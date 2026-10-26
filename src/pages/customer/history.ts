import type { BasketLine } from "../../lib/pricing";
import { supabase } from "../../lib/supabase";

// Recent orders, kept on the customer's phone only (no accounts), so they can
// reopen an order page or put the same round back in the basket. The lines are
// ids only: "Same again" always re-prices them from tonight's menu.
// An order is only shown once the server says it's paid (checked on the order
// page and again whenever the menu opens), so failed or refunded checkouts and
// deleted test orders never appear.

const KEY = "rs-orders-v1";
const KEEP = 10;
const DAYS = 7;

export type PastOrder = {
  token: string;
  orderNumber: number;
  placedAt: string;
  table: string;
  totalPence: number;
  lines: BasketLine[];
  summary: string; // e.g. "2 × Birra Moretti, Gordon's Gin (no ice)"
  paid?: boolean; // last answer from the server
};

export function readHistory(): PastOrder[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]") as PastOrder[];
    const cutoff = Date.now() - DAYS * 86_400_000;
    return Array.isArray(saved)
      ? saved.filter((o) => o && typeof o.token === "string" && Array.isArray(o.lines) && new Date(o.placedAt).getTime() > cutoff)
      : [];
  } catch {
    return [];
  }
}

export function saveToHistory(order: PastOrder) {
  try {
    const rest = readHistory().filter((o) => o.token !== order.token);
    localStorage.setItem(KEY, JSON.stringify([order, ...rest].slice(0, KEEP)));
  } catch {
    // private browsing: nothing to remember, ordering still works
  }
}

export const paidOnly = (orders: PastOrder[]) => orders.filter((o) => o.paid === true);

function store(orders: PastOrder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(orders));
  } catch {
    // nothing to do
  }
}

// Called by the order page with the server's payment status.
export function markPaid(token: string, paid: boolean) {
  const all = readHistory();
  if (all.some((o) => o.token === token && o.paid !== paid)) store(all.map((o) => (o.token === token ? { ...o, paid } : o)));
}

// Re-checks every remembered order with the server. Orders the server no
// longer has are forgotten; if the phone is offline the last answer stands.
export async function verifyHistory(): Promise<PastOrder[]> {
  const all = readHistory();
  const checked = await Promise.all(
    all.map(async (o) => {
      const { data, error } = await supabase.rpc("get_order_tracking", { p_token: o.token });
      if (error) return o;
      if (!data) return null;
      return { ...o, paid: (data as { payment_status: string }).payment_status === "paid" };
    }),
  );
  const kept = checked.filter((o): o is PastOrder => o !== null);
  store(kept);
  return kept;
}
