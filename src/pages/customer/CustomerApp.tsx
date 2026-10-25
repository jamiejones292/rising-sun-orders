import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatPence } from "../../lib/money";
import { orderingWindow } from "../../lib/hours";
import { priceLine } from "../../lib/pricing";
import { useBasket } from "./basket";
import { useCustomerMenu, type MenuDrink } from "./useCustomerMenu";
import MenuScreen from "./MenuScreen";
import ProductSheet from "./ProductSheet";
import BasketScreen from "./BasketScreen";
import TableScreen, { type CheckoutDetails } from "./TableScreen";
import ConfirmScreen from "./ConfirmScreen";

type Screen = "welcome" | "menu" | "basket" | "table" | "confirm";

export default function CustomerApp({ preview }: { preview: boolean }) {
  const { menu, error, reload } = useCustomerMenu();
  const basket = useBasket();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [category, setCategory] = useState("all");
  const [sheet, setSheet] = useState<{ drink: MenuDrink; index: number | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [details, setDetails] = useState<CheckoutDetails>({ table: basket.table ?? "", ageConfirmed: false, email: "" });

  useEffect(() => {
    document.title = "The Rising Sun Inn · Drinks to your table";
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
    if (s === "basket" || s === "table") void reload(); // re-check prices and stock
  };

  const priced = useMemo(() => (menu ? basket.lines.map((l) => priceLine({ drinks: menu.drinks }, l)) : []), [menu, basket.lines]);
  const total = priced.reduce((s, p) => s + (p.ok ? p.totalPence : 0), 0);
  const count = basket.lines.reduce((s, l) => s + l.quantity, 0);
  const problems = priced.some((p) => !p.ok);
  const needsAge = priced.some((p) => p.ok && p.containsAlcohol);

  if (error && !menu) {
    return (
      <main className="gutter mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-3xl">We can't load the menu</h1>
        <p className="text-muted">Check your phone's signal or Wi-Fi and try again, or order at the bar.</p>
        <button onClick={() => void reload()} className="min-h-12 rounded bg-forest px-5 font-semibold text-ivory">
          Try again
        </button>
      </main>
    );
  }
  if (!menu) return <main className="gutter py-20 text-center text-muted">Loading the drinks menu…</main>;

  const window_ = orderingWindow(menu.hours);
  const paused = menu.settings.ordering_paused;
  const belowMinimum = total > 0 && total < menu.settings.minimum_order_pence;
  const canCheckout = !paused && window_.open && !problems && !belowMinimum && count > 0;

  const notice: ReactNode = paused ? (
    <Banner title="Online ordering temporarily paused">{menu.settings.pause_message}</Banner>
  ) : !window_.open ? (
    <Banner title="Table ordering is closed right now">
      {window_.opensAt ? `Ordering opens ${window_.today ? "today" : "next"} at ${window_.opensAt}. ` : ""}You can still browse the menu, or order at the bar.
    </Banner>
  ) : null;

  const checkoutBlock = paused
    ? "Ordering is paused for a moment."
    : !window_.open
      ? "Table ordering is closed right now."
      : problems
        ? "Some drinks in your basket need changing first."
        : belowMinimum
          ? `The minimum order is ${formatPence(menu.settings.minimum_order_pence)}.`
          : null;

  return (
    <div className="relative mx-auto min-h-dvh max-w-[440px] bg-ivory pb-28 sm:border-x sm:border-line sm:shadow-[0_0_60px_rgba(19,42,31,.08)]">
      {screen === "welcome" && (
        <section className="gutter flex flex-col gap-5.5 pt-4.5 pb-8">
          {preview && (
            <p className="rounded bg-gold-soft px-3 py-2 text-center text-sm font-semibold text-gold-ink">
              Preview: customers can't see this menu yet. Turn it on in Venue settings.
            </p>
          )}
          <img
            src="/logo.jpg"
            alt="The Rising Sun Inn, Abersychan. Free house, warm welcome, fine beers."
            width={900}
            height={842}
            className="mx-auto h-auto max-h-[46vh] w-full max-w-[380px] object-contain"
          />
          <p className="text-center font-display text-[1.6rem] leading-tight text-forest">
            Croeso. <em className="text-gold-ink">Drinks to your table.</em>
          </p>
          <p className="mx-auto max-w-[32ch] text-center text-muted">Choose your drinks, pay on your phone and we'll bring them straight over.</p>
          <p className="flex items-center justify-center gap-2 text-sm text-forest">
            <span className={`h-2 w-2 rounded-full ${paused || !window_.open ? "bg-alert" : "bg-ok"}`} />
            {paused
              ? "Table ordering paused for a moment"
              : window_.open
                ? `Table ordering open until ${window_.closesAt}`
                : window_.opensAt
                  ? `Table ordering opens ${window_.today ? "today" : "next"} at ${window_.opensAt}`
                  : "Table ordering is closed"}
          </p>
          <button onClick={() => go("menu")} className="min-h-13.5 w-full rounded border border-forest bg-forest font-semibold text-ivory">
            View the drinks menu
          </button>
          <p className="mx-auto max-w-[36ch] text-center text-sm text-muted">
            Alcohol is only served to over-18s. We operate Challenge 25, so please have ID ready. Ask a member of the team about allergens.
          </p>
        </section>
      )}

      {(screen === "menu" || screen === "basket") && (
        <header className="sticky top-[env(safe-area-inset-top,0px)] z-5 bg-forest">
          <div className="gutter flex items-center justify-between gap-3 pt-3.5 pb-2.5">
            <button onClick={() => go("welcome")} className="text-left font-display text-[1.35rem] leading-none font-semibold text-ivory">
              The Rising Sun Inn
              <small className="mt-1 block font-caps text-[0.6rem] tracking-[0.3em] text-gold-soft">ABERSYCHAN</small>
            </button>
            <span className="rounded-full border border-gold-soft/50 px-3 py-1.5 text-xs whitespace-nowrap text-gold-soft">
              {basket.table && menu.tables.some((t) => t.label === basket.table) ? `Table ${basket.table}` : "Table chosen at checkout"}
            </span>
          </div>
        </header>
      )}

      {screen === "menu" && (
        <MenuScreen
          menu={menu}
          category={category}
          onCategory={setCategory}
          notice={notice && <div className="gutter pt-4">{notice}</div>}
          onPick={(d) => (d.available ? setSheet({ drink: d, index: null }) : setToast(`${d.name} is sold out tonight. Sorry!`))}
        />
      )}
      {screen === "basket" && (
        <BasketScreen
          menu={menu}
          lines={basket.lines}
          onBack={() => go("menu")}
          onEdit={(i) => {
            const d = menu.drinks.find((x) => x.id === basket.lines[i]!.drinkId);
            if (d) setSheet({ drink: d, index: i });
          }}
          onQuantity={basket.setQuantity}
          onRemove={basket.remove}
          notice={checkoutBlock && count > 0 ? <p className="rounded border border-alert bg-[#fbede7] p-3 text-sm text-alert">{checkoutBlock}</p> : null}
        />
      )}
      {screen === "table" && (
        <TableScreen
          menu={menu}
          initial={details}
          needsAge={needsAge}
          onBack={() => go("basket")}
          onContinue={(d) => {
            setDetails(d);
            basket.setTable(d.table);
            go("confirm");
          }}
        />
      )}
      {screen === "confirm" && <ConfirmScreen table={details.table} drinks={count} totalPence={total} onChangeTable={() => go("table")} />}

      {(screen === "menu" || screen === "basket") && count > 0 && (
        <div className="fixed bottom-0 left-1/2 z-6 w-full max-w-[440px] -translate-x-1/2 bg-gradient-to-t from-ivory from-70% to-transparent pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))] pr-[max(0.9rem,env(safe-area-inset-right,0px))] pl-[max(0.9rem,env(safe-area-inset-left,0px))]">
          {screen === "menu" ? (
            <button onClick={() => go("basket")} className="flex min-h-13.5 w-full items-center justify-between rounded border border-forest bg-forest px-4.5 font-semibold text-ivory">
              <span className="inline-grid h-6.5 min-w-6.5 place-items-center rounded-full bg-gold px-1.5 text-sm text-white tabular-nums">{count}</span>
              <span>View basket</span>
              <span className="tabular-nums">{formatPence(total)}</span>
            </button>
          ) : (
            <button
              disabled={!canCheckout}
              onClick={() => go("table")}
              className="flex min-h-13.5 w-full items-center justify-between rounded border border-forest bg-forest px-4.5 font-semibold text-ivory disabled:opacity-45"
            >
              <span>Choose table &amp; pay</span>
              <span className="tabular-nums">{formatPence(total)}</span>
            </button>
          )}
        </div>
      )}

      {sheet && (
        <ProductSheet
          menu={menu}
          drink={sheet.drink}
          editing={sheet.index !== null ? basket.lines[sheet.index]! : null}
          onClose={() => setSheet(null)}
          onSave={(line) => {
            if (sheet.index !== null) {
              basket.replace(sheet.index, line);
              setToast("Basket updated");
            } else {
              basket.add(line);
              setToast(`Added ${line.quantity} × ${sheet.drink.name}`);
            }
            setSheet(null);
          }}
        />
      )}
      {toast && (
        <div role="status" className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded bg-forest px-4 py-2.5 text-sm text-ivory">
          {toast}
        </div>
      )}
    </div>
  );
}

function Banner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-alert bg-[#fbede7] px-4 py-3.5 text-alert">
      <strong className="mb-0.5 block font-display text-xl text-alert">{title}</strong>
      {children}
    </div>
  );
}
