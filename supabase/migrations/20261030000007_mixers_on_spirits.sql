-- Every spirit offers "Add a mixer" (owner's decision). Attaches the mixer
-- options to each spirit already on the menu. New spirits get it ticked
-- automatically in the drink editor. Safe to run more than once.
begin;

do $$
declare
  v_group uuid;
  v_added integer;
begin
  select id into v_group from public.modifier_groups
  where name ilike '%mixer%' order by sort_order limit 1;

  -- No mixer list yet: create the standard one.
  if v_group is null then
    insert into public.modifier_groups (name, required, sort_order)
    values ('Add a mixer', false, 10) returning id into v_group;
    insert into public.modifier_options (group_id, label, price_pence, sort_order) values
      (v_group, 'No mixer', 0, 0),
      (v_group, 'Fever-Tree Indian tonic', 180, 10),
      (v_group, 'Fever-Tree Light tonic', 180, 20),
      (v_group, 'Lemonade', 120, 30),
      (v_group, 'Coca-Cola', 120, 40),
      (v_group, 'Diet Coke', 120, 50);
  end if;

  insert into public.drink_modifier_groups (drink_id, group_id)
  select d.id, v_group
  from public.drinks d
  join public.categories c on c.id = d.category_id
  where c.name ilike '%spirit%'
  on conflict (drink_id, group_id) do nothing;
  get diagnostics v_added = row_count;

  raise notice 'Added the mixer options to % spirit(s).', v_added;
end;
$$;

commit;
