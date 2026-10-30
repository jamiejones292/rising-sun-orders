import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { useMenuData } from "../../lib/adminData";
import { friendlyError } from "../../lib/errors";
import type { Category } from "../../lib/types";
import { Button, Panel, Switch, inputClass, useToast } from "../../components/ui";
import { PageHeader } from "./AdminApp";
import { isMixersCategory } from "./DrinkEditor";

export default function Categories() {
  const { data, error, reload, setData } = useMenuData();
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const cats = data?.categories ?? [];

  const setCats = (next: Category[]) => setData((prev) => (prev ? { ...prev, categories: next } : prev));

  async function move(index: number, by: -1 | 1) {
    const next = [...cats];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    setCats(next);
    const { error: err } = await supabase.rpc("admin_reorder_categories", { p_ids: next.map((c) => c.id) });
    if (err) {
      toast(friendlyError(err), { error: true });
      await reload();
    }
  }

  async function rename(c: Category, name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === c.name) return;
    const { error: err } = await supabase.from("categories").update({ name: trimmed }).eq("id", c.id);
    if (err) {
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
    const sort = Math.max(0, ...cats.map((c) => c.sort_order)) + 10;
    const { error: err } = await supabase.from("categories").insert({ name, sort_order: sort, visible: !isMixersCategory(name) });
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
          {cats.map((c, i) => (
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
                  disabled={i === cats.length - 1}
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
                  readOnly={isMixersCategory(c.name)}
                  maxLength={60}
                  onBlur={(e) => void rename(c, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className={`${inputClass} max-w-[340px]`}
                />
                <div className="mt-1 text-xs text-muted">
                  {data?.drinks.filter((d) => d.category_id === c.id && !d.archived_at).length ?? 0} drinks
                </div>
              </div>
              {isMixersCategory(c.name) ? (
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
