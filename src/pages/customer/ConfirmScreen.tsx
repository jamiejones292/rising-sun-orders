import { useState } from "react";
import { formatPence } from "../../lib/money";

// Step 2 of checkout: the big table confirmation. Payment plugs in here once
// the payment provider is chosen; until then customers are asked to order at
// the bar, so no unpaid order can ever reach the bar screen.
// Test mode only: look like the real payment step, but just place a test order.
const TEST_METHODS = [
  { label: "Apple Pay", className: "bg-black text-white" },
  { label: "Google Pay", className: "border-2 border-ink bg-white text-ink" },
  { label: "card", className: "border border-forest bg-forest text-ivory" },
];

export default function ConfirmScreen({
  table,
  drinks,
  lines,
  totalPence,
  blocked,
  onBasket,
  onChangeTable,
  onPlaceTestOrder,
  previewPhone = false,
}: {
  table: string;
  drinks: number;
  // "2 × Brains SA (Pint)" for each drink, so people can check before paying.
  lines: string[];
  totalPence: number;
  // Why the order can't go through right now (paused, closed, a drink sold out), or null.
  blocked: string | null;
  onBasket: () => void;
  onChangeTable: () => void;
  onPlaceTestOrder: (() => Promise<string | null>) | null;
  // A /?preview phone: if test orders are off, say how to switch them on.
  previewPhone?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="gutter flex flex-col gap-5 py-5">
      <button onClick={onChangeTable} className="self-start py-1.5 font-semibold text-forest">
        ← Back
      </button>
      <p className="font-caps text-[0.72rem] tracking-[0.22em] text-gold-ink uppercase">Step 2 of 2</p>
      <div className="flex flex-col items-center gap-3 rounded-md bg-forest px-5 py-7.5 text-center text-ivory">
        <span className="font-caps text-[0.72rem] tracking-[0.22em] text-gold-soft uppercase">Your drinks will be delivered to</span>
        <span className="font-display text-[clamp(3.2rem,18vw,5rem)] leading-[.95] font-bold text-white">Table {table}</span>
        <span className="flex w-3/5 items-center gap-2.5 text-gold before:h-px before:flex-1 before:bg-gold/55 after:h-px after:flex-1 after:bg-gold/55">
          <span className="h-[7px] w-[7px] rotate-45 bg-gold" />
        </span>
        <p className="text-gold-soft tabular-nums">
          {drinks} drink{drinks === 1 ? "" : "s"} · {formatPence(totalPence)}
        </p>
      </div>
      {lines.length > 0 && (
        <details className="rounded border border-line bg-paper px-4 py-3">
          <summary className="cursor-pointer font-semibold text-forest">Your drinks ({drinks})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <button onClick={onBasket} className="mt-2 text-sm font-semibold text-gold-ink underline underline-offset-2">
            Change drinks
          </button>
        </details>
      )}
      <p className="-mt-1 text-center text-sm text-muted">
        Please check this matches the number on your table stand. Orders sent to an empty table can't usually be refunded.{" "}
        <a href="/refunds" target="_blank" rel="noopener" className="font-semibold text-gold-ink underline underline-offset-2">
          Refund policy
        </a>
      </p>

      {blocked ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-alert bg-[#fbede7] p-4.5 text-alert">
          <p className="m-0 font-semibold">{blocked}</p>
          <button onClick={onBasket} className="min-h-12 rounded border border-forest bg-forest px-5 font-semibold text-ivory">
            Back to basket
          </button>
        </div>
      ) : onPlaceTestOrder ? (
        <div className="flex flex-col gap-3 rounded-md border-2 border-dashed border-gold bg-paper p-4.5">
          <p className="font-caps text-[0.72rem] tracking-[0.2em] text-gold-ink uppercase">Test mode · no money is taken</p>
          <p className="text-muted">
            These buttons show where Apple Pay, Google Pay and card payments will go. Any of them sends the order straight to the bar,
            marked as a test.
          </p>
          {error && <p className="text-sm font-semibold text-alert">{error}</p>}
          {/* Stand-ins for the real wallet buttons, which the payment provider supplies. */}
          {TEST_METHODS.map((m) => (
            <button
              key={m.label}
              disabled={!!busy}
              onClick={async () => {
                setBusy(m.label);
                setError(await onPlaceTestOrder());
                setBusy(null);
              }}
              className={`flex min-h-14 items-center justify-center gap-2 rounded text-lg font-semibold disabled:opacity-60 ${m.className}`}
            >
              {busy === m.label ? "Confirming payment…" : `Pay ${formatPence(totalPence)} with ${m.label}`}
              <span className="rounded-sm bg-gold px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-white">TEST</span>
            </button>
          ))}
        </div>
      ) : (
        <div role="status" className="flex flex-col gap-2 rounded-md border border-gold bg-paper p-4.5">
          <p className="font-caps text-[0.72rem] tracking-[0.2em] text-gold-ink uppercase">Paying by phone</p>
          <h2 className="text-2xl">Card payments are being set up</h2>
          <p className="text-muted">
            You'll soon be able to pay here with Apple Pay, Google Pay or a card. For now, please order at the bar. Your basket is saved on
            this phone.
          </p>
          {previewPhone && (
            <p className="rounded border border-dashed border-gold p-3 text-sm text-gold-ink">
              Preview phone: test orders are switched off (they turn off by themselves after 2 hours). Switch them on in the admin
              site under Venue settings, Test orders, then come back to this screen.
            </p>
          )}
        </div>
      )}
      <button onClick={onChangeTable} className="self-center py-1.5 font-semibold text-gold-ink underline underline-offset-3">
        Change table
      </button>
    </div>
  );
}
