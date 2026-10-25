-- =============================================================================
-- Rising Sun Inn drinks ordering: initial database schema
--
-- Plain-English summary
--   * Menu: categories -> drinks -> sizes (variants) + optional extras (mixers,
--     milk, serve) + a per-drink "No ice" option.
--   * Tables 1-25, each optionally in an area (areas come later).
--   * Orders copy each drink's name, size, price and VAT at the moment of sale,
--     so later menu changes never alter past orders or reports.
--   * Money is always whole pence. Payment status and bar progress are separate.
--   * Customers can read the menu but never orders. Staff see paid orders.
--     Order changes from the bar go through checked functions that keep a history.
--   * Anything involving payments is written only by the server (service role).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
begin;

create type public.staff_role as enum ('owner', 'manager', 'bar');

create type public.payment_status as enum (
  'pending',            -- checkout started, not confirmed by the provider yet
  'paid',               -- confirmed by the provider: the order goes to the bar
  'failed',             -- card declined or payment error
  'expired',            -- customer abandoned the payment page
  'partially_refunded',
  'refunded'
);

create type public.fulfilment_status as enum (
  'new',        -- paid, nobody has started it
  'preparing',  -- at least one drink ticked
  'ready',      -- reserved for an optional "ready" step
  'delivered',  -- ORDER FULFILLED tapped
  'cancelled'   -- refused or cancelled (refund handled separately)
);

create type public.refund_status as enum ('pending', 'succeeded', 'failed');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- -----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Staff
-- Each Supabase Auth user who works at the pub has one profile row.
-- Staff sign in with a staff ID (e.g. "gerwyn"); the app maps it to the
-- internal login email <staff_code>@staff.drinksorder.app.
-- Bar iPads share one bar-only account (is_device = true).
-- -----------------------------------------------------------------------------
create table public.staff_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  staff_code   text not null unique check (staff_code ~ '^[a-z0-9._-]{2,32}$'),
  display_name text not null check (length(display_name) between 1 and 80),
  role         public.staff_role not null default 'bar',
  is_device    boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger staff_profiles_updated_at before update on public.staff_profiles
  for each row execute function public.set_updated_at();

-- Role helpers used by the security rules. SECURITY DEFINER so they can read
-- staff_profiles without being blocked by its own rules.
create function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff_profiles
  where user_id = auth.uid() and active
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_staff_role() is not null
$$;

create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() in ('owner', 'manager'), false)
$$;

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() = 'owner', false)
$$;

-- -----------------------------------------------------------------------------
-- Venue settings (exactly one row, id = 1)
-- -----------------------------------------------------------------------------
create table public.venue_settings (
  id                          smallint primary key default 1 check (id = 1),
  venue_name                  text not null default 'The Rising Sun Inn',
  timezone                    text not null default 'Europe/London',
  ordering_paused             boolean not null default false,
  pause_message               text not null default 'Our bar team is catching up with orders. Please speak to a member of staff or try again shortly.',
  wait_amber_minutes          smallint not null default 5 check (wait_amber_minutes between 1 and 120),
  wait_red_minutes            smallint not null default 10 check (wait_red_minutes between 2 and 240),
  vat_registered              boolean not null default true,
  vat_number                  text,
  default_vat_rate            numeric(5,2) not null default 20.00 check (default_vat_rate between 0 and 100),
  age_declaration_text        text not null default 'I confirm everyone I''m ordering alcohol for is 18 or over. I understand staff may ask for ID and can refuse service, with a full refund.',
  bar_staff_can_toggle_stock  boolean not null default false,
  minimum_order_pence         integer not null default 0 check (minimum_order_pence >= 0),
  receipt_sender_name         text not null default 'The Rising Sun Inn',
  receipt_reply_to            text,
  email_retention_days        smallint not null default 90 check (email_retention_days between 1 and 3650),
  updated_at                  timestamptz not null default now(),
  constraint wait_thresholds_ordered check (wait_red_minutes > wait_amber_minutes)
);
create trigger venue_settings_updated_at before update on public.venue_settings
  for each row execute function public.set_updated_at();

-- Ordering hours per weekday (ISO: 1 = Monday ... 7 = Sunday).
-- closes_at earlier than opens_at means closing after midnight.
create table public.opening_hours (
  weekday   smallint primary key check (weekday between 1 and 7),
  opens_at  time not null,
  closes_at time not null,
  closed    boolean not null default false
);

-- -----------------------------------------------------------------------------
-- Tables (seating)
-- -----------------------------------------------------------------------------
create table public.table_areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(name) between 1 and 40),
  sort_order integer not null default 0,
  active     boolean not null default true
);

create table public.venue_tables (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique check (label ~ '^[A-Za-z0-9 -]{1,12}$'),
  area_id    uuid references public.table_areas (id) on delete set null,
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Menu
-- -----------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 60),
  sort_order integer not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.drinks (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references public.categories (id),
  name             text not null check (length(name) between 1 and 80),
  description      text not null default '' check (length(description) <= 300),
  abv              numeric(4,1) check (abv between 0 and 99.9),
  contains_alcohol boolean not null default true,
  is_welsh         boolean not null default false,
  offers_no_ice    boolean not null default false,
  -- The 14 UK allergens, stored by name.
  allergens        text[] not null default '{}' check (allergens <@ array[
                     'Celery','Cereals containing gluten','Crustaceans','Eggs','Fish','Lupin','Milk',
                     'Molluscs','Mustard','Tree nuts','Peanuts','Sesame','Soya','Sulphites']::text[]),
  image_path       text,
  vat_rate         numeric(5,2) not null default 20.00 check (vat_rate between 0 and 100),
  available        boolean not null default true,
  sort_order       integer not null default 0,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index drinks_category_idx on public.drinks (category_id, sort_order);
create trigger drinks_updated_at before update on public.drinks
  for each row execute function public.set_updated_at();

create table public.drink_variants (
  id          uuid primary key default gen_random_uuid(),
  drink_id    uuid not null references public.drinks (id),
  label       text not null check (length(label) between 1 and 40),
  price_pence integer not null check (price_pence > 0 and price_pence <= 100000),
  available   boolean not null default true,
  sort_order  integer not null default 0,
  archived_at timestamptz,
  updated_at  timestamptz not null default now()
);
create index drink_variants_drink_idx on public.drink_variants (drink_id, sort_order);
create trigger drink_variants_updated_at before update on public.drink_variants
  for each row execute function public.set_updated_at();

create table public.modifier_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 60),
  required   boolean not null default false,  -- customer must choose one
  sort_order integer not null default 0
);

create table public.modifier_options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.modifier_groups (id),
  label       text not null check (length(label) between 1 and 60),
  price_pence integer not null default 0 check (price_pence >= 0 and price_pence <= 100000),
  available   boolean not null default true,
  sort_order  integer not null default 0,
  archived_at timestamptz
);
create index modifier_options_group_idx on public.modifier_options (group_id, sort_order);

create table public.drink_modifier_groups (
  drink_id   uuid not null references public.drinks (id) on delete cascade,
  group_id   uuid not null references public.modifier_groups (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (drink_id, group_id)
);

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         bigint generated always as identity (start with 1001) unique,
  -- Unguessable code for the customer's tracking link (never the order number).
  tracking_token       text not null unique
                         default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  table_id             uuid not null references public.venue_tables (id),
  table_label          text not null,              -- copied at the time of ordering
  total_pence          integer not null check (total_pence > 0),
  vat_pence            integer not null default 0 check (vat_pence >= 0 and vat_pence <= total_pence),
  refunded_pence       integer not null default 0 check (refunded_pence >= 0 and refunded_pence <= total_pence),
  currency             text not null default 'GBP' check (currency = 'GBP'),
  payment_status       public.payment_status not null default 'pending',
  fulfilment_status    public.fulfilment_status not null default 'new',
  payment_provider     text,
  provider_checkout_id text unique,
  provider_payment_id  text unique,
  payment_method_label text,                        -- e.g. "Apple Pay (Visa 4242)"
  customer_email       text check (customer_email is null or customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  receipt_sent_at      timestamptz,
  receipt_error        text,
  age_declared         boolean not null default false,
  recovered            boolean not null default false, -- created by the reconciliation sweep
  paid_at              timestamptz,
  preparing_at         timestamptz,
  delivered_at         timestamptz,
  cancelled_at         timestamptz,
  fulfilled_by         uuid references auth.users (id) on delete set null,
  version              integer not null default 1,   -- bumped on every bar change
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index orders_bar_queue_idx on public.orders (paid_at)
  where payment_status = 'paid' and fulfilment_status in ('new', 'preparing', 'ready');
create index orders_created_idx on public.orders (created_at desc);
create index orders_table_idx on public.orders (table_label, created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  drink_id         uuid references public.drinks (id),
  variant_id       uuid references public.drink_variants (id),
  drink_name       text not null,
  variant_label    text not null,
  quantity         smallint not null check (quantity between 1 and 20),
  unit_price_pence integer not null check (unit_price_pence > 0), -- size + extras, each
  vat_rate         numeric(5,2) not null,
  line_total_pence integer not null check (line_total_pence = unit_price_pence * quantity),
  no_ice           boolean not null default false,
  ticked           boolean not null default false,
  ticked_at        timestamptz,
  ticked_by        uuid references auth.users (id) on delete set null,
  sort_order       smallint not null default 0
);
create index order_items_order_idx on public.order_items (order_id, sort_order);

create table public.order_item_options (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  option_id     uuid references public.modifier_options (id),
  group_name    text not null,
  option_label  text not null,
  price_pence   integer not null default 0 check (price_pence >= 0)
);
create index order_item_options_item_idx on public.order_item_options (order_item_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.fulfilment_status,
  to_status   public.fulfilment_status not null,
  changed_by  uuid references auth.users (id) on delete set null,
  note        text,
  changed_at  timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

-- -----------------------------------------------------------------------------
-- Payments and refunds (written by the server only)
-- -----------------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id),
  provider            text not null,
  provider_payment_id text not null,
  amount_pence        integer not null check (amount_pence > 0),
  fee_pence           integer check (fee_pence >= 0),
  status              text not null,
  created_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index payments_order_idx on public.payments (order_id);

create table public.refunds (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id),
  amount_pence       integer not null check (amount_pence > 0),
  reason             text not null check (length(reason) between 1 and 200),
  status             public.refund_status not null default 'pending',
  provider           text,
  provider_refund_id text unique,
  requested_by       uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);
create index refunds_order_idx on public.refunds (order_id);

-- Every message from the payment provider is recorded once. Processing a
-- message twice (providers retry) is prevented by the primary key.
create table public.payment_events (
  provider     text not null,
  event_id     text not null,
  event_type   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  primary key (provider, event_id)
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references auth.users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security: on for every table. With no matching policy, access is
-- denied. The server's service role bypasses these rules by design.
-- -----------------------------------------------------------------------------
alter table public.staff_profiles        enable row level security;
alter table public.venue_settings        enable row level security;
alter table public.opening_hours         enable row level security;
alter table public.table_areas           enable row level security;
alter table public.venue_tables          enable row level security;
alter table public.categories            enable row level security;
alter table public.drinks                enable row level security;
alter table public.drink_variants        enable row level security;
alter table public.modifier_groups       enable row level security;
alter table public.modifier_options      enable row level security;
alter table public.drink_modifier_groups enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_item_options    enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.payments              enable row level security;
alter table public.refunds               enable row level security;
alter table public.payment_events        enable row level security;
alter table public.audit_log             enable row level security;

-- Public menu and venue information: anyone can read what customers see.
create policy "Public can read venue settings" on public.venue_settings
  for select to anon, authenticated using (true);
create policy "Public can read opening hours" on public.opening_hours
  for select to anon, authenticated using (true);
create policy "Public can read active areas" on public.table_areas
  for select to anon, authenticated using (active or public.is_staff());
create policy "Public can read active tables" on public.venue_tables
  for select to anon, authenticated using (active or public.is_staff());
create policy "Public can read visible categories" on public.categories
  for select to anon, authenticated using (visible or public.is_staff());
create policy "Public can read current drinks" on public.drinks
  for select to anon, authenticated using (archived_at is null or public.is_staff());
create policy "Public can read current sizes" on public.drink_variants
  for select to anon, authenticated using (archived_at is null or public.is_staff());
create policy "Public can read extras groups" on public.modifier_groups
  for select to anon, authenticated using (true);
create policy "Public can read current extras" on public.modifier_options
  for select to anon, authenticated using (archived_at is null or public.is_staff());
create policy "Public can read drink extras" on public.drink_modifier_groups
  for select to anon, authenticated using (true);

-- Managers and the owner edit the menu, tables and settings. Nothing is ever
-- deleted through the app (drinks are archived), so there are no delete rules.
create policy "Managers add categories" on public.categories
  for insert to authenticated with check (public.is_manager());
create policy "Managers edit categories" on public.categories
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "Managers add drinks" on public.drinks
  for insert to authenticated with check (public.is_manager());
create policy "Managers edit drinks" on public.drinks
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "Managers add sizes" on public.drink_variants
  for insert to authenticated with check (public.is_manager());
create policy "Managers edit sizes" on public.drink_variants
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "Managers add extras groups" on public.modifier_groups
  for insert to authenticated with check (public.is_manager());
create policy "Managers edit extras groups" on public.modifier_groups
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "Managers add extras" on public.modifier_options
  for insert to authenticated with check (public.is_manager());
create policy "Managers edit extras" on public.modifier_options
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "Managers link drink extras" on public.drink_modifier_groups
  for insert to authenticated with check (public.is_manager());
create policy "Managers unlink drink extras" on public.drink_modifier_groups
  for delete to authenticated using (public.is_manager());

create policy "Owner adds areas" on public.table_areas
  for insert to authenticated with check (public.is_owner());
create policy "Owner edits areas" on public.table_areas
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "Owner adds tables" on public.venue_tables
  for insert to authenticated with check (public.is_owner());
create policy "Owner edits tables" on public.venue_tables
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "Owner edits venue settings" on public.venue_settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "Owner edits opening hours" on public.opening_hours
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Staff profiles: everyone sees their own; the owner sees and edits everyone.
-- New staff logins are created by the server (it needs the service role).
create policy "Staff read own profile" on public.staff_profiles
  for select to authenticated using (user_id = auth.uid() or public.is_owner());
create policy "Owner edits staff" on public.staff_profiles
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Orders: no customer access (customers use get_order_tracking). Bar staff see
-- paid orders; managers see everything including unpaid and failed attempts.
create policy "Staff read orders" on public.orders
  for select to authenticated using (
    public.is_manager()
    or (public.is_staff() and payment_status in ('paid', 'partially_refunded', 'refunded'))
  );
create policy "Staff read order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id)  -- inherits the orders rule
  );
create policy "Staff read order item extras" on public.order_item_options
  for select to authenticated using (
    exists (select 1 from public.order_items i where i.id = order_item_id)
  );
create policy "Staff read order history" on public.order_status_history
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id)
  );

create policy "Managers read payments" on public.payments
  for select to authenticated using (public.is_manager());
create policy "Managers read refunds" on public.refunds
  for select to authenticated using (public.is_manager());
create policy "Owner reads payment events" on public.payment_events
  for select to authenticated using (public.is_owner());
create policy "Managers read audit log" on public.audit_log
  for select to authenticated using (public.is_manager());

-- -----------------------------------------------------------------------------
-- Bar and admin actions. Each one checks who is calling, applies the change in
-- one step, records history, and bumps the order's version so screens refresh.
-- -----------------------------------------------------------------------------

-- Tick or untick one drink on an order. The first tick moves the order to
-- "preparing" (the customer's tracking page shows this).
create function public.staff_set_item_ticked(p_item_id uuid, p_ticked boolean)
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

-- ORDER FULFILLED. Only works when every drink is ticked. If two iPads tap at
-- once, the first wins and the second gets 'already_fulfilled'.
create function public.staff_fulfil_order(p_order_id uuid)
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
  if exists (select 1 from public.order_items where order_id = p_order_id and not ticked) then
    raise exception 'items_not_ticked' using errcode = 'P0001';
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

-- Undo / Reopen a fulfilled order (e.g. delivered to the wrong table).
create function public.staff_reopen_order(p_order_id uuid)
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
  update public.orders
  set fulfilment_status = 'preparing', delivered_at = null, fulfilled_by = null,
      version = version + 1
  where id = p_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, 'delivered', 'preparing', auth.uid(), 'Reopened');
end;
$$;

-- Move an order to the correct table when the customer picked the wrong one.
create function public.staff_change_table(p_order_id uuid, p_table_id uuid)
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
  select table_label into v_old from public.orders where id = p_order_id for update;
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

-- Pause or resume online ordering for every customer (managers and owner).
create function public.set_ordering_paused(p_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_manager() then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  update public.venue_settings set ordering_paused = p_paused where id = 1;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), case when p_paused then 'pause_ordering' else 'resume_ordering' end,
          'venue_settings', '1', '{}');
end;
$$;

-- Stock switches. Managers always can; bar staff only if the owner allows it.
create function public.can_toggle_stock()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager()
      or (public.is_staff()
          and (select bar_staff_can_toggle_stock from public.venue_settings where id = 1))
$$;

create function public.set_drink_available(p_drink_id uuid, p_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_toggle_stock() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.drinks set available = p_available where id = p_drink_id and archived_at is null;
  if not found then
    raise exception 'drink_not_found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_available', 'drink', p_drink_id::text,
          jsonb_build_object('available', p_available));
end;
$$;

create function public.set_variant_available(p_variant_id uuid, p_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_toggle_stock() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.drink_variants set available = p_available
  where id = p_variant_id and archived_at is null;
  if not found then
    raise exception 'variant_not_found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_available', 'drink_variant', p_variant_id::text,
          jsonb_build_object('available', p_available));
end;
$$;

-- Customer tracking page. Anyone with the secret link can see that order's
-- progress; nothing else. Unpaid orders report their payment state only.
create function public.get_order_tracking(p_token text)
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

-- -----------------------------------------------------------------------------
-- Permissions. New tables are not exposed automatically in this project, so
-- each role gets exactly what it needs. Row Level Security above then decides
-- which rows.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select on public.venue_settings, public.opening_hours, public.table_areas,
  public.venue_tables, public.categories, public.drinks, public.drink_variants,
  public.modifier_groups, public.modifier_options, public.drink_modifier_groups
  to anon, authenticated;

grant insert, update on public.categories, public.drinks, public.drink_variants,
  public.modifier_groups, public.modifier_options, public.table_areas,
  public.venue_tables to authenticated;
grant delete on public.drink_modifier_groups to authenticated;
grant insert on public.drink_modifier_groups to authenticated;
grant update on public.venue_settings, public.opening_hours to authenticated;
grant select, update on public.staff_profiles to authenticated;
grant select on public.orders, public.order_items, public.order_item_options,
  public.order_status_history, public.payments, public.refunds,
  public.payment_events, public.audit_log to authenticated;

-- The server (service role) manages orders, payments, refunds and staff logins.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Functions: closed by default, then opened per role.
revoke execute on all functions in schema public from public, anon;
-- The role checks run inside the security rules for every visitor, signed in
-- or not, so everyone may call them (they simply return false for customers).
grant execute on function
  public.current_staff_role(), public.is_staff(), public.is_manager(), public.is_owner()
  to anon, authenticated;
grant execute on function
  public.can_toggle_stock(),
  public.staff_set_item_ticked(uuid, boolean), public.staff_fulfil_order(uuid),
  public.staff_reopen_order(uuid), public.staff_change_table(uuid, uuid),
  public.set_ordering_paused(boolean),
  public.set_drink_available(uuid, boolean), public.set_variant_available(uuid, boolean)
  to authenticated;
grant execute on function public.get_order_tracking(text) to anon, authenticated;
grant execute on all functions in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Live updates. The bar screens listen for order changes (filtered by the
-- rules above, so only staff receive them); customers' menus listen for stock
-- and pause changes.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.orders, public.order_items,
  public.venue_settings, public.drinks, public.drink_variants, public.modifier_options;

commit;
