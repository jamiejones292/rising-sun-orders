# Setting up the database (one-off, about 5 minutes)

This creates the tables, security rules and example menu in the Supabase project
`rising-sun-orders` (London). You only do this once.

## Step 1: Create the structure
1. On GitHub, open the file
   `supabase/migrations/20261025000001_initial_schema.sql` in this repository.
2. Click the **Copy raw file** button (two overlapping squares, top right of the file).
3. In Supabase, open your project and click **SQL Editor** in the left sidebar
   (the `>_` icon), then **New query** (or the **+**).
4. Paste everything into the editor and click **Run** (bottom right).
5. You should see **"Success. No rows returned."**
   - If Supabase asks you to confirm because the query makes changes, click
     **Run this query**.

## Step 2: Add the tables and example menu
1. On GitHub, open `supabase/seed.sql` and click **Copy raw file**.
2. In Supabase SQL Editor, click **New query** again, paste, and click **Run**.
3. Again you should see **"Success. No rows returned."**

Run each file **once**. Running `seed.sql` twice adds every example drink twice.

## Step 3: Check it worked
In a new SQL Editor query, paste this and click **Run**:

```sql
select
  (select count(*) from public.categories)     as categories,
  (select count(*) from public.drinks)         as drinks,
  (select count(*) from public.drink_variants) as sizes,
  (select count(*) from public.venue_tables)   as tables;
```

You should see **10 categories, 29 drinks, 57 sizes, 25 tables**.

You can also click **Table Editor** in the sidebar to browse the drinks.

## Step 4: Create the staff logins
1. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up" and
   save (leave Email sign-in on).
2. **Authentication → Users → Add user → Create new user**, ticking **Auto Confirm User**:
   - `gerwyn@staff.drinksorder.app` with Gerwyn's own password (at least 10 characters)
   - `bar@staff.drinksorder.app` with the bar iPad password
3. In a new SQL Editor query, run:

```sql
insert into public.staff_profiles (user_id, staff_code, display_name, role, is_device)
select id, 'gerwyn', 'Gerwyn', 'owner'::public.staff_role, false
from auth.users where email = 'gerwyn@staff.drinksorder.app'
union all
select id, 'bar', 'Bar iPad', 'bar'::public.staff_role, true
from auth.users where email = 'bar@staff.drinksorder.app';

select staff_code, display_name, role from public.staff_profiles;
```

You should see `gerwyn | Gerwyn | owner` and `bar | Bar iPad | bar`. Staff only ever type
their staff ID (e.g. `gerwyn`) or the bar password; the email addresses are internal.

## Database updates
When a new file appears in `supabase/migrations/`, run it once in the SQL Editor the same
way as step 1 (open it on GitHub, **Copy raw file**, paste into a **New query**, **Run**).
Run them in date order. Each one is all-or-nothing.

| File | What it adds | Run? |
|---|---|---|
| `20261025000001_initial_schema.sql` | Tables, security rules, bar actions | Done |
| `20261025000002_admin_saves.sql` | One-step saving for drinks, category order and ordering hours (admin site) | Done |
| `20261026000003_order_problems.sql` | "Problem with this order" flags for the bar screen | Done |
| `20261026000004_customer_menu_switch.sql` | "Show the drinks menu to customers" switch in Venue settings | Done |
| `20261026000005_test_orders.sql` | Test orders without payment (Venue settings → Test orders) | Done |
| `20261026000006_receipt_emails.sql` | Email receipts, the pub address for receipts, adding a receipt email on the order page (see `docs/receipts-setup.md`) | Done |
| `20261030000007_mixers_on_spirits.sql` | Gives every spirit the "Add a mixer" options | Not yet |

## Trying the bar screen with a test order
Real orders arrive once payments are set up. To see how the bar screen behaves before then,
run this in a new SQL Editor query. It creates a pretend paid order for Table 12:

```sql
with o as (
  insert into public.orders (table_id, table_label, total_pence, vat_pence, payment_status, paid_at, payment_method_label)
  select id, label, 1560, 260, 'paid', now(), 'TEST' from public.venue_tables where label = '12'
  returning id
)
insert into public.order_items (order_id, drink_name, variant_label, quantity, unit_price_pence, vat_rate, line_total_pence, no_ice, sort_order)
select o.id, x.name, x.size, x.qty, x.price, 20, x.qty * x.price, x.no_ice, x.ord
from o, (values ('Birra Moretti', 'Pint', 2, 620, false, 1), ('Diet Coke', 'Pint', 1, 320, true, 2))
  as x(name, size, qty, price, no_ice, ord);
```

To remove all test orders afterwards:

```sql
delete from public.orders where payment_method_label = 'TEST';
```

## If something goes wrong
- **An error in step 1:** nothing is half-done. A failed run is rolled back. Take a
  screenshot of the error message and send it over.
- **"relation already exists":** step 1 has already been run. Skip to step 2.
- **Started again from scratch?** In Supabase you can delete the project and create a
  new one, then repeat these steps.

## What not to do
- Don't paste the database password or the **secret** key anywhere except where these
  instructions say.
- Don't edit tables directly in Table Editor once the pub is live; use the admin site,
  which keeps history and checks permissions.
