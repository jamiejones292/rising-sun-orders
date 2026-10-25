-- =============================================================================
-- Admin saves that touch several rows at once, done in one step so a dropped
-- connection can never leave a drink half-saved.
--   admin_save_drink           drink + its sizes + its extras, add or edit
--   admin_reorder_categories   new menu order for categories
--   admin_save_opening_hours   all seven days at once
-- =============================================================================

begin;

-- p_drink (JSON):
--   id (omit for a new drink), category_id, name, description, abv,
--   contains_alcohol, is_welsh, offers_no_ice, allergens [text],
--   vat_rate, available,
--   variants [{ id (omit if new), label, price_pence, available }]  in menu order
--   modifier_group_ids [uuid]
-- Sizes left out of the list are archived (kept for past orders), not deleted.
create function public.admin_save_drink(p_drink jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := nullif(p_drink ->> 'id', '')::uuid;
  v_category uuid := (p_drink ->> 'category_id')::uuid;
  v_variant  jsonb;
  v_idx      integer := 0;
  v_keep     uuid[] := '{}';
  v_vid      uuid;
  v_groups   uuid[] := coalesce(
               (select array_agg(value::uuid) from jsonb_array_elements_text(p_drink -> 'modifier_group_ids')),
               '{}');
begin
  if not public.is_manager() then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_drink -> 'variants', '[]'::jsonb)) = 0 then
    raise exception 'needs_a_size' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.drinks (category_id, name, description, abv, contains_alcohol, is_welsh,
                               offers_no_ice, allergens, vat_rate, available, sort_order)
    values (
      v_category,
      trim(p_drink ->> 'name'),
      coalesce(trim(p_drink ->> 'description'), ''),
      nullif(p_drink ->> 'abv', '')::numeric,
      coalesce((p_drink ->> 'contains_alcohol')::boolean, true),
      coalesce((p_drink ->> 'is_welsh')::boolean, false),
      coalesce((p_drink ->> 'offers_no_ice')::boolean, false),
      coalesce((select array_agg(value) from jsonb_array_elements_text(p_drink -> 'allergens')), '{}'),
      coalesce((p_drink ->> 'vat_rate')::numeric, 20),
      coalesce((p_drink ->> 'available')::boolean, true),
      coalesce((select max(sort_order) + 10 from public.drinks where category_id = v_category), 10)
    )
    returning id into v_id;
  else
    update public.drinks set
      category_id      = v_category,
      name             = trim(p_drink ->> 'name'),
      description      = coalesce(trim(p_drink ->> 'description'), ''),
      abv              = nullif(p_drink ->> 'abv', '')::numeric,
      contains_alcohol = coalesce((p_drink ->> 'contains_alcohol')::boolean, true),
      is_welsh         = coalesce((p_drink ->> 'is_welsh')::boolean, false),
      offers_no_ice    = coalesce((p_drink ->> 'offers_no_ice')::boolean, false),
      allergens        = coalesce((select array_agg(value) from jsonb_array_elements_text(p_drink -> 'allergens')), '{}'),
      vat_rate         = coalesce((p_drink ->> 'vat_rate')::numeric, 20),
      available        = coalesce((p_drink ->> 'available')::boolean, true)
    where id = v_id;
    if not found then
      raise exception 'drink_not_found' using errcode = 'P0002';
    end if;
  end if;

  -- Sizes, in the order given.
  for v_variant in select value from jsonb_array_elements(p_drink -> 'variants') loop
    v_idx := v_idx + 1;
    v_vid := nullif(v_variant ->> 'id', '')::uuid;
    if v_vid is not null then
      update public.drink_variants set
        label       = trim(v_variant ->> 'label'),
        price_pence = (v_variant ->> 'price_pence')::integer,
        available   = coalesce((v_variant ->> 'available')::boolean, true),
        sort_order  = v_idx * 10,
        archived_at = null
      where id = v_vid and drink_id = v_id;
      if not found then
        raise exception 'size_not_found' using errcode = 'P0002';
      end if;
    else
      insert into public.drink_variants (drink_id, label, price_pence, available, sort_order)
      values (v_id, trim(v_variant ->> 'label'), (v_variant ->> 'price_pence')::integer,
              coalesce((v_variant ->> 'available')::boolean, true), v_idx * 10)
      returning id into v_vid;
    end if;
    v_keep := v_keep || v_vid;
  end loop;

  update public.drink_variants set archived_at = now()
  where drink_id = v_id and archived_at is null and not (id = any (v_keep));

  -- Extras groups.
  delete from public.drink_modifier_groups
  where drink_id = v_id and not (group_id = any (v_groups));
  insert into public.drink_modifier_groups (drink_id, group_id)
  select v_id, g from unnest(v_groups) as g
  on conflict do nothing;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), case when p_drink ? 'id' and p_drink ->> 'id' <> '' then 'edit_drink' else 'add_drink' end,
          'drink', v_id::text, jsonb_build_object('name', p_drink ->> 'name'));

  return v_id;
end;
$$;

create function public.admin_reorder_categories(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_manager() then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  update public.categories c
  set sort_order = o.ord * 10
  from unnest(p_ids) with ordinality as o(id, ord)
  where c.id = o.id;
end;
$$;

-- p_hours: [{ weekday 1-7, opens_at "HH:MM", closes_at "HH:MM", closed }]
create function public.admin_save_opening_hours(p_hours jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  insert into public.opening_hours (weekday, opens_at, closes_at, closed)
  select (h ->> 'weekday')::smallint, (h ->> 'opens_at')::time, (h ->> 'closes_at')::time,
         coalesce((h ->> 'closed')::boolean, false)
  from jsonb_array_elements(p_hours) as h
  on conflict (weekday) do update
    set opens_at = excluded.opens_at, closes_at = excluded.closes_at, closed = excluded.closed;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'save_opening_hours', 'opening_hours', null, p_hours);
end;
$$;

revoke execute on function public.admin_save_drink(jsonb), public.admin_reorder_categories(uuid[]),
  public.admin_save_opening_hours(jsonb) from public, anon;
grant execute on function public.admin_save_drink(jsonb), public.admin_reorder_categories(uuid[]),
  public.admin_save_opening_hours(jsonb) to authenticated, service_role;

commit;
