import { useRef, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { useMenuData } from "../../lib/adminData";
import { friendlyError } from "../../lib/errors";
import type { Category } from "../../lib/types";
import { Button, Panel, Switch, inputClass, useToast } from "../../components/ui";
import { PageHeader } from "./AdminApp";
import { isMixerOnlyCategory, isMixersCategory } from "./DrinkEditor";

export default function Categories() {
  const { data, error, reload, setData } = useMenuData();
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const cats = data?.categories ?? [];
  // Hidden categories with no drinks (left from an old menu) are tucked away.
  const [showOld, setShowOld] = useState(false);
  const liveCount = (id: string) => data?.drinks.filter((d) => d.category_id === id && !d.archived_at).length ?? 0;
  const isOld = (c: Category) => !c.visible && !isMixerOnlyCategory(c) && liveCount(c.id) === 0;
  const old = cats.filter(isOld);
  const shown = showOld ? cats : cats.filter((c) => !isOld(c));

  const setCats = (next: Category[]) => setData((prev) => (prev ? { ...prev, categories: next } : prev));

  // Saves run one after another, always with the latest order, so quick taps
  // can't arrive out of order and leave the menu in an older order.
  const wanted = useRef<string[] | null>(null);
  const saving = useRef(false);
  async function saveOrder() {
    if (saving.current) return;
    saving.current = true;
    while (wanted.current) {
      const ids = wanted.current;
      wanted.current = null;
      const { error: err } = await supabase.rpc("admin_reorder_categories", { p_ids: ids });
      if (err) {
        wanted.current = null;
        toast(friendlyError(err), { error: true });
        await reload();
      }
    }
    saving.current = false;
  }

  function move(index: number, by: -1 | 1) {
    const list = [...shown];
    const [item] = list.splice(index, 1);
    list.splice(index + by, 0, item!);
    const next = showOld ? list : [...list, ...old];
    setCats(next);
    wanted.current = next.map((c) => c.id);
    void saveOrder();
  }

  // "Mixers" is kept for the hidden mixer-only category, which the drink form
  // creates when it's first needed.
  const RESERVED = "“Mixers” is kept for mixer-only drinks. Choose another name.";

  async function rename(c: Category, input: HTMLInputElement) {
    const trimmed = input.value.trim();
    if (!trimmed || trimmed === c.name) {
      input.value = c.name;
      return;
    }
    if (isMixersCategory(trimmed)) {
      input.value = c.name;
      return toast(RESERVED, { error: true });
    }
    const { error: err } = await supabase.from("categories").update({ name: trimmed }).eq("id", c.id);
    if (err) {
      input.value = c.name;
      toast(friendlyError(err), { error: true });
      return reload();
    }
    setCats(cats.map((x) => (x.id === c.id ? { ...x, name: trimmed } : x)));
    toast("Category renamed");
  }

  async function setVisible(c: Category, visible: boolean) {
    setCats(cats.map((x) => (x.id === c.id ? { ...x, visible } : x)));
    const { error: err } = await supabase.from("categories").update({ visible }).eq("id", c.id);
    if (err) {
      toast(friendlyError(err), { error: true });
      return reload();
    }
    toast(`${c.name} ${visible ? "shown on" : "hidden from"} the menu`);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (isMixersCategory(name)) return toast(RESERVED, { error: true });
    const sort = Math.max(0, ...cats.map((c) => c.sort_order)) + 10;
    const { error: err } = await supabase.from("categories").insert({ name, sort_order: sort });
    if (err) return toast(friendlyError(err), { error: true });
    setNewName("");
    await reload();
    toast(`${name} added to the end of the menu`);
  }

  return (
    <>
      <PageHeader
        title="Categories"
        intro="The order here is the order customers see. Hidden categories, and every drink in them, disappear from the menu but stay saved."
      />
      {error && <p className="text-alert">Couldn't load categories: {error}</p>}
      <Panel>
        <ul className="flex flex-col">
          {shown.map((c, i) => (
            <li key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2.5">
              <span className="flex flex-col gap-0.5">
                <button
                  aria-label={`Move ${c.name} up`}
                  disabled={i === 0}
                  onClick={() => void move(i, -1)}
                  className="h-6 w-8 rounded-sm border border-[#d6c6a8] bg-paper text-xs text-forest disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  aria-label={`Move ${c.name} down`}
                  disabled={i === shown.length - 1}
                  onClick={() => void move(i, 1)}
                  className="h-6 w-8 rounded-sm border border-[#d6c6a8] bg-paper text-xs text-forest disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
              <div className="min-w-0">
                <input
                  id={`cat-name-${c.id}`}
                  aria-label="Category name"
                  defaultValue={c.name}
                  // The drink form finds the mixer-only category by this name.
                  readOnly={isMixerOnlyCategory(c)}
                  maxLength={60}
                  onBlur={(e) => void rename(c, e.target)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className={`${inputClass} max-w-[340px]`}
                />
                <div className="mt-1 text-xs text-muted">
                  {liveCount(c.id)} drink{liveCount(c.id) === 1 ? "" : "s"}
                </div>
              </div>
              {isMixerOnlyCategory(c) ? (
                <span className="max-w-[180px] text-right text-xs text-muted">Mixer-only drinks. Never shown on the menu.</span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">{c.visible ? "Shown" : "Hidden"}</span>
                  <Switch on={c.visible} showText={false} label={`Show ${c.name}`} onChange={(on) => void setVisible(c, on)} />
                </span>
              )}
            </li>
          ))}
        </ul>
        {old.length > 0 && (
          <button onClick={() => setShowOld(!showOld)} className="self-start text-sm font-semibold text-forest underline underline-offset-2">
            {showOld ? "Hide" : "Show"} old empty categories ({old.length})
          </button>
        )}
        <form onSubmit={add} className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <input
            id="new-category"
            aria-label="New category name"
            placeholder="New category, e.g. Gin of the Month"
            value={newName}
            maxLength={60}
            onChange={(e) => setNewName(e.target.value)}
            className={`${inputClass} max-w-[360px] flex-[1_1_220px]`}
          />
          <Button disabled={!newName.trim()}>+ Add category</Button>
        </form>
      </Panel>
    </>
  );
}
