import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth, isOwnerRole } from "../../lib/auth";
import { useMenuData, useVenue } from "../../lib/adminData";
import { Panel } from "../../components/ui";
import OrderingCard from "./OrderingCard";
import { PageHeader } from "./AdminApp";

export default function Overview() {
  const { profile } = useAuth();
  const { data } = useMenuData();
  const venue = useVenue();
  const owner = isOwnerRole(profile);

  const live = data?.drinks.filter((d) => !d.archived_at) ?? [];
  const outOfStock = live.filter((d) => !d.available || d.drink_variants.some((v) => !v.archived_at && !v.available));
  const tablesOff = venue.tables.filter((t) => !t.active);
  const hiddenCats = data?.categories.filter((c) => !c.visible) ?? [];
  const greeting = new Date().getHours() < 12 ? "Bore da" : new Date().getHours() < 18 ? "Prynhawn da" : "Noswaith dda";

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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Drinks on the menu" value={live.filter((d) => d.available).length} note={`${live.length} in total`} />
        <Tile label="Out of stock" value={outOfStock.length} note="drinks or sizes switched off" />
        <Tile label="Tables in use" value={venue.tables.filter((t) => t.active).length} note={`of ${venue.tables.length}`} />
        <Tile label="Categories shown" value={(data?.categories.length ?? 0) - hiddenCats.length} note={`${hiddenCats.length} hidden`} />
      </div>
      <Panel title="Needs attention">
        {outOfStock.length + tablesOff.length + hiddenCats.length === 0 ? (
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
            {hiddenCats.map((c) => (
              <Attention key={c.id} to="/admin/categories" tone="neutral" mark="–">
                <b>{c.name} is hidden</b>
                <span>None of its drinks show on the menu.</span>
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
        Orders, refunds, staff accounts and sales reports appear here once payments and the bar screen are built.
      </p>
    </>
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
