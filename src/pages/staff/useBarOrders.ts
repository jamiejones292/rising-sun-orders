import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { BarOrder } from "../../lib/types";

const ORDER_SELECT =
  "id, order_number, table_label, total_pence, payment_method_label, paid_at, fulfilment_status, delivered_at, problem_reason, version, order_items(id, drink_name, variant_label, quantity, no_ice, ticked, sort_order, order_item_options(option_label, group_name), drinks(contains_alcohol))";

// How often to re-check even when live updates are working: the safety net for
// an iPad that dozed off or missed a message.
const POLL_MS = 15_000;
// Treat the screen as offline if nothing has loaded for this long.
const STALE_MS = 45_000;

export type Connection = "live" | "checking" | "offline";

// staffStock: the owner lets bar staff switch drinks out of stock (Venue settings).
export type BarSettings = { paused: boolean; amber: number; red: number; staffStock: boolean };

// Start of today in the pub's timezone, for the "Fulfilled today" list.
function startOfTodayLondon(): string {
  const now = new Date();
  const london = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
  const offset = now.getTime() - london.getTime();
  london.setHours(0, 0, 0, 0);
  return new Date(london.getTime() + offset).toISOString();
}

const sortItems = (o: BarOrder): BarOrder => ({
  ...o,
  order_items: [...o.order_items].sort((a, b) => a.sort_order - b.sort_order),
});

export function useBarOrders(onNewOrders: (orders: BarOrder[]) => void) {
  const [open, setOpen] = useState<BarOrder[]>([]);
  const [done, setDone] = useState<BarOrder[]>([]);
  const [settings, setSettings] = useState<BarSettings>({ paused: false, amber: 5, red: 10, staffStock: false });
  const [loaded, setLoaded] = useState(false);
  const [lastOkAt, setLastOkAt] = useState(0);
  const [realtime, setRealtime] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [, setNow] = useState(Date.now());
  const known = useRef<Set<string> | null>(null);
  const onNewRef = useRef(onNewOrders);
  onNewRef.current = onNewOrders;
  const inFlight = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const [o, d, s] = await Promise.all([
        supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("payment_status", "paid")
          .in("fulfilment_status", ["new", "preparing", "ready"])
          .order("paid_at"),
        supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("fulfilment_status", "delivered")
          .gte("delivered_at", startOfTodayLondon())
          .order("delivered_at", { ascending: false })
          .limit(60),
        supabase.from("venue_settings").select("ordering_paused, wait_amber_minutes, wait_red_minutes, bar_staff_can_toggle_stock").eq("id", 1).single(),
      ]);
      if (o.error || d.error || s.error) throw o.error || d.error || s.error;
      const openOrders = (o.data as unknown as BarOrder[]).map(sortItems);
      // Spot orders that weren't there last time (not on the very first load).
      if (known.current) {
        const fresh = openOrders.filter((x) => !known.current!.has(x.id));
        if (fresh.length) onNewRef.current(fresh);
      }
      known.current = new Set([...openOrders.map((x) => x.id), ...(known.current ?? [])]);
      setOpen(openOrders);
      setDone((d.data as unknown as BarOrder[]).map(sortItems));
      setSettings({
        paused: s.data.ordering_paused,
        amber: s.data.wait_amber_minutes,
        red: s.data.wait_red_minutes,
        staffStock: s.data.bar_staff_can_toggle_stock,
      });
      setLastOkAt(Date.now());
      setLoaded(true);
    } catch {
      // Leave what's on screen; the connection banner shows the problem.
    } finally {
      inFlight.current = false;
      if (again.current) {
        again.current = false;
        void refresh();
      }
    }
  }, []);

  useEffect(() => {
    void refresh();

    // Live updates from the database. Several changes in quick succession
    // (an order and its drinks) trigger one reload.
    let timer: number | undefined;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), 250);
    };
    const channel = supabase
      .channel("bar-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, soon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "venue_settings" }, soon)
      .subscribe((status) => {
        setRealtime(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") soon(); // catch up on anything missed while disconnected
      });

    const poll = window.setInterval(() => void refresh(), POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 10_000);
    const wake = () => document.visibilityState === "visible" && void refresh();
    const goOnline = () => {
      setOnline(true);
      void refresh();
    };
    const goOffline = () => setOnline(false);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const fresh = Date.now() - lastOkAt < STALE_MS;
  const connection: Connection = !online || (loaded && !fresh) ? "offline" : realtime ? "live" : "checking";

  return { open, done, settings, loaded, connection, refresh, setOpen, setDone };
}
