import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMenuData } from "../../lib/adminData";
import { friendlyError } from "../../lib/errors";
import { formatPence } from "../../lib/money";
import type { Drink } from "../../lib/types";
import { Button, Pill, Switch, inputClass, useToast } from "../../components/ui";
import DrinkEditor from "./DrinkEditor";
import { PageHeader } from "./AdminApp";

type Filter = "active" | "off" | "archived";

// Ignore capitals and accents when searching ("rose" finds Rosé).
const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function Drinks() {
  const { data, error, reload, setData } = useMenuData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const filter = (params.get("filter") as Filter) || "active";
  const [editing, setEditing] = useState<Drink | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      setEditing("new");
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  // Drinks that are also a mixer choice for spirits (a linked option still offered).
  const mixerIds = useMemo(
    () => new Set((data?.groups ?? []).flatMap((g) => g.modifier_options.filter((o) => !o.archived_at && o.linked_drink_id).map((o) => o.linked_drink_id!))),
    [data],
  );
  const groups = useMemo(() => {
    if (!data) return [];
    const term = plain(q.trim());
    const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? "";
    // Matches the start of a word, so "rose" finds Rosé but not Prosecco.
    const wordStart = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    const list = data.drinks.filter(
      (d) =>
        (filter === "archived" ? !!d.archived_at : !d.archived_at) &&
        (filter !== "off" || !d.available || d.drink_variants.some((v) => !v.archived_at && !v.available)) &&
        (cat === "all" || d.category_id === cat) &&
        (!term || wordStart.test(plain(`${d.name} ${catName(d.category_id)}`))),
    );
    return data.categories.map((c) => ({ cat: c, drinks: list.filter((d) => d.category_id === c.id) })).filter((g) => g.drinks.length);
  }, [data, q, cat, filter]);

  // Flip a switch straight away on screen, then save; put it back if saving fails.
  function patchDrink(id: string, fn: (d: Drink) => Drink) {
    setData((prev) => (prev ? { ...prev, drinks: prev.drinks.map((d) => (d.id === id ? fn(d) : d)) } : prev));
  }

  async function setDrinkAvailable(d: Drink, available: boolean, quiet = false) {
    patchDrink(d.id, (x) => ({ ...x, available }));
    const { error } = await supabase.rpc("set_drink_available", { p_drink_id: d.id, p_available: available });
    if (error) {
      patchDrink(d.id, (x) => ({ ...x, available: !available }));
      return toast(friendlyError(error), { error: true });
    }
    const mixer = mixerIds.has(d.id) ? " (and as a mixer)" : "";
    if (!quiet)
      toast(available ? `${d.name} is back on the menu${mixer}` : `${d.name} marked out of stock${mixer}. Customers can't order it.`, {
        undo: () => void setDrinkAvailable(d, !available, true),
      });
  }

  async function setVariantAvailable(d: Drink, vid: string, available: boolean, quiet = false) {
    const label = d.drink_variants.find((v) => v.id === vid)?.label ?? "";
    patchDrink(d.id, (x) => ({ ...x, drink_variants: x.drink_variants.map((v) => (v.id === vid ? { ...v, available } : v)) }));
    const { error } = await supabase.rpc("set_variant_available", { p_variant_id: vid, p_available: available });
    if (error) {
      patchDrink(d.id, (x) => ({
        ...x,
        drink_variants: x.drink_variants.map((v) => (v.id === vid ? { ...v, available: !available } : v)),
      }));
      return toast(friendlyError(error), { error: true });
    }
    if (!quiet)
      toast(
        available ? `${d.name} ${label} available again` : `${d.name} ${label} switched off. Other sizes are still on sale.`,
        { undo: () => void setVariantAvailable(d, vid, !available, true) },
      );
  }

  // Permanent delete, only for drinks never ordered (admin_delete_drink, migration 011).
  async function remove(d: Drink) {
    setConfirmDelete(null);
    const { error } = await supabase.rpc("admin_delete_drink", { p_drink_id: d.id });
    if (error) return toast(friendlyError(error), { error: true });
    await reload();
    toast(`${d.name} deleted`);
  }

  async function restore(d: Drink) {
    const { error } = await supabase.from("drinks").update({ archived_at: null }).eq("id", d.id);
    if (error) return toast(friendlyError(error), { error: true });
    await reload();
    const c = data?.categories.find((x) => x.id === d.category_id);
    toast(
      c && !c.visible
        ? `${d.name} restored, but its category "${c.name}" is hidden, so customers won't see it. Edit the drink to move it, or show the category.`
        : `${d.name} restored to the menu`,
    );
  }

  // "All off" / "All on" for a whole category (asks once more first).
  const [confirmAll, setConfirmAll] = useState<string | null>(null);
  async function setCategoryAvailable(catId: string, name: string, available: boolean) {
    setConfirmAll(null);
    const { data: n, error } = await supabase.rpc("admin_set_category_available", { p_category_id: catId, p_available: available });
    if (error) return toast(friendlyError(error), { error: true });
    await reload();
    toast(`${name}: ${n ?? 0} drink${n === 1 ? "" : "s"} switched ${available ? "on" : "off"}`);
  }

  const setFilter = (f: Filter) => {
    params.set("filter", f);
    setParams(params, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Drinks & stock"
        intro="Switch a drink or a single size off when it runs out. Changes reach customers' phones within a few seconds."
        action={
          <Button variant="gold" onClick={() => setEditing("new")}>
            + ADD NEW DRINK
          </Button>
        }
      />
      {/* Stays at the top while scrolling a long menu. */}
      <div className="sticky top-0 z-5 -mx-1 flex flex-wrap items-center gap-2.5 bg-ivory px-1 py-2">
        <input
          id="drink-search"
          type="search"
          placeholder="Search drinks or categories"
          aria-label="Search drinks"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputClass} max-w-[360px] flex-[1_1_220px]`}
        />
        <select
          id="drink-category"
          aria-label="Category"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className={`${inputClass} w-auto flex-[0_1_220px]`}
        >
          <option value="all">All categories</option>
          {data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["active", "On the menu"],
              ["off", "Out of stock"],
              ["archived", "Archived"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className="rounded-full border border-[#d6c6a8] bg-paper px-3 py-1.5 text-sm font-medium aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-ivory"
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-alert">Couldn't load the menu: {error}</p>}
      {!data && !error && <p className="text-muted">Loading the menu…</p>}
      {data && groups.length === 0 && (
        <div className="rounded-md border border-line bg-paper p-10 text-center">
          <h2 className="text-2xl font-semibold">No drinks match</h2>
          <p className="mt-2 text-muted">Try a different search, category or filter, or add a new drink.</p>
        </div>
      )}

      <div className="flex flex-col gap-6.5">
        {groups.map(({ cat: c, drinks }) => (
          <section key={c.id} className="flex flex-col">
            <h2 className="flex flex-wrap items-baseline justify-between gap-2.5 border-b border-gold pb-1.5 text-2xl font-semibold">
              {c.name}
              <span className="flex flex-wrap items-center gap-2 font-sans text-sm font-medium text-muted">
                {drinks.length} drink{drinks.length === 1 ? "" : "s"}
                {!c.visible && " · category hidden"}
                {filter !== "archived" &&
                  ([false, true] as const).map((on) => {
                    const key = `${c.id}:${on}`;
                    return (
                      <Button
                        key={key}
                        variant={confirmAll === key ? "danger" : "ghost"}
                        small
                        onClick={() => (confirmAll === key ? void setCategoryAvailable(c.id, c.name, on) : setConfirmAll(key))}
                      >
                        {confirmAll === key ? `Switch every ${c.name} drink ${on ? "on" : "off"}?` : on ? "All on" : "All off"}
                      </Button>
                    );
                  })}
                {filter !== "archived" && <CategoryPrice catId={c.id} name={c.name} drinks={drinks} onDone={reload} />}
              </span>
            </h2>
            {drinks.map((d) => (
              <div
                key={d.id}
                className={`grid grid-cols-1 items-start gap-2.5 border-b border-line py-3.5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto] ${
                  d.archived_at ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className={`text-[1.02rem] font-bold ${d.available ? "text-forest" : "text-muted"}`}>{d.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
                    {d.abv != null && <span>{d.abv}% ABV</span>}
                    {d.is_welsh && <Pill tone="gold">Welsh</Pill>}
                    {!d.available && !d.archived_at && <Pill tone="bad">Out of stock</Pill>}
                    {mixerIds.has(d.id) && <Pill tone="gold">Mixer for spirits</Pill>}
                    {d.drink_modifier_groups.map((g) => (
                      <span key={g.group_id}>+ {data?.groups.find((x) => x.id === g.group_id)?.name}</span>
                    ))}
                    {d.offers_no_ice && <span>+ No ice option</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {d.drink_variants
                    .filter((v) => !v.archived_at)
                    .map((v) => (
                      <div key={v.id} className="grid grid-cols-[minmax(0,1fr)_76px_auto] items-center gap-2.5 text-sm">
                        <span className={v.available && d.available ? "" : "text-muted line-through"}>{v.label}</span>
                        <span className={`text-right font-bold tabular-nums ${v.available && d.available ? "" : "text-muted line-through"}`}>
                          {formatPence(v.price_pence)}
                        </span>
                        {!d.archived_at && (
                          <Switch
                            on={v.available}
                            disabled={!d.available}
                            label={`${d.name} ${v.label} available`}
                            onChange={(on) => void setVariantAvailable(d, v.id, on)}
                          />
                        )}
                      </div>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {confirmDelete === d.id ? (
                    <span className="flex flex-wrap items-center gap-2 rounded border border-alert bg-[#fbeae5] px-2.5 py-1.5 text-sm text-alert">
                      Delete {d.name} for good? This can't be undone.
                      <Button variant="danger" small onClick={() => void remove(d)}>
                        Delete
                      </Button>
                      <Button variant="ghost" small onClick={() => setConfirmDelete(null)}>
                        Keep it
                      </Button>
                    </span>
                  ) : d.archived_at ? (
                    <>
                      <Button variant="ghost" small aria-label={`Restore ${d.name}`} onClick={() => void restore(d)}>
                        Restore
                      </Button>
                      <Button variant="danger-ghost" small aria-label={`Delete ${d.name}`} onClick={() => setConfirmDelete(d.id)}>
                        Delete
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted">Whole drink</span>
                      <Switch on={d.available} label={`${d.name} available`} onChange={(on) => void setDrinkAvailable(d, on)} />
                      <Button variant="ghost" small aria-label={`Edit ${d.name}`} onClick={() => setEditing(d)}>
                        Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {data && editing && (
        <DrinkEditor
          drink={editing === "new" ? null : editing}
          data={data}
          defaultCategory={cat !== "all" ? cat : (data.categories.find((c) => c.visible) ?? data.categories[0])?.id}
          onClose={() => setEditing(null)}
          onSaved={async (name, archived) => {
            setEditing(null);
            await reload();
            toast(archived ? `${name} archived` : `${name} saved and live on the menu`);
          }}
        />
      )}
    </>
  );
}

// Set one size's price for every drink in a category at once, e.g. every
// "Single 25ml" gin to £3.20.
function CategoryPrice({ catId, name, drinks, onDone }: { catId: string; name: string; drinks: Drink[]; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const sizes = [...new Set(drinks.flatMap((d) => d.drink_variants.filter((v) => !v.archived_at).map((v) => v.label)))];
  const [size, setSize] = useState(sizes[0] ?? "");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  if (!sizes.length) return null;
  if (!open)
    return (
      <Button variant="ghost" small onClick={() => setOpen(true)}>
        Change a price
      </Button>
    );
  const pence = /^\d+(\.\d{1,2})?$/.test(price.trim().replace(/^£/, "")) ? Math.round(parseFloat(price.trim().replace(/^£/, "")) * 100) : null;
  const count = drinks.filter((d) => d.drink_variants.some((v) => !v.archived_at && v.label === size)).length;
  async function save() {
    if (!pence || pence <= 0) return toast("Write the price like 3.20", { error: true });
    setBusy(true);
    const { data: n, error } = await supabase.rpc("admin_set_category_size_price", { p_category_id: catId, p_label: size, p_price_pence: pence });
    setBusy(false);
    if (error) return toast(friendlyError(error), { error: true });
    setOpen(false);
    setPrice("");
    await onDone();
    toast(`${name}: ${size} is now ${formatPence(pence)} (${n ?? 0} changed)`);
  }
  return (
    <span className="flex basis-full flex-wrap items-center gap-2 rounded border border-line bg-paper p-2 text-ink">
      Set every
      <select aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)} className={`${inputClass} !h-10 !w-auto`}>
        {sizes.map((l) => (
          <option key={l}>{l}</option>
        ))}
      </select>
      in {name} to £
      <input
        aria-label="New price"
        inputMode="decimal"
        placeholder="3.20"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className={`${inputClass} !h-10 !w-24`}
      />
      <Button small disabled={busy || !pence} onClick={() => void save()}>
        {busy ? "Saving…" : `Save for ${count} drink${count === 1 ? "" : "s"}`}
      </Button>
      <Button variant="ghost" small onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </span>
  );
}
