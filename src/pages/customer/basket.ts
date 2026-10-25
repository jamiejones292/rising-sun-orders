import { useEffect, useState } from "react";
import { lineKey, MAX_QUANTITY, type BasketLine } from "../../lib/pricing";

// The basket lives on the customer's phone so a refresh doesn't lose it.
// Prices are never stored here: they're always worked out from the current menu.

const KEY = "rs-basket-v1";
const TABLE_KEY = "rs-table-v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private browsing: the basket still works until the page is closed
  }
}

export function useBasket() {
  const [lines, setLines] = useState<BasketLine[]>(() => {
    const saved = read<BasketLine[]>(KEY, []);
    return Array.isArray(saved) ? saved.filter((l) => l && typeof l.drinkId === "string") : [];
  });
  const [table, setTable] = useState<string | null>(() => read<string | null>(TABLE_KEY, null));

  useEffect(() => write(KEY, lines), [lines]);
  useEffect(() => write(TABLE_KEY, table), [table]);

  const add = (line: BasketLine) =>
    setLines((all) => {
      const k = lineKey(line);
      const same = all.find((l) => lineKey(l) === k);
      if (same) return all.map((l) => (l === same ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + line.quantity) } : l));
      return [...all, line];
    });
  const replace = (index: number, line: BasketLine) =>
    setLines((all) => {
      const rest = all.filter((_, i) => i !== index);
      const k = lineKey(line);
      const same = rest.find((l) => lineKey(l) === k);
      if (same) return rest.map((l) => (l === same ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + line.quantity) } : l));
      const copy = [...rest];
      copy.splice(index, 0, line);
      return copy;
    });
  const setQuantity = (index: number, quantity: number) =>
    setLines((all) => (quantity < 1 ? all.filter((_, i) => i !== index) : all.map((l, i) => (i === index ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) } : l))));
  const remove = (index: number) => setLines((all) => all.filter((_, i) => i !== index));
  const clear = () => setLines([]);

  return { lines, add, replace, setQuantity, remove, clear, table, setTable };
}
