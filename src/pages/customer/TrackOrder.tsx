import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { formatPence } from "../../lib/money";

type Tracking = {
  order_number: number;
  table: string;
  total_pence: number;
  payment_status: string;
  fulfilment_status: "new" | "preparing" | "ready" | "delivered" | "cancelled";
  paid_at: string | null;
  preparing_at: string | null;
  delivered_at: string | null;
  items: { name: string; size: string; quantity: number; line_total_pence: number; no_ice: boolean; extras: string[] }[];
};

const STAGES = [
  { key: "paid_at", title: "Order received", detail: "Paid and sent to the bar" },
  { key: "preparing_at", title: "Preparing", detail: "The bar team is pouring your drinks" },
  { key: "delivered_at", title: "Delivered", detail: "Enjoy! Iechyd da" },
] as const;

const hm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "";

// The customer's live order page, opened from the secret link after paying.
export default function TrackOrder() {
  const { token = "" } = useParams();
  const [order, setOrder] = useState<Tracking | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_order_tracking", { p_token: token });
    if (error) return setOffline(true);
    setOffline(false);
    setOrder((data as Tracking | null) ?? null);
  }, [token]);

  useEffect(() => {
    document.title = "Your order · The Rising Sun Inn";
    void load();
    // Customers can't receive live database messages about orders (the
    // security rules keep orders private), so the page checks every 8 seconds.
    const id = window.setInterval(() => void load(), 8000);
    const wake = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [load]);

  if (order === undefined) return <main className="gutter py-20 text-center text-muted">Loading your order…</main>;
  if (order === null) {
    return (
      <main className="gutter mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-3xl">We can't find that order</h1>
        <p className="text-muted">The link may be incomplete. If you've paid, show the bar team your payment confirmation.</p>
        <Link to="/" className="inline-flex min-h-12 items-center rounded bg-forest px-5 font-semibold text-ivory">
          Go to the drinks menu
        </Link>
      </main>
    );
  }

  const status = order.fulfilment_status;
  const reached = (i: number) =>
    i === 0 ? !!order.paid_at : i === 1 ? status === "preparing" || status === "ready" || status === "delivered" : status === "delivered";
  const current = STAGES.findIndex((_, i) => !reached(i));

  return (
    <main className="gutter mx-auto flex min-h-dvh max-w-[440px] flex-col gap-5 bg-ivory py-5">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="font-caps text-[0.72rem] tracking-[0.22em] text-gold-ink uppercase">The Rising Sun Inn</span>
        <h1 className="text-[2.3rem]">{status === "delivered" ? "Your drinks are here" : "Thank you for your order"}</h1>
      </div>
      {order.payment_status !== "paid" && (
        <p className="rounded border border-alert bg-[#fbede7] p-3 text-alert">
          {order.payment_status === "pending" ? "We're still waiting for your payment to be confirmed." : "This order hasn't been paid."}
        </p>
      )}
      {status === "cancelled" && (
        <p className="rounded border border-alert bg-[#fbede7] p-3 text-alert">This order was cancelled. Please speak to the bar team.</p>
      )}
      <div className="grid grid-cols-3 border-y border-gold">
        {[
          ["Order", `#${order.order_number}`],
          ["Table", order.table],
          ["Paid", formatPence(order.total_pence)],
        ].map(([k, v], i) => (
          <div key={k} className={`px-1.5 py-3 text-center ${i ? "border-l border-line" : ""}`}>
            <small className="block text-[0.72rem] tracking-[0.12em] text-muted uppercase">{k}</small>
            <b className="font-display text-2xl text-forest tabular-nums">{v}</b>
          </div>
        ))}
      </div>
      <ol className="flex flex-col">
        {STAGES.map((s, i) => {
          const done = reached(i);
          const isCurrent = i === current;
          return (
            <li key={s.key} className="relative grid grid-cols-[34px_1fr_auto] items-start gap-3 pb-5.5 last:pb-0">
              {i < STAGES.length - 1 && <span className={`absolute top-[30px] bottom-0.5 left-4 w-0.5 ${done ? "bg-forest" : "bg-line"}`} />}
              <span
                className={`relative z-1 grid h-8.5 w-8.5 place-items-center rounded-full border-2 text-sm font-bold ${
                  done ? "border-forest bg-forest text-ivory" : isCurrent ? "border-gold text-gold-ink shadow-[0_0_0_5px_rgb(156_120_64/0.18)]" : "border-line bg-paper text-muted"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <div>
                <div className={`pt-1 font-semibold ${done || isCurrent ? "text-forest" : "font-medium text-muted"}`}>{s.title}</div>
                {done && <div className="text-sm text-muted">{s.detail}</div>}
              </div>
              <span className="pt-1.5 text-sm text-muted tabular-nums">{hm(order[s.key])}</span>
            </li>
          );
        })}
      </ol>
      <p className="flex items-center justify-center gap-2 text-sm text-muted">
        <span className={`h-2 w-2 rounded-full ${offline ? "bg-alert" : "bg-ok"}`} />
        {offline ? "Reconnecting… your order is safe." : "Updates by itself. Bookmark this page to check back."}
      </p>
      <details>
        <summary className="cursor-pointer font-semibold text-forest">What you ordered</summary>
        {order.items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-3 border-b border-line py-3">
            <div>
              <div className="font-semibold text-forest">
                {it.quantity} × {it.name}
              </div>
              <div className="text-sm text-muted">{[it.size, ...it.extras, it.no_ice ? "No ice" : ""].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="font-semibold tabular-nums">{formatPence(it.line_total_pence)}</div>
          </div>
        ))}
      </details>
      <Link to="/" className="flex min-h-13.5 items-center justify-center rounded bg-forest font-semibold text-ivory">
        Order more drinks
      </Link>
      <p className="text-center text-sm text-muted">Need to change something? Speak to the bar team and quote your order number.</p>
    </main>
  );
}
