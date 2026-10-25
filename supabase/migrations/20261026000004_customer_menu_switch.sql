-- =============================================================================
-- Launch switch for the customer menu. While it's off, drinksorder.app shows
-- "Table ordering is being set up" to the public; the owner can still preview
-- the real menu with drinksorder.app/?preview. Turned on in Venue settings.
-- =============================================================================

begin;

alter table public.venue_settings
  add column customer_menu_live boolean not null default false;

commit;
