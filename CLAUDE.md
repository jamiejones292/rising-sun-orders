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
- Drinks are archived, never deleted, once ordered. Only never-ordered drinks can be deleted
  for good (`admin_delete_drink`, migration 011, managers; test orders count, so they must be
  deleted first). Its linked mixer option is archived, not deleted.

## Agreed product decisions
- Tables 1–25, no areas yet; keep an `area` field for later.
- One universal QR code to `drinksorder.app`.
- Category chips on the customer menu scroll the full menu to that heading (owner's change, Nov 2026;
  was filter). The highlighted chip follows the heading at the top while scrolling (scroll spy in
  `CustomerApp`, paused 1 s after a tap); tapping a chip clears a search; no "All drinks" chip.
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
- Accepted for now (owner, review Nov 2026): the bar account can read every column of paid
  orders, including `customer_email` (column grants risk breaking Realtime); the site no
  longer promises refund emails; revisit both when the payment provider is chosen.
- Still open: tracking stages (proposed Received → Preparing → Delivered), policy for
  orders missing from the iPad, minimum order.
- Every spirit offers "Add a mixer" (migration 007 attached it to existing spirits; the drink
  editor ticks it for drinks new in or moved into a spirit category: `SPIRIT_CATEGORY` matches
  Spirits, Whisky, Gin, Vodka, Rum, Tequila, Liqueurs, Brandy, Cognac).
- Menu (Nov 2026): `supabase/data/menu/menu_data.py` is the owner's drinks list (no ABVs, by
  the owner's choice; wine dietary labels from the owner's list in the description);
  `gen_sql.py` writes `supabase/data/2026-11-new-menu.sql`, run once by the owner (archives
  the old drinks, 20 categories, 125 drinks, mixer list with draught mixers at 60p). "Real Ales"
  (3 ales, half £2.80 / pint £4.60, after Draught Beer) was added later; `supabase/data/2026-11-real-ales.sql`
  adds it to a menu that's already live, and adds the half pints if the ales are already there (safe to run twice).
- Mixers follow their drink (migration 009): `modifier_options.linked_drink_id`; a trigger on
  drinks copies `available`/archived to linked options. Linked by exact name when the migration
  ran. Unlinked options have their own switch (`set_option_available`, same rule as drinks),
  shown under "Mixers & extras" in `StockList`.
- Drink editor "Mixer" section: "Also offer as a mixer for spirits" + mixer price adds/updates/
  archives (or restores) this drink's option in the "…mixer…" group, linked to the drink. Saved
  after `admin_save_drink` with direct updates (not atomic; error says the drink saved).
- Mixer-only drinks: category dropdown option "Mixers (mixer only, not on the menu)" puts the
  drink in a hidden category named exactly "Mixers" (created on first use; `isMixersCategory`),
  with one hidden "Mixer" size, no option lists, and a linked mixer option. Hidden categories
  keep it off the menu and unorderable on its own. Categories page locks its name and visibility.
  Only a *hidden* category named "Mixers" counts (`isMixerOnlyCategory`); the Categories page
  refuses creating or renaming another category to "Mixers".
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
- Sign-outs are `scope: "local"` (one bar account is shared by every iPad). The admin site
  uses its own auth storage key (`rs-admin-auth`, chosen by path in `lib/supabase.ts`), so
  /admin on a bar iPad needs a manager login and never touches the bar session. A failed
  profile check keeps the current profile and retries (`offline` in auth context).
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
- Sales (`Sales.tsx`, `/admin/sales`, managers): day / week (Mon–Sun) / month / year in UK time,
  from `admin_sales_stats(from, to, include_test)` (migration 012, fixed in 014): takings and
  orders = every order paid in the period incl. ones refunded since (gross); refunds by refund
  time (so takings − refunds is net); drinks/top drinks/extras leave out refunded-in-full
  orders and out-of-stock lines. "Include test orders" defaults on until
  card payments go live; switch the default off then.
- Drinks page: pinned search/filter bar (accent-insensitive, word-start, also matches the category);
  per category "All off / All on" (`admin_set_category_available`) and "Change a price" for one size
  across the category (`admin_set_category_size_price`), both migration 015; Delete only in Archived;
  "Mixer for spirits" tag. Drink editor: hidden categories last and a warning when saving into one; new
  drinks pre-tick the option lists most drinks in that category have; phone Back and closing the tab
  ask before discarding changes ("Discard changes / Keep editing", no `window.confirm`).
- Overview flags only hidden categories that still have drinks; Categories tucks old empty hidden ones
  away; category reorders save one after another. Sales shows the top 20 (Show all) with a category
  filter (matched by drink name). Pause/resume has Undo. Extras: Undo for Remove and the
  "must choose one" switch, warning when a required list has nothing in stock.
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
- Ticks are optimistic; `useBarOrders` keeps `pendingTicks` (markTick/settleTick) and overlays
  them on any reload that started before the save finished, so a stale reload can't flip a
  tick back. OrderDetail ignores a second tap on the same drink within 500 ms, and focuses
  "All orders" only once (re-focusing on every render jumped the page to the top).
- Order view layout: notices (test, alcohol, refund) are one slim row of labels; drinks in two
  columns on md+ when 3+; the bottom bar is slim until all are ticked (then ORDER FULFILLED);
  a gold "↓ n more to pour below" button shows while unticked drinks aren't fully visible.
- "Fulfilled today" runs from 6am UK time (trading day) and lists up to 300. Bar reloads time
  out after 12 s. If the open order is finished/refunded on another iPad, a toast says so.
  The bar admin's 5-minute lock pauses while a drink form or refund is open. The chime
  resumes audio after the iPad sleeps (`alerts.ts`).
- NEW marker: not opened on this iPad (localStorage) and still `fulfilment_status = new`. Unopened
  orders show as "(n)" in the tab title; the chime repeats every minute while one is over a minute old;
  a red "Sound is off" bar shows until sound is enabled.
- Cards (`Board.tsx`) show at most 4 drink lines ("+ n more drinks"), options as bold "+ Coca-Cola"
  lines ("No mixer" hidden), test orders striped grey (`isTest`: `payment_provider = 'test'`), and a
  "↓ n more orders below" button. Orders paid before today's 6am go in "From earlier"; waits over an
  hour read "1 h 20 min" / "20 h". Search shows a "Showing n of m" bar and clears when an order opens.
- Confirm steps: out of stock and table moves have Undo (`staff_undo_out_of_stock`, migration 015,
  leaves the drink off on the menu); table moves, Reopen and Untick all ask once more. ORDER FULFILLED
  waits for tick saves still in flight. Bar toasts sit at the bottom (`ToastProvider placement`),
  the NEW ORDER banner on top.
- Managers close stuck orders with "Close without serving" (`staff_close_order(id, reason)`, migration
  015: fulfilment `cancelled`, clears the problem) from the bar admin's "Needs a manager" list (problems
  plus orders from earlier) and the admin Overview problems panel. Only orders delivered in the last
  12 hours can be reopened (`order_too_old`).
- The admin section signs a manager in on a separate, unsaved client
  (`createElevatedClient`) so the bar session stays put; locks after 5 minutes. Bar password
  changes use the bar session's own `auth.updateUser`, with `signOut({scope: "others"})`.
- Stock switches (whole drinks and single sizes) are one shared `StockList` component, used
  by the bar-staff Stock panel (bar session, only while `bar_staff_can_toggle_stock`) and the
  manager admin section (elevated client), which also opens `DrinkEditor` to add, edit or
  archive a drink. `DrinkEditor` and `loadMenuData` take an optional client for this.
- Problems are flagged with `staff_report_problem` / cleared with `staff_clear_problem`
  (migration 003). "An item is out of stock" makes staff tick the drinks; the reason reads
  `Out of stock: 2 × Brains SA (Pint), …`, which `RefundPanel` uses to pre-tick lines (until a
  refund is made). With migration 013 the bar calls `staff_report_out_of_stock(order, item_ids)`
  instead: sets `order_items.out_of_stock` (no tick needed; `staff_fulfil_order` requires the
  rest ticked and at least one ticked), switches the whole drink off on the menu whatever the
  bar-stock setting says, and writes the same reason text. The bar falls back to
  `staff_report_problem` if the function is missing. Managers are alerted only on the admin Overview (owner's choice): a live
  "problems reported by the bar" panel with Refund/Clear, and "(n)" in the tab title.
- Refunds (`RefundPanel.tsx`, bar admin → Refunds, or Refund on a reported problem): pick
  drinks or an amount plus a policy reason; `staff_refund_order(id, pence, reason)` (migration
  010, managers) only accepts `payment_provider = 'test'` for now (`refunds_not_live`), records
  a `refunds` row, adds to `refunded_pence`. Partial refunds keep `payment_status = 'paid'`
  (so bar functions/queries keep working; `partially_refunded` is unused); a full refund sets
  `refunded` and cancels an order not yet delivered. Clears the problem flag. Real refunds
  must go through the provider from a Netlify function and reuse this panel.

## Customer pages (`src/pages/customer`)
- `CustomerRoot` shows the "being set up" page unless `venue_settings.customer_menu_live`
  (migration 004, switch in Venue settings) or this phone has `/?preview` (localStorage
  `rs-preview`; `/?preview=off` clears it). `CustomerApp` is lazy-loaded.
- Screens live in browser history (`location.state.screen`, plus `sheet` while a drink pop-up is
  open), so the phone's Back button steps back and closes the pop-up; a refresh on table/confirm goes
  back to the basket. "Order more drinks" on the order page opens the menu.
- Checkout: Continue stays tappable and scrolls to / highlights what's missing (table, age box); the
  confirm screen lists the drinks and, if ordering is paused/closed or a drink sold out, says so with
  "Back to basket" instead of the pay buttons. Menu loading gives up after 15 s with a weak-signal hint.
- Product sheet: required lists first; a gin's mixer list starts No mixer, then tonics.
- Menu screen: the sticky page header holds `MenuToolbar` (search box + category buttons), so
  both stay visible while scrolling. Search filters as you type across all categories,
  ignoring case and accents; each word must match the start of a word; name/category matches
  win, descriptions are searched only when nothing matches by name; a few aliases (`ALSO`:
  coke→Coca-Cola, whisky/whiskey, af, bubbly, kids, g&t, jd, j20, ale/bitter, shandy…), filler words
  ignored (a, of, pint, glass…), apostrophes ignored (gordons), and if nothing matches every word,
  drinks matching any word are shown with a note. Tapping a category clears the search.
- Menu from `useCustomerMenu` (public reads, Realtime on drinks/variants/options/settings,
  60-second poll). Basket in localStorage holds ids only; prices always come from
  `src/lib/pricing.ts` `priceLine`, which the payment server code must reuse.
- `src/lib/hours.ts` works in Europe/London and handles closing after midnight.
- Confirm screen shows a "card payments are being set up" holding panel: this is where the
  provider's Apple Pay / Google Pay / card step plugs in. No unpaid orders are created.
- Test orders (migration 005): `place_test_order(jsonb)` prices everything in SQL, only while
  `venue_settings.test_orders_until` is in the future (owner's 2-hour button), marks orders
  `payment_provider = 'test'`; `admin_delete_test_orders()` clears them. Test mode ignores
  ordering hours in the UI. Bar shows "TEST ORDER · NOT PAID". Test mode only applies on
  preview phones (`previewPhone` prop, localStorage `rs-preview`), and the database allows at
  most 20 test orders a minute (`limit_test_orders` trigger, migration 014).
  The confirm screen's test panel shows stand-in "Pay £x with Apple Pay / Google Pay / card"
  buttons (text only, no brand logos, marked TEST) that all place the same test order; the
  real provider's wallet buttons replace them. On a preview phone with test orders off, the
  holding panel says so and where to switch them on.
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

## Security headers
- `netlify.toml` sets HSTS, X-Frame-Options etc. The Content Security Policy is a `<meta>` tag added at
  build time by `vite.config.ts` (scripts from the site only; connections only to the site and the
  Supabase project from `VITE_SUPABASE_URL`; Google Fonts). It skips the dev server and `/demo`. A
  payment provider's scripts/frames will need adding to it.

## Design
Prototypes in `design/` are the reference for look and behaviour. Brand: forest
`#132A1F`, gold `#9C7840` (`#7A5C2C` for small text), ivory `#FBF4EA`. Fonts: Cormorant
Garamond (display), Cinzel (small caps labels), Figtree (UI text).

## Hosting
Domain `drinksorder.app` (Cloudflare DNS, records set to DNS only) is served by Netlify
project `risingsunpub`, which the owner is linking to this repository (branch
`setup/project-foundation`), so every push deploys live. Each production deploy costs 15
of the free plan's 300 monthly credits: batch changes on the working branch and push live only
when the owner says. `netlify.toml` `ignore` skips builds for docs/supabase/design/*.md-only pushes. The repository is public (owner's decision) because
Netlify's free plan refused builds from more than one Git contributor on a private repo. Keep
it free of secrets: keys live only in Netlify environment variables. Commits are authored as
the owner (`jamiejones292`, `342932116+jamiejones292@users.noreply.github.com`). The old clickable demo is kept as
static files in `public/demo/` (served at `/demo`, `/demo/staff`, `/demo/admin`).
