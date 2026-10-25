import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Category, Drink, ModifierGroup, OpeningHours, VenueSettings, VenueTable } from "./types";

// Loads what the admin pages need. Signed-in managers see archived rows too
// (the security rules allow it), so the pages filter as needed.

const DRINK_SELECT =
  "id, category_id, name, description, abv, contains_alcohol, is_welsh, offers_no_ice, allergens, vat_rate, available, sort_order, archived_at, drink_variants(id, drink_id, label, price_pence, available, sort_order, archived_at), drink_modifier_groups(group_id)";

export type MenuData = {
  categories: Category[];
  drinks: Drink[];
  groups: ModifierGroup[];
};

export function useMenuData() {
  const [data, setData] = useState<MenuData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [c, d, g] = await Promise.all([
      supabase.from("categories").select("id, name, sort_order, visible").order("sort_order"),
      supabase.from("drinks").select(DRINK_SELECT).order("sort_order"),
      supabase
        .from("modifier_groups")
        .select("id, name, required, sort_order, modifier_options(id, label, price_pence, archived_at)")
        .order("sort_order"),
    ]);
    const err = c.error || d.error || g.error;
    if (err) {
      setError(err.message);
      return;
    }
    const drinks = (d.data as unknown as Drink[]).map((x) => ({
      ...x,
      drink_variants: [...x.drink_variants].sort((a, b) => a.sort_order - b.sort_order),
    }));
    setData({ categories: c.data as Category[], drinks, groups: g.data as unknown as ModifierGroup[] });
    setError(null);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload, setData };
}

export function useVenue() {
  const [settings, setSettings] = useState<VenueSettings | null>(null);
  const [hours, setHours] = useState<OpeningHours[]>([]);
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [s, h, t] = await Promise.all([
      supabase.from("venue_settings").select("*").eq("id", 1).single(),
      supabase.from("opening_hours").select("*").order("weekday"),
      supabase.from("venue_tables").select("id, label, area_id, active, sort_order").order("sort_order"),
    ]);
    const err = s.error || h.error || t.error;
    if (err) {
      setError(err.message);
      return;
    }
    setSettings(s.data as VenueSettings);
    setHours(h.data as OpeningHours[]);
    setTables(t.data as VenueTable[]);
    setError(null);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { settings, hours, tables, error, reload, setSettings, setTables };
}

// Today's ordering hours in the venue's timezone (Europe/London).
export function todaysHours(hours: OpeningHours[]): OpeningHours | undefined {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" }).format(new Date());
  const iso = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(day) + 1;
  return hours.find((h) => h.weekday === iso);
}

export const hhmm = (t: string) => t.slice(0, 5);
