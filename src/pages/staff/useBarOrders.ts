import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { BarOrder } from "../../lib/types";

const ORDER_SELECT =
  "id, order_number, table_label, total_pence, payment_method_label, payment_provider, paid_at, fulfilment_status, delivered_at, problem_reason, refunded_pence, version, order_items(*, order_item_options(option_label, group_name), drinks(contains_alcohol))";

// How often to re-check even when live updates are working: the safety net for
// an iPad that dozed off or missed a message.
const POLL_MS = 15_000;
// Treat the screen as offline if nothing has loaded for this long.
const STALE_MS = 45_000;

export type Connection = "live" | "checking" | "offline";

// staffStock: the owner lets bar staff switch drinks out of stock (Venue settings).
export type BarSettings = { paused: boolean; amber: number; red: number; staffStock: boolean };

// Start of the trading day in the pub's timezone (6am, so a late night's
// orders stay together after midnight), for the "Fulfilled today" list.
const DAY_STARTS_AT = 6;
export function startOfTodayLondon(): string {
  const now = new Date();
  const london = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
  const offset = now.getTime() - london.getTime();
  if (london.getHours() < DAY_STARTS_AT) london.setDate(london.getDate() - 1);
  london.setHours(DAY_STARTS_AT, 0, 0, 0);
  return new Date(london.getTime() + offset).toISOString();
}

// A reload that never answers would block every later one, so give up after this.
const REQUEST_TIMEOUT_MS = 12_000;
export function timeoutSignal(ms: number): AbortSignal {
  const c = new AbortController(); // AbortSignal.timeout isn't on older iPads
  window.setTimeout(() => c.abort(), ms);
  return c.signal;
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

  // Ticks made on this iPad that a reload mustn't undo: kept until a reload
  // that started after the save finished, so a stale reload can't flip them back.
  // Each tap gets a number, so a slower earlier save can't settle a later tap.
  const pendingTicks = useRef(new Map<string, { value: boolean; savedAt: number | null; seq: number }>());
  const tickSeq = useRef(0);
  const markTick = useCallback((itemId: string, value: boolean) => {
    const seq = ++tickSeq.current;
    pendingTicks.current.set(itemId, { value, savedAt: null, seq });
    return seq;
  }, []);
  const settleTick = useCallback((itemId: string, seq: number, saved: boolean) => {
    const p = pendingTicks.current.get(itemId);
    if (!p || p.seq !== seq) return;
    if (saved) pendingTicks.current.set(itemId, { ...p, savedAt: Date.now() });
    else pendingTicks.current.delete(itemId);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    const startedAt = Date.now();
    try {
      const signal = timeoutSignal(REQUEST_TIMEOUT_MS);
      const [o, d, s] = await Promise.all([
        supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("payment_status", "paid")
          .in("fulfilment_status", ["new", "preparing", "ready"])
          .order("paid_at")
          .abortSignal(signal),
        supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("fulfilment_status", "delivered")
          .gte("delivered_at", startOfTodayLondon())
          .order("delivered_at", { ascending: false })
          .limit(300)
          .abortSignal(signal),
        supabase
          .from("venue_settings")
          .select("ordering_paused, wait_amber_minutes, wait_red_minutes, bar_staff_can_toggle_stock")
          .eq("id", 1)
          .abortSignal(signal)
          .single(),
      ]);
      if (o.error || d.error || s.error) throw o.error || d.error || s.error;
      const openOrders = (o.data as unknown as BarOrder[]).map(sortItems);
      // Spot orders that weren't there last time (not on the very first load).
      if (known.current) {
        const fresh = openOrders.filter((x) => !known.current!.has(x.id));
        if (fresh.length) onNewRef.current(fresh);
      }
      known.current = new Set([...openOrders.map((x) => x.id), ...(known.current ?? [])]);
      for (const [id, p] of pendingTicks.current) if (p.savedAt !== null && startedAt > p.savedAt) pendingTicks.current.delete(id);
      const pending = pendingTicks.current;
      setOpen(
        pending.size
          ? openOrders.map((x) => ({
              ...x,
              order_items: x.order_items.map((i) => (pending.has(i.id) ? { ...i, ticked: pending.get(i.id)!.value } : i)),
            }))
          : openOrders,
      );
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

  return { open, done, settings, loaded, connection, refresh, setOpen, setDone, markTick, settleTick };
}
