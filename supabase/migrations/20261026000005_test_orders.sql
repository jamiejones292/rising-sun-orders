-- =============================================================================
-- Test orders: try the whole journey (customer tablet -> bar iPad -> tracking)
-- before a payment provider is connected.
--   * Only works while the owner has switched test mode on in Venue settings,
--     and it switches itself off after the time set (2 hours from the button).
--   * The database works out every price itself from the current menu and
--     checks stock, table, age declaration and minimum order, exactly as the
--     real payment step will. The browser only says what was chosen.
--   * Test orders are marked "TEST ORDER (not paid)" and can be deleted in one go.
-- =============================================================================

begin;

alter table public.venue_settings
  add column test_orders_until timestamptz;

-- p_order (JSON):
--   table          "12"
--   age_confirmed  true/false
--   email          optional
--   lines          [{ drink_id, variant_id, options: { group_id: option_id }, no_ice, quantity }]
-- Returns { order_number, tracking_token }.
create function public.place_test_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings  public.venue_settings;
  v_table     public.venue_tables;
  v_line      jsonb;
  v_drink     record;
  v_variant   public.drink_variants;
  v_group     record;
  v_option    public.modifier_options;
  v_chosen    uuid;
  v_qty       integer;
  v_unit      integer;
  v_total     integer := 0;
  v_vat       integer := 0;
  v_alcohol   boolean := false;
  v_lines     jsonb := '[]'::jsonb;
  v_extras    jsonb;
  v_email     text := nullif(trim(p_order ->> 'email'), '');
  v_order     public.orders;
  v_item_id   uuid;
  v_idx       integer := 0;
  v_computed  jsonb;
begin
  select * into v_settings from public.venue_settings where id = 1;
  if v_settings.test_orders_until is null or v_settings.test_orders_until < now() then
    raise exception 'test_mode_off' using errcode = 'P0001';
  end if;
  if v_settings.ordering_paused then
    raise exception 'ordering_paused' using errcode = 'P0001';
  end if;

  select * into v_table from public.venue_tables where label = trim(p_order ->> 'table') and active;
  if not found then
    raise exception 'table_not_found' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception 'bad_email' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_order -> 'lines') <> 'array' or jsonb_array_length(p_order -> 'lines') = 0 then
    raise exception 'empty_basket' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_order -> 'lines') > 30 then
    raise exception 'too_many_lines' using errcode = 'P0001';
  end if;

  -- Price every line from the database.
  for v_line in select value from jsonb_array_elements(p_order -> 'lines') loop
    v_qty := (v_line ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'bad_quantity' using errcode = 'P0001';
    end if;

    select d.* into v_drink
    from public.drinks d join public.categories c on c.id = d.category_id
    where d.id = (v_line ->> 'drink_id')::uuid and d.available and d.archived_at is null and c.visible;
    if not found then
      raise exception 'drink_unavailable' using errcode = 'P0001';
    end if;

    select * into v_variant from public.drink_variants
    where id = (v_line ->> 'variant_id')::uuid and drink_id = v_drink.id and available and archived_at is null;
    if not found then
      raise exception 'size_unavailable' using errcode = 'P0001';
    end if;

    v_unit := v_variant.price_pence;
    v_extras := '[]'::jsonb;
    for v_group in
      select g.id, g.name, g.required
      from public.drink_modifier_groups dmg join public.modifier_groups g on g.id = dmg.group_id
      where dmg.drink_id = v_drink.id
    loop
      v_chosen := nullif(v_line -> 'options' ->> v_group.id::text, '')::uuid;
      if v_chosen is null then
        if v_group.required then
          raise exception 'choice_required' using errcode = 'P0001';
        end if;
        continue;
      end if;
      select * into v_option from public.modifier_options
      where id = v_chosen and group_id = v_group.id and available and archived_at is null;
      if not found then
        raise exception 'option_unavailable' using errcode = 'P0001';
      end if;
      v_unit := v_unit + v_option.price_pence;
      v_extras := v_extras || jsonb_build_object('option_id', v_option.id, 'group_name', v_group.name,
                                                 'option_label', v_option.label, 'price_pence', v_option.price_pence);
    end loop;

    v_alcohol := v_alcohol or v_drink.contains_alcohol;
    v_total := v_total + v_unit * v_qty;
    v_vat := v_vat + round((v_unit * v_qty) * v_drink.vat_rate / (100 + v_drink.vat_rate));
    v_lines := v_lines || jsonb_build_object(
      'drink_id', v_drink.id, 'variant_id', v_variant.id, 'drink_name', v_drink.name,
      'variant_label', v_variant.label, 'quantity', v_qty, 'unit', v_unit, 'vat_rate', v_drink.vat_rate,
      'no_ice', v_drink.offers_no_ice and coalesce((v_line ->> 'no_ice')::boolean, false),
      'extras', v_extras);
  end loop;

  if v_alcohol and not coalesce((p_order ->> 'age_confirmed')::boolean, false) then
    raise exception 'age_not_confirmed' using errcode = 'P0001';
  end if;
  if v_total < v_settings.minimum_order_pence then
    raise exception 'below_minimum' using errcode = 'P0001';
  end if;

  insert into public.orders (table_id, table_label, total_pence, vat_pence, payment_status, paid_at,
                             payment_provider, payment_method_label, customer_email, age_declared)
  values (v_table.id, v_table.label, v_total, v_vat, 'paid', now(),
          'test', 'TEST ORDER (not paid)', v_email, v_alcohol)
  returning * into v_order;

  for v_computed in select value from jsonb_array_elements(v_lines) loop
    v_idx := v_idx + 1;
    insert into public.order_items (order_id, drink_id, variant_id, drink_name, variant_label, quantity,
                                    unit_price_pence, vat_rate, line_total_pence, no_ice, sort_order)
    values (v_order.id, (v_computed ->> 'drink_id')::uuid, (v_computed ->> 'variant_id')::uuid,
            v_computed ->> 'drink_name', v_computed ->> 'variant_label', (v_computed ->> 'quantity')::smallint,
            (v_computed ->> 'unit')::integer, (v_computed ->> 'vat_rate')::numeric,
            (v_computed ->> 'unit')::integer * (v_computed ->> 'quantity')::integer,
            (v_computed ->> 'no_ice')::boolean, v_idx)
    returning id into v_item_id;
    insert into public.order_item_options (order_item_id, option_id, group_name, option_label, price_pence)
    select v_item_id, (x ->> 'option_id')::uuid, x ->> 'group_name', x ->> 'option_label', (x ->> 'price_pence')::integer
    from jsonb_array_elements(v_computed -> 'extras') as x;
  end loop;

  insert into public.order_status_history (order_id, from_status, to_status, note)
  values (v_order.id, null, 'new', 'Test order placed');

  return jsonb_build_object('order_number', v_order.order_number, 'tracking_token', v_order.tracking_token);
end;
$$;

-- Owner clears out test orders after a test session.
create function public.admin_delete_test_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  delete from public.orders where payment_provider = 'test';
  get diagnostics v_count = row_count;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'delete_test_orders', 'orders', null, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

revoke execute on function public.place_test_order(jsonb), public.admin_delete_test_orders() from public;
grant execute on function public.place_test_order(jsonb) to anon, authenticated, service_role;
grant execute on function public.admin_delete_test_orders() to authenticated, service_role;

commit;
