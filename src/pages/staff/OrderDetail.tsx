import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import { formatPence } from "../../lib/money";
import type { BarOrder, VenueTable } from "../../lib/types";
import { useToast } from "../../components/ui";
import { drinkCount, extrasText, hm, tickedCount, waitText } from "./barUtils";

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" className="h-7.5 w-7.5" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const PROBLEMS = ["An item is out of stock", "Refusing service: no ID", "Refusing service: customer intoxicated", "Can't find the table"];

export default function OrderDetail({
  order,
  onBack,
  onTick,
  onFulfilled,
  onChanged,
}: {
  order: BarOrder;
  onBack: () => void;
  onTick: (itemId: string, ticked: boolean) => Promise<boolean>;
  onFulfilled: (order: BarOrder) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [panel, setPanel] = useState<"none" | "problem" | "table">("none");
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [busy, setBusy] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const fulfilRef = useRef<HTMLButtonElement>(null);
  const t = tickedCount(order);
  const n = order.order_items.length;
  const all = t === n;
  const alcohol = order.order_items.some((i) => i.drinks?.contains_alcohol);

  useEffect(() => {
    backRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack]);

  useEffect(() => {
    if (all) fulfilRef.current?.focus();
  }, [all]);

  useEffect(() => {
    if (panel !== "table" || tables.length) return;
    void supabase
      .from("venue_tables")
      .select("id, label, area_id, active, sort_order")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setTables((data as VenueTable[]) ?? []));
  }, [panel, tables.length]);

  async function fulfil() {
    setBusy(true);
    const { error } = await supabase.rpc("staff_fulfil_order", { p_order_id: order.id });
    setBusy(false);
    if (error) {
      if (error.message.includes("already_fulfilled")) {
        toast(`Table ${order.table_label} was already fulfilled on another iPad.`);
        onChanged();
        return onBack();
      }
      if (error.message.includes("items_not_ticked")) {
        toast("A drink was unticked on another iPad. Check the list and try again.", { error: true });
        return onChanged();
      }
      return toast(friendlyError(error), { error: true });
    }
    onFulfilled(order);
  }

  async function report(reason: string) {
    const { error } = await supabase.rpc("staff_report_problem", { p_order_id: order.id, p_reason: reason });
    if (error) return toast(friendlyError(error), { error: true });
    setPanel("none");
    onChanged();
    toast(`Manager alerted: ${reason} (Table ${order.table_label})`);
  }

  async function moveTo(table: VenueTable) {
    const { error } = await supabase.rpc("staff_change_table", { p_order_id: order.id, p_table_id: table.id });
    if (error) return toast(friendlyError(error), { error: true });
    setPanel("none");
    onChanged();
    toast(`Order #${order.order_number} moved to Table ${table.label}`);
  }

  return (
    <section className="flex min-h-dvh flex-col bg-ivory text-ink" aria-labelledby="order-table">
      <div className="gutter flex flex-wrap items-center gap-x-5 gap-y-3 bg-forest py-3.5 text-ivory">
        <button ref={backRef} onClick={onBack} className="inline-flex min-h-12.5 items-center gap-1.5 rounded-md border-[1.5px] border-gold-soft/45 pr-4.5 pl-3 font-bold">
          <span aria-hidden="true">‹</span> All orders
        </button>
        <div className="flex items-baseline gap-3">
          <small className="text-sm font-extrabold tracking-[0.16em] text-gold-soft">TABLE</small>
          <b id="order-table" className="text-5xl leading-none font-extrabold tabular-nums">
            {order.table_label}
          </b>
        </div>
        <div className="flex flex-col gap-0.5 text-sm text-gold-soft tabular-nums">
          <span>
            Order <b className="text-ivory">#{order.order_number}</b> · Received <b className="text-ivory">{hm(order.paid_at)}</b>
          </span>
          <span>
            Waiting <b className="text-ivory">{waitText(order)}</b> · Paid <b className="text-ivory">{formatPence(order.total_pence)}</b>
            {order.payment_method_label ? ` by ${order.payment_method_label}` : ""}
          </span>
        </div>
      </div>

      <div className="gutter mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-3.5 pt-5 pb-48">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-muted">
          <span>Tap each drink as you pour it.</span>
          {alcohol && (
            <span className="rounded-md bg-bar-amber-soft px-3 py-2 text-sm font-bold text-[#7a4b00]">Contains alcohol: check ID if they look under 25</span>
          )}
        </div>
        {order.payment_method_label?.startsWith("TEST") && (
          <div className="rounded-md bg-ink px-3.5 py-2.5 text-center font-extrabold tracking-wider text-white">TEST ORDER · NO PAYMENT TAKEN</div>
        )}
        {order.problem_reason && (
          <div className="rounded-md bg-bar-red-soft px-3.5 py-2.5 font-bold text-bar-red">
            Problem reported: {order.problem_reason}. A manager will sort out any refund.
          </div>
        )}
        <ul className="flex flex-col gap-2.5">
          {order.order_items.map((i) => (
            <li key={i.id}>
              <button
                role="checkbox"
                aria-checked={i.ticked}
                onClick={() => void onTick(i.id, !i.ticked)}
                className={`grid min-h-22 w-full grid-cols-[56px_64px_minmax(0,1fr)] items-center gap-3.5 rounded-[10px] border-2 p-4 text-left transition-colors duration-75 ${
                  i.ticked ? "border-bar-ok bg-bar-ok" : "border-line bg-white"
                }`}
              >
                <span className={`grid h-13 w-13 place-items-center rounded-lg border-[3px] bg-white ${i.ticked ? "border-white text-bar-ok" : "border-[#9c9480] text-transparent"}`}>
                  {CHECK}
                </span>
                <span className={`text-[2rem] font-extrabold tabular-nums ${i.ticked ? "text-white" : "text-forest"}`}>{i.quantity}×</span>
                <span className="min-w-0">
                  <span className={`text-xl font-bold ${i.ticked ? "text-white" : "text-forest"}`}>{i.drink_name}</span>
                  {i.no_ice && (
                    <span className={`ml-1.5 inline-block rounded-sm px-2 py-0.5 align-[2px] text-sm font-extrabold tracking-wider ${i.ticked ? "bg-white text-bar-ok" : "bg-ink text-white"}`}>
                      NO ICE
                    </span>
                  )}
                  <span className={`mt-0.5 block ${i.ticked ? "text-[#d7f0df]" : "text-muted"}`}>{extrasText(i)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-line px-1 py-1.5 text-muted tabular-nums">
          <span>
            {drinkCount(order)} drinks in {n} line{n === 1 ? "" : "s"}
          </span>
          <span>
            Total paid <b className="text-forest">{formatPence(order.total_pence)}</b>
          </span>
        </div>

        {panel === "problem" && (
          <div className="flex flex-col gap-2.5 rounded-[10px] border-2 border-bar-red bg-bar-red-soft p-3.5 font-semibold text-bar-red">
            <span>What's wrong with this order?</span>
            <div className="flex flex-wrap gap-2">
              {PROBLEMS.map((p) => (
                <button key={p} onClick={() => void report(p)} className="min-h-11.5 rounded-md border-[1.5px] border-bar-red bg-white px-3.5 font-bold">
                  {p}
                </button>
              ))}
            </div>
            <span className="text-sm font-medium">This flags the order for a manager to refund. It stays on the screen until they clear it.</span>
          </div>
        )}
        {panel === "table" && (
          <div className="flex flex-col gap-2.5 rounded-[10px] border-2 border-line bg-white p-3.5">
            <span className="font-semibold text-forest">Move this order to which table?</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
              {tables.map((tb) => (
                <button
                  key={tb.id}
                  disabled={tb.label === order.table_label}
                  onClick={() => void moveTo(tb)}
                  className="min-h-12 rounded-md border border-line bg-paper text-lg font-bold text-forest tabular-nums disabled:bg-forest disabled:text-ivory"
                >
                  {tb.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="gutter fixed inset-x-0 bottom-0 z-7 border-t-2 border-line bg-ivory pt-3.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto flex max-w-[900px] flex-col gap-2.5">
          <div className="flex items-center gap-3 font-extrabold text-forest">
            <span className="h-3 flex-1 overflow-hidden rounded-md bg-vellum">
              <i className="block h-full rounded-md bg-bar-ok" style={{ width: `${(t / n) * 100}%` }} />
            </span>
            <span className="tabular-nums">
              {t} of {n} ticked
            </span>
          </div>
          {all ? (
            <button
              ref={fulfilRef}
              disabled={busy}
              onClick={() => void fulfil()}
              className="flex min-h-18 w-full items-center justify-center gap-3 rounded-[10px] bg-bar-ok text-2xl font-extrabold tracking-wider text-white shadow-[0_6px_16px_rgba(31,122,71,.35)] disabled:opacity-60"
            >
              {CHECK}
              {busy ? "SAVING…" : "ORDER FULFILLED"}
            </button>
          ) : (
            <div className="flex min-h-18 items-center justify-center rounded-[10px] border-2 border-dashed border-line px-4 text-center font-bold text-muted">
              Tick every drink to finish this order ({n - t} to go)
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-x-4.5 gap-y-2 [&_button]:p-1.5 [&_button]:font-semibold [&_button]:text-muted [&_button]:underline [&_button]:underline-offset-3">
            {t > 0 && (
              <button
                onClick={async () => {
                  for (const i of order.order_items.filter((x) => x.ticked)) await onTick(i.id, false);
                }}
              >
                Untick all
              </button>
            )}
            <button onClick={() => setPanel(panel === "table" ? "none" : "table")}>{panel === "table" ? "Cancel table change" : "Wrong table? Change it"}</button>
            <button onClick={() => setPanel(panel === "problem" ? "none" : "problem")}>{panel === "problem" ? "Hide problem options" : "Problem with this order"}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
