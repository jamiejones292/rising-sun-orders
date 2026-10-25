import { useState } from "react";
import type { CustomerMenu } from "./useCustomerMenu";

export type CheckoutDetails = { table: string; ageConfirmed: boolean; email: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Step 1 of checkout: which table, the age declaration for alcohol, and an
// optional email address for the receipt.
export default function TableScreen({
  menu,
  initial,
  needsAge,
  onBack,
  onContinue,
}: {
  menu: CustomerMenu;
  initial: CheckoutDetails;
  needsAge: boolean;
  onBack: () => void;
  onContinue: (d: CheckoutDetails) => void;
}) {
  const valid = (t: string | null) => !!t && menu.tables.some((x) => x.label === t);
  const [table, setTable] = useState<string | null>(valid(initial.table) ? initial.table : null);
  const [typed, setTyped] = useState(valid(initial.table) ? initial.table : "");
  const [typedError, setTypedError] = useState<string | null>(null);
  const [age, setAge] = useState(initial.ageConfirmed);
  const [email, setEmail] = useState(initial.email);
  const [emailTouched, setEmailTouched] = useState(false);
  const emailOk = !email.trim() || EMAIL_RE.test(email.trim());
  const ready = !!table && (!needsAge || age) && emailOk;

  function onType(value: string) {
    setTyped(value);
    const v = value.trim().replace(/^table\s*/i, "");
    if (!v) {
      setTable(null);
      setTypedError(null);
    } else if (menu.tables.some((t) => t.label.toLowerCase() === v.toLowerCase())) {
      setTable(menu.tables.find((t) => t.label.toLowerCase() === v.toLowerCase())!.label);
      setTypedError(null);
    } else {
      setTable(null);
      setTypedError(`We can't find table "${value.trim()}". Check the number on your table stand.`);
    }
  }

  return (
    <div className="gutter flex flex-col gap-5 pt-5 pb-32">
      <button onClick={onBack} className="self-start py-1.5 font-semibold text-forest">
        ← Back to basket
      </button>
      <div>
        <p className="mb-1.5 font-caps text-[0.72rem] tracking-[0.22em] text-gold-ink uppercase">Step 1 of 2</p>
        <h1 className="text-4xl">Where are you sitting?</h1>
      </div>
      <p className="-mt-2 text-sm text-muted">Your table number is on the stand with the QR code.</p>
      <input
        id="table-input"
        aria-label="Table number"
        inputMode="numeric"
        autoComplete="off"
        placeholder={`Type your table number, ${menu.tables[0]?.label ?? 1} to ${menu.tables[menu.tables.length - 1]?.label ?? 25}`}
        value={typed}
        onChange={(e) => onType(e.target.value)}
        className="h-13 rounded border border-line bg-paper px-3.5 text-[1.05rem]"
      />
      {typedError && <p className="-mt-2 text-sm text-alert">{typedError}</p>}
      <div className="grid grid-cols-5 gap-2">
        {menu.tables.map((t) => (
          <button
            key={t.id}
            aria-pressed={table === t.label}
            onClick={() => {
              setTable(t.label);
              setTyped(t.label);
              setTypedError(null);
            }}
            className="min-h-13 rounded border border-line bg-paper text-[1.05rem] font-bold text-forest tabular-nums aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-ivory"
          >
            {t.label}
          </button>
        ))}
      </div>
      {needsAge && (
        <label className="flex items-start gap-3 rounded border border-gold bg-paper p-3.5 text-[0.92rem]">
          <input id="age-confirm" type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-0.5 h-5.5 w-5.5 shrink-0 accent-forest" />
          <span>{menu.settings.age_declaration_text}</span>
        </label>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="receipt-email" className="font-bold text-forest">
          Email me a receipt <span className="text-sm font-normal text-muted">· optional</span>
        </label>
        <input
          id="receipt-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          className="h-13 rounded border border-line bg-paper px-3.5 text-[1.05rem]"
        />
        {emailTouched && !emailOk && <p className="text-sm text-alert">Please check your email address, for example name@example.com.</p>}
        <p className="text-sm text-muted">We'll only use this to send your receipt, never for marketing.</p>
      </div>
      <div className="fixed bottom-0 left-1/2 z-6 w-full max-w-[440px] -translate-x-1/2 bg-gradient-to-t from-ivory from-70% to-transparent pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))] pr-[max(0.9rem,env(safe-area-inset-right,0px))] pl-[max(0.9rem,env(safe-area-inset-left,0px))]">
        <button
          disabled={!ready}
          onClick={() => table && onContinue({ table, ageConfirmed: age, email: email.trim() })}
          className="flex min-h-13.5 w-full items-center justify-between rounded border border-forest bg-forest px-4.5 font-semibold text-ivory disabled:opacity-45"
        >
          <span>{table ? `Continue with Table ${table}` : "Choose a table to continue"}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
