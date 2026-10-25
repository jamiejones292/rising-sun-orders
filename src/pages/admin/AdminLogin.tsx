import { useState, type FormEvent } from "react";
import { useAuth } from "../../lib/auth";

export default function AdminLogin() {
  const { signIn } = useAuth();
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!staffId.trim() || !password) {
      setError("Enter your staff ID and password.");
      return;
    }
    setBusy(true);
    setError(await signIn(staffId, password));
    setBusy(false);
  }

  return (
    <main className="gutter flex min-h-dvh items-center justify-center bg-forest py-8">
      <form
        onSubmit={submit}
        noValidate
        className="flex w-full max-w-[420px] flex-col gap-3.5 rounded-xl bg-ivory p-6 shadow-2xl shadow-black/40"
      >
        <img src="/logo.jpg" alt="The Rising Sun Inn, Abersychan" width={900} height={842} className="mx-auto h-auto w-56" />
        <h1 className="text-center text-3xl font-semibold">Admin sign-in</h1>
        <label className="flex flex-col gap-1.5 text-sm font-bold text-forest">
          Staff ID
          <input
            id="admin-staff-id"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="h-13 rounded-lg border-2 border-line bg-white px-3.5 text-lg font-normal text-ink"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold text-forest">
          Password
          <span className="flex gap-2">
            <input
              id="admin-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-13 min-w-0 flex-1 rounded-lg border-2 border-line bg-white px-3.5 text-lg font-normal text-ink"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="min-w-17 rounded-lg border-2 border-line bg-white font-bold text-forest"
            >
              {show ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        {error && <p className="m-0 text-sm font-semibold text-alert">{error}</p>}
        <button
          disabled={busy}
          className="min-h-14 rounded-lg bg-forest text-lg font-extrabold tracking-wide text-ivory disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="m-0 text-center text-xs text-muted">
          Forgotten your password? Ask the owner to reset it in Supabase.
        </p>
      </form>
    </main>
  );
}
