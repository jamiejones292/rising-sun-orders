-- The Rising Sun Inn: the Coke mixers say they're a can (November 2026).
-- "Coca-Cola" becomes "Coca-Cola (can)", and the same for Diet Coke and Coke Zero,
-- in the spirits' "Add a mixer" list. Customers see it when choosing a mixer and the
-- bar sees it on the order. Prices and stock links are unchanged.
-- Run in the Supabase SQL Editor. Safe to run more than once.
begin;

update public.modifier_options o
   set label = o.label || ' (can)'
  from public.modifier_groups g
 where g.id = o.group_id
   and g.name = 'Add a mixer'
   and o.archived_at is null
   and o.label in ('Coca-Cola', 'Diet Coke', 'Coke Zero');

commit;
