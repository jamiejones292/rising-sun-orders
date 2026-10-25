# Project notes for Claude

QR drinks ordering for The Rising Sun Inn, Abersychan (Wales). The owner is not a
developer: explain decisions in plain English, confirm before major design or
architecture changes, and never ask for secrets in chat.

## Stack
- React 19 + Vite + TypeScript (strict) + Tailwind CSS 4 (`@theme` tokens in `src/index.css`)
- React Router: `/` customer, `/staff/*` bar iPad, `/admin/*` admin. One Netlify site.
- Netlify Functions (`netlify/functions`) for anything privileged: pricing, payments,
  payment confirmation, refunds, staff actions.
- Supabase (London): Postgres, Auth, Realtime. Row Level Security on every table.
- Payments: provider not chosen yet (Monek being asked; else Mollie, Revolut or Stripe).
  Keep payment code behind a provider-neutral interface.

## Rules that must hold
- Money is integer pence, GBP. Totals are calculated on the server, never trusted from
  the browser. Order lines copy name, size, price and VAT at the time of sale.
- An order reaches the bar only after the payment provider confirms payment server-side.
  Create orders idempotently from both the provider's webhook and the confirmation page,
  plus a periodic reconciliation sweep.
- Payment status and fulfilment status are separate fields.
- Drinks are archived, never deleted.

## Agreed product decisions
- Tables 1–25, no areas yet; keep an `area` field for later.
- One universal QR code to `drinksorder.app`.
- Category chips on the customer menu filter the list (not scroll-to).
- "No ice" tick box on soft drinks and mixer drinks (per-drink setting in admin).
- Express Apple Pay / Google Pay on the confirm-table screen; card as fallback.
- Optional email receipt with VAT breakdown (before or after paying).
- Bar screen: shared bar password (stays signed in) mapped to a bar-only account; order
  cards oldest first with green/amber/red timers (5/10 min, configurable); tap order to
  open, tick each drink (turns green), ORDER FULFILLED appears when all ticked, Undo toast.
  Multiple iPads stay in sync; first fulfil wins.
- Small admin section inside the bar screen needs staff ID + password (pause ordering,
  stock, refunds, change bar password, sign iPad out); auto-locks after 5 minutes.
  Owner staff ID: `gerwyn` (sets own password, minimum 10 characters).
- Still open: tracking stages (proposed Received → Preparing → Delivered), whether bar
  staff can toggle stock, policy for orders missing from the iPad, minimum order.

## Database
- Supabase project `faioegqaamrvbfzurzun` (London). URL and publishable key are public and
  live in `netlify.toml`; the secret key only ever goes in Netlify environment variables.
- Schema changes are new files in `supabase/migrations/` (never edit an applied one), wrapped
  in `begin; ... commit;`. The owner applies them in the Supabase SQL Editor
  (`docs/database-setup.md`). This build environment cannot reach supabase.co, so test SQL
  against a local PostgreSQL with a stub of Supabase's roles, `auth` schema and
  `supabase_realtime` publication before handing it over.
- Bar changes go through SECURITY DEFINER functions (`staff_set_item_ticked`,
  `staff_fulfil_order`, `staff_reopen_order`, `staff_change_table`, `set_ordering_paused`,
  `set_drink_available`, `set_variant_available`); customers track via
  `get_order_tracking(token)`. Orders, payments and refunds are inserted by the server only.
- Staff log in with a staff ID mapped to `<staff_code>@staff.drinksorder.app`; bar iPads use
  the bar-only account `bar@staff.drinksorder.app` (`staff_profiles.is_device`).

## Admin site (`src/pages/admin`)
- Lazy-loaded at `/admin`. Owner and managers only (`isManagerRole`); bar accounts are shown
  a "managers only" screen. Tables and Venue settings are owner-only, matching the RLS rules.
- Multi-row saves go through `admin_save_drink`, `admin_reorder_categories` and
  `admin_save_opening_hours` (migration 002). Single-field changes use direct updates.
- Local end-to-end testing: PostgREST (official release binary) on the local test database
  plus a small gateway that fakes `/auth/v1` password sign-in and proxies `/rest/v1`, with
  `.env.local` pointing the app at it, driven by playwright-core using
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## Bar screen (`src/pages/staff`)
- Lazy-loaded at `/staff`. Bar password signs in to `bar@staff.drinksorder.app` and the
  session persists. Orders load from `useBarOrders`: Supabase Realtime on orders,
  order_items and venue_settings, plus a 15-second poll and reload on wake/online as the
  safety net; "offline" banner if nothing has loaded for 45 seconds.
- NEW marker: not opened on this iPad (localStorage) and still `fulfilment_status = new`.
- The admin section signs a manager in on a separate, unsaved client
  (`createElevatedClient`) so the bar session stays put; locks after 5 minutes. Bar password
  changes use the bar session's own `auth.updateUser`, with `signOut({scope: "others"})`.
- Problems are flagged with `staff_report_problem` / cleared with `staff_clear_problem`
  (migration 003). Refunds wait for the payments stage.

## Customer pages (`src/pages/customer`)
- `CustomerRoot` shows the "being set up" page unless `venue_settings.customer_menu_live`
  (migration 004, switch in Venue settings) or this phone has `/?preview` (localStorage
  `rs-preview`; `/?preview=off` clears it). `CustomerApp` is lazy-loaded.
- Menu from `useCustomerMenu` (public reads, Realtime on drinks/variants/options/settings,
  60-second poll). Basket in localStorage holds ids only; prices always come from
  `src/lib/pricing.ts` `priceLine`, which the payment server code must reuse.
- `src/lib/hours.ts` works in Europe/London and handles closing after midnight.
- Confirm screen shows a "card payments are being set up" holding panel: this is where the
  provider's Apple Pay / Google Pay / card step plugs in. No unpaid orders are created.
- `/order/:token` tracking polls `get_order_tracking` every 8 seconds (anon can't
  subscribe to orders).

## Design
Prototypes in `design/` are the reference for look and behaviour. Brand: forest
`#132A1F`, gold `#9C7840` (`#7A5C2C` for small text), ivory `#FBF4EA`. Fonts: Cormorant
Garamond (display), Cinzel (small caps labels), Figtree (UI text).

## Hosting
Domain `drinksorder.app` (Cloudflare DNS, records set to DNS only) is served by Netlify
project `risingsunpub`, which the owner is linking to this repository (branch
`setup/project-foundation`), so every push deploys live. The old clickable demo is kept as
static files in `public/demo/` (served at `/demo`, `/demo/staff`, `/demo/admin`).
