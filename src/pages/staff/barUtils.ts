import type { BarOrder } from "../../lib/types";

export const minutesWaiting = (o: BarOrder) => Math.max(0, Math.floor((Date.now() - new Date(o.paid_at).getTime()) / 60_000));
export const waitText = (o: BarOrder) => {
  const m = minutesWaiting(o);
  return m < 1 ? "Just now" : `${m} min`;
};
export const waitLevel = (o: BarOrder, amber: number, red: number): "ok" | "amber" | "red" => {
  const m = minutesWaiting(o);
  return m >= red ? "red" : m >= amber ? "amber" : "ok";
};
export const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
export const drinkCount = (o: BarOrder) => o.order_items.reduce((s, i) => s + i.quantity, 0);
export const tickedCount = (o: BarOrder) => o.order_items.filter((i) => i.ticked).length;
export const extrasText = (i: BarOrder["order_items"][number]) =>
  [i.variant_label, ...i.order_item_options.map((x) => x.option_label)].join(" · ");

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
