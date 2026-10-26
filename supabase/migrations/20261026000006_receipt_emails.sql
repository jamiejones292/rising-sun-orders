-- Email receipts.
-- The send-receipt server function (Netlify) asks the database for an order's
-- receipt with claim_receipt, sends it through the email service, and reports
-- a failure with receipt_failed. Customers can add or change their receipt
-- address on the order page with set_receipt_email. Each order can send at
-- most 3 receipts, so the page can't be used to send spam.
begin;

alter table public.orders
  add column receipt_send_count smallint not null default 0 check (receipt_send_count between 0 and 3);

alter table public.venue_settings
  add column venue_address text;   -- printed at the foot of receipts

-- Customer adds (or changes) the receipt address for a paid order.
create function public.set_receipt_email(p_token text, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := btrim(coalesce(p_email, ''));
  v_order public.orders;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' or length(v_email) > 254 then
    raise exception 'bad_email';
  end if;
  select * into v_order from public.orders
  where tracking_token = p_token and length(p_token) = 64
  for update;
  if not found or v_order.payment_status <> 'paid' then
    raise exception 'order_not_found';
  end if;
  if v_order.created_at < now() - interval '7 days' then
    raise exception 'order_too_old';
  end if;
  if v_order.receipt_send_count >= 3 then
    raise exception 'too_many_receipts';
  end if;
  update public.orders
     set customer_email = v_email, receipt_sent_at = null, receipt_error = null
   where id = v_order.id;
end;
$$;

-- Server only: marks the receipt as being sent and returns everything the
-- email needs, or null if there's nothing to send (no address, already sent,
-- not paid, or the limit reached). Two calls at once can't both send.
create function public.claim_receipt(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_settings public.venue_settings;
begin
  update public.orders
     set receipt_sent_at = now(), receipt_send_count = receipt_send_count + 1, receipt_error = null
   where tracking_token = p_token and length(p_token) = 64
     and customer_email is not null and receipt_sent_at is null
     and receipt_send_count < 3 and payment_status = 'paid'
  returning * into v_order;
  if not found then
    return null;
  end if;
  select * into v_settings from public.venue_settings where id = 1;
  return jsonb_build_object(
    'order_number',   v_order.order_number,
    'email',          v_order.customer_email,
    'table',          v_order.table_label,
    'total_pence',    v_order.total_pence,
    'vat_pence',      v_order.vat_pence,
    'paid_at',        v_order.paid_at,
    'payment_method', v_order.payment_method_label,
    'test',           v_order.payment_provider = 'test',
    'tracking_token', v_order.tracking_token,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.drink_name, 'size', i.variant_label, 'quantity', i.quantity,
        'unit_price_pence', i.unit_price_pence, 'line_total_pence', i.line_total_pence,
        'vat_rate', i.vat_rate, 'no_ice', i.no_ice,
        'extras', coalesce((select jsonb_agg(jsonb_build_object('label', x.option_label, 'price_pence', x.price_pence) order by x.option_label)
                            from public.order_item_options x where x.order_item_id = i.id), '[]'::jsonb)
      ) order by i.sort_order)
      from public.order_items i where i.order_id = v_order.id
    ), '[]'::jsonb),
    'venue', jsonb_build_object(
      'name',           v_settings.venue_name,
      'address',        v_settings.venue_address,
      'vat_registered', v_settings.vat_registered,
      'vat_number',     v_settings.vat_number,
      'sender_name',    v_settings.receipt_sender_name,
      'reply_to',       v_settings.receipt_reply_to
    )
  );
end;
$$;

-- Server only: the email service refused the receipt. The attempt doesn't
-- count towards the limit, and the customer can try again from the order page.
create function public.receipt_failed(p_token text, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.orders
     set receipt_sent_at = null, receipt_error = left(coalesce(p_error, 'unknown'), 500),
         receipt_send_count = greatest(receipt_send_count - 1, 0)
   where tracking_token = p_token and length(p_token) = 64;
$$;

-- The order page now also shows where the receipt went (partly hidden).
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

-- Supabase grants new functions to everyone by default, so take that back
-- explicitly: only the server (service_role) may claim or fail a receipt.
revoke all on function public.set_receipt_email(text, text) from public;
revoke all on function public.claim_receipt(text) from public, anon, authenticated;
revoke all on function public.receipt_failed(text, text) from public, anon, authenticated;
grant execute on function public.set_receipt_email(text, text) to anon, authenticated;
grant execute on function public.claim_receipt(text) to service_role;
grant execute on function public.receipt_failed(text, text) to service_role;

commit;
