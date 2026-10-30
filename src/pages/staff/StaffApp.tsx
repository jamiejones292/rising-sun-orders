import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import type { BarOrder } from "../../lib/types";
import { ToastProvider, useToast } from "../../components/ui";
import BarLogin from "./BarLogin";
import BarAdmin from "./BarAdmin";
import StockList from "./StockList";
import OrderDetail from "./OrderDetail";
import { FulfilledList, OrderCards, Summary } from "./Board";
import { useBarOrders } from "./useBarOrders";
import { chime, disableSound, enableSound, keepAwake, soundOn } from "./alerts";
import { drinkCount, hm, loadSeen, saveSeen } from "./barUtils";

export default function StaffApp() {
  useEffect(() => {
    document.title = "Bar orders · The Rising Sun Inn";
  }, []);
  return (
    <AuthProvider>
      <ToastProvider>
        <StaffGate />
      </ToastProvider>
    </AuthProvider>
  );
}

function StaffGate() {
  const { loading, session, profile, signOut } = useAuth();
  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-forest-night text-gold-soft">Loading…</div>;
  if (!session) return <BarLogin />;
  if (!profile || !profile.active) {
    return (
      <main className="gutter flex min-h-dvh items-center justify-center bg-forest-night">
        <div className="flex max-w-md flex-col gap-3 rounded-xl bg-ivory p-6 text-center">
          <h1 className="text-3xl font-semibold">This login can't open the bar screen</h1>
          <p className="text-muted">It isn't set up as a staff account. Ask the owner to check it in Supabase.</p>
          <button onClick={() => void signOut()} className="min-h-12 rounded bg-forest font-bold text-ivory">
            Sign out
          </button>
        </div>
      </main>
    );
  }
  return <BarScreen />;
}

function BarScreen() {
  const toast = useToast();
  const [tab, setTab] = useState<"open" | "done">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  const [alert, setAlert] = useState<BarOrder | null>(null);
  const [sound, setSound] = useState(soundOn());
  const [admin, setAdmin] = useState(false);
  const [stock, setStock] = useState(false);
  const [query, setQuery] = useState("");
  const [clock, setClock] = useState(() => hm(new Date().toISOString()));

  const onNewOrders = useCallback((fresh: BarOrder[]) => {
    setAlert(fresh[fresh.length - 1]!);
    chime();
  }, []);
  const { open, done, settings, loaded, connection, refresh, setOpen } = useBarOrders(onNewOrders);

  useEffect(() => {
    const id = window.setInterval(() => setClock(hm(new Date().toISOString())), 10_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!alert) return;
    const id = window.setTimeout(() => setAlert(null), 8000);
    return () => window.clearTimeout(id);
  }, [alert]);

  const markSeen = (id: string) =>
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      saveSeen(next);
      return next;
    });

  const openOrder = (id: string) => {
    markSeen(id);
    setAlert(null);
    setOpenId(id);
    window.scrollTo(0, 0);
  };

  // Find an order by number or table.
  const q = query.trim().replace(/^#/, "").toLowerCase();
  const matches = (o: BarOrder) => !q || String(o.order_number).includes(q) || o.table_label.toLowerCase() === q;
  const shownOpen = useMemo(() => open.filter(matches), [open, q]);
  const shownDone = useMemo(() => done.filter(matches), [done, q]);

  const current = openId ? open.find((o) => o.id === openId) : undefined;

  // Tick a drink straight away on screen, then save; undo on failure.
  async function tick(itemId: string, ticked: boolean) {
    const patch = (value: boolean) =>
      setOpen((orders) =>
        orders.map((o) => ({ ...o, order_items: o.order_items.map((i) => (i.id === itemId ? { ...i, ticked: value } : i)) })),
      );
    patch(ticked);
    const { error } = await supabase.rpc("staff_set_item_ticked", { p_item_id: itemId, p_ticked: ticked });
    if (error) {
      patch(!ticked);
      toast(friendlyError(error), { error: true });
      void refresh();
      return false;
    }
    return true;
  }

  async function reopen(o: BarOrder, quiet = false) {
    const { error } = await supabase.rpc("staff_reopen_order", { p_order_id: o.id });
    if (error) return toast(friendlyError(error), { error: true });
    await refresh();
    if (!quiet) {
      setTab("open");
      toast(`Order #${o.order_number} reopened`);
    }
  }

  function fulfilled(o: BarOrder) {
    setOpenId(null);
    setOpen((orders) => orders.filter((x) => x.id !== o.id));
    void refresh();
    toast(`Table ${o.table_label} fulfilled. The customer sees "Delivered".`, { undo: () => void reopen(o, true) });
  }

  if (current) {
    return (
      <>
        <OrderDetail order={current} onBack={() => setOpenId(null)} onTick={tick} onFulfilled={fulfilled} onChanged={() => void refresh()} />
        {alert && alert.id !== current.id && <NewOrderAlert order={alert} onOpen={() => openOrder(alert.id)} />}
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-forest-night text-ivory">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-8 border-b border-gold-soft/20 bg-forest">
        <div className="gutter flex flex-wrap items-center gap-x-4.5 gap-y-2.5 py-3">
          <div className="leading-none">
            <span className="block font-display text-2xl font-bold">The Rising Sun Inn</span>
            <span className="mt-1 block text-[0.7rem] font-semibold tracking-[0.24em] text-gold-soft uppercase">Bar orders</span>
          </div>
          <span className="text-2xl font-extrabold tabular-nums">{clock}</span>
          <Connection state={connection} />
          <span className="flex-1" />
          <button
            aria-pressed={sound}
            onClick={async () => {
              if (sound) {
                disableSound();
                setSound(false);
              } else {
                const ok = await enableSound();
                setSound(ok);
                if (!ok) toast("This browser blocked sound. Visual alerts still work.", { error: true });
              }
              void keepAwake();
            }}
            className={`min-h-11.5 rounded-md border-[1.5px] px-4 text-[0.92rem] font-bold ${
              sound ? "border-gold-soft bg-gold-soft text-forest" : "border-gold-soft/45 text-ivory"
            }`}
          >
            {sound ? "Sound on" : "Enable sound"}
          </button>
          {settings.staffStock && (
            <button onClick={() => setStock(true)} className="min-h-11.5 rounded-md border-[1.5px] border-gold-soft/45 px-4 text-[0.92rem] font-bold">
              Stock
            </button>
          )}
          <button onClick={() => setAdmin(true)} className="inline-flex min-h-11.5 items-center gap-2 rounded-md border-[1.5px] border-gold-soft/45 px-4 text-[0.92rem] font-bold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4.5 w-4.5" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Admin
          </button>
        </div>
        <div className="gutter flex flex-wrap items-center gap-2 pb-3" role="tablist">
          <TabButton active={tab === "open"} onClick={() => setTab("open")} label="Waiting" count={open.length} />
          <TabButton active={tab === "done"} onClick={() => setTab("done")} label="Fulfilled today" count={done.length} />
          <span className="flex-1" />
          <input
            id="find-order"
            type="search"
            inputMode="numeric"
            placeholder="Find order no. or table"
            aria-label="Find an order by number or table"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-56 max-w-full rounded-full border-[1.5px] border-gold-soft/30 bg-forest-night px-4 text-ivory placeholder:text-gold-soft/60"
          />
        </div>
      </header>

      {settings.paused && (
        <div className="gutter flex flex-wrap items-center gap-x-3.5 gap-y-2 bg-bar-red py-3 font-bold text-white">
          ONLINE ORDERING PAUSED <span className="font-medium opacity-90">Customers can browse but can't pay. Finish the orders below, then resume.</span>
        </div>
      )}
      {connection === "offline" && (
        <div className="gutter flex flex-wrap items-center gap-x-3.5 gap-y-2 bg-[#5a1712] py-3 font-bold text-[#ffd2cb]">
          CONNECTION LOST. RECONNECTING…
          <span className="font-medium opacity-90">
            No orders are lost. New paid orders appear as soon as the iPad is back online. If this lasts more than 2 minutes, use the paper backup sheet.
          </span>
        </div>
      )}

      {!loaded ? (
        <p className="gutter py-16 text-center text-gold-soft">Loading orders…</p>
      ) : tab === "open" ? (
        <>
          <Summary orders={shownOpen} />
          {q && shownOpen.length === 0 && open.length > 0 ? (
            <p className="gutter py-10 text-center text-gold-soft">No waiting order matches "{query}". Check the Fulfilled today tab.</p>
          ) : (
            <OrderCards orders={shownOpen} settings={settings} seen={seen} onOpen={openOrder} />
          )}
        </>
      ) : (
        <FulfilledList orders={shownDone} onReopen={(o) => void reopen(o)} />
      )}

      {alert && <NewOrderAlert order={alert} onOpen={() => openOrder(alert.id)} />}
      {stock && settings.staffStock && <StockPanel onClose={() => setStock(false)} />}
      {admin && (
        <BarAdmin
          paused={settings.paused}
          problemOrders={open.filter((o) => o.problem_reason)}
          onClose={() => setAdmin(false)}
          onChanged={() => void refresh()}
        />
      )}
    </div>
  );
}

// Out-of-stock switches for any bar staff, shown only while the owner allows it.
function StockPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-35 flex items-center justify-center bg-[rgba(5,14,10,.72)] px-4 py-[calc(1rem+env(safe-area-inset-top,0px))]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bar-stock-title"
        className="flex max-h-full w-full max-w-[560px] flex-col gap-1.5 overflow-y-auto rounded-xl bg-ivory p-5.5 text-ink"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="bar-stock-title" className="text-3xl font-semibold">
            Out of stock
          </h2>
          <button onClick={onClose} aria-label="Close" className="h-11 w-11 shrink-0 rounded-full border-2 border-line text-muted">
            ✕
          </button>
        </div>
        <small className="text-muted">Switch a drink off and customers can't order it. Switch it back on when it's restocked.</small>
        <StockList client={supabase} />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border-[1.5px] px-4.5 font-bold ${active ? "border-ivory bg-ivory text-forest" : "border-gold-soft/30 text-gold-soft"}`}
    >
      {label} <b className="ml-1 text-lg tabular-nums">{count}</b>
    </button>
  );
}

function Connection({ state }: { state: "live" | "checking" | "offline" }) {
  const text = state === "live" ? "Live" : state === "checking" ? "Connected" : "Offline";
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-bold ${state === "offline" ? "text-[#ffb4a9]" : "text-[#9fd9b4]"}`} role="status">
      <i className={`h-2.5 w-2.5 rounded-full ${state === "offline" ? "bg-[#ff6b57] shadow-[0_0_0_4px_rgba(255,107,87,.25)]" : "bg-[#4cc27a] shadow-[0_0_0_4px_rgba(76,194,122,.2)]"}`} />
      {text}
    </span>
  );
}

function NewOrderAlert({ order, onOpen }: { order: BarOrder; onOpen: () => void }) {
  return (
    <button
      role="alert"
      onClick={onOpen}
      className="fixed top-[calc(env(safe-area-inset-top,0px)+0.9rem)] left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-[10px] bg-gold-bright px-5.5 py-4 text-left text-white shadow-[0_12px_34px_rgba(0,0,0,.45)]"
    >
      <span>
        <b className="text-2xl font-extrabold tracking-wide">NEW ORDER · TABLE {order.table_label}</b>
        <br />
        <span className="text-[0.95rem] tabular-nums">
          #{order.order_number} · {drinkCount(order)} drinks · {hm(order.paid_at)} · tap to open
        </span>
      </span>
    </button>
  );
}
