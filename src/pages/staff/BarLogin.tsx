import { useState, type FormEvent } from "react";
import { useAuth } from "../../lib/auth";

// The bar screen opens with just the bar password. It signs in to the shared,
// bar-only account and then stays signed in on this iPad.
export default function BarLogin() {
  const { signIn } = useAuth();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (Date.now() < lockedUntil) {
      return setError(`Too many wrong attempts. Try again in ${Math.ceil((lockedUntil - Date.now()) / 1000)} seconds.`);
    }
    if (!password) return setError("Enter the bar password.");
    setBusy(true);
    const err = await signIn("bar", password);
    setBusy(false);
    if (!err) return;
    const n = fails + 1;
    if (n >= 5) {
      setFails(0);
      setLockedUntil(Date.now() + 30_000);
      setError("Too many wrong attempts. Try again in 30 seconds.");
    } else {
      setFails(n);
      setError(err.includes("isn't right") ? "That password isn't right. Check with a manager." : err);
    }
  }

  return (
    <main className="gutter flex min-h-dvh items-center justify-center bg-forest-night py-8">
      <form onSubmit={submit} noValidate className="flex w-full max-w-[420px] flex-col gap-3.5 rounded-xl bg-ivory p-6 shadow-2xl shadow-black/40">
        <img src="/logo.jpg" alt="The Rising Sun Inn, Abersychan" width={900} height={842} className="mx-auto h-auto w-60" />
        <h1 className="text-center text-3xl font-semibold">Bar screen</h1>
        <label className="flex flex-col gap-1.5 text-sm font-bold text-forest">
          Bar password
          <span className="flex gap-2">
            <input
              id="bar-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 min-w-0 flex-1 rounded-lg border-2 border-line bg-white px-3.5 text-lg font-normal text-ink"
            />
            <button type="button" onClick={() => setShow(!show)} className="min-w-17 rounded-lg border-2 border-line bg-white font-bold text-forest">
              {show ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        {error && <p className="m-0 text-sm font-semibold text-alert">{error}</p>}
        <button disabled={busy} className="min-h-14 rounded-lg bg-forest text-lg font-extrabold tracking-wide text-ivory disabled:opacity-60">
          {busy ? "Opening…" : "Open bar screen"}
        </button>
        <p className="m-0 text-center text-xs text-muted">This iPad stays signed in until a manager signs it out.</p>
      </form>
    </main>
  );
}
