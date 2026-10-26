import type { BasketLine } from "../../lib/pricing";

// Recent orders, kept on the customer's phone only (no accounts), so they can
// reopen an order page or put the same round back in the basket. The lines are
// ids only: "Same again" always re-prices them from tonight's menu.

const KEY = "rs-orders-v1";
const KEEP = 10;
const DAYS = 30;

export type PastOrder = {
  token: string;
  orderNumber: number;
  placedAt: string;
  table: string;
  totalPence: number;
  lines: BasketLine[];
  summary: string; // e.g. "2 × Birra Moretti, Gordon's Gin (no ice)"
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
