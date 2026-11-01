-- Permanently delete a drink that has never been ordered (typos, test drinks),
-- owner's decision. A drink that has been ordered can only be archived, so past
-- orders and VAT records stay complete. Test orders count as orders: delete them
-- first (Venue settings -> Test orders).
begin;

create function public.admin_delete_drink(p_drink_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if not public.is_manager() then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  select name into v_name from public.drinks where id = p_drink_id for update;
  if not found then
    raise exception 'drink_not_found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.order_items i
      join public.orders o on o.id = i.order_id
     where (i.drink_id = p_drink_id
            or i.variant_id in (select id from public.drink_variants where drink_id = p_drink_id))
       and o.payment_provider is distinct from 'test'
  ) then
    raise exception 'drink_has_orders' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.order_items i
     where i.drink_id = p_drink_id
        or i.variant_id in (select id from public.drink_variants where drink_id = p_drink_id)
  ) then
    raise exception 'drink_in_test_orders' using errcode = 'P0001';
  end if;

  -- Its mixer choice (if any) is archived, not deleted: past orders may name it.
  update public.modifier_options set archived_at = coalesce(archived_at, now()), available = false
   where linked_drink_id = p_drink_id;
  delete from public.drink_variants where drink_id = p_drink_id;
  delete from public.drinks where id = p_drink_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'delete', 'drink', p_drink_id::text, jsonb_build_object('name', v_name));
  return v_name;
end;
$$;

revoke all on function public.admin_delete_drink(uuid) from public, anon;
grant execute on function public.admin_delete_drink(uuid) to authenticated;

commit;
