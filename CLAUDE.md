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

## Design
Prototypes in `design/` are the reference for look and behaviour. Brand: forest
`#132A1F`, gold `#9C7840` (`#7A5C2C` for small text), ivory `#FBF4EA`. Fonts: Cormorant
Garamond (display), Cinzel (small caps labels), Figtree (UI text).

## Hosting
Domain `drinksorder.app` (Cloudflare DNS, records set to DNS only) points at Netlify
project `risingsunpub`, currently serving the demo. Do not connect this repository to
that project or change its deploys without the owner's go-ahead.
