import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

// Small shared building blocks for the staff and admin screens.

type ButtonVariant = "primary" | "gold" | "ghost" | "danger" | "danger-ghost";
const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-forest text-ivory border-forest",
  gold: "bg-gold text-white border-gold tracking-wide font-bold",
  ghost: "bg-paper text-forest border-line",
  danger: "bg-alert text-white border-alert",
  "danger-ghost": "bg-paper text-alert border-alert",
};

export function Button({
  variant = "primary",
  small = false,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; small?: boolean }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded border font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
        small ? "min-h-9 px-3 text-sm" : "min-h-11 px-4"
      } ${BUTTON[variant]} ${className}`}
    />
  );
}

export function Switch({
  on,
  onChange,
  label,
  disabled,
  showText = true,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  showText?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
          on ? "bg-ok" : "bg-[#d6c6a8]"
        }`}
      >
        <span
          className={`absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-[22px]" : ""
          }`}
        />
      </button>
      {showText && (
        <span className={`min-w-7 text-xs font-bold ${on ? "text-ok" : "text-muted"}`}>{on ? "ON" : "OFF"}</span>
      )}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-bold text-forest">
        {label}
        {hint && <span className="ml-1 font-normal text-muted">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-11 w-full min-w-0 rounded border border-[#d6c6a8] bg-paper px-3 text-ink placeholder:text-muted/70";

export function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "gold" | "neutral"; children: ReactNode }) {
  const tones = {
    ok: "bg-[#e5f0e8] text-ok",
    warn: "bg-[#fbf0d9] text-warn",
    bad: "bg-[#fbeae5] text-alert",
    gold: "bg-gold-soft text-gold-ink",
    neutral: "bg-vellum text-muted",
  };
  return <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function Panel({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-md border border-line bg-paper p-4.5">
      {(title || action) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="text-2xl font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Drawer({
  open,
  onClose,
  eyebrow,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Kept in a ref so a parent that re-renders (the bar admin's lock countdown
  // ticks every second) doesn't re-run the effect and pull focus out of a field.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-forest/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-41 flex w-full max-w-[560px] flex-col border-l-[3px] border-gold bg-ivory shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-paper px-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-3.5">
          <div className="min-w-0">
            {eyebrow && <p className="font-caps text-xs uppercase tracking-[0.2em] text-gold-ink">{eyebrow}</p>}
            <h2 className="truncate text-3xl font-semibold">{title}</h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 shrink-0 rounded-full border border-[#d6c6a8] bg-paper text-muted"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4.5 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap gap-2.5 border-t border-line bg-paper px-5 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}

// Short confirmation messages with an optional Undo.
type Toast = { id: number; message: string; undo?: () => void; error?: boolean };
const ToastContext = createContext<(message: string, opts?: { undo?: () => void; error?: boolean }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((message: string, opts?: { undo?: () => void; error?: boolean }) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, ...opts });
    timer.current = window.setTimeout(() => setToast(null), opts?.undo ? 6000 : opts?.error ? 6000 : 2800);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed top-[calc(1rem+env(safe-area-inset-top,0px))] left-1/2 z-60 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3.5 rounded px-4 py-3 text-sm text-ivory shadow-xl ${
            toast.error ? "bg-alert" : "bg-forest"
          }`}
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              className="font-bold text-gold-soft underline"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
