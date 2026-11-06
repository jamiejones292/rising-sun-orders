import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useVenue } from "../../lib/adminData";
import { friendlyError } from "../../lib/errors";
import { formatPence, vatIncludedPence } from "../../lib/money";
import { Button } from "../../components/ui";
import { PageHeader } from "./AdminApp";

// End of night: a printable summary of one trading day (6am to 6am UK time,
// the same day the bar's "Fulfilled today" uses). Money in = orders paid in
// that time (refunded ones included, as on the Sales page); money out = refunds
// made in that time. Read straight from the orders and refunds the managers
// can already see, so there's nothing extra in the database.

type Item = {
  drink_name: string;
  variant_label: string;
  quantity: number;
  line_total_pence: number;
  vat_rate: number;
  out_of_stock: boolean | null;
  order_item_options: { option_label: string; price_pence: number }[];
};
type Order = {
  id: string;
  order_number: number;
  table_label: string;
  total_pence: number;
  refunded_pence: number;
  payment_status: string;
  fulfilment_status: string;
  payment_provider: string | null;
  payment_method_label: string | null;
  paid_at: string;
  order_items: Item[];
};
type Refund = {
  amount_pence: number;
  reason: string;
  created_at: string;
  orders: { order_number: number; table_label: string; payment_provider: string | null } | null;
};

const DAY_STARTS_AT = 6;
const DAY_MS = 86_400_000;

// A calendar date as UTC midnight, so stepping days ignores the clocks changing.
type Day = number;

// The moment it's `hour` o'clock on `day` in London (GMT or BST).
function londonAt(day: Day, hour: number): Date {
  const guess = day + hour * 3_600_000;
  const t = new Date(guess);
  const wall = new Date(t.toLocaleString("en-US", { timeZone: "Europe/London" })).getTime();
  const utc = new Date(t.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess - (wall - utc));
}

// Tonight's trading day: before 6am it's still last night.
function currentTradingDay(): Day {
  const now = new Date();
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now).split("-").map(Number);
  const today = Date.UTC(y!, m! - 1, d!);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(now));
  return hour < DAY_STARTS_AT ? today - DAY_MS : today;
}

const dayName = (day: Day) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(day);
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

// "Apple Pay (Visa 4242)" → "Apple Pay"; test orders in their own line.
function methodOf(o: Order) {
  if (o.payment_provider === "test") return "Test orders (no money taken)";
  const label = (o.payment_method_label ?? "").replace(/\s*\(.*\)\s*$/, "").trim();
  return label || "Card";
}

export default function EndOfNight() {
  const venue = useVenue();
  const tonight = currentTradingDay();
  const [day, setDay] = useState<Day>(tonight);
  // Test orders are the only orders until card payments go live.
  const [includeTest, setIncludeTest] = useState(true);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString());

  const from = londonAt(day, DAY_STARTS_AT).toISOString();
  const to = londonAt(day + DAY_MS, DAY_STARTS_AT).toISOString();

  useEffect(() => {
    let alive = true;
    setOrders(null);
    void Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, table_label, total_pence, refunded_pence, payment_status, fulfilment_status, payment_provider, payment_method_label, paid_at, " +
            "order_items(drink_name, variant_label, quantity, line_total_pence, vat_rate, out_of_stock, order_item_options(option_label, price_pence))",
        )
        .in("payment_status", ["paid", "partially_refunded", "refunded"])
        .gte("paid_at", from)
        .lt("paid_at", to)
        .order("paid_at")
        .limit(2000),
      supabase
        .from("refunds")
        .select("amount_pence, reason, created_at, orders(order_number, table_label, payment_provider)")
        .neq("status", "failed")
        .gte("created_at", from)
        .lt("created_at", to)
        .order("created_at"),
    ]).then(([o, r]) => {
      if (!alive) return;
      if (o.error || r.error) return setError(friendlyError((o.error || r.error)!));
      setError(null);
      setOrders(o.data as unknown as Order[]);
      setRefunds(r.data as unknown as Refund[]);
      setPrintedAt(new Date().toISOString());
    });
    return () => {
      alive = false;
    };
  }, [from, to]);

  const report = useMemo(() => {
    if (!orders) return null;
    const list = orders.filter((o) => includeTest || o.payment_provider !== "test");
    const refundList = refunds.filter((r) => includeTest || r.orders?.payment_provider !== "test");
    const takings = list.reduce((s, o) => s + o.total_pence, 0);
    const refunded = refundList.reduce((s, r) => s + r.amount_pence, 0);

    const methods = new Map<string, { orders: number; pence: number }>();
    for (const o of list) {
      const m = methods.get(methodOf(o)) ?? { orders: 0, pence: 0 };
      m.orders += 1;
      m.pence += o.total_pence;
      methods.set(methodOf(o), m);
    }

    // VAT included in the takings, per rate, worked out per line like receipts.
    const vat = new Map<number, { gross: number; vat: number }>();
    for (const i of list.flatMap((o) => o.order_items)) {
      const rate = Number(i.vat_rate);
      const v = vat.get(rate) ?? { gross: 0, vat: 0 };
      v.gross += i.line_total_pence;
      v.vat += vatIncludedPence(i.line_total_pence, rate);
      vat.set(rate, v);
    }

    // Drinks that went out: lines on orders the bar finished, minus out of stock.
    const served = new Map<string, { name: string; size: string; qty: number; pence: number }>();
    const extras = new Map<string, number>();
    let outOfStock = 0;
    for (const o of list) {
      for (const i of o.order_items) {
        if (i.out_of_stock) {
          outOfStock += i.quantity;
          continue;
        }
        if (o.fulfilment_status !== "delivered") continue;
        const key = `${i.drink_name}|${i.variant_label}`;
        const s = served.get(key) ?? { name: i.drink_name, size: i.variant_label, qty: 0, pence: 0 };
        s.qty += i.quantity;
        s.pence += i.line_total_pence;
        served.set(key, s);
        for (const x of i.order_item_options) {
          if (/^no\b/i.test(x.option_label)) continue;
          extras.set(x.option_label, (extras.get(x.option_label) ?? 0) + i.quantity);
        }
      }
    }
    const servedList = [...served.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));

    return {
      list,
      refundList,
      takings,
      refunded,
      methods: [...methods.entries()].sort((a, b) => b[1].pence - a[1].pence),
      vat: [...vat.entries()].sort((a, b) => b[0] - a[0]),
      servedList,
      servedCount: servedList.reduce((s, x) => s + x.qty, 0),
      extras: [...extras.entries()].sort((a, b) => b[1] - a[1]),
      outOfStock,
      closed: list.filter((o) => o.fulfilment_status === "cancelled"),
      waiting: list.filter((o) => ["new", "preparing", "ready"].includes(o.fulfilment_status)),
      tests: list.filter((o) => o.payment_provider === "test").length,
    };
  }, [orders, refunds, includeTest]);

  const s = venue.settings;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="End of night"
          intro="A summary of one trading day, 6am to 6am: money taken, refunds paid out, VAT, and the drinks that went out. Print it or save it as a PDF to keep."
          action={
            <Button onClick={() => window.print()} disabled={!report}>
              Print / save as PDF
            </Button>
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-2.5 print:hidden">
        <button aria-label="Day before" onClick={() => setDay(day - DAY_MS)} className="h-10 w-10 rounded-full border border-line bg-paper text-forest">
          ‹
        </button>
        <span className="min-w-[15rem] text-center font-semibold text-forest">
          {day === tonight ? "Tonight · " : day === tonight - DAY_MS ? "Last night · " : ""}
          {dayName(day)}
        </span>
        <button
          aria-label="Day after"
          disabled={day >= tonight}
          onClick={() => setDay(day + DAY_MS)}
          className="h-10 w-10 rounded-full border border-line bg-paper text-forest disabled:opacity-30"
        >
          ›
        </button>
        {day !== tonight && (
          <button onClick={() => setDay(tonight)} className="text-sm font-semibold text-gold-ink underline underline-offset-2">
            Back to tonight
          </button>
        )}
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4.5 w-4.5 accent-forest" checked={includeTest} onChange={() => setIncludeTest(!includeTest)} />
          Include test orders
        </label>
      </div>

      {error && <p className="text-alert">{error}</p>}
      {!report && !error && <p className="text-muted">Loading…</p>}

      {report && (
        <article className="mx-auto w-full max-w-[460px] rounded-md border border-line bg-white px-6 py-6 text-ink shadow-sm tabular-nums print:max-w-none print:border-0 print:px-0 print:shadow-none">
          <header className="border-b-2 border-dashed border-line pb-3 text-center">
            <h2 className="font-display text-3xl font-semibold text-forest">{s?.venue_name ?? "The Rising Sun Inn"}</h2>
            {s?.venue_address && <p className="text-sm text-muted">{s.venue_address}</p>}
            {s?.vat_registered && s.vat_number && <p className="text-sm text-muted">VAT no. {s.vat_number}</p>}
            <p className="mt-2 font-caps text-sm tracking-[0.18em] text-gold-ink uppercase">End of night</p>
            <p className="font-semibold">{dayName(day)}</p>
            <p className="text-xs text-muted">
              6am to 6am the next morning · printed {new Date(printedAt).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {day === tonight && " · the night isn't over yet"}
            </p>
            {report.tests > 0 && (
              <p className="mt-2 rounded bg-vellum px-2 py-1 text-xs font-semibold">
                Includes {report.tests} test order{report.tests === 1 ? "" : "s"}: no money was taken for {report.tests === 1 ? "it" : "them"}.
              </p>
            )}
          </header>

          <Section title="Money in">
            <Line label="Orders paid" value={String(report.list.length)} />
            {report.methods.map(([m, v]) => (
              <Line key={m} label={`${m} (${v.orders})`} value={formatPence(v.pence)} indent />
            ))}
            <Line label="Total taken" value={formatPence(report.takings)} strong />
            {report.vat.map(([rate, v]) => (
              <Line key={rate} label={`Includes VAT at ${rate}% on ${formatPence(v.gross)}`} value={formatPence(v.vat)} indent muted />
            ))}
          </Section>

          <Section title="Money out">
            {report.refundList.length === 0 ? (
              <p className="text-sm text-muted">No refunds.</p>
            ) : (
              report.refundList.map((r, i) => (
                <div key={i} className="flex justify-between gap-3 py-0.5 text-sm">
                  <span className="min-w-0">
                    {hm(r.created_at)} · #{r.orders?.order_number} · Table {r.orders?.table_label}
                    {r.orders?.payment_provider === "test" && " · test"}
                    <span className="block text-xs text-muted">{r.reason}</span>
                  </span>
                  <span className="shrink-0">−{formatPence(r.amount_pence)}</span>
                </div>
              ))
            )}
            <Line label={`Refunds (${report.refundList.length})`} value={`−${formatPence(report.refunded)}`} strong />
          </Section>

          <Section title="Total">
            <Line label="Taken" value={formatPence(report.takings)} />
            <Line label="Refunded" value={`−${formatPence(report.refunded)}`} />
            <div className="mt-1 flex justify-between border-t-2 border-forest pt-1.5 text-lg font-extrabold text-forest">
              <span>Net takings</span>
              <span>{formatPence(report.takings - report.refunded)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Refunds count on the night they were made, so one made today for an earlier order shows here.</p>
          </Section>

          <Section title={`Drinks that went out (${report.servedCount})`}>
            {report.servedList.length === 0 ? (
              <p className="text-sm text-muted">No orders finished at the bar.</p>
            ) : (
              report.servedList.map((x) => (
                <div key={`${x.name}|${x.size}`} className="flex justify-between gap-3 py-0.5 text-sm">
                  <span className="min-w-0">
                    <b className="mr-1.5">{x.qty}×</b>
                    {x.name} <span className="text-muted">{x.size}</span>
                  </span>
                  <span className="shrink-0">{formatPence(x.pence)}</span>
                </div>
              ))
            )}
            {report.extras.length > 0 && (
              <>
                <p className="mt-2 text-xs font-bold tracking-wide text-muted uppercase">Mixers & extras</p>
                {report.extras.map(([label, n]) => (
                  <div key={label} className="flex justify-between gap-3 py-0.5 text-sm">
                    <span>{label}</span>
                    <span>{n}×</span>
                  </div>
                ))}
              </>
            )}
          </Section>

          <Section title="Not served">
            <Line label="Drinks reported out of stock" value={`${report.outOfStock}`} />
            <Line label="Orders closed without serving" value={`${report.closed.length}`} />
            <Line label="Orders still waiting at the bar" value={`${report.waiting.length}`} />
            {report.waiting.length > 0 && (
              <p className="text-xs text-alert">
                Still waiting: {report.waiting.map((o) => `#${o.order_number} (Table ${o.table_label})`).join(", ")}. Serve them, or close them from the bar's Admin.
              </p>
            )}
          </Section>

          <p className="pt-4 text-center text-xs text-muted">drinksorder.app · table orders only (not bar till sales)</p>
        </article>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b-2 border-dashed border-line py-3 break-inside-avoid">
      <h3 className="mb-1.5 font-sans text-sm font-extrabold tracking-[0.12em] text-forest uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, value, strong, indent, muted }: { label: string; value: string; strong?: boolean; indent?: boolean; muted?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-3 py-0.5 ${strong ? "mt-1 border-t border-line pt-1.5 font-extrabold" : "text-sm"} ${indent ? "pl-3" : ""} ${
        muted ? "text-muted" : ""
      }`}
    >
      <span className="min-w-0">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );
}
