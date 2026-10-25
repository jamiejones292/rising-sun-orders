-- =============================================================================
-- Starting data: venue settings, ordering hours, tables 1-25 and an EXAMPLE
-- menu matching the design prototypes. Prices are placeholders; replace them
-- with the pub's real menu in the admin site.
--
-- Safe to run once on a fresh database. Running it again adds duplicate
-- drinks, so only run it again after clearing the menu.
-- =============================================================================

begin;

insert into public.venue_settings (id) values (1)
on conflict (id) do nothing;

-- Ordering hours (placeholder: check against the premises licence).
insert into public.opening_hours (weekday, opens_at, closes_at, closed) values
  (1, '16:00', '23:00', false),  -- Monday
  (2, '16:00', '23:00', false),
  (3, '12:00', '23:00', false),
  (4, '12:00', '23:00', false),
  (5, '12:00', '23:30', false),
  (6, '12:00', '23:30', false),
  (7, '12:00', '22:30', false)   -- Sunday
on conflict (weekday) do nothing;

-- Tables 1 to 25, no areas yet.
insert into public.venue_tables (label, sort_order)
select n::text, n from generate_series(1, 25) as n
on conflict (label) do nothing;

do $$
declare
  c_draught uuid; c_bottles uuid; c_white uuid; c_red uuid; c_rose uuid;
  c_spirits uuid; c_cocktails uuid; c_soft uuid; c_af uuid; c_hot uuid;
  g_mixer uuid; g_serve uuid; g_milk uuid;
  d uuid;
begin
  -- Categories, in menu order.
  insert into public.categories (name, sort_order) values ('Draught Beer & Lager', 10) returning id into c_draught;
  insert into public.categories (name, sort_order) values ('Bottled Beer & Cider', 20) returning id into c_bottles;
  insert into public.categories (name, sort_order) values ('White Wine', 30) returning id into c_white;
  insert into public.categories (name, sort_order) values ('Red Wine', 40) returning id into c_red;
  insert into public.categories (name, sort_order) values ('Rosé & Sparkling', 50) returning id into c_rose;
  insert into public.categories (name, sort_order) values ('Spirits', 60) returning id into c_spirits;
  insert into public.categories (name, sort_order) values ('Cocktails', 70) returning id into c_cocktails;
  insert into public.categories (name, sort_order) values ('Soft Drinks', 80) returning id into c_soft;
  insert into public.categories (name, sort_order) values ('Alcohol-Free', 90) returning id into c_af;
  insert into public.categories (name, sort_order) values ('Hot Drinks', 100) returning id into c_hot;

  -- Extras groups.
  insert into public.modifier_groups (name, required, sort_order) values ('Add a mixer', false, 10) returning id into g_mixer;
  insert into public.modifier_options (group_id, label, price_pence, sort_order) values
    (g_mixer, 'No mixer', 0, 0),
    (g_mixer, 'Fever-Tree Indian tonic', 180, 10),
    (g_mixer, 'Fever-Tree Light tonic', 180, 20),
    (g_mixer, 'Lemonade', 120, 30),
    (g_mixer, 'Coca-Cola', 120, 40),
    (g_mixer, 'Diet Coke', 120, 50);

  insert into public.modifier_groups (name, required, sort_order) values ('How would you like it?', true, 20) returning id into g_serve;
  insert into public.modifier_options (group_id, label, price_pence, sort_order) values
    (g_serve, 'Neat', 0, 0), (g_serve, 'With ice', 0, 10), (g_serve, 'Splash of water', 0, 20);

  insert into public.modifier_groups (name, required, sort_order) values ('Milk', true, 30) returning id into g_milk;
  insert into public.modifier_options (group_id, label, price_pence, sort_order) values
    (g_milk, 'Whole milk', 0, 0), (g_milk, 'Semi-skimmed', 0, 10), (g_milk, 'Oat milk', 40, 20);

  -- Draught: half and pint.
  insert into public.drinks (category_id, name, description, abv, is_welsh, allergens, sort_order)
  values (c_draught, 'Brains SA', 'Cardiff''s classic best bitter. Malty, smooth and easy-drinking.', 4.2, true, '{"Cereals containing gluten"}', 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Half pint', 270, 10), (d, 'Pint', 520, 20);

  insert into public.drinks (category_id, name, description, abv, is_welsh, allergens, sort_order)
  values (c_draught, 'Tiny Rebel Cwtch', 'Award-winning Welsh red ale from Newport. Caramel malt and citrus hops.', 4.6, true, '{"Cereals containing gluten"}', 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Half pint', 310, 10), (d, 'Pint', 600, 20);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_draught, 'Birra Moretti', 'Crisp Italian lager with a gentle bitterness.', 4.6, '{"Cereals containing gluten"}', 30) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Half pint', 320, 10), (d, 'Pint', 620, 20);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_draught, 'Guinness', 'Irish stout, poured properly and left to settle.', 4.2, '{"Cereals containing gluten"}', 40) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Half pint', 310, 10), (d, 'Pint', 600, 20);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_draught, 'Carling', 'Refreshing, easy-going British lager.', 3.7, '{"Cereals containing gluten"}', 50) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Half pint', 290, 10), (d, 'Pint', 560, 20);

  -- Bottles.
  insert into public.drinks (category_id, name, description, abv, is_welsh, allergens, sort_order)
  values (c_bottles, 'Gwynt y Ddraig Black Dragon', 'Medium-dry Welsh farmhouse cider. 500ml bottle.', 7.2, true, '{"Sulphites"}', 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, '500ml bottle', 580);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_bottles, 'Corona Extra', 'Served ice cold with a wedge of lime. 330ml.', 4.5, '{"Cereals containing gluten"}', 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, '330ml bottle', 460);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_bottles, 'Old Mout Berries & Lime', 'Fruity, refreshing cider over ice. 500ml.', 4.0, '{"Sulphites"}', 30) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, '500ml bottle', 560);

  -- Wine: 125ml, 175ml, 250ml, bottle.
  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_white, 'Sauvignon Blanc, Marlborough', 'Zesty and fresh: gooseberry, lime and passion fruit.', 12.5, '{"Sulphites"}', 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values
    (d, '125ml glass', 500, 10), (d, '175ml glass', 650, 20), (d, '250ml glass', 850, 30), (d, 'Bottle 750ml', 2400, 40);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_white, 'Pinot Grigio, Veneto', 'Light, dry and delicate with hints of pear.', 12.0, '{"Sulphites"}', 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values
    (d, '125ml glass', 460, 10), (d, '175ml glass', 600, 20), (d, '250ml glass', 790, 30), (d, 'Bottle 750ml', 2200, 40);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_red, 'Merlot, Chile', 'Soft and round, with plum and dark cherry.', 13.0, '{"Sulphites"}', 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values
    (d, '125ml glass', 480, 10), (d, '175ml glass', 620, 20), (d, '250ml glass', 820, 30), (d, 'Bottle 750ml', 2300, 40);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_red, 'Malbec, Mendoza', 'Rich and velvety, blackberry and a little spice.', 13.5, '{"Sulphites"}', 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values
    (d, '125ml glass', 560, 10), (d, '175ml glass', 720, 20), (d, '250ml glass', 950, 30), (d, 'Bottle 750ml', 2700, 40);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_rose, 'White Zinfandel, California', 'Pink and summery: strawberry and watermelon.', 10.5, '{"Sulphites"}', 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values
    (d, '125ml glass', 460, 10), (d, '175ml glass', 600, 20), (d, '250ml glass', 790, 30), (d, 'Bottle 750ml', 2200, 40);

  insert into public.drinks (category_id, name, description, abv, allergens, sort_order)
  values (c_rose, 'Prosecco DOC', 'Light, fresh bubbles with green apple and pear.', 11.0, '{"Sulphites"}', 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values
    (d, '200ml bottle', 750, 10), (d, 'Bottle 750ml', 2900, 20);

  -- Spirits: single and double, with mixers (and "No ice") or serve options.
  insert into public.drinks (category_id, name, description, abv, offers_no_ice, sort_order)
  values (c_spirits, 'Gordon''s Gin', 'London dry gin. Juniper-forward and classic.', 37.5, true, 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Single 25ml', 450, 10), (d, 'Double 50ml', 700, 20);
  insert into public.drink_modifier_groups (drink_id, group_id) values (d, g_mixer);

  insert into public.drinks (category_id, name, description, abv, is_welsh, sort_order)
  values (c_spirits, 'Penderyn Madeira', 'Single malt Welsh whisky from the Brecon Beacons, finished in Madeira casks.', 46.0, true, 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Single 25ml', 520, 10), (d, 'Double 50ml', 880, 20);
  insert into public.drink_modifier_groups (drink_id, group_id) values (d, g_serve);

  insert into public.drinks (category_id, name, description, abv, offers_no_ice, sort_order)
  values (c_spirits, 'Smirnoff Red', 'Clean, smooth vodka.', 37.5, true, 30) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Single 25ml', 420, 10), (d, 'Double 50ml', 660, 20);
  insert into public.drink_modifier_groups (drink_id, group_id) values (d, g_mixer);

  insert into public.drinks (category_id, name, description, abv, sort_order)
  values (c_spirits, 'Jameson', 'Triple-distilled Irish whiskey.', 40.0, 40) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Single 25ml', 450, 10), (d, 'Double 50ml', 720, 20);
  insert into public.drink_modifier_groups (drink_id, group_id) values (d, g_serve);

  -- Cocktails.
  insert into public.drinks (category_id, name, description, sort_order)
  values (c_cocktails, 'Espresso Martini', 'Vodka, coffee liqueur and a fresh shot of espresso.', 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, 'Cocktail', 950);

  insert into public.drinks (category_id, name, description, allergens, sort_order)
  values (c_cocktails, 'Aperol Spritz', 'Aperol, Prosecco and soda with an orange slice.', '{"Sulphites"}', 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, 'Cocktail', 850);

  -- Soft drinks (all offer "No ice").
  insert into public.drinks (category_id, name, description, contains_alcohol, offers_no_ice, sort_order)
  values (c_soft, 'Coca-Cola', 'From the tap, with ice and lemon.', false, true, 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Half pint', 190, 10), (d, 'Pint', 320, 20);

  insert into public.drinks (category_id, name, description, contains_alcohol, offers_no_ice, sort_order)
  values (c_soft, 'Diet Coke', 'From the tap, with ice and lemon.', false, true, 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Half pint', 190, 10), (d, 'Pint', 320, 20);

  insert into public.drinks (category_id, name, description, contains_alcohol, offers_no_ice, sort_order)
  values (c_soft, 'Lemonade', 'From the tap.', false, true, 30) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence, sort_order) values (d, 'Half pint', 180, 10), (d, 'Pint', 300, 20);

  insert into public.drinks (category_id, name, description, contains_alcohol, offers_no_ice, sort_order)
  values (c_soft, 'J2O Orange & Passion Fruit', '275ml bottle.', false, true, 40) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, '275ml bottle', 340);

  -- Alcohol-free.
  insert into public.drinks (category_id, name, description, abv, contains_alcohol, allergens, sort_order)
  values (c_af, 'Guinness 0.0', 'All the stout, none of the alcohol. 440ml can, poured.', 0.0, false, '{"Cereals containing gluten"}', 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, '440ml', 420);

  insert into public.drinks (category_id, name, description, abv, contains_alcohol, allergens, sort_order)
  values (c_af, 'Lucky Saint', 'Unfiltered alcohol-free lager. 330ml.', 0.5, false, '{"Cereals containing gluten"}', 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, '330ml bottle', 460);

  -- Hot drinks.
  insert into public.drinks (category_id, name, description, contains_alcohol, allergens, sort_order)
  values (c_hot, 'Latte', 'Double shot with steamed milk.', false, '{"Milk"}', 10) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, 'Regular', 320);
  insert into public.drink_modifier_groups (drink_id, group_id) values (d, g_milk);

  insert into public.drinks (category_id, name, description, contains_alcohol, sort_order)
  values (c_hot, 'Americano', 'Double shot, topped with hot water.', false, 20) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, 'Regular', 280);

  insert into public.drinks (category_id, name, description, contains_alcohol, is_welsh, allergens, sort_order)
  values (c_hot, 'Pot of Tea', 'Glengettie Welsh tea, milk on the side.', false, true, '{"Milk"}', 30) returning id into d;
  insert into public.drink_variants (drink_id, label, price_pence) values (d, 'Pot for one', 260);
end;
$$;

commit;
