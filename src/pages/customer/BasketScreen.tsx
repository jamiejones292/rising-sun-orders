import type { ReactNode } from "react";
import { formatPence } from "../../lib/money";
import { PROBLEM_TEXT, priceLine, type BasketLine } from "../../lib/pricing";
import type { CustomerMenu } from "./useCustomerMenu";

export default function BasketScreen({
  menu,
  lines,
  onBack,
  onEdit,
  onQuantity,
  onRemove,
  notice,
}: {
  menu: CustomerMenu;
  lines: BasketLine[];
  onBack: () => void;
  onEdit: (index: number) => void;
  onQuantity: (index: number, q: number) => void;
  onRemove: (index: number) => void;
  notice: ReactNode;
}) {
  const priced = lines.map((l) => priceLine({ drinks: menu.drinks }, l));
  const total = priced.reduce((s, p) => s + (p.ok ? p.totalPence : 0), 0);
  const nameOf = (l: BasketLine) => menu.drinks.find((d) => d.id === l.drinkId)?.name ?? "A drink";

  return (
    <div className="gutter flex flex-col gap-5 py-5">
      <button onClick={onBack} className="self-start py-1.5 font-semibold text-forest">
        ← Back to menu
      </button>
      <h1 className="text-4xl">Your round</h1>
      {lines.length === 0 ? (
        <div className="py-10 text-center text-muted">
          <h2 className="mb-2 text-2xl">Your basket is empty</h2>
          <p>Have a look at the menu and pick your round.</p>
          <button onClick={onBack} className="mt-3 min-h-13 w-full rounded bg-forest font-semibold text-ivory">
            Browse drinks
          </button>
        </div>
      ) : (
        <>
          <div>
            {lines.map((l, i) => {
              const p = priced[i]!;
              return (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-b border-line py-3.5">
                  <div className="min-w-0">
                    <div className="font-semibold text-forest">{p.ok ? p.drinkName : nameOf(l)}</div>
                    {p.ok ? (
                      <div className="text-sm text-muted">
                        {[p.variantLabel, ...p.extras.filter((x) => !/^No mixer$/i.test(x.optionLabel)).map((x) => x.optionLabel), p.noIce ? "No ice" : ""]
                          .filter(Boolean)
                          .join(" · ")}{" "}
                        · {formatPence(p.unitPence)} each
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-alert">{PROBLEM_TEXT[p.reason]}</div>
                    )}
                  </div>
                  <div className="font-semibold tabular-nums">{p.ok ? formatPence(p.totalPence) : ""}</div>
                  <div className="col-span-2 flex items-center gap-3.5">
                    <div className="flex h-10 items-center rounded border border-forest">
                      <button aria-label="One fewer" onClick={() => onQuantity(i, l.quantity - 1)} className="h-full w-9.5 text-lg text-forest">
                        −
                      </button>
                      <output className="min-w-6 text-center font-bold tabular-nums">{l.quantity}</output>
                      <button aria-label="One more" onClick={() => onQuantity(i, l.quantity + 1)} className="h-full w-9.5 text-lg text-forest">
                        +
                      </button>
                    </div>
                    {p.ok || p.reason === "choice_required" || p.reason === "option_unavailable" || p.reason === "size_unavailable" ? (
                      <button onClick={() => onEdit(i)} className="py-1.5 font-semibold text-gold-ink underline underline-offset-3">
                        Change
                      </button>
                    ) : null}
                    <button onClick={() => onRemove(i)} className="py-1.5 font-semibold text-muted underline underline-offset-3">
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between border-t border-gold pt-2.5 font-display text-[1.6rem] font-bold text-forest">
            <span>Total</span>
            <span className="tabular-nums">{formatPence(total)}</span>
          </div>
          <p className="-mt-3 text-sm text-muted">Includes VAT. Prices and availability are checked again before you pay.</p>
          {notice}
          <button onClick={onBack} className="self-start py-1.5 font-semibold text-gold-ink underline underline-offset-3">
            + Add more drinks
          </button>
        </>
      )}
    </div>
  );
}
