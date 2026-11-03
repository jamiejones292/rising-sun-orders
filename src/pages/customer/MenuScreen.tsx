import { useRef, type ReactNode } from "react";
import { formatPence } from "../../lib/money";
import type { CustomerMenu, MenuDrink } from "./useCustomerMenu";

const shortLabel = (l: string) =>
  l.replace(" pint", "").replace(" glass", "").replace(" 25ml", "").replace(" 50ml", "").replace(/^Cocktail$|^Regular$/, "");

// Other words people type for the same thing.
const ALSO: Record<string, string[]> = {
  coke: ["coca"],
  cola: ["coca", "pepsi", "coke"],
  whiskey: ["whisky"],
  whisky: ["whiskey"],
  water: ["soda"],
  "0.0": ["alcohol free", "alcohol-free"],
  af: ["alcohol free", "alcohol-free", "0.0"],
  bubbly: ["prosecco", "champagne"],
  fizz: ["prosecco", "champagne"],
  kids: ["fruit shoot", "milkshake"],
};

// For search: ignore capitals and accents, so "jager" finds Jägermeister and "rose" finds Rosé.
const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Search box and category buttons. They sit in the page's sticky header, so
// they stay in view while the menu scrolls.
export function MenuToolbar({
  menu,
  category,
  onCategory,
  query,
  onQuery,
}: {
  menu: CustomerMenu;
  category: string;
  onCategory: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
}) {
  const chips = useRef<HTMLElement>(null);
  const searching = query.trim() !== "";
  return (
    <>
      <div className="gutter pb-2">
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="pointer-events-none absolute top-1/2 left-3 h-4.5 w-4.5 -translate-y-1/2 text-forest/60" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            id="menu-search"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search drinks, e.g. gin or Guinness"
            aria-label="Search the drinks menu"
            value={query}
            onChange={(e) => {
              onQuery(e.target.value);
              window.scrollTo({ top: 0 });
            }}
            className="h-10.5 w-full rounded-full border-0 bg-ivory pr-10 pl-9.5 text-[1rem] text-ink placeholder:text-muted/80"
          />
          {searching && (
            <button
              onClick={() => onQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 h-8 w-8 -translate-y-1/2 rounded-full text-lg text-muted"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <nav
        ref={chips}
        aria-label="Drink categories"
        className="gutter flex gap-1.5 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {[{ id: "all", name: "All drinks" }, ...menu.categories].map((c) => (
          <button
            key={c.id}
            aria-current={!searching && category === c.id}
            onClick={(e) => {
              onQuery("");
              onCategory(c.id);
              const el = e.currentTarget;
              chips.current?.scrollTo({ left: el.offsetLeft - (chips.current.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
              window.scrollTo({ top: 0 });
            }}
            className="shrink-0 rounded-full border border-gold-soft/35 px-3.5 py-1.5 text-sm font-medium text-ivory aria-[current=true]:border-gold-soft aria-[current=true]:bg-gold-soft aria-[current=true]:text-forest"
          >
            {c.name}
          </button>
        ))}
      </nav>
    </>
  );
}

export default function MenuScreen({
  menu,
  category,
  query,
  onClearQuery,
  onPick,
  notice,
}: {
  menu: CustomerMenu;
  category: string;
  query: string;
  onClearQuery: () => void;
  onPick: (d: MenuDrink) => void;
  notice: ReactNode;
}) {
  // While searching, every category is searched and each word typed must match.
  // Drinks matching by name or category come first; descriptions are only
  // searched when nothing matches by name (so "fruit" finds the Fruit Shoot, not
  // every "fruity" drink).
  const words = plain(query).split(/\s+/).filter(Boolean);
  const catName = (d: MenuDrink) => menu.categories.find((c) => c.id === d.category_id)?.name ?? "";
  // Each word must match the start of a word, so "rose" finds Rosé but not Prosecco.
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const starts = words.map((w) => new RegExp(`(^|[^a-z0-9])(${[w, ...(ALSO[w] ?? [])].map(esc).join("|")})`));
  const hits = (text: string) => starts.every((r) => r.test(plain(text)));
  const byName = words.length > 0 && menu.drinks.some((d) => d.variants.length > 0 && hits(`${d.name} ${catName(d)}`));
  const matches = (d: MenuDrink, cat: string) =>
    !words.length || (byName ? hits(`${d.name} ${cat}`) : hits(`${d.name} ${d.description ?? ""} ${cat}`));
  const sections = menu.categories
    .filter((c) => words.length > 0 || category === "all" || c.id === category)
    .map((c) => ({ cat: c, drinks: menu.drinks.filter((d) => d.category_id === c.id && d.variants.length > 0 && matches(d, c.name)) }))
    .filter((s) => s.drinks.length);

  return (
    <>
      {!words.length && notice}
      <div className="gutter">
        {words.length > 0 && sections.length === 0 && (
          <div className="flex flex-col items-start gap-3 py-10">
            <p className="m-0 text-muted">No drinks match “{query.trim()}”.</p>
            <button onClick={onClearQuery} className="font-semibold text-gold-ink underline underline-offset-3">
              Clear the search
            </button>
          </div>
        )}
        {sections.map(({ cat, drinks }) => (
          <section key={cat.id} className="pt-6.5 pb-1">
            <div className="flex items-baseline justify-between gap-3 border-b border-gold pb-1.5">
              <h2 className="text-[1.7rem]">{cat.name}</h2>
              <span className="text-xs text-muted">
                {drinks.length} drink{drinks.length === 1 ? "" : "s"}
              </span>
            </div>
            {drinks.map((d) => {
              const out = !d.available;
              return (
                <button
                  key={d.id}
                  onClick={() => onPick(d)}
                  aria-disabled={out}
                  className="grid w-full grid-cols-[1fr_auto] gap-x-3.5 gap-y-1 border-b border-line py-4 text-left"
                >
                  <div className="min-w-0">
                    <div className={`text-[1.04rem] font-semibold text-forest ${out ? "opacity-50" : ""}`}>{d.name}</div>
                    {d.description && <div className="mt-0.5 text-sm text-muted">{d.description}</div>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {out && <Tag tone="out">Sold out tonight</Tag>}
                      {d.is_welsh && <Tag tone="welsh">Welsh</Tag>}
                      {d.abv != null && <Tag>{d.abv}% ABV</Tag>}
                    </div>
                  </div>
                  <div className={`flex flex-col gap-0.5 text-right text-sm whitespace-nowrap ${out ? "opacity-50" : ""}`}>
                    {d.variants.slice(0, 3).map((v) => (
                      <span key={v.id} className={`font-semibold tabular-nums ${v.available ? "" : "line-through opacity-50"}`}>
                        <small className="mr-1 text-xs font-normal text-muted">{shortLabel(v.label)}</small>
                        {formatPence(v.price_pence)}
                      </span>
                    ))}
                    {d.variants.length > 3 && <small className="text-muted">+ more sizes</small>}
                  </div>
                </button>
              );
            })}
          </section>
        ))}
        <p className="py-6 text-sm text-muted">
          All prices include VAT. Spirits are served as 25ml singles or 50ml doubles. Please ask the bar team about allergens.
        </p>
      </div>
    </>
  );
}

function Tag({ tone, children }: { tone?: "welsh" | "out"; children: ReactNode }) {
  const t =
    tone === "welsh" ? "border-gold text-gold-ink" : tone === "out" ? "border-alert bg-[#fbede7] text-alert" : "border-line text-muted";
  return <span className={`rounded-sm border bg-paper px-2 py-0.5 text-[0.72rem] font-semibold tracking-wide ${t}`}>{children}</span>;
}
