import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth, isOwnerRole } from "../../lib/auth";
import { useMenuData, useVenue } from "../../lib/adminData";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import { Button, Panel, useToast } from "../../components/ui";
import RefundPanel from "../staff/RefundPanel";
import OrderingCard from "./OrderingCard";
import { PageHeader } from "./AdminApp";
import { isMixerOnlyCategory } from "./DrinkEditor";

export default function Overview() {
  const { profile } = useAuth();
  const { data } = useMenuData();
  const venue = useVenue();
  const owner = isOwnerRole(profile);
  const problems = useProblemOrders();

  // The "Mixers" category is hidden on purpose (mixer-only drinks), so it isn't
  // counted as a menu category or flagged; its drinks still show if out of stock.
  const menuCats = data?.categories.filter((c) => !isMixerOnlyCategory(c)) ?? [];
  const mixerOnly = new Set(data?.categories.filter(isMixerOnlyCategory).map((c) => c.id));
  const live = data?.drinks.filter((d) => !d.archived_at) ?? [];
  const onMenu = live.filter((d) => !mixerOnly.has(d.category_id));
  const outOfStock = live.filter((d) => !d.available || d.drink_variants.some((v) => !v.archived_at && !v.available));
  const tablesOff = venue.tables.filter((t) => !t.active);
  const hiddenCats = menuCats.filter((c) => !c.visible);
  // Only worth flagging a hidden category that still has drinks in it (the old
  // menu's empty categories stay hidden quietly).
  const hiddenWithDrinks = hiddenCats
    .map((c) => ({ c, n: live.filter((d) => d.category_id === c.id).length }))
    .filter((x) => x.n > 0);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(new Date()));
  const greeting = hour < 12 ? "Bore da" : hour < 18 ? "Prynhawn da" : "Noswaith dda";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${profile?.display_name ?? ""}`}
        intro="Manage the drinks menu, stock and how online ordering behaves."
        action={
          <Link to="/admin/drinks?new=1" className="inline-flex min-h-11 items-center rounded bg-gold px-4 font-bold tracking-wide text-white">
            + ADD NEW DRINK
          </Link>
        }
      />
      {venue.settings && (
        <OrderingCard
          settings={venue.settings}
          hours={venue.hours}
          onChanged={(p) => venue.setSettings({ ...venue.settings!, ordering_paused: p })}
        />
      )}
      {problems.orders.length > 0 && <ProblemsPanel orders={problems.orders} onChanged={problems.reload} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Drinks on the menu" value={onMenu.filter((d) => d.available).length} note={`${onMenu.length} in total`} />
        <Tile label="Out of stock" value={outOfStock.length} note="drinks or sizes switched off" />
        <Tile label="Tables in use" value={venue.tables.filter((t) => t.active).length} note={`of ${venue.tables.length}`} />
        <Tile label="Categories shown" value={menuCats.length - hiddenCats.length} note={`${hiddenCats.length} hidden`} />
      </div>
      <Panel title="Needs attention">
        {outOfStock.length + tablesOff.length + hiddenWithDrinks.length === 0 ? (
          <p className="text-muted">Everything is on: all drinks, sizes and tables are available.</p>
        ) : (
          <ul className="flex flex-col">
            {outOfStock.map((d) => (
              <Attention key={d.id} to="/admin/drinks?filter=off" tone="bad" mark="!">
                <b>
                  {d.name}
                  {d.available &&
                    `: ${d.drink_variants
                      .filter((v) => !v.archived_at && !v.available)
                      .map((v) => v.label)
                      .join(", ")}`}
                </b>
                <span>Out of stock. Customers can't order {d.available ? "this size" : "it"}.</span>
              </Attention>
            ))}
            {hiddenWithDrinks.map(({ c, n }) => (
              <Attention key={c.id} to="/admin/categories" tone="neutral" mark="–">
                <b>{c.name} is hidden</b>
                <span>
                  Its {n} drink{n === 1 ? "" : "s"} don't show on the menu.
                </span>
              </Attention>
            ))}
            {owner &&
              tablesOff.map((t) => (
                <Attention key={t.id} to="/admin/tables" tone="neutral" mark="–">
                  <b>Table {t.label} is switched off</b>
                  <span>Customers can't choose it at checkout.</span>
                </Attention>
              ))}
          </ul>
        )}
      </Panel>
      <p className="text-sm text-muted">
        Takings and best sellers are on the Sales page. Real card refunds arrive once card payments are set up; until then refunds are practice ones on test orders.
      </p>
    </>
  );
}

type ProblemOrder = {
  id: string;
  order_number: number;
  table_label: string;
  problem_reason: string;
  problem_reported_at: string | null;
  fulfilment_status: string;
};

// Orders the bar has flagged ("Problem with this order") and not yet cleared.
// Live updates on orders, with a 30-second check as the safety net. The tab
// title shows the count so it's noticed in a background tab.
function useProblemOrders() {
  const [orders, setOrders] = useState<ProblemOrder[]>([]);
  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, table_label, problem_reason, problem_reported_at, fulfilment_status")
      .not("problem_reason", "is", null)
      .eq("payment_status", "paid")
      .order("problem_reported_at");
    if (data) setOrders(data as ProblemOrder[]);
  }, []);
  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 30_000);
    const channel = supabase
      // A fresh name each time: reusing one can pick up the old channel as it closes.
      .channel(`admin-problems-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void reload())
      .subscribe();
    return () => {
      window.clearInterval(id);
      void supabase.removeChannel(channel);
    };
  }, [reload]);
  useEffect(() => {
    document.title = `${orders.length ? `(${orders.length}) ` : ""}Admin · The Rising Sun Inn`;
    return () => {
      document.title = "Admin · The Rising Sun Inn";
    };
  }, [orders.length]);
  return { orders, reload };
}

function ProblemsPanel({ orders, onChanged }: { orders: ProblemOrder[]; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [refunding, setRefunding] = useState<string | null>(null);
  const ago = (iso: string | null) => (iso ? `${Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))} min ago` : "");

  async function clear(o: ProblemOrder) {
    const { error } = await supabase.rpc("staff_clear_problem", { p_order_id: o.id });
    if (error) return toast(friendlyError(error), { error: true });
    await onChanged();
    toast(`Problem cleared on order #${o.order_number}`);
  }

  // Takes it off the bar screen without serving it (asks once more first).
  const [closing, setClosing] = useState<string | null>(null);
  async function close(o: ProblemOrder) {
    if (closing !== o.id) return setClosing(o.id);
    setClosing(null);
    const { error } = await supabase.rpc("staff_close_order", { p_order_id: o.id, p_reason: o.problem_reason });
    if (error) return toast(friendlyError(error), { error: true });
    await onChanged();
    toast(`Order #${o.order_number} closed without serving. Refund it if the customer paid for drinks they didn't get.`);
  }

  return (
    <section className="flex flex-col gap-2 rounded-md border-2 border-alert bg-[#fbeae5] p-4.5">
      <h2 className="text-2xl font-semibold text-alert">
        {orders.length} problem{orders.length === 1 ? "" : "s"} reported by the bar
      </h2>
      <ul className="flex flex-col">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-alert/25 py-2.5 first:border-t-0">
            <span className="min-w-0">
              <b className="text-forest tabular-nums">
                #{o.order_number} · Table {o.table_label}
              </b>{" "}
              <small className="text-muted">{ago(o.problem_reported_at)}</small>
              <br />
              <span className="text-alert">{o.problem_reason}</span>
            </span>
            <span className="flex flex-wrap gap-2">
              <Button small onClick={() => setRefunding(o.id)}>
                Refund
              </Button>
              <Button variant="ghost" small onClick={() => void clear(o)}>
                Clear
              </Button>
              {o.fulfilment_status !== "delivered" && o.fulfilment_status !== "cancelled" && (
                <Button variant={closing === o.id ? "danger" : "danger-ghost"} small onClick={() => void close(o)}>
                  {closing === o.id ? "Tap again to close" : "Close without serving"}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <small className="text-muted">
        Refunding clears the problem. Use Clear if it was sorted another way, e.g. a swap at the bar. Close without serving takes an order off
        the bar screen when none of it will be served (refund it too).
      </small>
      {refunding && <RefundPanel client={supabase} orderId={refunding} onClose={() => setRefunding(null)} onDone={() => void onChanged()} />}
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-paper px-4 py-3.5">
      <small className="block text-xs font-semibold text-muted">{label}</small>
      <b className="mt-1 block font-display text-4xl leading-tight text-forest [font-variant-numeric:lining-nums_tabular-nums]">{value}</b>
      <span className="text-xs text-muted">{note}</span>
    </div>
  );
}

function Attention({
  to,
  tone,
  mark,
  children,
}: {
  to: string;
  tone: "bad" | "neutral";
  mark: string;
  children: ReactNode;
}) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link to={to} className="flex items-start gap-3 py-3 [&_b]:block [&_b]:text-forest [&_span]:text-sm [&_span]:text-muted">
        <span
          className={`grid h-6.5 w-6.5 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
            tone === "bad" ? "bg-[#fbeae5] !text-alert" : "bg-vellum"
          }`}
        >
          {mark}
        </span>
        <div>{children}</div>
      </Link>
    </li>
  );
}
