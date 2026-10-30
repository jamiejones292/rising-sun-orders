import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "../../lib/errors";
import { Switch, useToast } from "../../components/ui";

type SizeRow = { id: string; label: string; available: boolean };
type StockRow = { id: string; name: string; available: boolean; category: string; sizes: SizeRow[] };

// The out-of-stock switches used on the bar screen: by bar staff (when the owner
// allows it) and in the manager's admin section. Whole drinks and single sizes.
export default function StockList({
  client,
  reloadKey = 0,
  onEdit,
}: {
  client: SupabaseClient;
  reloadKey?: number;
  onEdit?: (drinkId: string) => void;
}) {
  const toast = useToast();
  const [stock, setStock] = useState<StockRow[] | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await client
      .from("drinks")
      .select("id, name, available, sort_order, categories(name, sort_order), drink_variants(id, label, available, sort_order, archived_at)")
      .is("archived_at", null)
      .order("sort_order");
    if (error) return toast(friendlyError(error), { error: true });
    type Row = {
      id: string;
      name: string;
      available: boolean;
      sort_order: number;
      categories: { name: string; sort_order: number } | null;
      drink_variants: (SizeRow & { sort_order: number; archived_at: string | null })[];
    };
    const rows = ((data as unknown as Row[]) ?? []).sort(
      (a, b) => (a.categories?.sort_order ?? 0) - (b.categories?.sort_order ?? 0) || a.sort_order - b.sort_order,
    );
    setStock(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        available: r.available,
        category: r.categories?.name ?? "",
        sizes: r.drink_variants
          .filter((v) => !v.archived_at)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ id: v.id, label: v.label, available: v.available })),
      })),
    );
  }, [client, toast]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (stock ?? []).filter((s) => !term || s.name.toLowerCase().includes(term) || s.category.toLowerCase().includes(term));
  }, [stock, q]);

  const patch = (id: string, fn: (r: StockRow) => StockRow) => setStock((all) => all && all.map((s) => (s.id === id ? fn(s) : s)));

  // Flip the switch straight away, then save; put it back if saving fails.
  async function setDrink(row: StockRow, available: boolean) {
    patch(row.id, (s) => ({ ...s, available }));
    const { error } = await client.rpc("set_drink_available", { p_drink_id: row.id, p_available: available });
    if (error) {
      patch(row.id, (s) => ({ ...s, available: !available }));
      return toast(friendlyError(error), { error: true });
    }
    toast(`${row.name} ${available ? "is back on the menu" : "marked out of stock"}`);
  }

  async function setSize(row: StockRow, size: SizeRow, available: boolean) {
    const flip = (value: boolean) => patch(row.id, (s) => ({ ...s, sizes: s.sizes.map((v) => (v.id === size.id ? { ...v, available: value } : v)) }));
    flip(available);
    const { error } = await client.rpc("set_variant_available", { p_variant_id: size.id, p_available: available });
    if (error) {
      flip(!available);
      return toast(friendlyError(error), { error: true });
    }
    toast(`${row.name} ${size.label} ${available ? "available again" : "out of stock. Other sizes are still on sale."}`);
  }

  return (
    <>
      <input
        id="bar-stock-search"
        type="search"
        placeholder="Find a drink"
        aria-label="Find a drink"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="my-1 h-11 rounded-lg border-2 border-line bg-white px-3"
      />
      <div className="max-h-[min(60dvh,32rem)] overflow-y-auto">
        {stock === null && <p className="py-4 text-center text-sm text-muted">Loading drinks…</p>}
        {stock !== null && visible.length === 0 && <p className="py-4 text-center text-sm text-muted">No drink matches "{q}".</p>}
        {visible.map((s) => (
          <div key={s.id} className="border-t border-vellum py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className={s.available ? "" : "text-muted line-through"}>{s.name}</span>
                <br />
                <small className="text-muted">
                  {s.category}
                  {!s.available && <b className="ml-1.5 text-bar-red">· Out of stock</b>}
                </small>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {onEdit && (
                  <button onClick={() => onEdit(s.id)} className="min-h-10 rounded-lg border-2 border-line bg-white px-3 text-sm font-extrabold text-forest">
                    Edit
                  </button>
                )}
                <Switch on={s.available} showText={false} label={`${s.name} available`} onChange={(on) => void setDrink(s, on)} />
              </span>
            </div>
            {s.available && s.sizes.length > 1 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.sizes.map((v) => (
                  <button
                    key={v.id}
                    role="switch"
                    aria-checked={v.available}
                    aria-label={`${s.name} ${v.label} available`}
                    onClick={() => void setSize(s, v, !v.available)}
                    className={`min-h-9 rounded-full border-2 px-3 text-sm font-bold ${
                      v.available ? "border-bar-ok bg-white text-bar-ok" : "border-bar-red bg-bar-red-soft text-bar-red line-through"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <small className="text-muted">Tap a size to switch just that size off or on.</small>
    </>
  );
}
