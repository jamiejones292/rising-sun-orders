// Basket pricing rules, shared by the customer pages (to show totals) and, later,
// the server (which recalculates every total itself before taking payment).
// Pure TypeScript with no browser or database code, so both can import it.

export type PricingMenu = {
  drinks: {
    id: string;
    name: string;
    available: boolean;
    archived_at: string | null;
    category_visible: boolean;
    offers_no_ice: boolean;
    contains_alcohol: boolean;
    vat_rate: number;
    variants: { id: string; label: string; price_pence: number; available: boolean; archived_at: string | null }[];
    groups: {
      id: string;
      name: string;
      required: boolean;
      options: { id: string; label: string; price_pence: number; available: boolean; archived_at: string | null }[];
    }[];
  }[];
};

export type BasketLine = {
  drinkId: string;
  variantId: string;
  options: Record<string, string>; // modifier group id -> chosen option id
  noIce: boolean;
  quantity: number;
};

export type PricedLine = {
  ok: true;
  unitPence: number;
  totalPence: number;
  vatRate: number;
  drinkName: string;
  variantLabel: string;
  extras: { groupName: string; optionLabel: string; pricePence: number }[];
  noIce: boolean;
  containsAlcohol: boolean;
};

export type LineProblem = { ok: false; reason: "drink_unavailable" | "size_unavailable" | "option_unavailable" | "choice_required" | "bad_quantity" };

export const MAX_QUANTITY = 20;

export function priceLine(menu: PricingMenu, line: BasketLine): PricedLine | LineProblem {
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) return { ok: false, reason: "bad_quantity" };
  const drink = menu.drinks.find((d) => d.id === line.drinkId);
  if (!drink || !drink.available || drink.archived_at || !drink.category_visible) return { ok: false, reason: "drink_unavailable" };
  const variant = drink.variants.find((v) => v.id === line.variantId);
  if (!variant || !variant.available || variant.archived_at) return { ok: false, reason: "size_unavailable" };

  let unit = variant.price_pence;
  const extras: PricedLine["extras"] = [];
  for (const group of drink.groups) {
    const chosen = line.options[group.id];
    if (!chosen) {
      if (group.required) return { ok: false, reason: "choice_required" };
      continue;
    }
    const option = group.options.find((o) => o.id === chosen);
    if (!option || !option.available || option.archived_at) return { ok: false, reason: "option_unavailable" };
    unit += option.price_pence;
    extras.push({ groupName: group.name, optionLabel: option.label, pricePence: option.price_pence });
  }
  // Options for groups this drink no longer has are ignored rather than charged.

  return {
    ok: true,
    unitPence: unit,
    totalPence: unit * line.quantity,
    vatRate: drink.vat_rate,
    drinkName: drink.name,
    variantLabel: variant.label,
    extras,
    noIce: drink.offers_no_ice && line.noIce,
    containsAlcohol: drink.contains_alcohol,
  };
}

// Two basket lines are the same drink if everything chosen matches.
export const lineKey = (l: BasketLine) =>
  [l.drinkId, l.variantId, l.noIce ? "noice" : "", ...Object.entries(l.options).sort().map(([g, o]) => `${g}=${o}`)].join("|");

export const PROBLEM_TEXT: Record<LineProblem["reason"], string> = {
  drink_unavailable: "No longer available tonight",
  size_unavailable: "This size is no longer available",
  option_unavailable: "One of the extras is no longer available",
  choice_required: "Choose an option for this drink",
  bad_quantity: "Check the quantity",
};
