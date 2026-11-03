-- The Rising Sun Inn: new drinks menu (November 2026), from the owner's list.
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

-- 3. The new menu.
do $$
declare c uuid; dr uuid;
begin
  c := pg_temp.cat('Draught Lager', 10);
  dr := pg_temp.drink(c, 'Cruzcampo', 'Crisp, easy-drinking Spanish lager from Seville with a light malt sweetness.', null, true, false, false, array['Cereals containing gluten']::text[], 10);
  perform pg_temp.size(dr, 'Half pint', 270, 10);
  perform pg_temp.size(dr, 'Pint', 540, 20);
  dr := pg_temp.drink(c, 'Birra Moretti', 'Classic Italian lager with a balanced bitterness and gentle hoppy aroma.', null, true, false, false, array['Cereals containing gluten']::text[], 20);
  perform pg_temp.size(dr, 'Half pint', 270, 10);
  perform pg_temp.size(dr, 'Pint', 540, 20);
  dr := pg_temp.drink(c, 'Heineken', 'Crisp, refreshing Dutch lager with subtle fruity notes and a clean finish.', null, true, false, false, array['Cereals containing gluten']::text[], 30);
  perform pg_temp.size(dr, 'Half pint', 275, 10);
  perform pg_temp.size(dr, 'Pint', 550, 20);
  dr := pg_temp.drink(c, 'Amstel', 'Smooth, full-flavoured Dutch lager with a light, rounded taste.', null, true, false, false, array['Cereals containing gluten']::text[], 40);
  perform pg_temp.size(dr, 'Half pint', 260, 10);
  perform pg_temp.size(dr, 'Pint', 520, 20);
  dr := pg_temp.drink(c, 'Hawkstone Premium Lager', 'Crisp, full-flavoured lager brewed in the Cotswolds, with a clean, refreshing finish.', null, true, false, false, array['Cereals containing gluten']::text[], 50);
  perform pg_temp.size(dr, 'Half pint', 275, 10);
  perform pg_temp.size(dr, 'Pint', 550, 20);
  c := pg_temp.cat('Draught Beer', 20);
  dr := pg_temp.drink(c, 'John Smith''s', 'Smooth Yorkshire bitter with a creamy head and a mellow, malty taste.', null, true, false, false, array['Cereals containing gluten']::text[], 10);
  perform pg_temp.size(dr, 'Half pint', 260, 10);
  perform pg_temp.size(dr, 'Pint', 520, 20);
  dr := pg_temp.drink(c, 'Neck Oil', 'Beavertown''s light, zesty session IPA, full of fresh citrus hop flavour.', null, true, false, false, array['Cereals containing gluten']::text[], 20);
  perform pg_temp.size(dr, 'Half pint', 275, 10);
  perform pg_temp.size(dr, 'Pint', 550, 20);
  dr := pg_temp.drink(c, 'Hawkstone IPA', 'Hoppy Cotswold IPA with tropical fruit and citrus notes and a crisp, bitter finish.', null, true, false, false, array['Cereals containing gluten']::text[], 30);
  perform pg_temp.size(dr, 'Half pint', 275, 10);
  perform pg_temp.size(dr, 'Pint', 550, 20);
  c := pg_temp.cat('Draught Cider', 30);
  dr := pg_temp.drink(c, 'Inch''s', 'Crisp, refreshing apple cider from Herefordshire with a clean, dry finish.', null, true, false, false, array['Sulphites']::text[], 10);
  perform pg_temp.size(dr, 'Half pint', 260, 10);
  perform pg_temp.size(dr, 'Pint', 520, 20);
  dr := pg_temp.drink(c, 'Hawkstone Cider', 'Crisp, refreshing cider made with English apples, with a balanced sweetness.', null, true, false, false, array['Sulphites']::text[], 20);
  perform pg_temp.size(dr, 'Half pint', 275, 10);
  perform pg_temp.size(dr, 'Pint', 550, 20);
  c := pg_temp.cat('Draught Stout', 40);
  dr := pg_temp.drink(c, 'Guinness', 'The famous Irish stout: smooth and creamy, with roasted malt and a hint of coffee.', null, true, false, false, array['Cereals containing gluten']::text[], 10);
  perform pg_temp.size(dr, 'Half pint', 275, 10);
  perform pg_temp.size(dr, 'Pint', 550, 20);
  dr := pg_temp.drink(c, 'Hawkstone Stout', 'Rich, dark stout with roasted malt, chocolate and coffee notes and a smooth finish.', null, true, false, false, array['Cereals containing gluten']::text[], 20);
  perform pg_temp.size(dr, 'Half pint', 275, 10);
  perform pg_temp.size(dr, 'Pint', 550, 20);
  c := pg_temp.cat('Bottled Cider', 50);
  dr := pg_temp.drink(c, 'Old Mout Berries & Cherries', 'Fruity cider bursting with summer berries and cherries. Served over ice.', null, true, false, false, array['Sulphites']::text[], 10);
  perform pg_temp.size(dr, 'Bottle', 490, 10);
  dr := pg_temp.drink(c, 'Old Mout Kiwi & Lime', 'Refreshing cider with zingy kiwi and a squeeze of lime. Served over ice.', null, true, false, false, array['Sulphites']::text[], 20);
  perform pg_temp.size(dr, 'Bottle', 490, 10);
  dr := pg_temp.drink(c, 'Thatchers Blood Orange', 'Crisp apple cider with a burst of zesty blood orange.', null, true, false, false, array['Sulphites']::text[], 30);
  perform pg_temp.size(dr, 'Bottle', 490, 10);
  dr := pg_temp.drink(c, 'Thatchers Blackcurrant', 'Somerset apple cider blended with sweet, tangy blackcurrant.', null, true, false, false, array['Sulphites']::text[], 40);
  perform pg_temp.size(dr, 'Bottle', 490, 10);
  dr := pg_temp.drink(c, 'Thatchers Rosy', 'Light, refreshing rosé cider made from Somerset apples.', null, true, false, false, array['Sulphites']::text[], 50);
  perform pg_temp.size(dr, 'Bottle', 490, 10);
  dr := pg_temp.drink(c, 'Thatchers Katy', 'Sparkling single-variety cider made only from Katy apples: fruity and refreshing.', null, true, false, false, array['Sulphites']::text[], 60);
  perform pg_temp.size(dr, 'Bottle', 550, 10);
  dr := pg_temp.drink(c, 'Thatchers Rascal', 'Medium cider from Somerset with a rich, fruity apple taste.', null, true, false, false, array['Sulphites']::text[], 70);
  perform pg_temp.size(dr, 'Bottle', 530, 10);
  c := pg_temp.cat('Alcohol-Free', 60);
  dr := pg_temp.drink(c, 'Old Mout Alcohol Free', 'All the fruity flavour of Old Mout, without the alcohol.', null, false, false, false, array['Sulphites']::text[], 10);
  perform pg_temp.size(dr, 'Bottle', 450, 10);
  dr := pg_temp.drink(c, 'Heineken 0.0', 'Refreshing alcohol-free lager with a light malty body and fruity notes.', null, false, false, false, array['Cereals containing gluten']::text[], 20);
  perform pg_temp.size(dr, '330ml bottle', 300, 10);
  dr := pg_temp.drink(c, 'Thatchers Blood Orange Alcohol Free', 'Crisp apple cider and zesty blood orange, alcohol-free.', null, false, false, false, array['Sulphites']::text[], 30);
  perform pg_temp.size(dr, 'Bottle', 450, 10);
  c := pg_temp.cat('Whisky', 70);
  dr := pg_temp.drink(c, 'Jack Daniel''s Old No. 7', 'The classic Tennessee whiskey: smooth, with caramel, vanilla and toasted oak.', null, true, false, false, '{}'::text[], 10);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jack Daniel''s Tennessee Fire', 'Jack Daniel''s blended with a warming red-hot cinnamon liqueur.', null, true, false, false, '{}'::text[], 20);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jack Daniel''s Bonded', 'Bottled-in-bond Tennessee whiskey: bold and rich, with deep oak, caramel and spice.', null, true, false, false, '{}'::text[], 30);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jack Daniel''s Tennessee Apple', 'Jack Daniel''s with crisp green apple liqueur. Great with lemonade or ginger.', null, true, false, false, '{}'::text[], 40);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jack Daniel''s Tennessee Blackberry', 'Jack Daniel''s blended with a juicy blackberry liqueur.', null, true, false, false, '{}'::text[], 50);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jack Daniel''s McLaren Edition', 'Limited-edition Jack Daniel''s released with the McLaren Formula 1 team.', null, true, false, false, '{}'::text[], 60);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Gentleman Jack', 'Double charcoal-mellowed Tennessee whiskey: exceptionally smooth, with fruit and vanilla.', null, true, false, false, '{}'::text[], 70);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jura Winter Edition', 'Seasonal single malt from the Isle of Jura, with rich, warming winter spice.', null, true, false, false, '{}'::text[], 80);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jura 14 Year Old American Rye Cask', 'Island single malt finished in rye whiskey casks: spicy, with toffee and ripe fruit.', null, true, false, false, '{}'::text[], 90);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jura 10 Year Old', 'Smooth island single malt with notes of honey, vanilla and a gentle hint of smoke.', null, true, false, false, '{}'::text[], 100);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jura Bourbon Cask', 'Island single malt matured in American oak bourbon casks: sweet vanilla and toffee.', null, true, false, false, '{}'::text[], 110);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jura Journey', 'Easy-going island single malt with sweet vanilla, citrus and a touch of smoke.', null, true, false, false, '{}'::text[], 120);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Jura Pale Ale Cask Edition', 'Island single malt finished in pale ale casks: fresh citrus, malt and spice.', null, true, false, false, '{}'::text[], 130);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Monkey Shoulder Original', 'Smooth, mellow blended malt Scotch with vanilla, honey and spice. Made for mixing.', null, true, false, false, '{}'::text[], 140);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Cardhu Gold Reserve', 'Speyside single malt: rich and sweet, with honey, pear and toffee.', null, true, false, false, '{}'::text[], 150);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'The Singleton Malt Master''s Selection', 'Smooth, approachable single malt with notes of dark fruit, toffee and chocolate.', null, true, false, false, '{}'::text[], 160);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Aber Falls Sherry Cask', 'Welsh single malt from Abergwyngregyn, finished in sherry casks: rich dried fruit and spice.', null, true, true, false, '{}'::text[], 170);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Paddy Irish Whiskey', 'Smooth, easy-drinking blended Irish whiskey with a mellow, slightly sweet taste.', null, true, false, false, '{}'::text[], 180);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'The Sexton Single Malt Irish Whiskey', 'Irish single malt aged in sherry casks: rich, with dried fruit, honey and spice.', null, true, false, false, '{}'::text[], 190);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Penderyn Madeira Finish', 'Single malt Welsh whisky from the Brecon Beacons, finished in Madeira casks: rich and fruity.', null, true, true, false, '{}'::text[], 200);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Penderyn Celt', 'Lightly peated Welsh single malt with a fresh, gently smoky character.', null, true, true, false, '{}'::text[], 210);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Dalwhinnie Winter''s Gold', 'Highland single malt with honey, vanilla and a gentle spiced sweetness. Lovely chilled.', null, true, false, false, '{}'::text[], 220);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Ardbeg Ten', 'Bold, smoky Islay single malt: peaty, with sweet citrus and chocolate notes.', null, true, false, false, '{}'::text[], 230);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Haig Club Clubman', 'Light, smooth single grain Scotch with sweet vanilla and toffee. Great with a mixer.', null, true, false, false, '{}'::text[], 240);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Haig Club Clubman Single Grain Scotch Whisky', 'Light, smooth single grain Scotch matured in American oak: sweet vanilla, toffee and a hint of spice.', null, true, false, false, '{}'::text[], 250);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  dr := pg_temp.drink(c, 'Laphroaig Oak Select', 'Islay single malt with Laphroaig''s peaty smoke softened by sweet oak and vanilla.', null, true, false, false, '{}'::text[], 260);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  perform pg_temp.offers(dr, 'How would you like it?');
  c := pg_temp.cat('Gin', 80);
  dr := pg_temp.drink(c, 'Tanqueray London Dry Gin', 'Classic London dry gin with bold juniper, coriander and a crisp, clean finish.', null, true, false, false, '{}'::text[], 10);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Crabbie''s 1891 Old Tom Gin', 'Slightly sweeter Old Tom style gin with juniper and warm spice.', null, true, false, false, '{}'::text[], 20);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Limehouse Rhubarb & Ginger Gin', 'Fruity pink gin with tart rhubarb and a warming ginger kick.', null, true, false, false, '{}'::text[], 30);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Gordon''s Premium Pink Gin', 'Gordon''s gin with raspberry, strawberry and redcurrant. Lovely with lemonade or tonic.', null, true, false, false, '{}'::text[], 40);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Gordon''s Mediterranean Orange Gin', 'Gordon''s gin with sun-ripened Mediterranean oranges.', null, true, false, false, '{}'::text[], 50);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Gordon''s Sicilian Lemon Gin', 'Gordon''s gin with zesty Sicilian lemons. Bright and refreshing.', null, true, false, false, '{}'::text[], 60);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Gordon''s Mulled Gin', 'Seasonal Gordon''s with warming mulled spices and dark fruit.', null, true, false, false, '{}'::text[], 70);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Gordon''s Shimmer Berry Gin', 'Gordon''s with juicy berry flavours and a shimmering swirl in the glass. Lovely with lemonade.', null, true, false, false, '{}'::text[], 80);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Bombay Sapphire London Dry Gin', 'Light, aromatic London dry gin made with 10 vapour-infused botanicals.', null, true, false, false, '{}'::text[], 90);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  c := pg_temp.cat('Vodka', 90);
  dr := pg_temp.drink(c, 'Smirnoff No. 21 Vodka', 'Triple-distilled, smooth and clean. The world''s favourite vodka.', null, true, false, false, '{}'::text[], 10);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Smirnoff Spicy Tamarind', 'Smirnoff with tangy tamarind and a chilli kick.', null, true, false, false, '{}'::text[], 20);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Absolut Original Vodka', 'Swedish vodka, rich and full-bodied with a hint of dried fruit.', null, true, false, false, '{}'::text[], 30);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  c := pg_temp.cat('Rum & Tequila', 100);
  dr := pg_temp.drink(c, 'Malibu Original', 'Caribbean rum with coconut flavour: sweet, smooth and summery.', null, true, false, false, '{}'::text[], 10);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Captain Morgan Original Spiced Gold', 'Smooth spiced rum with vanilla, caramel and warm spice. Perfect with cola.', null, true, false, false, '{}'::text[], 20);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Captain Morgan Dark Rum', 'Rich, full-bodied dark rum with notes of molasses and spice.', null, true, false, false, '{}'::text[], 30);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Jose Cuervo Especial Silver', 'Smooth silver tequila with agave, citrus and a hint of pepper.', null, true, false, false, '{}'::text[], 40);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  c := pg_temp.cat('Liqueurs', 110);
  dr := pg_temp.drink(c, 'Archers Peach Schnapps', 'Sweet, fruity peach schnapps. A classic with lemonade.', null, true, false, false, '{}'::text[], 10);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Disaronno Velvet', 'Creamy liqueur with Disaronno''s signature amaretto taste.', null, true, false, false, array['Milk']::text[], 20);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Cointreau', 'French orange liqueur made with sweet and bitter orange peel.', null, true, false, false, '{}'::text[], 30);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Jägermeister Original', 'German herbal liqueur with 56 botanicals. Best served ice cold.', null, true, false, false, '{}'::text[], 40);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Jägermeister Orange', 'Jägermeister''s herbal recipe with a twist of bitter orange.', null, true, false, false, '{}'::text[], 50);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Drambuie', 'Scotch whisky liqueur with heather honey, herbs and spice.', null, true, false, false, '{}'::text[], 60);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Grand Marnier Cordon Rouge', 'Cognac and bitter orange liqueur: rich, smooth and warming.', null, true, false, false, '{}'::text[], 70);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Jack Daniel''s Winter Jack', 'A seasonal blend of Jack Daniel''s, apple cider liqueur and winter spices. Lovely warm.', null, true, false, false, '{}'::text[], 80);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Fireball Cinnamon Whisky Liqueur', 'Whisky liqueur with a fiery red-hot cinnamon kick.', null, true, false, false, '{}'::text[], 90);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Southern Comfort Original', 'Fruity, spiced whiskey liqueur from New Orleans. Great with lemonade or cola.', null, true, false, false, '{}'::text[], 100);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Sourz Apple', 'Sweet and sour green apple liqueur.', null, true, false, false, '{}'::text[], 110);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Aperol', 'Italian orange aperitif with a bittersweet taste. The base of an Aperol Spritz.', null, true, false, false, '{}'::text[], 120);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  c := pg_temp.cat('Brandy, Port & Sherry', 120);
  dr := pg_temp.drink(c, 'Courvoisier VS Cognac', 'Smooth cognac with notes of fresh fruit, spring flowers and oak.', null, true, false, false, '{}'::text[], 10);
  perform pg_temp.size(dr, 'Single 25ml', 300, 10);
  perform pg_temp.size(dr, 'Double 50ml', 560, 20);
  perform pg_temp.offers(dr, 'Add a mixer');
  dr := pg_temp.drink(c, 'Harveys Bristol Cream Sherry', 'Rich, smooth cream sherry with dried fruit and nutty notes.', null, true, false, false, array['Sulphites']::text[], 20);
  perform pg_temp.size(dr, 'Small glass', 300, 10);
  perform pg_temp.size(dr, 'Large glass', 560, 20);
  dr := pg_temp.drink(c, 'Taylor''s Late Bottled Vintage Port 2018', 'Rich, full-bodied port with blackberry, cherry and chocolate notes.', null, true, false, false, array['Sulphites']::text[], 30);
  perform pg_temp.size(dr, 'Small glass', 300, 10);
  perform pg_temp.size(dr, 'Large glass', 560, 20);
  c := pg_temp.cat('House Wine', 130);
  dr := pg_temp.drink(c, 'Pinot Grigio', 'House white. Light and crisp, with fresh pear and citrus.', null, true, false, false, array['Sulphites']::text[], 10);
  perform pg_temp.size(dr, '175ml glass', 520, 10);
  perform pg_temp.size(dr, '250ml glass', 680, 20);
  perform pg_temp.size(dr, 'Bottle', 1975, 30);
  dr := pg_temp.drink(c, 'Sauvignon Blanc', 'House white. Zesty and refreshing, with gooseberry and citrus.', null, true, false, false, array['Sulphites']::text[], 20);
  perform pg_temp.size(dr, '175ml glass', 520, 10);
  perform pg_temp.size(dr, '250ml glass', 680, 20);
  perform pg_temp.size(dr, 'Bottle', 1975, 30);
  dr := pg_temp.drink(c, 'Chardonnay', 'House white. Smooth and rounded, with ripe peach and melon.', null, true, false, false, array['Sulphites']::text[], 30);
  perform pg_temp.size(dr, '175ml glass', 520, 10);
  perform pg_temp.size(dr, '250ml glass', 680, 20);
  perform pg_temp.size(dr, 'Bottle', 1975, 30);
  dr := pg_temp.drink(c, 'Rosé', 'House rosé. Light and fruity, with red berry flavours.', null, true, false, false, array['Sulphites']::text[], 40);
  perform pg_temp.size(dr, '175ml glass', 520, 10);
  perform pg_temp.size(dr, '250ml glass', 680, 20);
  perform pg_temp.size(dr, 'Bottle', 1975, 30);
  dr := pg_temp.drink(c, 'Blush', 'House rosé. Soft and gently sweet, with strawberry notes.', null, true, false, false, array['Sulphites']::text[], 50);
  perform pg_temp.size(dr, '175ml glass', 520, 10);
  perform pg_temp.size(dr, '250ml glass', 680, 20);
  perform pg_temp.size(dr, 'Bottle', 1975, 30);
  dr := pg_temp.drink(c, 'Zinfandel', 'House rosé. Juicy and sweet, with raspberry and strawberry.', null, true, false, false, array['Sulphites']::text[], 60);
  perform pg_temp.size(dr, '175ml glass', 520, 10);
  perform pg_temp.size(dr, '250ml glass', 680, 20);
  perform pg_temp.size(dr, 'Bottle', 1975, 30);
  dr := pg_temp.drink(c, 'Shiraz', 'House red. Rich and spicy, with dark berry fruit.', null, true, false, false, array['Sulphites']::text[], 70);
  perform pg_temp.size(dr, '175ml glass', 520, 10);
  perform pg_temp.size(dr, '250ml glass', 680, 20);
  perform pg_temp.size(dr, 'Bottle', 1975, 30);
  dr := pg_temp.drink(c, 'Merlot', 'House red. Soft and smooth, with plum and cherry.', null, true, false, false, array['Sulphites']::text[], 80);
  perform pg_temp.size(dr, '175ml glass', 520, 10);
  perform pg_temp.size(dr, '250ml glass', 680, 20);
  perform pg_temp.size(dr, 'Bottle', 1975, 30);
  dr := pg_temp.drink(c, 'Malbec', 'House red. Full and juicy, with blackberry and a hint of spice.', null, true, false, false, array['Sulphites']::text[], 90);
  perform pg_temp.size(dr, '175ml glass', 520, 10);
  perform pg_temp.size(dr, '250ml glass', 680, 20);
  perform pg_temp.size(dr, 'Bottle', 1975, 30);
  c := pg_temp.cat('White Wine', 140);
  dr := pg_temp.drink(c, 'Frunza Pinot Grigio Feteasca Alba', 'Vegetarian. Banat, Romania. A refreshing blend with fresh pear, citrus and white peach and subtle floral aromas. Crisp acidity and a clean, lightly textured finish.', null, true, false, false, array['Sulphites']::text[], 10);
  perform pg_temp.size(dr, 'Bottle', 2025, 10);
  dr := pg_temp.drink(c, 'Rue Des Amis Sauvignon Blanc', 'Vegan · Vegetarian. South West France. A lively, zesty Sauvignon Blanc with mouth-watering freshness. Tropical orchard fruits and citrus notes create a confident, refreshing wine.', null, true, false, false, array['Sulphites']::text[], 20);
  perform pg_temp.size(dr, 'Bottle', 2150, 10);
  dr := pg_temp.drink(c, 'AUS Estate Chardonnay, De Bortoli', 'Vegan · Vegetarian. New South Wales, Australia. A soft, lightly oaked Chardonnay from family producers De Bortoli. Ripe peach and vanilla oak lead to a creamy palate of stone fruits and a long, smooth finish.', null, true, false, false, array['Sulphites']::text[], 30);
  perform pg_temp.size(dr, 'Bottle', 2400, 10);
  dr := pg_temp.drink(c, 'Seafarer Sauvignon Blanc', 'Vegan · Vegetarian. Marlborough, New Zealand. Vibrant and refreshing, with lime, grapefruit, passion fruit and gooseberry. Crisp and lively: excellent with seafood and salads.', null, true, false, false, array['Sulphites']::text[], 40);
  perform pg_temp.size(dr, 'Bottle', 2950, 10);
  dr := pg_temp.drink(c, 'Cuvee Prestige Picpoul de Pinet', 'Vegetarian. Languedoc, France. A dry white with a delicate pale-gold colour. Fresh fruity and floral aromas lead to a refreshing palate with subtle citrus notes.', null, true, false, false, array['Sulphites']::text[], 50);
  perform pg_temp.size(dr, 'Bottle', 3300, 10);
  c := pg_temp.cat('Rosé Wine', 150);
  dr := pg_temp.drink(c, 'Soprano Pinot Grigio Rosé', 'Vegetarian. Lombardia, Italy. A fresh, fruity rosé with inviting summer fruit aromas. Strawberry flavours and refreshing acidity create a light, enjoyable wine.', null, true, false, false, array['Sulphites']::text[], 10);
  perform pg_temp.size(dr, 'Bottle', 2025, 10);
  dr := pg_temp.drink(c, 'Terrazzo Zinfandel Rosé', 'Vegan · Vegetarian. California, USA. A juicy, approachable rosé for warm summer days or cooler evenings. Raspberry, strawberry and sweet melon make it deliciously fruity.', null, true, false, false, array['Sulphites']::text[], 20);
  perform pg_temp.size(dr, 'Bottle', 1925, 10);
  dr := pg_temp.drink(c, 'Villanelle Cinsault Rosé', 'Vegan · Vegetarian. Languedoc, France. An elegant, vibrant rosé with red berries, rose petals and a touch of citrus. Light-bodied with crisp acidity and a smooth, refreshing finish.', null, true, false, false, array['Sulphites']::text[], 30);
  perform pg_temp.size(dr, 'Bottle', 2275, 10);
  c := pg_temp.cat('Red Wine', 160);
  dr := pg_temp.drink(c, 'San Elian Merlot', 'Vegan · Vegetarian. Central Valley, Chile. A smooth, medium-bodied Merlot with aromas of black cherries. Juicy red and black fruit and soft tannins give an approachable finish.', null, true, false, false, array['Sulphites']::text[], 10);
  perform pg_temp.size(dr, 'Bottle', 2175, 10);
  dr := pg_temp.drink(c, 'De Bortoli AUS Estate Shiraz', 'Vegan · Vegetarian. New South Wales, Australia. A fresh, fruity Shiraz from family producers De Bortoli. Juicy berry flavours, gentle spice and soft tannins. Medium-bodied, generous and smooth.', null, true, false, false, array['Sulphites']::text[], 20);
  perform pg_temp.size(dr, 'Bottle', 2450, 10);
  dr := pg_temp.drink(c, 'Oscuro Mendoza Malbec', 'Vegan · Vegetarian. Mendoza, Argentina. A rich, juicy Malbec with plum and blackberry and subtle chocolate and vanilla from oak ageing. Elegant and smooth with a long finish.', null, true, false, false, array['Sulphites']::text[], 30);
  perform pg_temp.size(dr, 'Bottle', 2125, 10);
  dr := pg_temp.drink(c, 'Showdown Cabernet Sauvignon', 'Vegan · Vegetarian. California, USA. Ripe blackcurrant and wild berry aromas with sweet vanilla oak. Cassis and black cherry lead to a soft, juicy, long-lasting finish.', null, true, false, false, array['Sulphites']::text[], 40);
  perform pg_temp.size(dr, 'Bottle', 3175, 10);
  dr := pg_temp.drink(c, 'Milhojas Crianza, Rioja', 'Vegan · Vegetarian. Rioja, Spain. Full-bodied yet smooth, made with 75% Tempranillo and 25% Garnacha. Vanilla spice and baked red fruit: approachable, and lovely on its own.', null, true, false, false, array['Sulphites']::text[], 50);
  perform pg_temp.size(dr, 'Bottle', 2775, 10);
  c := pg_temp.cat('Prosecco & Champagne', 170);
  dr := pg_temp.drink(c, 'Botter Spumante Prosecco', 'Vegan · Vegetarian. Veneto, Italy. A lively, refreshing Prosecco with delicate fruity notes, sherbet-like freshness and a soft, creamy finish.', null, true, false, false, array['Sulphites']::text[], 10);
  perform pg_temp.size(dr, 'Bottle', 2400, 10);
  dr := pg_temp.drink(c, 'Baron De Villeboerg Brut Champagne', 'Vegan · Vegetarian. Champagne, France. An elegant Champagne from Ville-sur-Arce in southern Champagne. Blossom and yellow fruit aromas, fine balance, pear notes and a long finish.', null, true, false, false, array['Sulphites']::text[], 20);
  perform pg_temp.size(dr, 'Bottle', 6850, 10);
  c := pg_temp.cat('Soft Drinks', 180);
  dr := pg_temp.drink(c, 'Lemonade', 'Crisp, sparkling lemonade.', null, false, false, true, '{}'::text[], 10);
  perform pg_temp.size(dr, '16oz', 260, 10);
  perform pg_temp.size(dr, '20oz', 300, 20);
  dr := pg_temp.drink(c, 'Pepsi', 'Ice-cold Pepsi cola.', null, false, false, true, '{}'::text[], 20);
  perform pg_temp.size(dr, '16oz', 260, 10);
  perform pg_temp.size(dr, '20oz', 300, 20);
  dr := pg_temp.drink(c, 'Pepsi Max', 'Maximum taste, no sugar.', null, false, false, true, '{}'::text[], 30);
  perform pg_temp.size(dr, '16oz', 260, 10);
  perform pg_temp.size(dr, '20oz', 300, 20);
  dr := pg_temp.drink(c, 'Soda & Lime', 'Soda water with a splash of lime cordial.', null, false, false, true, '{}'::text[], 40);
  perform pg_temp.size(dr, '16oz', 200, 10);
  perform pg_temp.size(dr, '20oz', 240, 20);
  dr := pg_temp.drink(c, 'Soda & Blackcurrant', 'Soda water with a splash of blackcurrant cordial.', null, false, false, true, '{}'::text[], 50);
  perform pg_temp.size(dr, '16oz', 200, 10);
  perform pg_temp.size(dr, '20oz', 240, 20);
  c := pg_temp.cat('Cans, Juices & Mixers', 190);
  dr := pg_temp.drink(c, 'Coca-Cola', 'The original. Served with ice and a glass.', null, false, false, true, '{}'::text[], 10);
  perform pg_temp.size(dr, '330ml can', 200, 10);
  dr := pg_temp.drink(c, 'Diet Coke', 'Great Coke taste, no sugar. Served with ice and a glass.', null, false, false, true, '{}'::text[], 20);
  perform pg_temp.size(dr, '330ml can', 200, 10);
  dr := pg_temp.drink(c, 'Coke Zero', 'Real Coca-Cola taste, zero sugar. Served with ice and a glass.', null, false, false, true, '{}'::text[], 30);
  perform pg_temp.size(dr, '330ml can', 200, 10);
  dr := pg_temp.drink(c, 'J2O Orange & Passion Fruit', 'Orange and passion fruit juice drink, lightly sparkling.', null, false, false, true, '{}'::text[], 40);
  perform pg_temp.size(dr, '275ml bottle', 240, 10);
  dr := pg_temp.drink(c, 'J2O Mango & Apple', 'Mango and apple juice drink, lightly sparkling.', null, false, false, true, '{}'::text[], 50);
  perform pg_temp.size(dr, '275ml bottle', 240, 10);
  dr := pg_temp.drink(c, 'J2O Apple & Blackcurrant', 'Apple and blackcurrant juice drink, lightly sparkling.', null, false, false, true, '{}'::text[], 60);
  perform pg_temp.size(dr, '275ml bottle', 240, 10);
  dr := pg_temp.drink(c, 'Appletiser', 'Sparkling 100% apple juice.', null, false, false, true, '{}'::text[], 70);
  perform pg_temp.size(dr, '275ml bottle', 220, 10);
  dr := pg_temp.drink(c, 'Water', 'Still bottled water.', null, false, false, true, '{}'::text[], 80);
  perform pg_temp.size(dr, '500ml bottle', 120, 10);
  dr := pg_temp.drink(c, 'Slimline Britvic Tonic', 'Low-calorie Indian tonic water.', null, false, false, true, '{}'::text[], 90);
  perform pg_temp.size(dr, '200ml bottle', 240, 10);
  dr := pg_temp.drink(c, 'Fever-Tree Low Calorie Tonic', 'Fever-Tree''s refreshingly light Indian tonic, with fewer calories.', null, false, false, true, '{}'::text[], 100);
  perform pg_temp.size(dr, '200ml bottle', 280, 10);
  dr := pg_temp.drink(c, 'Britvic Orange', 'Orange juice drink. A classic mixer.', null, false, false, true, '{}'::text[], 110);
  perform pg_temp.size(dr, '200ml bottle', 240, 10);
  dr := pg_temp.drink(c, 'Chocolate Milkshake', 'Rich, creamy chocolate milkshake.', null, false, false, false, array['Milk']::text[], 120);
  perform pg_temp.size(dr, 'Bottle', 250, 10);
  dr := pg_temp.drink(c, 'Strawberry Milkshake', 'Creamy strawberry milkshake.', null, false, false, false, array['Milk']::text[], 130);
  perform pg_temp.size(dr, 'Bottle', 250, 10);
  dr := pg_temp.drink(c, 'Vanilla Milkshake', 'Smooth, creamy vanilla milkshake.', null, false, false, false, array['Milk']::text[], 140);
  perform pg_temp.size(dr, 'Bottle', 250, 10);
  dr := pg_temp.drink(c, 'Fruit Shoot Orange & Blackcurrant', 'Kids'' fruit drink, no added sugar.', null, false, false, false, '{}'::text[], 150);
  perform pg_temp.size(dr, 'Bottle', 120, 10);
end $$;

-- 4. The new mixer choices, each following its drink (out of stock with it).
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'No mixer', 0, 0, null from public.modifier_groups where name = 'Add a mixer';
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'Lemonade', 60, 10, (select id from public.drinks where name = 'Lemonade' and archived_at is null limit 1) from public.modifier_groups where name = 'Add a mixer';
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'Pepsi', 60, 20, (select id from public.drinks where name = 'Pepsi' and archived_at is null limit 1) from public.modifier_groups where name = 'Add a mixer';
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'Pepsi Max', 60, 30, (select id from public.drinks where name = 'Pepsi Max' and archived_at is null limit 1) from public.modifier_groups where name = 'Add a mixer';
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'Coca-Cola', 180, 40, (select id from public.drinks where name = 'Coca-Cola' and archived_at is null limit 1) from public.modifier_groups where name = 'Add a mixer';
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'Diet Coke', 180, 50, (select id from public.drinks where name = 'Diet Coke' and archived_at is null limit 1) from public.modifier_groups where name = 'Add a mixer';
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'Coke Zero', 180, 60, (select id from public.drinks where name = 'Coke Zero' and archived_at is null limit 1) from public.modifier_groups where name = 'Add a mixer';
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'Slimline Britvic Tonic', 200, 70, (select id from public.drinks where name = 'Slimline Britvic Tonic' and archived_at is null limit 1) from public.modifier_groups where name = 'Add a mixer';
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'Fever-Tree Low Calorie Tonic', 240, 80, (select id from public.drinks where name = 'Fever-Tree Low Calorie Tonic' and archived_at is null limit 1) from public.modifier_groups where name = 'Add a mixer';
insert into public.modifier_options (group_id, label, price_pence, sort_order, linked_drink_id)
select id, 'Britvic Orange', 200, 90, (select id from public.drinks where name = 'Britvic Orange' and archived_at is null limit 1) from public.modifier_groups where name = 'Add a mixer';

commit;
