import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { MenuData } from "../../lib/adminData";
import { friendlyError } from "../../lib/errors";
import { UK_ALLERGENS, type Drink } from "../../lib/types";
import { Button, Drawer, Field, Switch, inputClass } from "../../components/ui";

// touched: the size's stock switch was changed in this form.
type SizeRow = { key: string; id?: string; label: string; price: string; available: boolean; touched?: boolean };

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

// Price typed as pounds ("6.20", "£6", "6.2") to whole pence, or null if not a price.
// Up to £1,000, the database's limit for a size. ".50" is fine too.
export function parsePrice(text: string): number | null {
  const t = text.replace(/[£,\s]/g, "");
  if (!/^(\d{1,4}(\.\d{1,2})?|\.\d{1,2})$/.test(t)) return null;
  const pence = Math.round(parseFloat(t) * 100);
  return pence > 0 && pence <= 100_000 ? pence : null;
}

// Mixer price in pounds ("1.20", "£1", empty for free) to whole pence, or null.
export function parseMixerPrice(text: string): number | null {
  const t = text.replace(/[£,\s]/g, "");
  if (t === "") return 0;
  if (!/^(\d{1,3}(\.\d{1,2})?|\.\d{1,2})$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

// Mixer-only drinks live in a hidden "Mixers" category: hidden categories never
// reach the customer menu and can't be ordered, but the drink still appears in
// the spirits' mixer list and has a stock switch. Created on first use.
export const MIXERS_CATEGORY = "Mixers";
export const isMixersCategory = (name: string) => name.trim().toLowerCase() === MIXERS_CATEGORY.toLowerCase();
// The real mixer-only category is the hidden one; a visible category that
// happens to be called "Mixers" is an ordinary category.
export const isMixerOnlyCategory = (c: { name: string; visible: boolean }) => isMixersCategory(c.name) && !c.visible;
// Categories whose drinks are spirits (they get "Add a mixer" ticked automatically).
const SPIRIT_CATEGORY = /spirit|whisk|\bgin\b|vodka|\brum\b|tequila|liqueur|brandy|cognac/i;
// Mixer choices are limited to 60 characters in the database; drink names to 80.
const MIXER_LABEL_MAX = 60;
const NEW_MIXERS = "__mixers__";

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
    SPIRIT_CATEGORY.test(data.categories.find((c) => c.id === catId)?.name ?? "")
      ? data.groups.find((g) => g.name.toLowerCase().includes("mixer"))?.id
      : undefined;
  // "Also offer as a mixer": this drink's choice in the spirits' mixer list,
  // linked to the drink so it goes out of stock with it (migration 009).
  const mixerGroup = data.groups.find((g) => g.name.toLowerCase().includes("mixer"));
  const myMixer = drink ? mixerGroup?.modifier_options.find((o) => o.linked_drink_id === drink.id && !o.archived_at) : undefined;
  const [madeMixersCat, setMadeMixersCat] = useState<string | null>(null);
  const mixersCat = data.categories.find(isMixerOnlyCategory) ?? (madeMixersCat ? { id: madeMixersCat } : undefined);
  // Set after the first successful save of a new drink, so retrying (e.g. after
  // the mixer step failed) updates that drink instead of adding a second one.
  const [savedId, setSavedId] = useState<string | null>(null);
  const drinkId = drink?.id ?? savedId ?? undefined;
  const [availableTouched, setAvailableTouched] = useState(false);
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
  // A new drink starts with the option lists most drinks in its category have
  // (e.g. "How would you like it?" for whiskies), plus the mixer list for spirits.
  const autoGroups = (catId: string) => {
    const same = data.drinks.filter((d) => d.category_id === catId && !d.archived_at);
    const common = data.groups
      .filter((g) => same.length > 0 && same.filter((d) => d.drink_modifier_groups.some((x) => x.group_id === g.id)).length * 2 > same.length)
      .map((g) => g.id);
    const mixer = mixerFor(catId);
    return mixer && !common.includes(mixer) ? [...common, mixer] : common;
  };
  const [groupIds, setGroupIds] = useState<string[]>(() => {
    if (drink) return drink.drink_modifier_groups.map((g) => g.group_id);
    return autoGroups(categoryId);
  });
  const [sizes, setSizes] = useState<SizeRow[]>(
    drink
      ? drink.drink_variants
          .filter((v) => !v.archived_at)
          .map((v) => ({ key: newKey(), id: v.id, label: v.label, price: (v.price_pence / 100).toFixed(2), available: v.available }))
      : [{ key: newKey(), label: "Pint", price: "", available: true }],
  );
  const [error, setError] = useState<string | null>(null);

  // Stock as it is right now in the database, for switches not changed in this
  // form: a drink switched off at the bar meanwhile mustn't be put back on sale
  // by saving a price change.
  async function currentStock() {
    if (!drinkId) return null;
    const { data: now } = await client.from("drinks").select("available, drink_variants(id, available, archived_at)").eq("id", drinkId).maybeSingle();
    return now as { available: boolean; drink_variants: { id: string; available: boolean; archived_at: string | null }[] } | null;
  }
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Ask before throwing away edits (a stray tap outside the form closes it).
  const snapshot = JSON.stringify([
    name, categoryId, description, abv, alcohol, welsh, noIce, vat, available, allergens, groupIds, asMixer, mixerPrice,
    sizes.map((x) => [x.label, x.price, x.available]),
  ]);
  const initial = useRef(snapshot);
  const dirty = snapshot !== initial.current;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Leaving: also take away the history entry added for the phone's Back button.
  const leaving = useRef(false);
  const leave = () => {
    leaving.current = true;
    if ((window.history.state as { rsDrawer?: boolean } | null)?.rsDrawer) window.history.back();
  };
  const requestClose = () => {
    if (!dirty) {
      leave();
      return onClose();
    }
    setConfirmDiscard(true);
  };
  const discard = () => {
    leave();
    onClose();
  };
  // The phone's Back button closes the form (asking first if there are changes),
  // instead of leaving the page; closing or reloading the tab asks too.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const mark = () => window.history.pushState({ ...(window.history.state as object | null), rsDrawer: true }, "");
    if (!(window.history.state as { rsDrawer?: boolean } | null)?.rsDrawer) mark();
    const onPop = () => {
      if (leaving.current) return;
      if (dirtyRef.current) {
        mark();
        setConfirmDiscard(true);
      } else onCloseRef.current();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);
  // Saving into a hidden category asks once more (the drink wouldn't be seen).
  const [hiddenWarned, setHiddenWarned] = useState<string | null>(null);

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const mixerOnly = categoryId === NEW_MIXERS || (!!mixersCat && categoryId === mixersCat.id);

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Give the drink a name so customers can find it.");
    if (!categoryId) return setError("Choose a category.");
    if (mixerOnly) return saveMixerOnly();
    const cat = data.categories.find((c) => c.id === categoryId);
    if (cat && !cat.visible && hiddenWarned !== categoryId) {
      setHiddenWarned(categoryId);
      return setError(`"${cat.name}" is a hidden category, so customers won't see this drink. Choose another category, or press Save again to save it anyway.`);
    }
    if (sizes.length === 0) return setError("Add at least one size with a price.");
    for (const s of sizes) {
      if (!s.label.trim() || parsePrice(s.price) === null) {
        return setError("Each size needs a name and a price, written like 6.20 (up to £1,000).");
      }
    }
    if (abv.trim() && (isNaN(Number(abv)) || Number(abv) < 0 || Number(abv) > 99.9)) {
      return setError("ABV should be a number like 4.5, or left empty.");
    }
    const mixerPence = parseMixerPrice(mixerPrice);
    if (asMixer && mixerPence === null) return setError("Write the mixer price like 1.20, or 0 if it's free.");
    setBusy(true);
    const now = await currentStock();
    const variants = sizes
      .map((s) => {
        const fresh = s.id ? now?.drink_variants.find((v) => v.id === s.id) : undefined;
        // A size removed elsewhere since this form opened stays removed.
        if (fresh?.archived_at && !s.touched) return null;
        return { id: s.id, label: s.label.trim(), price_pence: parsePrice(s.price)!, available: s.touched || !fresh ? s.available : fresh.available };
      })
      .filter((v) => v !== null);
    if (variants.length === 0) {
      setBusy(false);
      return setError("This drink's sizes were removed elsewhere. Close the form and open it again.");
    }
    const { data: newId, error: err } = await client.rpc("admin_save_drink", {
      p_drink: {
        id: drinkId,
        category_id: categoryId,
        name: name.trim(),
        description: description.trim(),
        abv: abv.trim() === "" ? null : Number(abv),
        contains_alcohol: alcohol,
        is_welsh: welsh,
        offers_no_ice: noIce,
        allergens,
        vat_rate: Number(vat),
        available: availableTouched || !now ? available : now.available,
        variants,
        modifier_group_ids: groupIds,
      },
    });
    if (err) {
      setBusy(false);
      return setError(friendlyError(err));
    }
    const id = (newId as string | null) ?? drinkId ?? null;
    if (id) setSavedId(id);
    const mixerErr = await saveMixer(id, mixerPence ?? 0);
    setBusy(false);
    if (mixerErr) return setError(`The drink was saved, but the mixer wasn't: ${friendlyError(mixerErr)} Press Save to try again.`);
    leave();
    await onSaved(name.trim(), false);
  }

  // A mixer-only drink: just a name, a mixer price and a stock switch. The
  // database still needs one size, so it gets a "Mixer" size nobody sees.
  async function saveMixerOnly() {
    if (!mixerGroup) return setError("There's no mixer list yet. Add one in Mixers & extras first.");
    const pence = parseMixerPrice(mixerPrice);
    if (pence === null) return setError("Write the mixer price like 1.20, or 0 if it's free.");
    setBusy(true);
    let catId = mixersCat?.id;
    if (!catId) {
      const sort = Math.max(0, ...data.categories.map((c) => c.sort_order)) + 10;
      const { data: made, error: catErr } = await client
        .from("categories")
        .insert({ name: MIXERS_CATEGORY, visible: false, sort_order: sort })
        .select("id")
        .single();
      if (catErr || !made) {
        setBusy(false);
        return setError(friendlyError(catErr));
      }
      catId = (made as { id: string }).id;
      setMadeMixersCat(catId);
    }
    const now = await currentStock();
    const { data: newId, error: err } = await client.rpc("admin_save_drink", {
      p_drink: {
        id: drinkId,
        category_id: catId,
        name: name.trim(),
        description: "",
        abv: null,
        contains_alcohol: false,
        is_welsh: false,
        offers_no_ice: false,
        allergens,
        vat_rate: Number(vat),
        available: availableTouched || !now ? available : now.available,
        variants: [{ id: sizes[0]?.id, label: "Mixer", price_pence: Math.max(pence, 1), available: true }],
        modifier_group_ids: [],
      },
    });
    if (err) {
      setBusy(false);
      return setError(friendlyError(err));
    }
    const id = (newId as string | null) ?? drinkId ?? null;
    if (id) setSavedId(id);
    const mixerErr = await saveMixer(id, pence, true);
    setBusy(false);
    if (mixerErr) return setError(`The mixer was saved, but isn't in the mixer list yet: ${friendlyError(mixerErr)}`);
    leave();
    await onSaved(name.trim(), false);
  }

  // Add, update or remove this drink's choice in the mixer list.
  async function saveMixer(drinkId: string | null, pence: number, offer = asMixer) {
    if (!mixerGroup || !drinkId) return null;
    const label = name.trim().slice(0, MIXER_LABEL_MAX);
    if (offer && myMixer) {
      // Keep the mixer's name in step with the drink unless someone renamed it on purpose.
      const newLabel = myMixer.label === drink?.name ? label : myMixer.label;
      if (pence === myMixer.price_pence && newLabel === myMixer.label) return null;
      return (await client.from("modifier_options").update({ price_pence: pence, label: newLabel }).eq("id", myMixer.id)).error;
    }
    const old = drink ? mixerGroup.modifier_options.find((o) => o.linked_drink_id === drink.id) : undefined;
    if (offer && old) {
      // Bring back its earlier mixer; re-saving the link picks up the drink's stock.
      return (
        await client
          .from("modifier_options")
          .update({ archived_at: null, price_pence: pence, label, linked_drink_id: drinkId })
          .eq("id", old.id)
      ).error;
    }
    if (offer) {
      const sort = Math.max(0, ...mixerGroup.modifier_options.map((o) => o.sort_order)) + 10;
      return (
        await client
          .from("modifier_options")
          .insert({ group_id: mixerGroup.id, label, price_pence: pence, sort_order: sort, linked_drink_id: drinkId })
      ).error;
    }
    if (myMixer)
      return (await client.from("modifier_options").update({ archived_at: new Date().toISOString() }).eq("id", myMixer.id)).error;
    return null;
  }

  async function archive() {
    if (!drink) return;
    setBusy(true);
    const { error: err } = await client.from("drinks").update({ archived_at: new Date().toISOString() }).eq("id", drink.id);
    setBusy(false);
    if (err) return setError(friendlyError(err));
    leave();
    await onSaved(drink.name, true);
  }

  return (
    <Drawer
      open
      onClose={requestClose}
      eyebrow={drink ? "Edit drink" : "New drink"}
      title={drink ? drink.name : "Add a new drink"}
      footer={
        confirmDiscard ? (
          <div className="flex w-full flex-wrap items-center gap-2.5">
            <b className="text-alert">Discard your changes?</b>
            <Button variant="danger" onClick={discard}>
              Discard changes
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
          </div>
        ) : (
        <>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : drink ? "Save changes" : "Save & publish"}
          </Button>
          <Button variant="ghost" onClick={requestClose}>
            Cancel
          </Button>
          <span className="flex-1" />
          {drink && (
            <Button variant="danger-ghost" onClick={() => setConfirmArchive(true)}>
              Archive drink
            </Button>
          )}
        </>
        )
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
      <div className={`grid gap-3 ${mixerOnly ? "grid-cols-1" : "grid-cols-2"}`}>
        <Field label="Category">
          <select
            id="edit-category"
            className={inputClass}
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              if (e.target.value === NEW_MIXERS || e.target.value === mixersCat?.id) setAsMixer(true);
              const mixer = mixerFor(e.target.value);
              if (drink) {
                if (mixer && !groupIds.includes(mixer)) setGroupIds([...groupIds, mixer]);
              } else {
                // A new drink: swap the lists ticked automatically for the old
                // category for the new category's, keeping any ticked by hand.
                const before = autoGroups(categoryId);
                const after = autoGroups(e.target.value);
                setGroupIds([...groupIds.filter((id) => !before.includes(id) && !after.includes(id)), ...after]);
              }
            }}
          >
            {data.categories
              .filter((c) => c.id !== mixersCat?.id)
              // Hidden categories last, so a new drink isn't put in one by mistake.
              .sort((a, b) => Number(!a.visible) - Number(!b.visible))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.visible ? " (hidden)" : ""}
                </option>
              ))}
            {mixerGroup && <option value={mixersCat?.id ?? NEW_MIXERS}>Mixers (mixer only, not on the menu)</option>}
          </select>
        </Field>
        {!mixerOnly && (
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
        )}
      </div>
      {mixerOnly && mixerGroup && (
        <div className="flex flex-col gap-3 rounded border border-gold bg-paper p-3.5">
          <p className="m-0 text-sm text-muted">
            Mixer only: customers won't see it on the menu as a drink. It's added to "{mixerGroup.name}" on every drink that offers it, like
            the spirits, and has a stock switch on the bar screen.
          </p>
          <Field label="Mixer price" hint="added to the spirit's price">
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
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-forest">In stock</span>
            <Switch on={available} label="Mixer in stock" onChange={(on) => (setAvailable(on), setAvailableTouched(true))} />
          </div>
        </div>
      )}
      {!mixerOnly && (
        <>
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
                  onChange={(on) => setSizes(sizes.map((x) => (x.key === s.key ? { ...x, available: on, touched: true } : x)))}
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
                      {g.modifier_options
                        .filter((o) => !o.archived_at)
                        .map((o) => o.label)
                        .slice(0, 3)
                        .join(", ")}
                      {g.modifier_options.length > 3 ? "…" : ""}
                    </span>
                  </span>
                </label>
              ))}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-forest"
                  checked={noIce}
                  onChange={() => setNoIce(!noIce)}
                />
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
                <input
                  type="checkbox"
                  className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-forest"
                  checked={asMixer}
                  onChange={() => setAsMixer(!asMixer)}
                />
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
        </>
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

      {!mixerOnly && (
        <>
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
                <Switch on={available} label="Drink available" onChange={(on) => (setAvailable(on), setAvailableTouched(true))} />
              </div>
            </div>
          </div>
        </>
      )}

      {error && <p className="m-0 text-sm font-semibold text-alert">{error}</p>}

      {confirmArchive && drink && (
        <div className="flex flex-col gap-2.5 rounded border border-alert bg-[#fbeae5] p-3 text-sm text-alert">
          <b>Archive {drink.name}?</b>
          It disappears from the customer menu. Past orders and reports keep it, and you can restore it from the Archived filter.
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
