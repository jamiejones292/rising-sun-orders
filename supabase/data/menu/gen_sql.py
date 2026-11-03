import sys
from menu_data import GROUPS, MENU, MIXERS

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

def arr(items):
    return "array[" + ", ".join(q(a) for a in items) + "]::text[]" if items else "'{}'::text[]"

out = []
w = out.append
w("""-- The Rising Sun Inn: new drinks menu (November 2026), from the owner's list.
-- Run ONCE in the Supabase SQL Editor (New query, paste, Run). All or nothing.
--
-- What it does:
--  * Archives every drink currently on the menu (past orders and sales keep them).
--  * Hides the old categories and creates or reuses the new ones, in menu order.
--  * Adds the new drinks with their sizes, prices, descriptions, ABVs and allergens.
--  * Replaces the choices in "Add a mixer" with the new mixers, each following its
--    drink's stock, and gives every spirit and liqueur the mixer list. Whiskies also
--    get "How would you like it?" (neat / with ice / splash of water).
begin;

create function pg_temp.cat(p_name text, p_sort integer) returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.categories
   where lower(trim(name)) = lower(trim(p_name)) and not (lower(name) = 'mixers' and not visible)
   order by visible desc limit 1;
  if v is null then
    insert into public.categories (name, sort_order, visible) values (p_name, p_sort, true) returning id into v;
  else
    update public.categories set visible = true, sort_order = p_sort where id = v;
  end if;
  return v;
end $$;

create function pg_temp.drink(p_cat uuid, p_name text, p_desc text, p_abv numeric, p_alcohol boolean,
                              p_welsh boolean, p_no_ice boolean, p_allergens text[], p_sort integer)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.drinks (category_id, name, description, abv, contains_alcohol, is_welsh,
                             offers_no_ice, allergens, vat_rate, available, sort_order)
  values (p_cat, p_name, p_desc, p_abv, p_alcohol, p_welsh, p_no_ice, p_allergens, 20, true, p_sort)
  returning id into v;
  return v;
end $$;

create function pg_temp.size(p_drink uuid, p_label text, p_pence integer, p_sort integer) returns void
language sql as $$
  insert into public.drink_variants (drink_id, label, price_pence, available, sort_order)
  values (p_drink, p_label, p_pence, true, p_sort)
$$;

create function pg_temp.offers(p_drink uuid, p_group text) returns void language sql as $$
  insert into public.drink_modifier_groups (drink_id, group_id)
  select p_drink, g.id from public.modifier_groups g where g.name = p_group
  on conflict do nothing
$$;

-- 1. Retire the old menu.
update public.drinks set archived_at = now() where archived_at is null;
update public.categories set visible = false where visible;

-- 2. The mixer list for spirits (created if missing), emptied of old choices.
insert into public.modifier_groups (name, required, sort_order)
select 'Add a mixer', false, 10 where not exists (select 1 from public.modifier_groups where name = 'Add a mixer');
update public.modifier_options set archived_at = now(), available = false
 where archived_at is null and group_id = (select id from public.modifier_groups where name = 'Add a mixer');

-- 2b. Other choice lists the menu uses (created if missing).
"""
)
for gi, (gname, required, options) in enumerate(GROUPS):
    w(f"insert into public.modifier_groups (name, required, sort_order)\n"
      f"select {q(gname)}, {str(required).lower()}, {(gi + 5) * 10} where not exists (select 1 from public.modifier_groups where name = {q(gname)});")
    for oi, (label, pence) in enumerate(options):
        w(f"insert into public.modifier_options (group_id, label, price_pence, sort_order)\n"
          f"select g.id, {q(label)}, {pence}, {oi * 10} from public.modifier_groups g where g.name = {q(gname)}\n"
          f"   and not exists (select 1 from public.modifier_options o where o.group_id = g.id and o.label = {q(label)} and o.archived_at is null);")
w("""
-- 3. The new menu.
do $$
declare c uuid; dr uuid;
begin""")

for ci, c in enumerate(MENU):
    w(f"  c := pg_temp.cat({q(c['name'])}, {(ci + 1) * 10});")
    for di, x in enumerate(c["drinks"]):
        alcohol = c["alcohol"] if x["alcohol"] is None else x["alcohol"]
        no_ice = c["no_ice"] if x["no_ice"] is None else x["no_ice"]
        abv = "null" if x["abv"] is None else str(x["abv"])
        w(f"  dr := pg_temp.drink(c, {q(x['name'])}, {q(x['desc'])}, {abv}, {str(alcohol).lower()}, "
          f"{str(x['welsh']).lower()}, {str(no_ice).lower()}, {arr(x['allergens'])}, {(di + 1) * 10});")
        for si, (label, pence) in enumerate(x["sizes"]):
            w(f"  perform pg_temp.size(dr, {q(label)}, {pence}, {(si + 1) * 10});")
        for g in (x["groups"] if x["groups"] is not None else c["groups"]):
            w(f"  perform pg_temp.offers(dr, {q(g)});")
w("end $$;")

w("""
-- 4. The new mixer choices, each following its drink (out of stock with it).""")
for i, (label, pence, follows) in enumerate(MIXERS):
    link = ("(select id from public.drinks where name = " + q(follows) + " and archived_at is null limit 1)") if follows else "null"
    w(f"insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)\n"
      f"select id, {q(label)}, {pence}, {i * 10}, {link} from public.modifier_groups where name = 'Add a mixer';")

w("""
commit;""")
open(sys.argv[1], "w").write("\n".join(out) + "\n")
