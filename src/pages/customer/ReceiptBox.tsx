import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { requestReceipt, type ReceiptResult } from "../../lib/receipts";

export type ReceiptState = {
  receipt_email_set: boolean;
  receipt_email?: string | null; // partly hidden, e.g. j•••@gmail.com
  receipt_sent?: boolean;
  receipt_failed?: boolean;
  receipts_left?: number;
};

const ERRORS: Record<string, string> = {
  bad_email: "Please check your email address, for example name@example.com.",
  too_many_receipts: "This order has already sent the most receipts we allow. Please ask the bar team.",
  order_too_old: "Receipts can only be sent within 7 days of ordering. Please ask the bar team.",
  order_not_found: "We can't find this order. Please ask the bar team.",
};

const ENVELOPE = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="mt-0.5 shrink-0 text-gold">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
  </svg>
);

// Receipt panel on the order page: shows where the receipt went, or lets the
// customer add (or change) an address after paying.
export default function ReceiptBox({ token, state, onChanged }: { token: string; state: ReceiptState; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const asked = useRef(false);

  const pending = state.receipt_email_set && !state.receipt_sent && !state.receipt_failed;
  const left = state.receipts_left ?? 3;

  // An address is waiting to be sent (for example the phone lost signal at
  // checkout): ask once more. The server never sends the same receipt twice.
  useEffect(() => {
    if (!pending || asked.current) return;
    asked.current = true;
    void requestReceipt(token).then((r) => {
      setResult(r);
      onChanged();
    });
  }, [pending, token, onChanged]);

  async function send() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("set_receipt_email", { p_token: token, p_email: email.trim() });
    if (err) {
      setBusy(false);
      return setError(ERRORS[Object.keys(ERRORS).find((k) => err.message.includes(k)) ?? ""] ?? "Something went wrong. Please try again.");
    }
    asked.current = true;
    const r = await requestReceipt(token);
    setBusy(false);
    setResult(r);
    setEditing(false);
    onChanged();
  }

  async function retry() {
    setBusy(true);
    const r = await requestReceipt(token);
    setBusy(false);
    setResult(r);
    onChanged();
  }

  const form = (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label htmlFor="track-email" className="font-bold text-forest">
        Email me a receipt <span className="text-sm font-normal text-muted">· optional</span>
      </label>
      <div className="flex gap-2">
        <input
          id="track-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 min-w-0 flex-1 rounded border border-line bg-white px-3 text-[1.05rem]"
        />
        <button disabled={busy} className="min-h-12 rounded border border-forest bg-forest px-4 font-semibold text-ivory disabled:opacity-60">
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      <p className="text-sm text-muted">We'll only use this to send your receipt, never for marketing.</p>
    </form>
  );

  let body;
  if (result === "not_configured") {
    body = <p className="text-muted">Email receipts aren't switched on yet. Your order is still on its way.</p>;
  } else if (editing || !state.receipt_email_set) {
    body = form;
  } else if (state.receipt_sent) {
    body = (
      <>
        <div className="flex gap-3">
          {ENVELOPE}
          <div>
            <b className="text-forest">Receipt sent</b>
            <p className="text-sm text-muted">We've emailed your VAT receipt to {state.receipt_email}. Check your junk folder if it isn't there in a few minutes.</p>
          </div>
        </div>
        {left > 0 && (
          <button onClick={() => setEditing(true)} className="self-start text-sm font-semibold text-gold-ink underline underline-offset-2">
            Send to a different address
          </button>
        )}
      </>
    );
  } else if (state.receipt_failed || result === "failed") {
    body = (
      <>
        <p className="text-alert">We couldn't send your receipt to {state.receipt_email}.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <button disabled={busy} onClick={() => void retry()} className="min-h-11 rounded border border-forest bg-forest px-4 font-semibold text-ivory disabled:opacity-60">
            {busy ? "Trying…" : "Try again"}
          </button>
          {left > 0 && (
            <button onClick={() => setEditing(true)} className="text-sm font-semibold text-gold-ink underline underline-offset-2">
              Use a different address
            </button>
          )}
        </div>
      </>
    );
  } else {
    body = (
      <div className="flex gap-3">
        {ENVELOPE}
        <p className="text-muted">Sending your receipt to {state.receipt_email}…</p>
      </div>
    );
  }

  return <section className="flex flex-col gap-2.5 rounded border border-line bg-paper p-3.5">{body}</section>;
}
