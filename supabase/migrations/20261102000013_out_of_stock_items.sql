-- "An item is out of stock" from the bar screen: the chosen drinks are marked
-- out of stock on the order (so they don't need ticking to finish it) and the
-- whole drink is switched off on the menu straight away (its mixer follows,
-- migration 009). Bar staff can do this whatever the "bar staff can switch
-- stock" setting says: it's a report of what's happened, and a manager switches
-- the drink back on when it's restocked.
begin;

alter table public.order_items
  add column out_of_stock boolean not null default false;

create function public.staff_report_out_of_stock(p_order_id uuid, p_item_ids uuid[])
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
     or (select count(*) from public.order_items where order_id = p_order_id and id = any (p_item_ids))
        <> (select count(distinct x) from unnest(p_item_ids) x) then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;

  update public.order_items set out_of_stock = true, ticked = false, ticked_at = null, ticked_by = null
   where order_id = p_order_id and id = any (p_item_ids);

  select left('Out of stock: ' || string_agg(quantity || ' × ' || drink_name || ' (' || variant_label || ')', ', ' order by sort_order), 200),
         array_agg(distinct drink_id) filter (where drink_id is not null)
    into v_reason, v_drinks
    from public.order_items where order_id = p_order_id and out_of_stock;

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

revoke all on function public.staff_report_out_of_stock(uuid, uuid[]) from public, anon;
grant execute on function public.staff_report_out_of_stock(uuid, uuid[]) to authenticated;

-- ORDER FULFILLED no longer needs out-of-stock drinks ticked.
create or replace function public.staff_fulfil_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_from  public.fulfilment_status;
begin
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.fulfilment_status = 'delivered' then
    raise exception 'already_fulfilled' using errcode = 'P0001';
  end if;
  if v_order.payment_status <> 'paid' or v_order.fulfilment_status = 'cancelled' then
    raise exception 'order_not_open' using errcode = 'P0001';
  end if;
  -- Drinks reported out of stock don't need ticking, but something must be served.
  if exists (select 1 from public.order_items where order_id = p_order_id and not ticked and not out_of_stock) then
    raise exception 'items_not_ticked' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.order_items where order_id = p_order_id and ticked) then
    raise exception 'nothing_to_fulfil' using errcode = 'P0001';
  end if;

  v_from := v_order.fulfilment_status;

  update public.orders
  set fulfilment_status = 'delivered', delivered_at = now(), fulfilled_by = auth.uid(),
      version = version + 1
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, v_from, 'delivered', auth.uid());

  return v_order;
end;
$$;

-- The order page marks drinks that were out of stock.
create or replace function public.get_order_tracking(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number',      o.order_number,
    'table',             o.table_label,
    'total_pence',       o.total_pence,
    'payment_status',    o.payment_status,
    'fulfilment_status', o.fulfilment_status,
    'paid_at',           o.paid_at,
    'preparing_at',      o.preparing_at,
    'delivered_at',      o.delivered_at,
    'receipt_email_set', o.customer_email is not null,
    'receipt_email',     case when o.customer_email is not null then
                           left(o.customer_email, 1) || '•••@' || split_part(o.customer_email, '@', 2) end,
    'receipt_sent',      o.receipt_sent_at is not null,
    'receipt_failed',    o.receipt_error is not null,
    'receipts_left',     3 - o.receipt_send_count,
    'refunded_pence',    o.refunded_pence,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.drink_name, 'size', i.variant_label, 'quantity', i.quantity,
        'line_total_pence', i.line_total_pence, 'no_ice', i.no_ice, 'out_of_stock', i.out_of_stock,
        'extras', coalesce((select jsonb_agg(x.option_label order by x.option_label)
                            from public.order_item_options x where x.order_item_id = i.id), '[]'::jsonb)
      ) order by i.sort_order)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.tracking_token = p_token
    and length(p_token) = 64
$$;

commit;
