-- Practice refunds on test orders, from the bar screen's admin section. Real
-- card refunds will go through the payment provider (a server function) once
-- payments are set up; until then this refuses anything but a test order.
--
-- A partial refund leaves payment_status 'paid' (refunded_pence shows how much
-- came back) so the order stays on the bar screen and keeps working as normal.
-- A full refund sets 'refunded' and, if the drinks haven't gone out, cancels
-- the order so it leaves the bar screen.
begin;

create function public.staff_refund_order(p_order_id uuid, p_amount_pence integer, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  public.orders;
  v_full   boolean;
  v_cancel boolean;
  v_from   public.fulfilment_status;
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
  if v_order.payment_provider is distinct from 'test' then
    raise exception 'refunds_not_live' using errcode = 'P0001';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'already_refunded' using errcode = 'P0001';
  end if;
  if p_amount_pence is null or p_amount_pence <= 0
     or p_amount_pence > v_order.total_pence - v_order.refunded_pence then
    raise exception 'bad_refund_amount' using errcode = '22023';
  end if;

  v_from := v_order.fulfilment_status;
  v_full := v_order.refunded_pence + p_amount_pence = v_order.total_pence;
  v_cancel := v_full and v_order.fulfilment_status not in ('delivered', 'cancelled');

  insert into public.refunds (order_id, amount_pence, reason, status, provider, requested_by, completed_at)
  values (p_order_id, p_amount_pence, trim(p_reason), 'succeeded', 'test', auth.uid(), now());

  update public.orders
     set refunded_pence    = refunded_pence + p_amount_pence,
         payment_status    = case when v_full then 'refunded'::public.payment_status else payment_status end,
         fulfilment_status = case when v_cancel then 'cancelled'::public.fulfilment_status else fulfilment_status end,
         cancelled_at      = case when v_cancel then now() else cancelled_at end,
         version           = version + 1
   where id = p_order_id
  returning * into v_order;

  if v_cancel then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
    values (p_order_id, v_from, 'cancelled', auth.uid(), 'Refunded in full');
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'refund', 'order', p_order_id::text,
          jsonb_build_object('amount_pence', p_amount_pence, 'reason', trim(p_reason), 'test', true));
  return v_order;
end;
$$;

revoke all on function public.staff_refund_order(uuid, integer, text) from public, anon;
grant execute on function public.staff_refund_order(uuid, integer, text) to authenticated;

-- Deleting test orders also deletes their practice refunds.
create or replace function public.admin_delete_test_orders()
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
  delete from public.refunds where order_id in (select id from public.orders where payment_provider = 'test');
  delete from public.orders where payment_provider = 'test';
  get diagnostics v_count = row_count;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'delete_test_orders', 'orders', null, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

-- The order page shows how much has been refunded.
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
        'line_total_pence', i.line_total_pence, 'no_ice', i.no_ice,
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
