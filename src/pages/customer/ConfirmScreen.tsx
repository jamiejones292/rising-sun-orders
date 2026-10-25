import { useState } from "react";
import { formatPence } from "../../lib/money";

// Step 2 of checkout: the big table confirmation. Payment plugs in here once
// the payment provider is chosen; until then customers are asked to order at
// the bar, so no unpaid order can ever reach the bar screen.
export default function ConfirmScreen({
  table,
  drinks,
  totalPence,
  onChangeTable,
  onPlaceTestOrder,
}: {
  table: string;
  drinks: number;
  totalPence: number;
  onChangeTable: () => void;
  onPlaceTestOrder: (() => Promise<string | null>) | null;
}) {
  const [busy, setBusy] = useState(false);
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
      <p className="-mt-1 text-center text-sm text-muted">
        Please check this matches the number on your table stand. Orders sent to an empty table can't usually be refunded.{" "}
        <a href="/refunds" target="_blank" rel="noopener" className="font-semibold text-gold-ink underline underline-offset-2">
          Refund policy
        </a>
      </p>

      {onPlaceTestOrder ? (
        <div className="flex flex-col gap-3 rounded-md border-2 border-dashed border-gold bg-paper p-4.5">
          <p className="font-caps text-[0.72rem] tracking-[0.2em] text-gold-ink uppercase">Test mode</p>
          <p className="text-muted">No payment is taken. The order goes straight to the bar screen marked as a test.</p>
          {error && <p className="text-sm font-semibold text-alert">{error}</p>}
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(await onPlaceTestOrder());
              setBusy(false);
            }}
            className="min-h-14 rounded border border-forest bg-forest text-lg font-bold text-ivory disabled:opacity-60"
          >
            {busy ? "Sending to the bar…" : "Place test order (no payment)"}
          </button>
        </div>
      ) : (
        <div role="status" className="flex flex-col gap-2 rounded-md border border-gold bg-paper p-4.5">
          <p className="font-caps text-[0.72rem] tracking-[0.2em] text-gold-ink uppercase">Paying by phone</p>
          <h2 className="text-2xl">Card payments are being set up</h2>
          <p className="text-muted">
            You'll soon be able to pay here with Apple Pay, Google Pay or a card. For now, please order at the bar. Your basket is saved on
            this phone.
          </p>
        </div>
      )}
      <button onClick={onChangeTable} className="self-center py-1.5 font-semibold text-gold-ink underline underline-offset-3">
        Change table
      </button>
    </div>
  );
}
