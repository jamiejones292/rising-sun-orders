import { useEffect, useState } from "react";
import { formatPence } from "../../lib/money";
import type { BarOrder } from "../../lib/types";
import type { BarSettings } from "./useBarOrders";
import { drinkCount, extrasText, hm, isTest, optionLines, plural, tickedCount, toPour, waitLevel, waitText } from "./barUtils";

const NOICE = <span className="ml-1 inline-block rounded-sm bg-ink px-1.5 py-0.5 align-[1px] text-[0.7rem] font-extrabold tracking-wider text-white">NO ICE</span>;

// Cards show this many drink lines at most, so one big round can't push the
// other orders off the screen; the rest are in the order itself.
const CARD_LINES = 4;

// "oldest" is today's oldest order when there is one (not a stuck order from earlier).
export function Summary({ orders, oldest = orders[0] }: { orders: BarOrder[]; oldest?: BarOrder }) {
  if (!orders.length || !oldest) return null;
  return (
    <div className="gutter flex flex-wrap items-baseline gap-x-5.5 gap-y-2 pt-4.5 pb-1.5 text-gold-soft">
      <span>
        <b className="text-2xl font-extrabold text-ivory tabular-nums">{orders.length}</b> order{orders.length === 1 ? "" : "s"} waiting
      </span>
      <span>
        <b className="text-2xl font-extrabold text-ivory tabular-nums">{orders.reduce((s, o) => s + toPour(o).filter((i) => !i.ticked).reduce((q, i) => q + i.quantity, 0), 0)}</b> drinks to pour
      </span>
      <span>
        Oldest: <b className="text-2xl font-extrabold text-ivory tabular-nums">{waitText(oldest)}</b> · Table {oldest.table_label}
      </span>
    </div>
  );
}

export function OrderCards({
  orders,
  earlier = [],
  settings,
  seen,
  onOpen,
}: {
  orders: BarOrder[];
  earlier?: BarOrder[];
  settings: BarSettings;
  seen: Set<string>;
  onOpen: (id: string) => void;
}) {
  const below = useCardsBelow([orders, earlier]);
  if (!orders.length && !earlier.length) {
    return (
      <div className="gutter py-18 text-center text-gold-soft">
        <h2 className="mb-1.5 text-4xl text-ivory">All caught up</h2>
        <p>New paid orders appear here automatically, with a chime if sound is switched on.</p>
      </div>
    );
  }
  const card = (o: BarOrder) => <OrderCard key={o.id} o={o} settings={settings} seen={seen} onOpen={onOpen} />;
  return (
    <div className="pb-30">
      {orders.length > 0 ? (
        <div className="gutter grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] items-start gap-4 pt-3">{orders.map(card)}</div>
      ) : (
        <p className="gutter pt-6 text-center text-gold-soft">No orders from today waiting.</p>
      )}
      {earlier.length > 0 && (
        <>
          <div className="gutter mt-8 border-t border-gold-soft/25 pt-4 text-gold-soft">
            <h2 className="text-2xl text-ivory">From earlier ({earlier.length})</h2>
            <p className="text-sm">Paid before 6am today and never finished. Serve them, or a manager can close them in Admin.</p>
          </div>
          <div className="gutter grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] items-start gap-4 pt-3 opacity-85">{earlier.map(card)}</div>
        </>
      )}
      {below > 0 && (
        <button
          onClick={() => {
            const el = [...document.querySelectorAll<HTMLElement>("[data-order-card]")].find((c) => c.getBoundingClientRect().bottom > window.innerHeight);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-8 min-h-12 -translate-x-1/2 rounded-full bg-gold-bright px-5 text-lg font-extrabold text-white shadow-[0_8px_22px_rgba(0,0,0,.4)]"
        >
          ↓ {below} more order{below === 1 ? "" : "s"} below
        </button>
      )}
    </div>
  );
}

// How many order cards start below the bottom of the screen.
function useCardsBelow(deps: unknown[]) {
  const [below, setBelow] = useState(0);
  useEffect(() => {
    const check = () =>
      setBelow([...document.querySelectorAll<HTMLElement>("[data-order-card]")].filter((c) => c.getBoundingClientRect().top > window.innerHeight - 40).length);
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return below;
}

function OrderCard({ o, settings, seen, onOpen }: { o: BarOrder; settings: BarSettings; seen: Set<string>; onOpen: (id: string) => void }) {
  const level = waitLevel(o, settings.amber, settings.red);
  // NEW until this iPad opens it, or anyone on any iPad starts ticking it.
  const isNew = !seen.has(o.id) && o.fulfilment_status === "new";
  const test = isTest(o);
  const t = tickedCount(o);
  const n = toPour(o).length;
  const lines = o.order_items.length > CARD_LINES ? o.order_items.slice(0, CARD_LINES - 1) : o.order_items;
  const hidden = o.order_items.slice(lines.length);
  return (
    <button
      data-order-card
      onClick={() => onOpen(o.id)}
      aria-label={`${test ? "Test order. " : ""}Table ${o.table_label}, order ${o.order_number}, waiting ${waitText(o)}. Open order.`}
      className={`flex w-full flex-col overflow-hidden rounded-[10px] border-[3px] text-left text-ink shadow-[0_6px_18px_rgba(0,0,0,.25)] active:scale-[.99] ${
        test ? "bg-[repeating-linear-gradient(135deg,#ece8df_0_14px,#e2ddd2_14px_28px)]" : "bg-ivory"
      } ${isNew ? "animate-glow border-gold-bright" : test ? "border-dashed border-[#8f897c]" : "border-transparent"}`}
    >
      <div className={`h-2.5 ${level === "red" ? "bg-bar-red" : level === "amber" ? "bg-bar-amber" : "bg-bar-ok"}`} />
      {test && <div className="bg-ink px-2.5 py-1 text-center text-xs font-extrabold tracking-wider text-white">TEST ORDER · NOT PAID</div>}
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
        <span>{plural(drinkCount(o), "drink")}</span>
      </div>
      {o.problem_reason && <div className="mx-4 mb-2.5 rounded bg-bar-red-soft px-2.5 py-1.5 text-sm font-bold text-bar-red">Problem: {o.problem_reason}</div>}
      {o.refunded_pence > 0 && (
        <div className="mx-4 mb-2.5 rounded bg-bar-amber-soft px-2.5 py-1.5 text-sm font-bold text-[#7a4b00]">
          {formatPence(o.refunded_pence)} refunded. Check with the manager which drinks to leave out.
        </div>
      )}
      <ul className="flex flex-col gap-1.5 border-t border-line px-4 py-2.5">
        {lines.map((i) => (
          <li key={i.id} className={`grid grid-cols-[44px_1fr] gap-1.5 ${i.out_of_stock ? "text-muted line-through" : i.ticked ? "text-bar-ok" : ""}`}>
            <span className="font-extrabold whitespace-nowrap tabular-nums">
              {i.quantity}×{i.ticked && " ✓"}
            </span>
            <span className="min-w-0 font-semibold">
              {i.drink_name}
              {i.no_ice && NOICE}
              {i.out_of_stock && <b className="ml-1.5 text-sm text-bar-red no-underline">OUT OF STOCK</b>}
              <span className="block text-sm font-normal text-muted">{extrasText(i)}</span>
              {optionLines(i).map((x, k) => (
                <span key={k} className="block font-extrabold">
                  + {x}
                </span>
              ))}
            </span>
          </li>
        ))}
        {hidden.length > 0 && (
          <li className="pl-[50px] text-sm font-extrabold text-forest">
            + {plural(hidden.reduce((s, i) => s + i.quantity, 0), "more drink")} · tap to see all
          </li>
        )}
      </ul>
      <div className="flex items-center gap-2.5 border-t border-line px-4 pt-2.5 pb-3.5 text-sm font-bold text-muted">
        <span className="h-2 flex-1 overflow-hidden rounded bg-vellum">
          <i className="block h-full rounded bg-bar-ok" style={{ width: `${n ? (t / n) * 100 : 0}%` }} />
        </span>
        <span className="tabular-nums">
          {t} of {n} ticked
        </span>
      </div>
    </button>
  );
}

export function FulfilledList({ orders, onReopen }: { orders: BarOrder[]; onReopen: (o: BarOrder) => void }) {
  // Reopen asks once more, so a stray tap doesn't put a finished order back.
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (!confirm) return;
    const id = window.setTimeout(() => setConfirm(null), 5000);
    return () => window.clearTimeout(id);
  }, [confirm]);
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
          <span className="col-span-2 min-w-0 text-ivory md:col-span-1">
            {isTest(o) && <b className="mr-1.5 rounded bg-ink px-1.5 py-0.5 text-xs tracking-wider text-white">TEST</b>}
            {o.order_items.map((i) => `${i.quantity}× ${i.drink_name}`).join(", ")}
          </span>
          <button
            onClick={() => (confirm === o.id ? (setConfirm(null), onReopen(o)) : setConfirm(o.id))}
            className={`min-h-11 rounded-md border-[1.5px] px-3.5 font-bold ${confirm === o.id ? "border-gold-bright bg-gold-bright text-white" : "border-gold-soft/40 text-ivory"}`}
          >
            {confirm === o.id ? "Tap again to reopen" : "Reopen"}
          </button>
        </div>
      ))}
    </div>
  );
}
