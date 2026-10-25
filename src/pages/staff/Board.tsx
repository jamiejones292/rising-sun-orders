import type { BarOrder } from "../../lib/types";
import type { BarSettings } from "./useBarOrders";
import { drinkCount, extrasText, hm, tickedCount, waitLevel, waitText } from "./barUtils";

const NOICE = <span className="ml-1 inline-block rounded-sm bg-ink px-1.5 py-0.5 align-[1px] text-[0.7rem] font-extrabold tracking-wider text-white">NO ICE</span>;

export function Summary({ orders }: { orders: BarOrder[] }) {
  if (!orders.length) return null;
  const oldest = orders[0]!;
  return (
    <div className="gutter flex flex-wrap items-baseline gap-x-5.5 gap-y-2 pt-4.5 pb-1.5 text-gold-soft">
      <span>
        <b className="text-2xl font-extrabold text-ivory tabular-nums">{orders.length}</b> order{orders.length === 1 ? "" : "s"} waiting
      </span>
      <span>
        <b className="text-2xl font-extrabold text-ivory tabular-nums">{orders.reduce((s, o) => s + drinkCount(o), 0)}</b> drinks to pour
      </span>
      <span>
        Oldest: <b className="text-2xl font-extrabold text-ivory tabular-nums">{waitText(oldest)}</b> · Table {oldest.table_label}
      </span>
    </div>
  );
}

export function OrderCards({
  orders,
  settings,
  seen,
  onOpen,
}: {
  orders: BarOrder[];
  settings: BarSettings;
  seen: Set<string>;
  onOpen: (id: string) => void;
}) {
  if (!orders.length) {
    return (
      <div className="gutter py-18 text-center text-gold-soft">
        <h2 className="mb-1.5 text-4xl text-ivory">All caught up</h2>
        <p>New paid orders appear here automatically, with a chime if sound is switched on.</p>
      </div>
    );
  }
  return (
    <div className="gutter grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] items-start gap-4 pt-3 pb-30">
      {orders.map((o) => {
        const level = waitLevel(o, settings.amber, settings.red);
        // NEW until this iPad opens it, or anyone on any iPad starts ticking it.
        const isNew = !seen.has(o.id) && o.fulfilment_status === "new";
        const t = tickedCount(o);
        const n = o.order_items.length;
        return (
          <button
            key={o.id}
            onClick={() => onOpen(o.id)}
            aria-label={`Table ${o.table_label}, order ${o.order_number}, waiting ${waitText(o)}. Open order.`}
            className={`flex w-full flex-col overflow-hidden rounded-[10px] border-[3px] bg-ivory text-left text-ink shadow-[0_6px_18px_rgba(0,0,0,.25)] active:scale-[.99] ${
              isNew ? "animate-glow border-gold-bright" : "border-transparent"
            }`}
          >
            <div className={`h-2.5 ${level === "red" ? "bg-bar-red" : level === "amber" ? "bg-bar-amber" : "bg-bar-ok"}`} />
            <div className="flex items-start justify-between gap-2.5 px-4 pt-3.5 pb-2">
              <div>
                <div className="text-xs font-extrabold tracking-[0.16em] text-muted">TABLE</div>
                <div className="text-[3.4rem] leading-[.95] font-extrabold text-forest tabular-nums">{o.table_label}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 font-extrabold whitespace-nowrap tabular-nums ${
                    level === "red" ? "bg-bar-red-soft text-bar-red" : level === "amber" ? "bg-bar-amber-soft text-[#8a5600]" : "bg-bar-ok-soft text-bar-ok"
                  }`}
                >
                  {waitText(o)}
                </span>
                <span
                  className={`rounded px-2 py-1 text-xs font-extrabold tracking-wider ${
                    isNew ? "bg-gold-bright text-white" : t ? "bg-forest text-ivory" : "bg-vellum text-muted"
                  }`}
                >
                  {isNew ? "NEW" : t ? "IN PROGRESS" : "NOT STARTED"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 px-4 pb-2.5 text-sm text-muted tabular-nums">
              <span>#{o.order_number}</span>
              <span>Received {hm(o.paid_at)}</span>
              <span>
                {drinkCount(o)} drink{drinkCount(o) === 1 ? "" : "s"}
              </span>
            </div>
            {o.problem_reason && (
              <div className="mx-4 mb-2.5 rounded bg-bar-red-soft px-2.5 py-1.5 text-sm font-bold text-bar-red">Problem: {o.problem_reason}</div>
            )}
            <ul className="flex flex-col gap-1.5 border-t border-line px-4 py-2.5">
              {o.order_items.map((i) => (
                <li key={i.id} className={`grid grid-cols-[44px_1fr] gap-1.5 ${i.ticked ? "text-bar-ok" : ""}`}>
                  <span className="font-extrabold whitespace-nowrap tabular-nums">
                    {i.quantity}×{i.ticked && " ✓"}
                  </span>
                  <span className="min-w-0 font-semibold">
                    {i.drink_name}
                    {i.no_ice && NOICE}
                    <span className="block text-sm font-normal text-muted">{extrasText(i)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2.5 border-t border-line px-4 pt-2.5 pb-3.5 text-sm font-bold text-muted">
              <span className="h-2 flex-1 overflow-hidden rounded bg-vellum">
                <i className="block h-full rounded bg-bar-ok" style={{ width: `${(t / n) * 100}%` }} />
              </span>
              <span className="tabular-nums">
                {t} of {n} ticked
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function FulfilledList({ orders, onReopen }: { orders: BarOrder[]; onReopen: (o: BarOrder) => void }) {
  if (!orders.length) {
    return (
      <div className="gutter py-18 text-center text-gold-soft">
        <h2 className="text-4xl text-ivory">Nothing fulfilled yet today</h2>
      </div>
    );
  }
  return (
    <div className="gutter flex flex-col gap-2.5 pt-4 pb-30">
      {orders.map((o) => (
        <div
          key={o.id}
          className="grid grid-cols-2 items-center gap-3.5 rounded-lg border border-gold-soft/15 bg-[#17322a] px-4 py-3.5 text-gold-soft md:grid-cols-[90px_100px_minmax(0,1fr)_auto]"
        >
          <span>
            Table
            <br />
            <b className="text-xl text-ivory tabular-nums">{o.table_label}</b>
          </span>
          <span className="tabular-nums">
            #{o.order_number}
            <br />
            {o.delivered_at ? hm(o.delivered_at) : ""}
          </span>
          <span className="col-span-2 min-w-0 text-ivory md:col-span-1">{o.order_items.map((i) => `${i.quantity}× ${i.drink_name}`).join(", ")}</span>
          <button onClick={() => onReopen(o)} className="min-h-11 rounded-md border-[1.5px] border-gold-soft/40 px-3.5 font-bold text-ivory">
            Reopen
          </button>
        </div>
      ))}
    </div>
  );
}
