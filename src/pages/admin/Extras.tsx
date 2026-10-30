import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import { formatPence } from "../../lib/money";
import { Button, Panel, Pill, Switch, inputClass, useToast } from "../../components/ui";
import { PageHeader } from "./AdminApp";

// Mixers & extras: the option lists customers pick from on a drink ("Add a
// mixer", "How would you like it?", "Milk"). Each option can follow a drink's
// stock (the Coca-Cola mixer goes off with the Coca-Cola drink; the database
// does this, migration 009) or have its own stock switch. Options are removed
// by archiving, like drinks, so past orders keep them.

type Option = {
  id: string;
  group_id: string;
  label: string;
  price_pence: number;
  available: boolean;
  sort_order: number;
  archived_at: string | null;
  linked_drink_id: string | null;
};
type Group = { id: string; name: string; required: boolean; sort_order: number };
type DrinkRef = { id: string; name: string; available: boolean; category: string; categorySort: number };

// Extra charge typed as pounds ("1.20", "£1", "0"), to whole pence. Free is allowed.
function parseExtraPrice(text: string): number | null {
  const t = text.replace(/[£,\s]/g, "");
  if (t === "") return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

export default function Extras() {
  const toast = useToast();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [drinks, setDrinks] = useState<DrinkRef[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState("");

  const reload = useCallback(async () => {
    const [g, o, d, u] = await Promise.all([
      supabase.from("modifier_groups").select("id, name, required, sort_order").order("sort_order"),
      supabase.from("modifier_options").select("id, group_id, label, price_pence, available, sort_order, archived_at, linked_drink_id").order("sort_order"),
      supabase.from("drinks").select("id, name, available, sort_order, categories(name, sort_order)").is("archived_at", null).order("sort_order"),
      supabase.from("drink_modifier_groups").select("group_id, drinks(archived_at)"),
    ]);
    const err = g.error || o.error || d.error || u.error;
    if (err) {
      // Before database update 009 there's no link column yet.
      return setError(/linked_drink_id/.test(err.message) ? "Run database update 009 (linked mixers) in Supabase first, then refresh this page." : err.message);
    }
    type D = { id: string; name: string; available: boolean; sort_order: number; categories: { name: string; sort_order: number } | null };
    setDrinks(
      (d.data as unknown as D[])
        .map((x) => ({ id: x.id, name: x.name, available: x.available, category: x.categories?.name ?? "", categorySort: x.categories?.sort_order ?? 0 }))
        .sort((a, b) => a.categorySort - b.categorySort || a.name.localeCompare(b.name)),
    );
    const counts: Record<string, number> = {};
    for (const row of u.data as unknown as { group_id: string; drinks: { archived_at: string | null } | null }[]) {
      if (row.drinks && !row.drinks.archived_at) counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
    }
    setUsage(counts);
    setGroups(g.data as Group[]);
    setOptions(o.data as Option[]);
    setError(null);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const drinkById = useMemo(() => new Map(drinks.map((d) => [d.id, d])), [drinks]);

  // Save one change straight away; reload if it fails so the screen is right.
  async function saveOption(o: Option, patch: Partial<Option>, message?: string) {
    setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, ...patch } : x)));
    const { error: err } = await supabase.from("modifier_options").update(patch).eq("id", o.id);
    if (err) {
      toast(friendlyError(err), { error: true });
      return reload();
    }
    // Linking to a drink copies that drink's stock in the database.
    if ("linked_drink_id" in patch) await reload();
    if (message) toast(message);
  }

  async function saveGroup(g: Group, patch: Partial<Group>, message: string) {
    setGroups((all) => all && all.map((x) => (x.id === g.id ? { ...x, ...patch } : x)));
    const { error: err } = await supabase.from("modifier_groups").update(patch).eq("id", g.id);
    if (err) {
      toast(friendlyError(err), { error: true });
      return reload();
    }
    toast(message);
  }

  async function move(list: Option[], index: number, by: -1 | 1) {
    const a = list[index]!;
    const b = list[index + by]!;
    // Swap positions; if two share a number, spread them apart first.
    const [sa, sb] = a.sort_order === b.sort_order ? [index * 10 + by * 10, index * 10] : [b.sort_order, a.sort_order];
    setOptions((all) => all.map((x) => (x.id === a.id ? { ...x, sort_order: sa } : x.id === b.id ? { ...x, sort_order: sb } : x)));
    const [r1, r2] = await Promise.all([
      supabase.from("modifier_options").update({ sort_order: sa }).eq("id", a.id),
      supabase.from("modifier_options").update({ sort_order: sb }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) {
      toast(friendlyError(r1.error || r2.error), { error: true });
      await reload();
    }
  }

  async function addGroup(e: FormEvent) {
    e.preventDefault();
    const name = newGroup.trim();
    if (!name) return;
    const sort = Math.max(0, ...(groups ?? []).map((g) => g.sort_order)) + 10;
    const { error: err } = await supabase.from("modifier_groups").insert({ name, required: false, sort_order: sort });
    if (err) return toast(friendlyError(err), { error: true });
    setNewGroup("");
    await reload();
    toast(`${name} added. Add its choices, then tick it on the drinks that offer it.`);
  }

  return (
    <>
      <PageHeader
        title="Mixers & extras"
        intro="The choices customers make on a drink, like a mixer or how they'd like it served. A mixer that's also a drink on the menu can follow that drink, so when the drink is out of stock the mixer is too."
      />
      {error && <p className="text-alert">{error}</p>}
      {groups === null && !error && <p className="text-muted">Loading…</p>}

      {groups?.map((g) => (
        <GroupPanel
          key={g.id}
          group={g}
          options={options.filter((o) => o.group_id === g.id)}
          drinks={drinks}
          drinkById={drinkById}
          usedOn={usage[g.id] ?? 0}
          onSaveGroup={saveGroup}
          onSaveOption={saveOption}
          onMove={move}
          onAdded={reload}
        />
      ))}

      {groups && (
        <Panel title="Add a new list">
          <p className="m-0 text-sm text-muted">For example "Syrups" for coffees. After adding it, tick it on the drinks that offer it (Drinks → Edit).</p>
          <form onSubmit={addGroup} className="flex flex-wrap items-center gap-2.5">
            <input
              id="new-group"
              aria-label="New list name"
              placeholder="List name, e.g. Syrups"
              value={newGroup}
              maxLength={60}
              onChange={(e) => setNewGroup(e.target.value)}
              className={`${inputClass} max-w-[360px] flex-[1_1_220px]`}
            />
            <Button disabled={!newGroup.trim()}>+ Add list</Button>
          </form>
        </Panel>
      )}
    </>
  );
}

function GroupPanel({
  group,
  options,
  drinks,
  drinkById,
  usedOn,
  onSaveGroup,
  onSaveOption,
  onMove,
  onAdded,
}: {
  group: Group;
  options: Option[];
  drinks: DrinkRef[];
  drinkById: Map<string, DrinkRef>;
  usedOn: number;
  onSaveGroup: (g: Group, patch: Partial<Group>, message: string) => Promise<void>;
  onSaveOption: (o: Option, patch: Partial<Option>, message?: string) => Promise<void>;
  onMove: (list: Option[], index: number, by: -1 | 1) => Promise<void>;
  onAdded: () => Promise<void>;
}) {
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const current = options.filter((o) => !o.archived_at).sort((a, b) => a.sort_order - b.sort_order);
  const removed = options.filter((o) => o.archived_at);

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = label.trim();
    const pence = parseExtraPrice(price);
    if (!name) return setAddError("Give the choice a name, e.g. Lemonade.");
    if (pence === null) return setAddError("Write the extra charge like 1.20, or leave it empty if it's free.");
    setAddError(null);
    const sort = Math.max(0, ...options.map((o) => o.sort_order)) + 10;
    const { error } = await supabase
      .from("modifier_options")
      .insert({ group_id: group.id, label: name, price_pence: pence, sort_order: sort, linked_drink_id: link || null });
    if (error) return toast(friendlyError(error), { error: true });
    setLabel("");
    setPrice("");
    setLink("");
    await onAdded();
    toast(`${name} added to ${group.name}`);
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-[1_1_260px]">
          <input
            id={`group-name-${group.id}`}
            aria-label="List name"
            defaultValue={group.name}
            maxLength={60}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== group.name) void onSaveGroup(group, { name }, "List renamed");
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={`${inputClass} max-w-[340px] font-display text-2xl font-semibold`}
          />
          <div className="mt-1 text-xs text-muted">
            Offered on {usedOn} drink{usedOn === 1 ? "" : "s"} · tick it on a drink in Drinks → Edit
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Customers must choose one
          <Switch
            on={group.required}
            showText={false}
            label={`${group.name}: customers must choose one`}
            onChange={(required) =>
              void onSaveGroup(group, { required }, required ? `Customers must now choose from ${group.name}` : `${group.name} is now optional`)
            }
          />
        </label>
      </div>

      <ul className="flex flex-col">
        {current.map((o, i) => {
          const linked = o.linked_drink_id ? drinkById.get(o.linked_drink_id) : undefined;
          return (
            <li
              key={o.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-line py-3 sm:grid-cols-[auto_minmax(0,1fr)_96px_minmax(0,220px)_96px_auto] sm:items-center"
            >
              <span className="row-span-2 flex flex-col gap-0.5 sm:row-span-1">
                <button
                  aria-label={`Move ${o.label} up`}
                  disabled={i === 0}
                  onClick={() => void onMove(current, i, -1)}
                  className="h-6 w-8 rounded-sm border border-[#d6c6a8] bg-paper text-xs text-forest disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  aria-label={`Move ${o.label} down`}
                  disabled={i === current.length - 1}
                  onClick={() => void onMove(current, i, 1)}
                  className="h-6 w-8 rounded-sm border border-[#d6c6a8] bg-paper text-xs text-forest disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
              <input
                id={`opt-label-${o.id}`}
                aria-label="Choice name"
                defaultValue={o.label}
                maxLength={60}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (!name) e.target.value = o.label;
                  else if (name !== o.label) void onSaveOption(o, { label: name }, "Saved");
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className={inputClass}
              />
              <span className="relative col-start-2 sm:col-start-auto">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">+£</span>
                <input
                  id={`opt-price-${o.id}`}
                  aria-label={`Extra charge for ${o.label}`}
                  inputMode="decimal"
                  defaultValue={(o.price_pence / 100).toFixed(2)}
                  onBlur={(e) => {
                    const pence = parseExtraPrice(e.target.value);
                    if (pence === null) {
                      toast("Write the extra charge like 1.20, or 0 if it's free.", { error: true });
                      e.target.value = (o.price_pence / 100).toFixed(2);
                    } else {
                      e.target.value = (pence / 100).toFixed(2);
                      if (pence !== o.price_pence) void onSaveOption(o, { price_pence: pence }, `${o.label} now ${pence ? `+${formatPence(pence)}` : "free"}`);
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className={`${inputClass} pl-8 tabular-nums`}
                />
              </span>
              <select
                id={`opt-link-${o.id}`}
                aria-label={`Stock for ${o.label}`}
                value={o.linked_drink_id ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  const d = id ? drinkById.get(id) : undefined;
                  void onSaveOption(o, { linked_drink_id: id }, d ? `${o.label} now follows ${d.name}'s stock` : `${o.label} now has its own stock switch`);
                }}
                className={`${inputClass} col-start-2 sm:col-start-auto`}
              >
                <option value="">Own stock switch</option>
                <DrinkOptions drinks={drinks} prefix="Follows " />
              </select>
              <span className="col-start-2 flex items-center gap-2 sm:col-start-auto">
                {linked ? (
                  <Pill tone={o.available ? "ok" : "bad"}>{o.available ? "In stock" : "Out of stock"}</Pill>
                ) : /^no\b/i.test(o.label) ? (
                  <span className="text-xs text-muted">Always on</span>
                ) : (
                  <Switch
                    on={o.available}
                    showText={false}
                    label={`${o.label} in stock`}
                    onChange={(available) => void onSaveOption(o, { available }, `${o.label} ${available ? "back in stock" : "out of stock"}`)}
                  />
                )}
              </span>
              <span className="col-start-2 sm:col-start-auto">
                <Button
                  variant="danger-ghost"
                  small
                  onClick={() => void onSaveOption(o, { archived_at: new Date().toISOString() }, `${o.label} removed. Customers can't choose it any more.`)}
                >
                  Remove
                </Button>
              </span>
            </li>
          );
        })}
        {current.length === 0 && <li className="py-3 text-sm text-muted">No choices yet. Add the first one below.</li>}
      </ul>

      <form onSubmit={add} className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,240px)_auto]">
          <input
            id={`new-opt-${group.id}`}
            aria-label="New choice name"
            placeholder="New choice, e.g. Lemonade"
            value={label}
            maxLength={60}
            onChange={(e) => {
              setLabel(e.target.value);
              // Suggest following the drink with the same name.
              const match = drinks.find((d) => d.name.trim().toLowerCase() === e.target.value.trim().toLowerCase());
              if (match) setLink(match.id);
            }}
            className={inputClass}
          />
          <span className="relative">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">+£</span>
            <input
              id={`new-opt-price-${group.id}`}
              aria-label="Extra charge"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${inputClass} pl-8 tabular-nums`}
            />
          </span>
          <select id={`new-opt-link-${group.id}`} aria-label="Stock for the new choice" value={link} onChange={(e) => setLink(e.target.value)} className={inputClass}>
            <option value="">Own stock switch</option>
            <DrinkOptions drinks={drinks} prefix="Follows " />
          </select>
          <Button disabled={!label.trim()}>+ Add</Button>
        </div>
        {addError && <p className="m-0 text-sm text-alert">{addError}</p>}
      </form>

      {removed.length > 0 && (
        <div className="text-sm">
          <button onClick={() => setShowRemoved(!showRemoved)} className="font-semibold text-forest underline underline-offset-2">
            {showRemoved ? "Hide" : "Show"} removed choices ({removed.length})
          </button>
          {showRemoved && (
            <ul className="mt-2 flex flex-col">
              {removed.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 border-t border-line py-2">
                  <span className="text-muted">{o.label}</span>
                  <Button variant="ghost" small onClick={() =>
                      // Re-saving the link makes a linked choice pick up its drink's stock again.
                      void onSaveOption(o, { archived_at: null, linked_drink_id: o.linked_drink_id }, `${o.label} restored`)
                    }>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

// Drinks grouped by category, for the "follows" dropdowns.
function DrinkOptions({ drinks, prefix }: { drinks: DrinkRef[]; prefix: string }) {
  const cats = [...new Set(drinks.map((d) => d.category))];
  return (
    <>
      {cats.map((c) => (
        <optgroup key={c} label={c}>
          {drinks
            .filter((d) => d.category === c)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {prefix}
                {d.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}
