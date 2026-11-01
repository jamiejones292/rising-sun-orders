import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import { formatPence } from "../../lib/money";
import { Panel } from "../../components/ui";
import { PageHeader } from "./AdminApp";

// Sales: what sold most by day, week (Monday to Sunday), month or calendar year, in UK time.
// The database adds it up (admin_sales_stats, migration 012).

type Period = "day" | "week" | "month" | "year";
type Item = { name: string; size: string; quantity: number; revenue_pence: number };
type Stats = {
  orders: number;
  drinks: number;
  revenue_pence: number;
  refunded_pence: number;
  items: Item[];
  extras: { list: string; label: string; quantity: number }[];
};
type Row = { key: string; name: string; detail: string; quantity: number; revenue_pence: number };

// A calendar date as a UTC midnight, so adding days and months ignores clocks changing.
type Day = number;
const DAY_MS = 86_400_000;

function todayLondon(): Day {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()).split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

// The moment a UK calendar day starts (midnight in London, GMT or BST).
function londonMidnight(day: Day): string {
  const wall = new Date(new Date(day).toLocaleString("en-US", { timeZone: "Europe/London" })).getTime();
  const utcWall = new Date(new Date(day).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(day - (wall - utcWall)).toISOString();
}

function range(period: Period, anchor: Day): { from: Day; to: Day } {
  const d = new Date(anchor);
  if (period === "day") return { from: anchor, to: anchor + DAY_MS };
  if (period === "week") {
    const monday = anchor - ((d.getUTCDay() + 6) % 7) * DAY_MS;
    return { from: monday, to: monday + 7 * DAY_MS };
  }
  if (period === "year") return { from: Date.UTC(d.getUTCFullYear(), 0, 1), to: Date.UTC(d.getUTCFullYear() + 1, 0, 1) };
  const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return { from: first, to: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) };
}

function step(period: Period, anchor: Day, by: 1 | -1): Day {
  const d = new Date(anchor);
  if (period === "day") return anchor + by * DAY_MS;
  if (period === "week") return anchor + by * 7 * DAY_MS;
  if (period === "year") return Date.UTC(d.getUTCFullYear() + by, 0, 1);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + by, 1);
}

const fmt = (day: Day, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(day);

function label(period: Period, from: Day, to: Day, today: Day): string {
  if (period === "day") return `${from === today ? "Today, " : from === today - DAY_MS ? "Yesterday, " : ""}${fmt(from, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`;
  if (period === "week") return `${fmt(from, { day: "numeric", month: "short" })} – ${fmt(to - DAY_MS, { day: "numeric", month: "short", year: "numeric" })}`;
  if (period === "year") return fmt(from, { year: "numeric" });
  return fmt(from, { month: "long", year: "numeric" });
}

export default function Sales() {
  const today = todayLondon();
  const [period, setPeriod] = useState<Period>("day");
  const [anchor, setAnchor] = useState<Day>(today);
  // Test orders are the only orders until card payments go live.
  const [includeTest, setIncludeTest] = useState(true);
  const [combine, setCombine] = useState(true);
  const [sortBy, setSortBy] = useState<"quantity" | "revenue_pence">("quantity");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = range(period, anchor);
  const isCurrent = to > today;

  useEffect(() => {
    let alive = true;
    setStats(null);
    void supabase
      .rpc("admin_sales_stats", { p_from: londonMidnight(from), p_to: londonMidnight(to), p_include_test: includeTest })
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) return setError(friendlyError(err));
        setError(null);
        setStats(data as Stats);
      });
    return () => {
      alive = false;
    };
  }, [from, to, includeTest]);

  const rows = useMemo<Row[]>(() => {
    if (!stats) return [];
    let list: Row[];
    if (combine) {
      const byName = new Map<string, Row & { sizes: Map<string, number> }>();
      for (const it of stats.items) {
        const r = byName.get(it.name) ?? { key: it.name, name: it.name, detail: "", quantity: 0, revenue_pence: 0, sizes: new Map() };
        r.quantity += it.quantity;
        r.revenue_pence += it.revenue_pence;
        r.sizes.set(it.size, (r.sizes.get(it.size) ?? 0) + it.quantity);
        byName.set(it.name, r);
      }
      list = [...byName.values()].map((r) => ({
        ...r,
        detail: r.sizes.size > 1 ? [...r.sizes].map(([s, q]) => `${q} ${s}`).join(" · ") : [...r.sizes.keys()][0] ?? "",
      }));
    } else {
      list = stats.items.map((it) => ({ key: `${it.name}|${it.size}`, name: it.name, detail: it.size, quantity: it.quantity, revenue_pence: it.revenue_pence }));
    }
    return list.sort((a, b) => b[sortBy] - a[sortBy] || a.name.localeCompare(b.name));
  }, [stats, combine, sortBy]);

  const extras = (stats?.extras ?? []).filter((x) => !/^no\b/i.test(x.label)).sort((a, b) => b.quantity - a.quantity);

  return (
    <>
      <PageHeader title="Sales" intro="What sold most, by day, week, month or year (UK time). Orders refunded in full aren't counted." />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-full border border-line bg-paper p-0.5" role="group" aria-label="Period">
          {(["day", "week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              aria-pressed={period === p}
              onClick={() => {
                setPeriod(p);
                setAnchor(today);
              }}
              className={`min-h-10 rounded-full px-4 font-semibold capitalize ${period === p ? "bg-forest text-ivory" : "text-forest"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button aria-label="Earlier" onClick={() => setAnchor(step(period, anchor, -1))} className="h-10 w-10 rounded-full border border-line bg-paper text-forest">
            ‹
          </button>
          <span className="min-w-[13rem] text-center font-semibold text-forest">{label(period, from, to, today)}</span>
          <button
            aria-label="Later"
            disabled={isCurrent}
            onClick={() => setAnchor(step(period, anchor, 1))}
            className="h-10 w-10 rounded-full border border-line bg-paper text-forest disabled:opacity-30"
          >
            ›
          </button>
        </div>
        {!isCurrent && (
          <button onClick={() => setAnchor(today)} className="text-sm font-semibold text-gold-ink underline underline-offset-2">
            Back to {period === "day" ? "today" : `this ${period}`}
          </button>
        )}
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4.5 w-4.5 accent-forest" checked={includeTest} onChange={() => setIncludeTest(!includeTest)} />
          Include test orders
        </label>
      </div>

      {error && <p className="text-alert">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Orders" value={stats ? String(stats.orders) : "–"} />
        <Tile label="Drinks sold" value={stats ? String(stats.drinks) : "–"} />
        <Tile label="Takings" value={stats ? formatPence(stats.revenue_pence) : "–"} note="before refunds" />
        <Tile label="Refunded" value={stats ? formatPence(stats.refunded_pence) : "–"} />
      </div>

      <Panel
        title="Top drinks"
        action={
          <span className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4.5 w-4.5 accent-forest" checked={combine} onChange={() => setCombine(!combine)} />
              Combine sizes
            </label>
            <label className="flex items-center gap-2">
              Sort by
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="h-9 rounded border border-line bg-paper px-2">
                <option value="quantity">Number sold</option>
                <option value="revenue_pence">Takings</option>
              </select>
            </label>
          </span>
        }
      >
        {!stats ? (
          <p className="text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted">
            No drinks sold {period === "day" ? "on this day" : `in this ${period}`}.
            {!includeTest && " Tick “Include test orders” to see test orders."}
          </p>
        ) : (
          <RankedBars
            rows={rows.map((r) => ({
              key: r.key,
              name: r.name,
              detail: r.detail,
              value: r[sortBy],
              shown: sortBy === "quantity" ? `${r.quantity} sold` : formatPence(r.revenue_pence),
              aside: sortBy === "quantity" ? formatPence(r.revenue_pence) : `${r.quantity} sold`,
            }))}
          />
        )}
      </Panel>

      {extras.length > 0 && (
        <Panel title="Mixers & extras chosen">
          <RankedBars
            rows={extras.map((x) => ({ key: `${x.list}|${x.label}`, name: x.label, detail: x.list, value: x.quantity, shown: `${x.quantity}×`, aside: "" }))}
          />
        </Panel>
      )}
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-paper px-4 py-3.5">
      <small className="block text-xs font-semibold text-muted">{label}</small>
      <b className="mt-1 block font-display text-4xl leading-tight text-forest [font-variant-numeric:lining-nums_tabular-nums]">{value}</b>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

// A ranked list: one bar per row in a single colour, length = share of the top
// row, with the value written beside it (so the bar is never the only way to read it).
function RankedBars({ rows }: { rows: { key: string; name: string; detail: string; value: number; shown: string; aside: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="flex flex-col">
      {rows.map((r, i) => (
        <li
          key={r.key}
          title={`${r.name}${r.detail ? ` (${r.detail})` : ""}: ${r.shown}${r.aside ? `, ${r.aside}` : ""}`}
          className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line py-2.5 first:border-t-0 hover:bg-vellum/50"
        >
          <span className="text-right text-sm text-muted tabular-nums">{i + 1}</span>
          <span className="min-w-0">
            <b className="text-forest">{r.name}</b> {r.detail && <small className="text-muted">{r.detail}</small>}
          </span>
          <span className="text-right tabular-nums">
            <b className="text-ink">{r.shown}</b>
            {r.aside && <small className="block text-muted">{r.aside}</small>}
          </span>
          <span className="col-start-2 col-end-4 h-1.5 overflow-hidden rounded-full bg-vellum" aria-hidden="true">
            <span className="block h-full rounded-full bg-forest" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}
