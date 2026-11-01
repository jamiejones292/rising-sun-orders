-- Sales figures for the admin Sales page, added up in the database so the page
-- stays quick however many orders there are. Managers only.
--
-- Counts paid orders by when they were paid (part-refunded orders still count;
-- orders refunded in full don't). Refunds are counted by when they were made.
-- Test orders are left out unless asked for.
begin;

create function public.admin_sales_stats(p_from timestamptz, p_to timestamptz, p_include_test boolean default false)
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

  with o as (
    select id, total_pence from public.orders
     where payment_status = 'paid' and paid_at >= p_from and paid_at < p_to
       and (p_include_test or payment_provider is distinct from 'test')
  ),
  i as (
    select it.* from public.order_items it join o on o.id = it.order_id
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

revoke all on function public.admin_sales_stats(timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.admin_sales_stats(timestamptz, timestamptz, boolean) to authenticated;

commit;
