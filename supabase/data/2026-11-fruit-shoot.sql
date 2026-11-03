-- Fruit Shoot: one drink with a choice of Orange or Blackcurrant.
-- For a menu where 2026-11-new-menu.sql has already been run. Safe to run more
-- than once, and harmless if the menu hasn't been run yet (that file includes it).
begin;

insert into public.modifier_groups (name, required, sort_order)
select 'Flavour', true, 50 where not exists (select 1 from public.modifier_groups where name = 'Flavour');
insert into public.modifier_options (group_id, label, price_pence, sort_order)
select g.id, 'Orange', 0, 0 from public.modifier_groups g where g.name = 'Flavour'
   and not exists (select 1 from public.modifier_options o where o.group_id = g.id and o.label = 'Orange' and o.archived_at is null);
insert into public.modifier_options (group_id, label, price_pence, sort_order)
select g.id, 'Blackcurrant', 0, 10 from public.modifier_groups g where g.name = 'Flavour'
   and not exists (select 1 from public.modifier_options o where o.group_id = g.id and o.label = 'Blackcurrant' and o.archived_at is null);

update public.drinks
   set name = 'Fruit Shoot', description = 'Kids'' fruit drink, no added sugar. Orange or blackcurrant.'
 where name = 'Fruit Shoot Orange & Blackcurrant' and archived_at is null;

insert into public.drink_modifier_groups (drink_id, group_id)
select d.id, g.id from public.drinks d, public.modifier_groups g
 where d.name = 'Fruit Shoot' and d.archived_at is null and g.name = 'Flavour'
on conflict do nothing;

commit;
