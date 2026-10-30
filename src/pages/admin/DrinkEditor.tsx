import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { MenuData } from "../../lib/adminData";
import { friendlyError } from "../../lib/errors";
import { UK_ALLERGENS, type Drink } from "../../lib/types";
import { Button, Drawer, Field, Switch, inputClass } from "../../components/ui";

type SizeRow = { key: string; id?: string; label: string; price: string; available: boolean };

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

// Price typed as pounds ("6.20", "£6", "6.2") to whole pence, or null if not a price.
export function parsePrice(text: string): number | null {
  const t = text.replace(/[£,\s]/g, "");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null;
  const pence = Math.round(parseFloat(t) * 100);
  return pence > 0 ? pence : null;
}

// Mixer price in pounds ("1.20", "£1", empty for free) to whole pence, or null.
function parseMixerPrice(text: string): number | null {
  const t = text.replace(/[£,\s]/g, "");
  if (t === "") return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

export default function DrinkEditor({
  drink,
  data,
  defaultCategory,
  onClose,
  onSaved,
  client = supabase,
}: {
  drink: Drink | null;
  data: MenuData;
  defaultCategory?: string;
  onClose: () => void;
  onSaved: (name: string, archived: boolean) => void | Promise<void>;
  // The bar screen passes its manager sign-in; the admin site uses its own login.
  client?: SupabaseClient;
}) {
  // Every spirit offers a mixer (owner's decision): the mixer options to tick
  // when a drink is new in, or moved into, the Spirits category.
  const mixerFor = (catId: string) =>
    data.categories.find((c) => c.id === catId)?.name.toLowerCase().includes("spirit")
      ? data.groups.find((g) => g.name.toLowerCase().includes("mixer"))?.id
      : undefined;
  // "Also offer as a mixer": this drink's choice in the spirits' mixer list,
  // linked to the drink so it goes out of stock with it (migration 009).
  const mixerGroup = data.groups.find((g) => g.name.toLowerCase().includes("mixer"));
  const myMixer = drink ? mixerGroup?.modifier_options.find((o) => o.linked_drink_id === drink.id && !o.archived_at) : undefined;
  const [asMixer, setAsMixer] = useState(!!myMixer);
  const [mixerPrice, setMixerPrice] = useState(myMixer ? (myMixer.price_pence / 100).toFixed(2) : "");
  const [name, setName] = useState(drink?.name ?? "");
  const [categoryId, setCategoryId] = useState(drink?.category_id ?? defaultCategory ?? "");
  const [description, setDescription] = useState(drink?.description ?? "");
  const [abv, setAbv] = useState(drink?.abv != null ? String(drink.abv) : "");
  const [alcohol, setAlcohol] = useState(drink?.contains_alcohol ?? true);
  const [welsh, setWelsh] = useState(drink?.is_welsh ?? false);
  const [noIce, setNoIce] = useState(drink?.offers_no_ice ?? false);
  const [vat, setVat] = useState(String(drink?.vat_rate ?? 20));
  const [available, setAvailable] = useState(drink?.available ?? true);
  const [allergens, setAllergens] = useState<string[]>(drink?.allergens ?? []);
  const [groupIds, setGroupIds] = useState<string[]>(() => {
    if (drink) return drink.drink_modifier_groups.map((g) => g.group_id);
    const mixer = mixerFor(categoryId);
    return mixer ? [mixer] : [];
  });
  const [sizes, setSizes] = useState<SizeRow[]>(
    drink
      ? drink.drink_variants
          .filter((v) => !v.archived_at)
          .map((v) => ({ key: newKey(), id: v.id, label: v.label, price: (v.price_pence / 100).toFixed(2), available: v.available }))
      : [{ key: newKey(), label: "Pint", price: "", available: true }],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Give the drink a name so customers can find it.");
    if (!categoryId) return setError("Choose a category.");
    if (sizes.length === 0) return setError("Add at least one size with a price.");
    const variants = [];
    for (const s of sizes) {
      const pence = parsePrice(s.price);
      if (!s.label.trim() || pence === null) {
        return setError("Each size needs a name and a price, written like 6.20.");
      }
      variants.push({ id: s.id, label: s.label.trim(), price_pence: pence, available: s.available });
    }
    if (abv.trim() && (isNaN(Number(abv)) || Number(abv) < 0 || Number(abv) > 99.9)) {
      return setError("ABV should be a number like 4.5, or left empty.");
    }
    const mixerPence = parseMixerPrice(mixerPrice);
    if (asMixer && mixerPence === null) return setError("Write the mixer price like 1.20, or 0 if it's free.");
    setBusy(true);
    const { data: savedId, error: err } = await client.rpc("admin_save_drink", {
      p_drink: {
        id: drink?.id,
        category_id: categoryId,
        name: name.trim(),
        description: description.trim(),
        abv: abv.trim() === "" ? null : Number(abv),
        contains_alcohol: alcohol,
        is_welsh: welsh,
        offers_no_ice: noIce,
        allergens,
        vat_rate: Number(vat),
        available,
        variants,
        modifier_group_ids: groupIds,
      },
    });
    if (err) {
      setBusy(false);
      return setError(friendlyError(err));
    }
    const mixerErr = await saveMixer((savedId as string | null) ?? drink?.id ?? null, mixerPence ?? 0);
    setBusy(false);
    if (mixerErr) return setError(`The drink was saved, but the mixer wasn't: ${friendlyError(mixerErr)}`);
    await onSaved(name.trim(), false);
  }

  // Add, update or remove this drink's choice in the mixer list.
  async function saveMixer(drinkId: string | null, pence: number) {
    if (!mixerGroup || !drinkId) return null;
    const label = name.trim();
    if (asMixer && myMixer) {
      // Keep the mixer's name in step with the drink unless someone renamed it on purpose.
      const newLabel = myMixer.label === drink?.name ? label : myMixer.label;
      if (pence === myMixer.price_pence && newLabel === myMixer.label) return null;
      return (await client.from("modifier_options").update({ price_pence: pence, label: newLabel }).eq("id", myMixer.id)).error;
    }
    const old = drink ? mixerGroup.modifier_options.find((o) => o.linked_drink_id === drink.id) : undefined;
    if (asMixer && old) {
      // Bring back its earlier mixer; re-saving the link picks up the drink's stock.
      return (
        await client.from("modifier_options").update({ archived_at: null, price_pence: pence, label, linked_drink_id: drinkId }).eq("id", old.id)
      ).error;
    }
    if (asMixer) {
      const sort = Math.max(0, ...mixerGroup.modifier_options.map((o) => o.sort_order)) + 10;
      return (
        await client
          .from("modifier_options")
          .insert({ group_id: mixerGroup.id, label, price_pence: pence, sort_order: sort, linked_drink_id: drinkId })
      ).error;
    }
    if (myMixer) return (await client.from("modifier_options").update({ archived_at: new Date().toISOString() }).eq("id", myMixer.id)).error;
    return null;
  }

  async function archive() {
    if (!drink) return;
    setBusy(true);
    const { error: err } = await client.from("drinks").update({ archived_at: new Date().toISOString() }).eq("id", drink.id);
    setBusy(false);
    if (err) return setError(friendlyError(err));
    await onSaved(drink.name, true);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={drink ? "Edit drink" : "New drink"}
      title={drink ? drink.name : "Add a new drink"}
      footer={
        <>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : drink ? "Save changes" : "Save & publish"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <span className="flex-1" />
          {drink && (
            <Button variant="danger-ghost" onClick={() => setConfirmArchive(true)}>
              Archive drink
            </Button>
          )}
        </>
      }
    >
      <Field label="Drink name">
        <input
          id="edit-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tiny Rebel Clwb Tropicana"
          maxLength={80}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select
            id="edit-category"
            className={inputClass}
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              const mixer = mixerFor(e.target.value);
              if (mixer && !groupIds.includes(mixer)) setGroupIds([...groupIds, mixer]);
              // A new drink starts in the first category; moving it out of Spirits
              // takes away the mixer list that was ticked for it automatically.
              const auto = mixerFor(categoryId);
              if (!drink && !mixer && auto) setGroupIds(groupIds.filter((id) => id !== auto));
            }}
          >
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.visible ? " (hidden)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ABV %" hint="optional">
          <input
            id="edit-abv"
            className={`${inputClass} tabular-nums`}
            inputMode="decimal"
            value={abv}
            onChange={(e) => setAbv(e.target.value)}
            placeholder="e.g. 4.5"
          />
        </Field>
      </div>
      <Field label="Description" hint="customers see this">
        <textarea
          id="edit-description"
          className={`${inputClass} h-auto min-h-21 py-2.5`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          placeholder="One or two short sentences"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-forest">Sizes &amp; prices</span>
        <small className="text-sm text-muted">Each size can be switched off on its own. Prices include VAT.</small>
        {sizes.map((s, i) => (
          <div key={s.key} className="grid grid-cols-[minmax(0,1fr)_108px_auto_36px] items-center gap-2">
            <input
              id={`size-label-${i}`}
              className={inputClass}
              value={s.label}
              aria-label="Size name"
              placeholder="Size, e.g. Pint"
              maxLength={40}
              onChange={(e) => setSizes(sizes.map((x) => (x.key === s.key ? { ...x, label: e.target.value } : x)))}
            />
            <span className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">£</span>
              <input
                id={`size-price-${i}`}
                className={`${inputClass} pl-6 tabular-nums`}
                inputMode="decimal"
                aria-label="Price"
                placeholder="0.00"
                value={s.price}
                onChange={(e) => setSizes(sizes.map((x) => (x.key === s.key ? { ...x, price: e.target.value } : x)))}
                onBlur={() => {
                  const pence = parsePrice(s.price);
                  if (pence !== null)
                    setSizes((all) => all.map((x) => (x.key === s.key ? { ...x, price: (pence / 100).toFixed(2) } : x)));
                }}
              />
            </span>
            <Switch
              on={s.available}
              showText={false}
              label={`${s.label || "Size"} available`}
              onChange={(on) => setSizes(sizes.map((x) => (x.key === s.key ? { ...x, available: on } : x)))}
            />
            <button
              type="button"
              aria-label="Remove size"
              disabled={sizes.length === 1}
              onClick={() => setSizes(sizes.filter((x) => x.key !== s.key))}
              className="h-9 w-9 rounded border border-[#d6c6a8] bg-paper text-muted disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          small
          className="self-start"
          onClick={() => setSizes([...sizes, { key: newKey(), label: "", price: "", available: true }])}
        >
          + Add a size
        </Button>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-forest">Options customers can choose</legend>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {data.groups.map((g) => (
            <label key={g.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-forest"
                checked={groupIds.includes(g.id)}
                onChange={() => setGroupIds(toggleIn(groupIds, g.id))}
              />
              <span className="min-w-0">
                {g.name}
                <span className="block text-xs text-muted">
                  {g.modifier_options.filter((o) => !o.archived_at).map((o) => o.label).slice(0, 3).join(", ")}
                  {g.modifier_options.length > 3 ? "…" : ""}
                </span>
              </span>
            </label>
          ))}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-forest" checked={noIce} onChange={() => setNoIce(!noIce)} />
            <span>
              "No ice" tick box
              <span className="block text-xs text-muted">Shown on soft drinks and mixers</span>
            </span>
          </label>
        </div>
      </fieldset>

      {mixerGroup && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold text-forest">Mixer</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-forest" checked={asMixer} onChange={() => setAsMixer(!asMixer)} />
            <span>
              Also offer as a mixer for spirits
              <span className="block text-xs text-muted">
                Adds it to "{mixerGroup.name}". It goes out of stock whenever this drink does.
              </span>
            </span>
          </label>
          {asMixer && (
            <Field label="Mixer price" hint="added to the spirit's price, usually less than the drink on its own">
              <span className="relative max-w-[160px]">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">+£</span>
                <input
                  id="edit-mixer-price"
                  className={`${inputClass} pl-8 tabular-nums`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={mixerPrice}
                  onChange={(e) => setMixerPrice(e.target.value)}
                />
              </span>
            </Field>
          )}
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-forest">
          Allergens <span className="font-normal text-muted">· the 14 UK allergens</span>
        </legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {UK_ALLERGENS.map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4.5 w-4.5 accent-forest"
                checked={allergens.includes(a)}
                onChange={() => setAllergens(toggleIn(allergens, a))}
              />
              {a}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4.5 w-4.5 accent-forest" checked={alcohol} onChange={() => setAlcohol(!alcohol)} />
          Contains alcohol (customers confirm their age at checkout)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4.5 w-4.5 accent-forest" checked={welsh} onChange={() => setWelsh(!welsh)} />
          Show the "Welsh" tag
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="VAT rate">
          <select id="edit-vat" className={inputClass} value={vat} onChange={(e) => setVat(e.target.value)}>
            <option value="20">Standard 20%</option>
            <option value="5">Reduced 5%</option>
            <option value="0">Zero 0%</option>
          </select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-forest">On the menu</span>
          <div className="flex h-11 items-center">
            <Switch on={available} label="Drink available" onChange={setAvailable} />
          </div>
        </div>
      </div>

      {error && <p className="m-0 text-sm font-semibold text-alert">{error}</p>}

      {confirmArchive && drink && (
        <div className="flex flex-col gap-2.5 rounded border border-alert bg-[#fbeae5] p-3 text-sm text-alert">
          <b>Archive {drink.name}?</b>
          It disappears from the customer menu. Past orders and reports keep it, and you can restore it from the Archived
          filter.
          <div className="flex gap-2">
            <Button variant="danger" small onClick={() => void archive()} disabled={busy}>
              Archive
            </Button>
            <Button variant="ghost" small onClick={() => setConfirmArchive(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
