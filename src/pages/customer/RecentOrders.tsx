import { Link } from "react-router-dom";
import { formatPence } from "../../lib/money";
import type { PastOrder } from "./history";

const london = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", ...opts });

// Tonight's orders show the time; older ones show the day as well.
function when(iso: string) {
  const day = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const time = london(iso, { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "");
  const recent = Date.now() - new Date(iso).getTime() < 12 * 3_600_000;
  return day(iso) === day(new Date()) || recent ? time : `${london(iso, { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

export default function RecentOrders({ orders, onAgain, compact = false }: { orders: PastOrder[]; onAgain: (o: PastOrder) => void; compact?: boolean }) {
  if (!orders.length) return null;
  const shown = compact ? orders.slice(0, 1) : orders;
  return (
    <section aria-labelledby="recent-title" className="flex flex-col gap-2.5">
      <h2 id="recent-title" className="font-caps text-[0.72rem] tracking-[0.2em] text-gold-ink uppercase">
        {compact ? "Your last round" : "Your recent orders"}
      </h2>
      <ul className="flex flex-col gap-2.5">
        {shown.map((o) => (
          <li key={o.token} className="flex flex-col gap-2.5 rounded border border-line bg-paper p-3.5">
            <div className="flex items-baseline justify-between gap-3 text-sm text-muted tabular-nums">
              <span>
                {when(o.placedAt)} · Table {o.table}
              </span>
              <span>{formatPence(o.totalPence)}</span>
            </div>
            <p className="font-semibold text-forest">{o.summary}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button onClick={() => onAgain(o)} className="min-h-11 rounded border border-forest bg-forest px-4 font-semibold text-ivory">
                Same again
              </button>
              <Link to={`/order/${o.token}`} className="py-2 text-sm font-semibold text-gold-ink underline underline-offset-2">
                View order #{o.orderNumber}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
