# rising-sun-orders

QR code drinks ordering for **The Rising Sun Inn, Abersychan**. Customers scan one QR
code, order and pay for drinks on their phone, and the order appears on the bar iPad.

| Address | Who uses it |
|---|---|
| `drinksorder.app` | Customers (the table QR code) |
| `drinksorder.app/staff` | Bar iPads |
| `drinksorder.app/admin` | Owner and managers |

## Build progress

| Stage | What | Status |
|---|---|---|
| 1 | Design prototypes saved in `design/` | Done |
| 2 | Project setup: one site for `/`, `/staff`, `/admin` | Done (pages are placeholders) |
| 3 | Database (Supabase): menu, tables 1–25, orders, staff, security rules | Done: applied to Supabase (London) |
| 4 | Admin: drinks, prices, stock, tables, staff, settings | |
| 5 | Payments: Apple Pay, Google Pay, card (provider to be confirmed) | |
| 6 | Bar screen: sign-in, live orders, tick-off, Order Fulfilled | |
| 7 | Customer menu, basket, checkout, tracking and receipts | |
| 8 | Testing: payments, two iPads, Wi-Fi loss, timings | |
| 9 | Go live on drinksorder.app | |

## How it fits together

- **Netlify** hosts the site and runs the server code in `netlify/functions`.
- **Supabase** (London) holds the database, staff logins and live updates.
- **Payments**: provider to be confirmed (Monek, Mollie, Revolut or Stripe). An order only
  reaches the bar once the provider has confirmed payment to our server.

## Project layout

```
design/              Agreed clickable prototypes and the logo
public/              Files served as-is (logo, robots.txt)
src/
  pages/customer/    Customer ordering (/)
  pages/staff/       Bar iPad screen (/staff)
  pages/admin/       Admin site (/admin)
  components/        Shared pieces (wordmark, notices)
  lib/               Helpers (money in pence, VAT)
netlify/functions/   Server code (payments, staff actions)
supabase/migrations/ Database structure and security rules (run in order)
supabase/seed.sql    Tables 1–25, settings and an example menu
docs/                Step-by-step guides
netlify.toml         Netlify build, routing and security headers
```

## Running it on a computer (developers)

Needs Node.js 22 or newer.

```bash
npm install
npm run dev        # local preview at http://localhost:5173
npm run build      # production build into dist/
```

Secret keys are never stored in this repository. Copy `.env.example` to `.env` for local
work; on the live site they're set in Netlify under **Project configuration →
Environment variables**.
