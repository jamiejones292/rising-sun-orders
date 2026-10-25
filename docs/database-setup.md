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
