import type { BarOrder } from "../../lib/types";

export const minutesWaiting = (o: BarOrder) => Math.max(0, Math.floor((Date.now() - new Date(o.paid_at).getTime()) / 60_000));
export const waitText = (o: BarOrder) => {
  const m = minutesWaiting(o);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min`;
  if (m < 180) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return `${Math.floor(m / 60)} h`;
};
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// Test orders (no payment taken) look different everywhere on the bar screen.
export const isTest = (o: BarOrder) => o.payment_provider === "test" || !!o.payment_method_label?.startsWith("TEST");
export const waitLevel = (o: BarOrder, amber: number, red: number): "ok" | "amber" | "red" => {
  const m = minutesWaiting(o);
  return m >= red ? "red" : m >= amber ? "amber" : "ok";
};
export const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
export const drinkCount = (o: BarOrder) => o.order_items.reduce((s, i) => s + i.quantity, 0);
// Drinks to pour: everything except drinks reported out of stock.
export const toPour = (o: BarOrder) => o.order_items.filter((i) => !i.out_of_stock);
export const tickedCount = (o: BarOrder) => toPour(o).filter((i) => i.ticked).length;
// The size on its own; mixers, flavours and serves are shown as their own bold lines.
export const extrasText = (i: BarOrder["order_items"][number]) => i.variant_label;
export const optionLines = (i: BarOrder["order_items"][number]) =>
  i.order_item_options.map((x) => x.option_label).filter((l) => !/^no mixer$/i.test(l));

// Orders this iPad has opened, so the gold NEW marker clears. Kept per iPad.
const SEEN_KEY = "rs-seen-orders";
export function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
export function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)));
  } catch {
    // private browsing or storage full: the marker just shows again after a reload
  }
}
