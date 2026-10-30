-- Forget receipt email addresses once they're older than
-- venue_settings.email_retention_days (90 by default), as the privacy notice
-- promises. Run daily by netlify/functions/forget-old-emails.ts.
begin;

create function public.forget_old_receipt_emails()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days    integer := (select email_retention_days from public.venue_settings where id = 1);
  v_cleared integer;
begin
  update public.orders
     set customer_email = null, receipt_error = null
   where customer_email is not null
     and coalesce(paid_at, created_at) < now() - make_interval(days => v_days);
  get diagnostics v_cleared = row_count;
  return v_cleared;
end;
$$;

-- Only the server may run it.
revoke all on function public.forget_old_receipt_emails() from public, anon, authenticated;
grant execute on function public.forget_old_receipt_emails() to service_role;

commit;
