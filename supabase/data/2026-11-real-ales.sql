-- The Rising Sun Inn: adds the "Real Ales" heading with three ales (November 2026).
-- Run in the Supabase SQL Editor (New query, paste, Run). Safe to run more than once:
-- it only adds what isn't there yet. Not needed if 2026-11-new-menu.sql is run after
-- 4 November 2026 (that file already includes them), but harmless either way.
begin;

-- The heading, placed straight after Draught Beer on the menu.
do $$
declare
  v_after integer;
begin
  if not exists (select 1 from public.categories where lower(trim(name)) = 'real ales') then
    select sort_order into v_after from public.categories
     where lower(trim(name)) = 'draught beer' order by visible desc limit 1;
    if v_after is null then
      select coalesce(max(sort_order), 0) into v_after from public.categories;
    end if;
    -- Make room after Draught Beer.
    update public.categories set sort_order = sort_order + 10 where sort_order > v_after;
    insert into public.categories (name, sort_order, visible) values ('Real Ales', v_after + 5, true);
  else
    update public.categories set visible = true where lower(trim(name)) = 'real ales';
  end if;
end $$;

-- The three ales, pints only, £4.60 each.
do $$
declare
  v_cat uuid;
  v_drink uuid;
  r record;
begin
  select id into v_cat from public.categories where lower(trim(name)) = 'real ales' limit 1;
  for r in
    select * from (values
      (10, 'Ghost Face – Wye Valley Brewery',
       'Pale ale. A hop-forward pale ale with refreshing citrus character, fruity hop notes and a crisp, pleasantly bitter finish.'),
      (20, 'Hop Crop – Wye Valley Brewery',
       'British session IPA. A refreshing session IPA with bright citrus and floral notes, balanced bitterness and a clean, easy-drinking finish.'),
      (30, 'Admiral''s Ale – St Austell Brewery',
       'Limited edition strong ale. A full-flavoured strong ale with rich malt character, gentle caramel sweetness and a balanced, warming finish.')
    ) as t(sort, name, description)
  loop
    if not exists (select 1 from public.drinks where name = r.name and archived_at is null) then
      insert into public.drinks (category_id, name, description, abv, contains_alcohol, is_welsh,
                                 offers_no_ice, allergens, vat_rate, available, sort_order)
      values (v_cat, r.name, r.description, null, true, false, false,
              array['Cereals containing gluten']::text[], 20, true, r.sort)
      returning id into v_drink;
      insert into public.drink_variants (drink_id, label, price_pence, available, sort_order)
      values (v_drink, 'Pint', 460, true, 10);
    end if;
  end loop;
end $$;

commit;
