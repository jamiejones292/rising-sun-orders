-- Mixers follow their soft drink's stock: if Coca-Cola is switched off, the
-- "Coca-Cola" mixer goes off too (and back on with it), so nobody can order a
-- vodka and Coke. Mixers that aren't a drink on the menu (e.g. tonics) get
-- their own stock switch, set_option_available.
begin;

alter table public.modifier_options
  add column linked_drink_id uuid references public.drinks (id) on delete set null;
create index modifier_options_linked_drink_idx on public.modifier_options (linked_drink_id)
  where linked_drink_id is not null;

-- A drink switched off, on, archived or restored: its linked options follow.
create function public.sync_linked_options()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.modifier_options
     set available = (new.available and new.archived_at is null)
   where linked_drink_id = new.id
     and available is distinct from (new.available and new.archived_at is null);
  return null;
end;
$$;
create trigger drinks_sync_linked_options
  after update of available, archived_at on public.drinks
  for each row execute function public.sync_linked_options();

-- An option newly linked to a drink starts with that drink's stock.
create function public.linked_option_follows_drink()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.linked_drink_id is not null then
    select d.available and d.archived_at is null into new.available
      from public.drinks d where d.id = new.linked_drink_id;
  end if;
  return new;
end;
$$;
create trigger modifier_options_follow_drink
  before insert or update of linked_drink_id on public.modifier_options
  for each row execute function public.linked_option_follows_drink();

-- Stock switch for an option that isn't linked to a drink. Same permission as
-- the drink switches; linked options are changed through their drink instead.
create function public.set_option_available(p_option_id uuid, p_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_toggle_stock() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.modifier_options set available = p_available
   where id = p_option_id and archived_at is null and linked_drink_id is null;
  if not found then
    raise exception 'option_not_found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_available', 'modifier_option', p_option_id::text,
          jsonb_build_object('available', p_available));
end;
$$;
revoke all on function public.set_option_available(uuid, boolean) from public, anon;
grant execute on function public.set_option_available(uuid, boolean) to authenticated;

-- Link existing options to the drink with exactly the same name, where there's
-- only one such drink on the menu.
update public.modifier_options o
   set linked_drink_id = m.drink_id
  from (
    select o2.id as option_id, min(d.id::text)::uuid as drink_id
      from public.modifier_options o2
      join public.drinks d on lower(trim(d.name)) = lower(trim(o2.label)) and d.archived_at is null
     where o2.archived_at is null
     group by o2.id
    having count(*) = 1
  ) m
 where o.id = m.option_id;

do $$
declare r record;
begin
  for r in
    select g.name as grp, o.label, d.name as drink
      from public.modifier_options o
      join public.modifier_groups g on g.id = o.group_id
      left join public.drinks d on d.id = o.linked_drink_id
     where o.archived_at is null and g.name ilike '%mixer%'
     order by o.sort_order
  loop
    raise notice '%: % -> %', r.grp, r.label, coalesce('follows the drink "' || r.drink || '"', 'own stock switch');
  end loop;
end;
$$;

commit;
