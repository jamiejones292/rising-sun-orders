# Menu data

`menu_data.py` is the drinks list (from the owner's November 2026 menu): categories,
drinks, sizes and prices in pence, descriptions, ABVs, allergens and points to check.
`python3 gen_sql.py ../2026-11-new-menu.sql` (run from this folder) writes the SQL the
owner runs once in the Supabase SQL Editor. It archives the old drinks, so don't run it
again on a live menu without changing it.
