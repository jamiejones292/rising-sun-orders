import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { formatPence } from "../../lib/money";
import { orderingWindow } from "../../lib/hours";
import { priceLine } from "../../lib/pricing";
import { requestReceipt } from "../../lib/receipts";
import { paidOnly, readHistory, saveToHistory, verifyHistory, type PastOrder } from "./history";
import RecentOrders from "./RecentOrders";
import { useBasket } from "./basket";
import { useCustomerMenu, type MenuDrink } from "./useCustomerMenu";
import MenuScreen, { MenuToolbar } from "./MenuScreen";
import ProductSheet from "./ProductSheet";
import BasketScreen from "./BasketScreen";
import TableScreen, { type CheckoutDetails } from "./TableScreen";
import ConfirmScreen from "./ConfirmScreen";

type Screen = "welcome" | "menu" | "basket" | "table" | "confirm";

// previewPhone: this phone was set up with /?preview. Test orders only work on
// those phones, so customers never see the test buttons.
export default function CustomerApp({ preview, previewPhone }: { preview: boolean; previewPhone: boolean }) {
  const { menu, error, reload } = useCustomerMenu();
  const basket = useBasket();
  // The screen lives in the browser history, so the phone's Back button steps
  // back through menu → basket → table → confirm, and closes a drink pop-up.
  const location = useLocation();
  const navState = (location.state ?? null) as { screen?: Screen; sheet?: boolean } | null;
  const screen: Screen = navState?.screen ?? "welcome";
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<{ drink: MenuDrink; index: number | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<PastOrder[]>(() => paidOnly(readHistory()));
  const [againNote, setAgainNote] = useState<string | null>(null);
  const [details, setDetails] = useState<CheckoutDetails>({ table: basket.table ?? "", ageConfirmed: false, email: "" });
  const navigate = useNavigate();

  // Screens visited on this page, oldest first, to tell "back" from "forward".
  const trail = useRef<Screen[]>([]);
  useEffect(() => {
    const t = trail.current;
    if (t[t.length - 2] === screen) t.pop();
    else if (t[t.length - 1] !== screen) t.push(screen);
    window.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    // After a page refresh, checkout steps start again from the basket (the
    // age tick isn't kept), and a pop-up that was open stays closed.
    if (navState?.screen === "table" || navState?.screen === "confirm" || navState?.sheet) {
      navigate(".", { replace: true, state: { screen: navState.screen === "table" || navState.screen === "confirm" ? "basket" : navState.screen } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Back button with a pop-up open: close it.
  useEffect(() => {
    if (!navState?.sheet) setSheet(null);
  }, [navState?.sheet]);

  useEffect(() => {
    document.title = "The Rising Sun Inn · Drinks to your table";
    void verifyHistory().then((all) => setHistory(paidOnly(all)));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const go = (s: Screen) => {
    if (s !== "basket") setAgainNote(null);
    if (s === "basket" || s === "table") void reload(); // re-check prices and stock
    if (s === screen) return;
    const t = trail.current;
    if (t[t.length - 2] === s) navigate(-1);
    else navigate(".", { state: { screen: s } });
  };
  const openSheet = (drink: MenuDrink, index: number | null) => {
    setSheet({ drink, index });
    navigate(".", { state: { screen, sheet: true } });
  };
  const closeSheet = () => {
    if (navState?.sheet) navigate(-1);
    else setSheet(null);
  };

  // Category buttons scroll the full menu to that heading, and the highlighted
  // button follows whichever heading is at the top as the customer scrolls.
  const spyPausedUntil = useRef(0);
  const headerBottom = () => document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  function jumpTo(id: string) {
    setQuery("");
    setCategory(id);
    spyPausedUntil.current = Date.now() + 1000;
    // Wait a moment for the full menu to show again if a search was cleared.
    window.setTimeout(() => {
      const el = document.getElementById(`cat-${id}`);
      if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - headerBottom() + 1, behavior: "smooth" });
    }, 30);
  }
  useEffect(() => {
    if (screen !== "menu" || query.trim()) return;
    const spy = () => {
      if (Date.now() < spyPausedUntil.current) return;
      const line = headerBottom() + 12;
      let current: string | undefined;
      for (const el of document.querySelectorAll<HTMLElement>("[data-menu-cat]")) {
        if (el.getBoundingClientRect().top <= line) current = el.dataset.menuCat;
        else break;
      }
      setCategory(current ?? menu?.categories[0]?.id ?? "all");
    };
    spy();
    window.addEventListener("scroll", spy, { passive: true });
    return () => window.removeEventListener("scroll", spy);
  }, [screen, query, menu]);

  const priced = useMemo(() => (menu ? basket.lines.map((l) => priceLine({ drinks: menu.drinks }, l)) : []), [menu, basket.lines]);
  const total = priced.reduce((s, p) => s + (p.ok ? p.totalPence : 0), 0);
  const count = basket.lines.reduce((s, l) => s + l.quantity, 0);
  const pricedCount = priced.reduce((s, p, i) => s + (p.ok ? basket.lines[i]!.quantity : 0), 0);
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
  if (!menu) return <MenuLoading onRetry={() => void reload()} />;

  const window_ = orderingWindow(menu.hours);
  const paused = menu.settings.ordering_paused;
  const belowMinimum = total > 0 && total < menu.settings.minimum_order_pence;
  // Test orders (no payment) while the owner has test mode switched on.
  const testMode =
    previewPhone && !!menu.settings.test_orders_until && new Date(menu.settings.test_orders_until).getTime() > Date.now();
  const canCheckout = !paused && (window_.open || testMode) && !problems && !belowMinimum && count > 0;

  async function placeTestOrder(): Promise<string | null> {
    const { data, error: err } = await supabase.rpc("place_test_order", {
      p_order: {
        table: details.table,
        age_confirmed: details.ageConfirmed,
        email: details.email || null,
        lines: basket.lines.map((l) => ({
          drink_id: l.drinkId,
          variant_id: l.variantId,
          options: l.options,
          no_ice: l.noIce,
          quantity: l.quantity,
        })),
      },
    });
    if (err) {
      void reload();
      return TEST_ORDER_ERRORS[Object.keys(TEST_ORDER_ERRORS).find((k) => err.message.includes(k)) ?? ""] ?? "Something went wrong placing the order. Please try again.";
    }
    const placed = data as { order_number: number; tracking_token: string };
    saveToHistory({
      token: placed.tracking_token,
      orderNumber: placed.order_number,
      placedAt: new Date().toISOString(),
      table: details.table,
      totalPence: total,
      lines: basket.lines,
      paid: false, // shown once the order page confirms payment
      summary: priced.flatMap((p, i) => (p.ok ? [`${basket.lines[i]!.quantity} × ${p.drinkName}${p.noIce ? " (no ice)" : ""}`] : [])).join(", "),
    });
    if (details.email) void requestReceipt(placed.tracking_token);
    basket.clear();
    navigate(`/order/${placed.tracking_token}`);
    return null;
  }

  // "Same again": put a past round back in the basket at tonight's prices,
  // leaving out anything sold out or no longer on the menu.
  function sameAgain(order: PastOrder) {
    if (!menu) return;
    const left: string[] = [];
    let added = 0;
    for (const line of order.lines) {
      const p = priceLine({ drinks: menu.drinks }, line);
      if (p.ok) {
        basket.add(line);
        added += line.quantity;
      } else {
        const name = menu.drinks.find((d) => d.id === line.drinkId)?.name ?? "A drink";
        left.push(p.reason === "drink_unavailable" ? `${name} is sold out tonight` : `${name} has changed on the menu`);
      }
    }
    if (menu.tables.some((t) => t.label === order.table)) {
      basket.setTable(order.table);
      setDetails((d) => ({ ...d, table: order.table }));
    }
    setAgainNote(left.length ? `${left.join(". ")}, so we've left ${left.length === 1 ? "it" : "them"} out.` : null);
    if (added) {
      setToast(`Added your round from ${order.orderNumber ? `order #${order.orderNumber}` : "last time"}`);
      go("basket");
    } else setToast("Nothing from that round is available tonight.");
  }

  const notice: ReactNode = paused ? (
    <Banner title="Online ordering temporarily paused">{menu.settings.pause_message}</Banner>
  ) : !window_.open ? (
    <Banner title="Table ordering is closed right now">
      {window_.opensAt ? `Ordering opens ${window_.today ? "today" : "next"} at ${window_.opensAt}. ` : ""}You can still browse the menu, or order at the bar.
    </Banner>
  ) : null;

  const checkoutBlock = paused
    ? "Ordering is paused for a moment."
    : !window_.open && !testMode
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
          {count > 0 && (
            <button onClick={() => go("basket")} className="flex min-h-13.5 w-full items-center justify-between gap-3 rounded border border-gold bg-gold px-4.5 font-semibold text-white">
              <span>Carry on with your basket</span>
              <span className="tabular-nums">
                {count} · {formatPence(total)}
              </span>
            </button>
          )}
          <button onClick={() => go("menu")} className="min-h-13.5 w-full rounded border border-forest bg-forest font-semibold text-ivory">
            View the drinks menu
          </button>
          <RecentOrders orders={history} onAgain={sameAgain} />
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
            {basket.table && menu.tables.some((t) => t.label === basket.table) && (
              <span className="shrink-0 rounded-full border border-gold-soft/50 px-3 py-1.5 text-xs text-gold-soft">Table {basket.table}</span>
            )}
          </div>
          {screen === "menu" && (
            <MenuToolbar menu={menu} category={category} onCategory={jumpTo} query={query} onQuery={setQuery} />
          )}
        </header>
      )}

      {screen === "menu" && (
        <MenuScreen
          menu={menu}
          query={query}
          onClearQuery={() => setQuery("")}
          notice={
            (notice || (history.length > 0 && count === 0)) && (
              <div className="gutter flex flex-col gap-4 pt-4">
                {notice}
                {count === 0 && <RecentOrders orders={history} onAgain={sameAgain} compact />}
              </div>
            )
          }
          onPick={(d) => (d.available ? openSheet(d, null) : setToast(`${d.name} is sold out tonight. Sorry!`))}
        />
      )}
      {screen === "basket" && (
        <BasketScreen
          menu={menu}
          lines={basket.lines}
          onBack={() => go("menu")}
          onEdit={(i) => {
            const d = menu.drinks.find((x) => x.id === basket.lines[i]!.drinkId);
            if (d) openSheet(d, i);
          }}
          onQuantity={basket.setQuantity}
          onRemove={basket.remove}
          notice={
            (againNote || (checkoutBlock && count > 0)) && (
              <>
                {againNote && <p className="rounded border border-gold bg-paper p-3 text-sm text-forest">{againNote}</p>}
                {checkoutBlock && count > 0 && <p className="rounded border border-alert bg-[#fbede7] p-3 text-sm text-alert">{checkoutBlock}</p>}
              </>
            )
          }
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
      {screen === "confirm" && (
        <ConfirmScreen
          table={details.table}
          drinks={pricedCount}
          lines={priced.flatMap((p, i) =>
            p.ok ? [`${basket.lines[i]!.quantity} × ${p.drinkName} (${p.variantLabel})${extrasOf(p.extras)}${p.noIce ? ", no ice" : ""}`] : [],
          )}
          totalPence={total}
          blocked={count > 0 && !canCheckout ? (checkoutBlock ?? "Something in your basket needs changing first.") : null}
          onBasket={() => go("basket")}
          onChangeTable={() => go("table")}
          onPlaceTestOrder={testMode ? placeTestOrder : null}
          previewPhone={previewPhone}
        />
      )}

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
          drink={menu.drinks.find((d) => d.id === sheet.drink.id) ?? sheet.drink}
          editing={sheet.index !== null ? basket.lines[sheet.index]! : null}
          onClose={closeSheet}
          onSave={(line) => {
            if (sheet.index !== null) {
              basket.replace(sheet.index, line);
              setToast("Basket updated");
            } else {
              basket.add(line);
              setToast(`Added ${line.quantity} × ${sheet.drink.name}`);
            }
            closeSheet();
          }}
        />
      )}
      {toast && !sheet && (
        <div role="status" className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded bg-forest px-4 py-2.5 text-sm text-ivory">
          {toast}
        </div>
      )}
    </div>
  );
}

// "+ Coca-Cola" for the summary; "No mixer" goes without saying.
const extrasOf = (extras: { optionLabel: string }[]) => {
  const shown = extras.map((x) => x.optionLabel).filter((l) => !/^no mixer$/i.test(l));
  return shown.length ? ` + ${shown.join(", ")}` : "";
};

const TEST_ORDER_ERRORS: Record<string, string> = {
  test_mode_off: "Test orders have been switched off. Turn them on again in Venue settings.",
  ordering_paused: "Ordering has just been paused. Please try again shortly.",
  table_not_found: "That table isn't available. Go back and choose another.",
  drink_unavailable: "A drink in your basket has just sold out. Go back to the basket to change it.",
  size_unavailable: "A size in your basket has just become unavailable. Go back to the basket to change it.",
  option_unavailable: "An extra in your basket is no longer available. Go back to the basket to change it.",
  choice_required: "One of your drinks needs an option choosing. Go back to the basket to change it.",
  age_not_confirmed: "Please confirm the age declaration on the previous step.",
  below_minimum: "Your basket is below the minimum order.",
  bad_email: "Please check the receipt email address.",
  empty_basket: "Your basket is empty.",
  bad_quantity: "Each drink can be ordered up to 20 at a time. Change the number in your basket.",
  too_many_lines: "That's a lot of different drinks for one order. Please split it into two orders.",
  too_many_test_orders: "Lots of test orders just now. Wait a minute and try again.",
};

// "Loading…", then after a few seconds a hint about the signal, with a retry.
function MenuLoading({ onRetry }: { onRetry: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <main className="gutter mx-auto flex min-h-[60dvh] max-w-[440px] flex-col items-center justify-center gap-4 text-center text-muted">
      <p className="m-0">Loading the drinks menu…</p>
      {slow && (
        <>
          <p className="m-0 text-sm">This is taking a while. The signal may be weak here: try the pub Wi-Fi, or move nearer a window.</p>
          <button onClick={onRetry} className="min-h-12 rounded border border-forest px-5 font-semibold text-forest">
            Try again
          </button>
        </>
      )}
    </main>
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
