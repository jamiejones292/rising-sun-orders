-- =============================================================================
-- "Problem with this order" from the bar screen.
-- Bar staff flag an order (out of stock, refusing service, can't find the
-- table). The order stays on the bar screen marked with the problem, and a
-- manager sorts it out (refund, change table) and clears the flag.
-- =============================================================================

begin;

alter table public.orders
  add column problem_reason      text check (problem_reason is null or length(problem_reason) between 1 and 200),
  add column problem_reported_at timestamptz,
  add column problem_reported_by uuid references auth.users (id) on delete set null;

create function public.staff_report_problem(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 200 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.orders
  set problem_reason = trim(p_reason), problem_reported_at = now(),
      problem_reported_by = auth.uid(), version = version + 1
  where id = p_order_id and payment_status = 'paid';
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'report_problem', 'order', p_order_id::text,
          jsonb_build_object('reason', trim(p_reason)));
end;
$$;

create function public.staff_clear_problem(p_order_id uuid)
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
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'clear_problem', 'order', p_order_id::text, '{}');
end;
$$;

revoke execute on function public.staff_report_problem(uuid, text), public.staff_clear_problem(uuid)
  from public, anon;
grant execute on function public.staff_report_problem(uuid, text), public.staff_clear_problem(uuid)
  to authenticated, service_role;

commit;
