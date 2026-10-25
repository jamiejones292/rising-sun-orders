import { useRef, type ReactNode } from "react";
import { formatPence } from "../../lib/money";
import type { CustomerMenu, MenuDrink } from "./useCustomerMenu";

const shortLabel = (l: string) =>
  l.replace(" pint", "").replace(" glass", "").replace(" 25ml", "").replace(" 50ml", "").replace(/^Cocktail$|^Regular$/, "");

export default function MenuScreen({
  menu,
  category,
  onCategory,
  onPick,
  notice,
}: {
  menu: CustomerMenu;
  category: string;
  onCategory: (id: string) => void;
  onPick: (d: MenuDrink) => void;
  notice: ReactNode;
}) {
  const chips = useRef<HTMLElement>(null);
  const sections = menu.categories
    .filter((c) => category === "all" || c.id === category)
    .map((c) => ({ cat: c, drinks: menu.drinks.filter((d) => d.category_id === c.id && d.variants.length > 0) }))
    .filter((s) => s.drinks.length);

  return (
    <>
      <nav
        ref={chips}
        aria-label="Drink categories"
        className="gutter flex gap-1.5 overflow-x-auto bg-forest pt-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {[{ id: "all", name: "All drinks" }, ...menu.categories].map((c) => (
          <button
            key={c.id}
            aria-current={category === c.id}
            onClick={(e) => {
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
      {notice}
      <div className="gutter">
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
