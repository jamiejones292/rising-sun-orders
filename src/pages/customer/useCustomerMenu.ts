import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { PricingMenu } from "../../lib/pricing";
import type { OpeningHours } from "../../lib/types";

export type MenuDrink = PricingMenu["drinks"][number] & {
  category_id: string;
  description: string;
  abv: number | null;
  is_welsh: boolean;
  allergens: string[];
  sort_order: number;
};

export type CustomerMenu = {
  categories: { id: string; name: string; sort_order: number }[];
  drinks: MenuDrink[];
  tables: { id: string; label: string; sort_order: number }[];
  hours: OpeningHours[];
  settings: {
    ordering_paused: boolean;
    pause_message: string;
    age_declaration_text: string;
    minimum_order_pence: number;
    customer_menu_live: boolean;
    test_orders_until: string | null;
  };
};

type Row = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  abv: number | null;
  contains_alcohol: boolean;
  is_welsh: boolean;
  offers_no_ice: boolean;
  allergens: string[];
  vat_rate: number;
  available: boolean;
  sort_order: number;
  archived_at: string | null;
  drink_variants: (PricingMenu["drinks"][number]["variants"][number] & { sort_order: number })[];
  drink_modifier_groups: {
    sort_order: number;
    modifier_groups: {
      id: string;
      name: string;
      required: boolean;
      sort_order: number;
      modifier_options: (PricingMenu["drinks"][number]["groups"][number]["options"][number] & { sort_order: number })[];
    } | null;
  }[];
};

const DRINKS =
  "id, category_id, name, description, abv, contains_alcohol, is_welsh, offers_no_ice, allergens, vat_rate, available, sort_order, archived_at, " +
  "drink_variants(id, label, price_pence, available, archived_at, sort_order), " +
  "drink_modifier_groups(sort_order, modifier_groups(id, name, required, sort_order, modifier_options(id, label, price_pence, available, archived_at, sort_order)))";

// Everything the customer pages show, read with the public (signed-out)
// permissions. Reloads when the bar or admin changes stock, prices or pausing.
export function useCustomerMenu() {
  const [menu, setMenu] = useState<CustomerMenu | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const [c, d, t, h, s] = await Promise.all([
      supabase.from("categories").select("id, name, sort_order, visible").eq("visible", true).order("sort_order"),
      supabase.from("drinks").select(DRINKS).is("archived_at", null).order("sort_order"),
      supabase.from("venue_tables").select("id, label, sort_order").eq("active", true).order("sort_order"),
      supabase.from("opening_hours").select("*").order("weekday"),
      supabase
        .from("venue_settings")
        .select("ordering_paused, pause_message, age_declaration_text, minimum_order_pence, customer_menu_live, test_orders_until")
        .eq("id", 1)
        .single(),
    ]);
    if (c.error || d.error || t.error || h.error || s.error) {
      setError(true);
      return;
    }
    const visible = new Set((c.data ?? []).map((x) => x.id));
    const drinks: MenuDrink[] = (d.data as unknown as Row[]).map((r) => ({
      id: r.id,
      category_id: r.category_id,
      name: r.name,
      description: r.description,
      abv: r.abv,
      is_welsh: r.is_welsh,
      allergens: r.allergens,
      sort_order: r.sort_order,
      available: r.available,
      archived_at: r.archived_at,
      category_visible: visible.has(r.category_id),
      offers_no_ice: r.offers_no_ice,
      contains_alcohol: r.contains_alcohol,
      vat_rate: Number(r.vat_rate),
      variants: [...r.drink_variants].filter((v) => !v.archived_at).sort((a, b) => a.sort_order - b.sort_order),
      groups: [...r.drink_modifier_groups]
        .filter((g) => g.modifier_groups)
        .sort((a, b) => a.sort_order - b.sort_order || a.modifier_groups!.sort_order - b.modifier_groups!.sort_order)
        .map((g) => ({
          id: g.modifier_groups!.id,
          name: g.modifier_groups!.name,
          required: g.modifier_groups!.required,
          options: [...g.modifier_groups!.modifier_options].filter((o) => !o.archived_at).sort((a, b) => a.sort_order - b.sort_order),
        })),
    }));
    setMenu({
      categories: c.data ?? [],
      drinks,
      tables: t.data ?? [],
      hours: (h.data as OpeningHours[]) ?? [],
      settings: s.data as CustomerMenu["settings"],
    });
    setError(false);
  }, []);

  useEffect(() => {
    void load();
    let timer: number | undefined;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 400);
    };
    const channel = supabase
      .channel("customer-menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "drinks" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_variants" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "modifier_options" }, soon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "venue_settings" }, soon)
      .subscribe();
    // Backup for phones that slept or missed an update.
    const poll = window.setInterval(() => void load(), 60_000);
    const wake = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", wake);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { menu, error, reload: load };
}
