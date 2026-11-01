-- Fixes from the full review (November 2026).
--  * Sales: takings include orders refunded since, so takings minus refunds is
--    right; drinks sold leave out refunded-in-full orders and out-of-stock drinks.
--  * A refunded order can't be reopened; only paid orders still waiting can
--    change table; an out-of-stock drink can't be ticked as served; clearing a
--    problem on a missing order says so.
--  * Test orders are limited to 20 a minute (they can be placed by anyone with
--    a preview phone while test mode is on).
begin;

create or replace function public.staff_set_item_ticked(p_item_id uuid, p_ticked boolean)
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

  select o.* into v_order
  from public.order_items i join public.orders o on o.id = i.order_id
  where i.id = p_item_id
  for update of o;

  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'order_not_paid' using errcode = 'P0001';
  end if;
  if v_order.fulfilment_status in ('delivered', 'cancelled') then
    raise exception 'order_closed' using errcode = 'P0001';
  end if;
  -- A drink reported out of stock isn't poured, so it can't be ticked as served.
  if p_ticked and exists (select 1 from public.order_items where id = p_item_id and out_of_stock) then
    raise exception 'item_out_of_stock' using errcode = 'P0001';
  end if;

  update public.order_items
  set ticked = p_ticked,
      ticked_at = case when p_ticked then now() end,
      ticked_by = case when p_ticked then auth.uid() end
  where id = p_item_id;

  if p_ticked and v_order.fulfilment_status = 'new' then
    update public.orders
    set fulfilment_status = 'preparing', preparing_at = now(), version = version + 1
    where id = v_order.id;
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (v_order.id, 'new', 'preparing', auth.uid());
  else
    update public.orders set version = version + 1 where id = v_order.id;
  end if;
end;
$$;

create or replace function public.staff_reopen_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.fulfilment_status;
begin
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  select fulfilment_status into v_status from public.orders where id = p_order_id for update;
  if v_status is distinct from 'delivered' then
    raise exception 'order_not_fulfilled' using errcode = 'P0001';
  end if;
  -- A refunded order stays finished: reopening it would leave it on no list.
  if exists (select 1 from public.orders where id = p_order_id and payment_status <> 'paid') then
    raise exception 'order_refunded' using errcode = 'P0001';
  end if;
  update public.orders
  set fulfilment_status = 'preparing', delivered_at = null, fulfilled_by = null,
      version = version + 1
  where id = p_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, 'delivered', 'preparing', auth.uid(), 'Reopened');
end;
$$;

create or replace function public.staff_change_table(p_order_id uuid, p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
  v_old   text;
begin
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  select label into v_label from public.venue_tables where id = p_table_id and active;
  if v_label is null then
    raise exception 'table_not_found' using errcode = 'P0002';
  end if;
  -- Only paid orders still waiting at the bar can move tables.
  select table_label into v_old from public.orders
   where id = p_order_id and payment_status = 'paid' and fulfilment_status in ('new', 'preparing', 'ready')
     for update;
  if v_old is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  update public.orders
  set table_id = p_table_id, table_label = v_label, version = version + 1
  where id = p_order_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'change_table', 'order', p_order_id::text,
          jsonb_build_object('from', v_old, 'to', v_label));
end;
$$;

create or replace function public.staff_clear_problem(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_manager() then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  update public.orders
  set problem_reason = null, problem_reported_at = null, problem_reported_by = null,
      version = version + 1
  where id = p_order_id;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'clear_problem', 'order', p_order_id::text, '{}');
end;
$$;

create or replace function public.admin_sales_stats(p_from timestamptz, p_to timestamptz, p_include_test boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_manager() then
    raise exception 'not_manager' using errcode = '42501';
  end if;

  -- o: every order paid in the period, including ones refunded since (gross
  -- takings; refunds are shown separately, by when they were made).
  -- i: drinks actually served: not in orders refunded in full, not out of stock.
  with o as (
    select id, total_pence, payment_status from public.orders
     where payment_status in ('paid', 'refunded') and paid_at >= p_from and paid_at < p_to
       and (p_include_test or payment_provider is distinct from 'test')
  ),
  i as (
    select it.* from public.order_items it join o on o.id = it.order_id
     where o.payment_status = 'paid' and not it.out_of_stock
  )
  select jsonb_build_object(
    'orders',         (select count(*) from o),
    'revenue_pence',  (select coalesce(sum(total_pence), 0) from o),
    'drinks',         (select coalesce(sum(quantity), 0) from i),
    'refunded_pence', (select coalesce(sum(r.amount_pence), 0)
                         from public.refunds r join public.orders x on x.id = r.order_id
                        where r.status = 'succeeded' and r.created_at >= p_from and r.created_at < p_to
                          and (p_include_test or x.payment_provider is distinct from 'test')),
    'items', coalesce((
      select jsonb_agg(t order by t.quantity desc, t.revenue_pence desc, t.name)
        from (select drink_name as name, variant_label as size,
                     sum(quantity)::integer as quantity, sum(line_total_pence)::integer as revenue_pence
                from i group by 1, 2) t
    ), '[]'::jsonb),
    'extras', coalesce((
      select jsonb_agg(t order by t.quantity desc, t.label)
        from (select x.group_name as list, x.option_label as label, sum(i.quantity)::integer as quantity
                from public.order_item_options x join i on i.id = x.order_item_id
               group by 1, 2) t
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create function public.limit_test_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_provider = 'test'
     and (select count(*) from public.orders
           where payment_provider = 'test' and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too_many_test_orders' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger orders_limit_test_orders
  before insert on public.orders
  for each row execute function public.limit_test_orders();

-- Supabase grants new functions to anon by default; take back what isn't needed.
revoke all on function public.admin_delete_test_orders() from anon;
revoke all on function public.limit_test_orders() from public, anon, authenticated;
revoke all on function public.sync_linked_options() from public, anon, authenticated;
revoke all on function public.linked_option_follows_drink() from public, anon, authenticated;

commit;
