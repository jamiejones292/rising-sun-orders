import { useEffect, useRef, type ReactNode } from "react";
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
  "g&t": ["gin"],
  gt: ["gin"],
  jd: ["jack daniel"],
  j20: ["j2o"],
  ale: ["draught beer", "real ale"],
  bitter: ["draught beer", "real ale"],
  shandy: ["lager", "lemonade"],
  vino: ["wine"],
  // A word for a whole type of drink brings up every drink of that type.
  beer: ["lager", "ale", "stout", "bitter", "ipa"],
  spirit: ["whisky", "gin", "vodka", "rum", "tequila", "brandy", "liqueur", "cognac"],
  pop: ["soft drink", "cans"],
  fizzy: ["soft drink", "cans", "prosecco"],
  // Common misspellings.
  larger: ["lager"],
  lagar: ["lager"],
  guiness: ["guinness"],
  guineas: ["guinness"],
  prosseco: ["prosecco"],
  proseco: ["prosecco"],
  cyder: ["cider"],
  whiskys: ["whisky"],
  vodca: ["vodka"],
};

// The word typed, its singular ("ales" → "ale", "largers" → "larger") and
// anything listed for either above.
const forms = (w: string) => {
  const base = w.length > 3 && w.endsWith("s") ? [w, w.slice(0, -1)] : [w];
  return [...new Set(base.flatMap((b) => [b, ...(ALSO[b] ?? [])]))];
};

// Words that don't help find a drink ("a pint of lager" searches for "lager").
const STOP = new Set(["a", "an", "and", "of", "the", "with", "glass", "pint", "half", "bottle", "&", "please", "some"]);

// For search: ignore capitals and accents, so "jager" finds Jägermeister and "rose" finds Rosé.
const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "") // "gordons" finds Gordon's
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
  // Keep the highlighted button in view as the menu scrolls through the headings.
  useEffect(() => {
    const nav = chips.current;
    const el = nav?.querySelector<HTMLElement>(`[data-cat="${category}"]`);
    if (nav && el) nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [category]);
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
            // "Search" on the keyboard closes it, so the results can be seen.
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
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
        {menu.categories.map((c) => (
          <button
            key={c.id}
            data-cat={c.id}
            aria-current={!searching && category === c.id}
            onClick={() => {
              onQuery("");
              onCategory(c.id);
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
  query,
  onClearQuery,
  onPick,
  notice,
}: {
  menu: CustomerMenu;
  query: string;
  onClearQuery: () => void;
  onPick: (d: MenuDrink) => void;
  notice: ReactNode;
}) {
  // While searching, every category is searched and each word typed must match.
  // Drinks matching by name or category come first; descriptions are only
  // searched when nothing matches by name (so "fruit" finds the Fruit Shoot, not
  // every "fruity" drink).
  const typed = plain(query).split(/\s+/).filter(Boolean);
  const useful = typed.filter((w) => !STOP.has(w));
  const words = useful.length ? useful : typed;
  const catName = (d: MenuDrink) => menu.categories.find((c) => c.id === d.category_id)?.name ?? "";
  // Each word must match the start of a word, so "rose" finds Rosé but not Prosecco.
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const starts = words.map((w) => new RegExp(`(^|[^a-z0-9])(${forms(w).map(esc).join("|")})`));
  const all = (text: string) => starts.every((r) => r.test(plain(text)));
  const some = (text: string) => starts.some((r) => r.test(plain(text)));
  const onMenu = menu.drinks.filter((d) => d.category_visible && d.variants.length > 0);
  // Best first: every word in the name or category; then every word anywhere
  // (descriptions too); last, any one word in the name, so a typo in one word
  // still finds something.
  const mode: "name" | "desc" | "any" =
    onMenu.some((d) => all(`${d.name} ${catName(d)}`)) ? "name" : onMenu.some((d) => all(`${d.name} ${d.description ?? ""} ${catName(d)}`)) ? "desc" : "any";
  const matches = (d: MenuDrink, cat: string) =>
    !words.length ||
    (mode === "name" ? all(`${d.name} ${cat}`) : mode === "desc" ? all(`${d.name} ${d.description ?? ""} ${cat}`) : words.length > 1 && some(`${d.name} ${cat}`));
  const sections = menu.categories
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
        {words.length > 1 && mode === "any" && sections.length > 0 && (
          <p className="m-0 pt-4 text-sm text-muted">Nothing matches all of “{query.trim()}”, so here are drinks matching some of it.</p>
        )}
        {sections.map(({ cat, drinks }, i) => (
          <section
            key={cat.id}
            id={`cat-${cat.id}`}
            data-menu-cat={cat.id}
            // The last heading gets room below it, so tapping it can still bring it to the top.
            className={`pt-6.5 pb-1 ${i === sections.length - 1 && !words.length ? "min-h-[calc(100dvh-12rem)]" : ""}`}
          >
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
