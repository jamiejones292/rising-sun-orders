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
- No location/geofence check on ordering (owner's decision): paying up front is the
  safeguard; staff flag "Can't find the table". Per-table codes are the fallback if
  remote prank orders ever become a problem.
- QR: plain static code to `https://drinksorder.app` (files in `design/qr/`); no paid
  dynamic QR service, since the domain itself is the redirect point.
- Still open: tracking stages (proposed Received → Preparing → Delivered), policy for
  orders missing from the iPad, minimum order.
- Every spirit offers "Add a mixer" (migration 007 attached it to existing spirits; the drink
  editor ticks it for drinks new in or moved into a category named like "Spirits").
- Mixers follow their drink (migration 009): `modifier_options.linked_drink_id`; a trigger on
  drinks copies `available`/archived to linked options. Linked by exact name when the migration
  ran. Unlinked options have their own switch (`set_option_available`, same rule as drinks),
  shown under "Mixers & extras" in `StockList`.
- Drink editor "Mixer" section: "Also offer as a mixer for spirits" + mixer price adds/updates/
  archives (or restores) this drink's option in the "…mixer…" group, linked to the drink. Saved
  after `admin_save_drink` with direct updates (not atomic; error says the drink saved).
- Bar staff stock switches: allowed when the owner turns on "Bar staff can switch drinks
  out of stock" in Venue settings (off by default); a Stock button then appears on the bar
  screen. Adding, editing and archiving drinks stays managers-only.

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
- Mixers & extras (`Extras.tsx`, `/admin/extras`, managers): edit option lists (groups) and
  their choices: name, extra charge, order, "follows drink" link or own stock switch, remove
  (archive) and restore, "customers must choose one". Direct updates under the manager RLS
  rules; needs migration 009 for `linked_drink_id`. Which drinks offer a list is set in the
  drink editor.
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
  safety net; "offline" banner if nothing has loaded for 45 seconds. Realtime confirmed
  working on the live site (owner's two-tablet test: orders arrived instantly).
- NEW marker: not opened on this iPad (localStorage) and still `fulfilment_status = new`.
- The admin section signs a manager in on a separate, unsaved client
  (`createElevatedClient`) so the bar session stays put; locks after 5 minutes. Bar password
  changes use the bar session's own `auth.updateUser`, with `signOut({scope: "others"})`.
- Stock switches (whole drinks and single sizes) are one shared `StockList` component, used
  by the bar-staff Stock panel (bar session, only while `bar_staff_can_toggle_stock`) and the
  manager admin section (elevated client), which also opens `DrinkEditor` to add, edit or
  archive a drink. `DrinkEditor` and `loadMenuData` take an optional client for this.
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
- Test orders (migration 005): `place_test_order(jsonb)` prices everything in SQL, only while
  `venue_settings.test_orders_until` is in the future (owner's 2-hour button), marks orders
  `payment_provider = 'test'`; `admin_delete_test_orders()` clears them. Test mode ignores
  ordering hours in the UI. Bar shows "TEST ORDER · NOT PAID".
- Recent orders / "Same again" (`history.ts`, `RecentOrders.tsx`): last 10 orders for 7 days
  in localStorage `rs-orders-v1` (ids only, no accounts). Only shown once the server says
  `payment_status = 'paid'` (set by the order page, re-checked via `get_order_tracking` each
  time the menu opens; orders the server no longer has are forgotten). Listed on the welcome screen, last
  round on the menu while the basket is empty. Same again re-prices from tonight's menu, leaves
  out sold-out or changed drinks with a note, and keeps the table. The payment step must call
  `saveToHistory` too.
- Receipt emails (migration 006, `docs/receipts-setup.md`): `netlify/functions/send-receipt.ts`
  takes a tracking token, calls `claim_receipt` (service_role only; atomic, returns null if
  nothing to send), builds the email with `src/lib/receiptEmail.ts` and sends via Resend;
  on failure `receipt_failed` (doesn't count). Max 3 receipts per order
  (`receipt_send_count`). Customers add or change the address on the order page via
  `set_receipt_email` (paid orders, 7 days). Checkout and the order page both call
  `requestReceipt` (`src/lib/receipts.ts`); the payment webhook should too. Netlify env:
  `SUPABASE_SECRET_KEY`, `RESEND_API_KEY` (503 `receipts_not_configured` without them).
  Locally: bundle the function with `npx rolldown` and run it behind a fake Resend.
- Email retention: `forget_old_receipt_emails()` (migration 008, service_role only) clears
  `customer_email` older than `email_retention_days`; `netlify/functions/forget-old-emails.ts`
  runs it daily (`schedule: "@daily"`, needs `SUPABASE_SECRET_KEY`).
- `/privacy` (`src/pages/PrivacyPolicy.tsx`) is the privacy notice, linked wherever an email is
  asked for and from the order page. Keep it in step with what the site stores. No legal
  name or contact email on it (owner's choice); name the payment provider once chosen.
- Order page stages: Order received → Preparing → On its way (bar taps ORDER FULFILLED,
  `delivered_at`) → Delivered, shown 5 minutes after `delivered_at` (`TrackOrder.tsx`).
- `/refunds` (`src/pages/RefundPolicy.tsx`) is the agreed refund policy, linked from the confirm
  screen (with the "empty tables can't usually be refunded" line) and the tracking page.
- `/order/:token` tracking polls `get_order_tracking` every 8 seconds (anon can't
  subscribe to orders).

## Design
Prototypes in `design/` are the reference for look and behaviour. Brand: forest
`#132A1F`, gold `#9C7840` (`#7A5C2C` for small text), ivory `#FBF4EA`. Fonts: Cormorant
Garamond (display), Cinzel (small caps labels), Figtree (UI text).

## Hosting
Domain `drinksorder.app` (Cloudflare DNS, records set to DNS only) is served by Netlify
project `risingsunpub`, which the owner is linking to this repository (branch
`setup/project-foundation`), so every push deploys live. The repository is public (owner's decision) because
Netlify's free plan refused builds from more than one Git contributor on a private repo. Keep
it free of secrets: keys live only in Netlify environment variables. Commits are authored as
the owner (`jamiejones292`, `342932116+jamiejones292@users.noreply.github.com`). The old clickable demo is kept as
static files in `public/demo/` (served at `/demo`, `/demo/staff`, `/demo/admin`).
