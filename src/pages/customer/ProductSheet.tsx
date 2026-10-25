import { useEffect, useRef, useState } from "react";
import { formatPence } from "../../lib/money";
import { MAX_QUANTITY, priceLine, type BasketLine } from "../../lib/pricing";
import type { CustomerMenu, MenuDrink } from "./useCustomerMenu";

// Bottom sheet for choosing size, extras and quantity.
export default function ProductSheet({
  menu,
  drink,
  editing,
  onClose,
  onSave,
}: {
  menu: CustomerMenu;
  drink: MenuDrink;
  editing: BasketLine | null;
  onClose: () => void;
  onSave: (line: BasketLine) => void;
}) {
  const firstAvailable = drink.variants.find((v) => v.available);
  const [variantId, setVariantId] = useState(
    editing?.variantId ?? (drink.variants.find((v) => v.label === "Pint" && v.available) ?? firstAvailable)?.id ?? "",
  );
  const [options, setOptions] = useState<Record<string, string>>(
    editing?.options ??
      Object.fromEntries(
        drink.groups
          .map((g) => [g.id, g.options.find((o) => o.available)?.id])
          .filter((x): x is [string, string] => !!x[1]),
      ),
  );
  const [noIce, setNoIce] = useState(editing?.noIce ?? false);
  const [qty, setQty] = useState(editing?.quantity ?? 1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const category = menu.categories.find((c) => c.id === drink.category_id)?.name;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const line: BasketLine = { drinkId: drink.id, variantId, options, noIce, quantity: qty };
  const priced = priceLine({ drinks: menu.drinks }, line);

  return (
    <>
      <div className="fixed inset-0 z-20 bg-forest/45" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-name"
        className="fixed bottom-0 left-1/2 z-21 flex max-h-[88vh] w-full max-w-[440px] -translate-x-1/2 flex-col rounded-t-2xl border-t-[3px] border-gold bg-paper"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-[max(0.75rem,env(safe-area-inset-right,0px))] h-9 w-9 rounded-full border border-line bg-paper text-muted"
        >
          ✕
        </button>
        <div className="gutter flex flex-col gap-4.5 overflow-y-auto pt-5.5 pb-2.5">
          <div className="pr-10">
            {category && <p className="font-caps text-[0.72rem] tracking-[0.22em] text-gold-ink uppercase">{category}</p>}
            <h3 id="sheet-name" className="mt-1.5 text-[1.9rem]">
              {drink.name}
            </h3>
          </div>
          {(drink.description || drink.abv != null) && (
            <p className="text-muted">
              {drink.description}
              {drink.abv != null && <b className="text-ink"> {drink.abv}% ABV.</b>}
            </p>
          )}
          {drink.allergens.length > 0 && (
            <p className="border-l-2 border-gold pl-2.5 text-sm text-muted">
              Contains: {drink.allergens.join(", ")}. Ask the bar team for full allergen details.
            </p>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-bold tracking-[0.08em] text-forest uppercase">Size</legend>
            {drink.variants.map((v) => (
              <Option
                key={v.id}
                type="radio"
                name="variant"
                checked={v.id === variantId}
                disabled={!v.available}
                onChange={() => setVariantId(v.id)}
                label={v.label}
                note={!v.available ? "unavailable" : undefined}
                price={formatPence(v.price_pence)}
              />
            ))}
          </fieldset>
          {drink.groups.map((g) => (
            <fieldset key={g.id} className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-bold tracking-[0.08em] text-forest uppercase">
                {g.name} <span className="font-medium tracking-normal text-muted normal-case">· {g.required ? "choose one" : "optional"}</span>
              </legend>
              {g.options.map((o) => (
                <Option
                  key={o.id}
                  type="radio"
                  name={`group-${g.id}`}
                  checked={options[g.id] === o.id}
                  disabled={!o.available}
                  onChange={() => setOptions({ ...options, [g.id]: o.id })}
                  label={o.label}
                  note={!o.available ? "unavailable" : undefined}
                  price={o.price_pence ? `+${formatPence(o.price_pence)}` : ""}
                  quiet
                />
              ))}
            </fieldset>
          ))}
          {drink.offers_no_ice && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-bold tracking-[0.08em] text-forest uppercase">Ice</legend>
              <Option type="checkbox" name="noice" checked={noIce} onChange={() => setNoIce(!noIce)} label="No ice" price="" />
            </fieldset>
          )}
        </div>
        <div className="gutter flex items-center gap-3 border-t border-line pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex h-13.5 shrink-0 items-center rounded border border-forest">
            <button aria-label="One fewer" onClick={() => setQty(Math.max(1, qty - 1))} className="h-full w-11 text-xl text-forest">
              −
            </button>
            <output className="min-w-6 text-center font-bold tabular-nums">{qty}</output>
            <button aria-label="One more" onClick={() => setQty(Math.min(MAX_QUANTITY, qty + 1))} className="h-full w-11 text-xl text-forest">
              +
            </button>
          </div>
          <button
            disabled={!priced.ok}
            onClick={() => priced.ok && onSave(line)}
            className="flex min-h-13.5 flex-1 items-center justify-center gap-2 rounded border border-forest bg-forest px-4 font-semibold text-ivory disabled:opacity-45"
          >
            {editing ? "Update" : "Add to basket"} {priced.ok && <span className="tabular-nums">· {formatPence(priced.totalPence)}</span>}
          </button>
        </div>
      </div>
    </>
  );
}

function Option({
  type,
  name,
  checked,
  disabled,
  onChange,
  label,
  note,
  price,
  quiet,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
  note?: string;
  price: string;
  quiet?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded border px-3.5 py-3 has-[:checked]:border-forest has-[:checked]:bg-white has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-forest)] ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } border-line bg-ivory`}
    >
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={onChange} className="m-0 h-4.5 w-4.5 accent-forest" />
      <span className="flex-1">
        {label}
        {note && <small className="text-alert"> · {note}</small>}
      </span>
      <span className={`tabular-nums ${quiet ? "font-medium text-muted" : "font-semibold"}`}>{price}</span>
    </label>
  );
}
