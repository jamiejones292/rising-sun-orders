-- Fixes from the second full review (November 2026).
--  * Managers can close an order without serving it (everything out of stock,
--    can't find the table) so it doesn't sit on the bar screen for ever.
--  * Staff can undo an out-of-stock mark made by mistake.
--  * Out-of-stock reports no longer accept empty items or wipe another problem.
--  * Only orders finished in the last 12 hours can be reopened.
--  * A mixer linked to a drink can't be switched on while the drink is off.
--  * The hidden "Mixers" category can't be shown on the menu.
--  * Test-order limit counted under a lock; anon can't write to tables directly.
--  * Managers can switch a whole category off/on, or set one size's price for a
--    whole category (e.g. every Single 25ml gin to £3.20), in one go.
begin;

-- Close without serving -------------------------------------------------------
create function public.staff_close_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_manager() then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 200 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.fulfilment_status in ('delivered', 'cancelled') then
    raise exception 'order_closed' using errcode = 'P0001';
  end if;
  update public.orders
     set fulfilment_status = 'cancelled', cancelled_at = now(),
         problem_reason = null, problem_reported_at = null, problem_reported_by = null,
         version = version + 1
   where id = p_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_order.fulfilment_status, 'cancelled', auth.uid(), left('Closed without serving: ' || trim(p_reason), 200));
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'close_order', 'order', p_order_id::text, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

-- Out of stock: build the problem text, keeping any other problem ---------------
create function public.out_of_stock_reason(p_order_id uuid, p_previous text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with oos as (
    select 'Out of stock: ' || string_agg(quantity || ' × ' || drink_name || ' (' || variant_label || ')', ', ' order by sort_order) as t
      from public.order_items where order_id = p_order_id and out_of_stock
  ), other as (
    -- Whatever was reported before that isn't the out-of-stock part.
    select nullif(trim(regexp_replace(coalesce(p_previous, ''), '(^| · )Out of stock: .*$', '')), '') as t
  )
  select nullif(left(concat_ws(' · ', other.t, oos.t), 200), '') from oos, other
$$;

create or replace function public.staff_report_out_of_stock(p_order_id uuid, p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  public.orders;
  v_reason text;
  v_drinks uuid[];
begin
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.payment_status <> 'paid' then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.fulfilment_status in ('delivered', 'cancelled') then
    raise exception 'order_closed' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_item_ids, 1), 0) = 0
     or array_position(p_item_ids, null) is not null
     or (select count(*) from public.order_items where order_id = p_order_id and id = any (p_item_ids))
        <> (select count(distinct x) from unnest(p_item_ids) x) then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;

  update public.order_items set out_of_stock = true, ticked = false, ticked_at = null, ticked_by = null
   where order_id = p_order_id and id = any (p_item_ids);

  v_reason := public.out_of_stock_reason(p_order_id, v_order.problem_reason);
  select array_agg(distinct drink_id) filter (where drink_id is not null) into v_drinks
    from public.order_items where order_id = p_order_id and id = any (p_item_ids);

  update public.orders
     set problem_reason = v_reason, problem_reported_at = now(), problem_reported_by = auth.uid(),
         version = version + 1
   where id = p_order_id;

  update public.drinks set available = false
   where id = any (v_drinks) and available and archived_at is null;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'report_out_of_stock', 'order', p_order_id::text,
          jsonb_build_object('reason', v_reason, 'drinks_switched_off', to_jsonb(v_drinks)));
end;
$$;

-- Undo a mistaken out-of-stock mark on an order (the drink stays switched off on
-- the menu; a manager switches it back on if it was a mistake there too).
create function public.staff_undo_out_of_stock(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  select o.* into v_order from public.order_items i join public.orders o on o.id = i.order_id
   where i.id = p_item_id and i.out_of_stock for update of o;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if v_order.fulfilment_status in ('delivered', 'cancelled') then
    raise exception 'order_closed' using errcode = 'P0001';
  end if;
  update public.order_items set out_of_stock = false where id = p_item_id;
  update public.orders
     set problem_reason = public.out_of_stock_reason(v_order.id, v_order.problem_reason),
         version = version + 1
   where id = v_order.id;
  update public.orders set problem_reported_at = null, problem_reported_by = null
   where id = v_order.id and problem_reason is null;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'undo_out_of_stock', 'order_item', p_item_id::text, '{}');
end;
$$;

-- Reopen: only orders finished in the last 12 hours (Undo and "Fulfilled today").
create or replace function public.staff_reopen_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.fulfilment_status is distinct from 'delivered' then
    raise exception 'order_not_fulfilled' using errcode = 'P0001';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'order_refunded' using errcode = 'P0001';
  end if;
  if v_order.delivered_at < now() - interval '12 hours' then
    raise exception 'order_too_old' using errcode = 'P0001';
  end if;
  update public.orders
  set fulfilment_status = 'preparing', delivered_at = null, fulfilled_by = null,
      version = version + 1
  where id = p_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, 'delivered', 'preparing', auth.uid(), 'Reopened');
end;
$$;

-- A linked mixer always follows its drink, even if someone edits it directly.
create or replace function public.linked_option_follows_drink()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.linked_drink_id is not null then
    select d.available and d.archived_at is null into new.available
      from public.drinks d where d.id = new.linked_drink_id;
  end if;
  return new;
end;
$$;
drop trigger modifier_options_follow_drink on public.modifier_options;
create trigger modifier_options_follow_drink
  before insert or update of linked_drink_id, available on public.modifier_options
  for each row execute function public.linked_option_follows_drink();

-- The mixer-only category stays hidden.
create function public.keep_mixers_category_hidden()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(trim(new.name)) = 'mixers' and new.visible then
    raise exception 'mixers_category_hidden' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger categories_keep_mixers_hidden
  before insert or update of name, visible on public.categories
  for each row execute function public.keep_mixers_category_hidden();

-- Test-order limit: count under a lock so simultaneous orders can't slip past.
create or replace function public.limit_test_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_provider = 'test' then
    perform pg_advisory_xact_lock(hashtext('limit_test_orders'));
    if (select count(*) from public.orders
         where payment_provider = 'test' and created_at > now() - interval '1 minute') >= 20 then
      raise exception 'too_many_test_orders' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Bulk changes for managers ----------------------------------------------------
create function public.admin_set_category_available(p_category_id uuid, p_available boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_manager() then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  update public.drinks set available = p_available
   where category_id = p_category_id and archived_at is null and available is distinct from p_available;
  get diagnostics v_count = row_count;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_category_available', 'category', p_category_id::text,
          jsonb_build_object('available', p_available, 'drinks', v_count));
  return v_count;
end;
$$;

create function public.admin_set_category_size_price(p_category_id uuid, p_label text, p_price_pence integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_manager() then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  if p_price_pence is null or p_price_pence <= 0 or p_price_pence > 100000 then
    raise exception 'bad_price' using errcode = '22023';
  end if;
  update public.drink_variants v set price_pence = p_price_pence
    from public.drinks d
   where v.drink_id = d.id and d.category_id = p_category_id and d.archived_at is null
     and v.archived_at is null and v.label = p_label and v.price_pence <> p_price_pence;
  get diagnostics v_count = row_count;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_category_price', 'category', p_category_id::text,
          jsonb_build_object('size', p_label, 'price_pence', p_price_pence, 'sizes', v_count));
  return v_count;
end;
$$;

-- Permissions --------------------------------------------------------------
revoke all on function public.staff_close_order(uuid, text) from public, anon;
revoke all on function public.staff_undo_out_of_stock(uuid) from public, anon;
revoke all on function public.out_of_stock_reason(uuid, text) from public, anon, authenticated;
revoke all on function public.keep_mixers_category_hidden() from public, anon, authenticated;
revoke all on function public.admin_set_category_available(uuid, boolean) from public, anon;
revoke all on function public.admin_set_category_size_price(uuid, text, integer) from public, anon;
grant execute on function public.staff_close_order(uuid, text) to authenticated;
grant execute on function public.staff_undo_out_of_stock(uuid) to authenticated;
grant execute on function public.admin_set_category_available(uuid, boolean) to authenticated;
grant execute on function public.admin_set_category_size_price(uuid, text, integer) to authenticated;

-- Customers (anon) only ever read tables and call functions; never write directly.
revoke insert, update, delete, truncate on all tables in schema public from anon;

commit;
