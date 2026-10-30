import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createElevatedClient, supabase } from "../../lib/supabase";
import { staffEmail } from "../../lib/auth";
import { friendlyError } from "../../lib/errors";
import { loadMenuData, type MenuData } from "../../lib/adminData";
import type { BarOrder, Drink, StaffProfile } from "../../lib/types";
import { useToast } from "../../components/ui";
import DrinkEditor from "../admin/DrinkEditor";
import StockList from "./StockList";

const LOCK_AFTER_S = 300;

// The small admin section inside the bar screen. A manager signs in with their
// own staff ID on a separate, unsaved connection, so the bar iPad stays signed
// in underneath. It locks itself after 5 minutes without a tap.
export default function BarAdmin({
  paused,
  problemOrders,
  onClose,
  onChanged,
}: {
  paused: boolean;
  problemOrders: BarOrder[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [manager, setManager] = useState<StaffProfile | null>(null);
  return (
    <div className="fixed inset-0 z-35 flex items-center justify-center bg-[rgba(5,14,10,.72)] px-4 py-[calc(1rem+env(safe-area-inset-top,0px))]">
      {client && manager ? (
        <AdminPanel
          client={client}
          manager={manager}
          paused={paused}
          problemOrders={problemOrders}
          onLock={() => {
            void client.auth.signOut({ scope: "local" });
            onClose();
          }}
          onChanged={onChanged}
        />
      ) : (
        <AdminSignIn
          onCancel={onClose}
          onSignedIn={(c, p) => {
            setClient(c);
            setManager(p);
          }}
        />
      )}
    </div>
  );
}

function AdminSignIn({ onCancel, onSignedIn }: { onCancel: () => void; onSignedIn: (c: SupabaseClient, p: StaffProfile) => void }) {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!staffId.trim() || !password) return setError("Enter your staff ID and password.");
    setBusy(true);
    const c = createElevatedClient();
    const { data, error: err } = await c.auth.signInWithPassword({ email: staffEmail(staffId), password });
    if (err || !data.session) {
      setBusy(false);
      return setError("That staff ID or password isn't right.");
    }
    const { data: p } = await c
      .from("staff_profiles")
      .select("user_id, staff_code, display_name, role, is_device, active")
      .eq("user_id", data.session.user.id)
      .maybeSingle();
    setBusy(false);
    const profile = p as StaffProfile | null;
    if (!profile || !profile.active || (profile.role !== "owner" && profile.role !== "manager")) {
      void c.auth.signOut({ scope: "local" });
      return setError("Only a manager or the owner can open the admin section.");
    }
    onSignedIn(c, profile);
  }

  return (
    <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="bar-admin-title" className="flex max-h-full w-full max-w-[440px] flex-col gap-3.5 overflow-y-auto rounded-xl bg-ivory p-5.5 text-ink">
      <div className="flex items-start justify-between gap-3">
        <h2 id="bar-admin-title" className="text-3xl font-semibold">
          Admin sign-in
        </h2>
        <button type="button" onClick={onCancel} aria-label="Close" className="h-11 w-11 shrink-0 rounded-full border-2 border-line text-muted">
          ✕
        </button>
      </div>
      <p className="m-0 text-sm text-muted">For managers and the owner. Bar staff don't need this to run orders.</p>
      <label className="flex flex-col gap-1.5 text-sm font-bold text-forest">
        Staff ID
        <input
          id="bar-admin-id"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="h-13.5 rounded-lg border-2 border-line bg-white px-3.5 text-lg font-normal text-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-bold text-forest">
        Password
        <span className="flex gap-2">
          <input
            id="bar-admin-password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-13.5 min-w-0 flex-1 rounded-lg border-2 border-line bg-white px-3.5 text-lg font-normal text-ink"
          />
          <button type="button" onClick={() => setShow(!show)} className="min-w-17 rounded-lg border-2 border-line bg-white font-bold text-forest">
            {show ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      {error && <p className="m-0 text-sm font-semibold text-alert">{error}</p>}
      <button disabled={busy} className="min-h-14 rounded-lg bg-forest text-lg font-extrabold text-ivory disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in to admin"}
      </button>
    </form>
  );
}

function AdminPanel({
  client,
  manager,
  paused,
  problemOrders,
  onLock,
  onChanged,
}: {
  client: SupabaseClient;
  manager: StaffProfile;
  paused: boolean;
  problemOrders: BarOrder[];
  onLock: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [left, setLeft] = useState(LOCK_AFTER_S);
  const [stockKey, setStockKey] = useState(0);
  // The drink editor: the menu it needs, and which drink ("new" for a new one).
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [editing, setEditing] = useState<Drink | "new" | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const lockRef = useRef(onLock);
  lockRef.current = onLock;

  // Auto-lock countdown, reset by any tap or key press inside the panel.
  useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          toast("Admin locked");
          lockRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [toast]);
  const touch = () => setLeft(LOCK_AFTER_S);

  async function openEditor(drinkId: string | null) {
    try {
      const data = await loadMenuData(client);
      const drink = drinkId ? data.drinks.find((d) => d.id === drinkId) : undefined;
      if (drinkId && !drink) return toast("That drink has been archived or removed. Try again.", { error: true });
      setMenu(data);
      setEditing(drink ?? "new");
    } catch (err) {
      toast(friendlyError(err as Error), { error: true });
    }
  }

  async function togglePause() {
    const { error } = await client.rpc("set_ordering_paused", { p_paused: !paused });
    if (error) return toast(friendlyError(error), { error: true });
    onChanged();
    toast(paused ? "Online ordering resumed" : "Online ordering paused for every customer");
  }

  async function clearProblem(o: BarOrder) {
    const { error } = await client.rpc("staff_clear_problem", { p_order_id: o.id });
    if (error) return toast(friendlyError(error), { error: true });
    onChanged();
    toast(`Problem cleared on order #${o.order_number}`);
  }

  async function changeBarPassword(e: FormEvent) {
    e.preventDefault();
    if (pw1.length < 8) return setPwError("Use at least 8 characters. A short phrase is easiest to remember.");
    if (pw1 !== pw2) return setPwError("The two passwords don't match. Type them again.");
    setPwError(null);
    // The bar iPad's own connection changes the bar account's password.
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) return setPwError(friendlyError(error));
    if (signOutOthers) await supabase.auth.signOut({ scope: "others" });
    setPw1("");
    setPw2("");
    toast(signOutOthers ? "Bar password changed. Other iPads will need the new one." : "Bar password changed");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bar-admin-panel"
      onPointerDown={touch}
      onKeyDown={touch}
      className="flex max-h-full w-full max-w-[820px] flex-col gap-3.5 overflow-y-auto rounded-xl bg-ivory p-5.5 text-ink"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-sm text-muted">
            Signed in as{" "}
            <b>
              {manager.display_name} · <span className="capitalize">{manager.role}</span>
            </b>
          </span>
          <h2 id="bar-admin-panel" className="text-3xl font-semibold">
            Admin
          </h2>
        </div>
        <button onClick={onLock} className="min-h-11.5 shrink-0 rounded-lg bg-forest px-4 font-extrabold text-ivory">
          Lock admin
        </button>
      </div>
      <p className="m-0 text-sm text-muted tabular-nums">
        Locks automatically in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} if nobody taps it.
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,330px),1fr))] items-start gap-3.5">
        <section className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-line bg-white px-4 py-3.5">
          <h3 className="m-0 font-sans text-base font-bold text-forest">Online ordering</h3>
          <div className="flex items-center justify-between gap-3 py-2">
            <span>
              <b className={paused ? "text-bar-red" : "text-bar-ok"}>{paused ? "Paused" : "Active"}</b>
              <br />
              <small className="text-muted">{paused ? "Customers can browse but can't pay." : "Customers can order and pay."}</small>
            </span>
            <button onClick={() => void togglePause()} className={`min-h-12 rounded-lg px-4 font-extrabold text-white ${paused ? "bg-bar-ok" : "bg-bar-red"}`}>
              {paused ? "RESUME ONLINE ORDERS" : "PAUSE ONLINE ORDERS"}
            </button>
          </div>
          {problemOrders.length > 0 && (
            <>
              <h3 className="mt-2 font-sans text-base font-bold text-forest">Problems reported</h3>
              {problemOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 border-t border-vellum py-2">
                  <span className="min-w-0 text-sm">
                    <b className="tabular-nums">
                      #{o.order_number} · Table {o.table_label}
                    </b>
                    <br />
                    <small className="text-bar-red">{o.problem_reason}</small>
                  </span>
                  <button onClick={() => void clearProblem(o)} className="min-h-10 shrink-0 rounded-lg border-2 border-line bg-white px-3 text-sm font-extrabold text-forest">
                    Clear
                  </button>
                </div>
              ))}
              <small className="text-muted">Refunds arrive once card payments are set up.</small>
            </>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-line bg-white px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="m-0 font-sans text-base font-bold text-forest">Drinks &amp; stock</h3>
            <button onClick={() => void openEditor(null)} className="min-h-10 shrink-0 rounded-lg bg-forest px-3.5 text-sm font-extrabold text-ivory">
              + Add a drink
            </button>
          </div>
          <small className="text-muted">Switch a drink off and customers can't order it. Edit a drink to change prices or archive it.</small>
          <StockList client={client} reloadKey={stockKey} onEdit={(id) => void openEditor(id)} />
        </section>

        <section className="flex min-w-0 flex-col gap-2 rounded-[10px] border border-line bg-white px-4 py-3.5">
          <h3 className="m-0 font-sans text-base font-bold text-forest">Bar screen password</h3>
          <small className="text-muted">The password staff type to open this screen.</small>
          <form onSubmit={changeBarPassword} noValidate className="flex flex-col gap-2.5">
            <label className="flex flex-col gap-1 text-sm font-bold text-forest">
              New password
              <input id="bar-new-pw" type="password" autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} className="h-12 rounded-lg border-2 border-line bg-white px-3 font-normal" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-forest">
              Type it again
              <input id="bar-new-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-12 rounded-lg border-2 border-line bg-white px-3 font-normal" />
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} className="h-5.5 w-5.5 accent-bar-ok" />
              Sign out the other bar iPads
            </label>
            {pwError && <p className="m-0 text-sm font-semibold text-alert">{pwError}</p>}
            <button className="min-h-12 self-start rounded-lg border-2 border-line bg-white px-4 font-extrabold text-forest">Change password</button>
          </form>
        </section>

        <section className="flex min-w-0 flex-col gap-2 rounded-[10px] border border-line bg-white px-4 py-3.5">
          <h3 className="m-0 font-sans text-base font-bold text-forest">This iPad</h3>
          <a href="/admin" target="_blank" rel="noopener" className="inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-line bg-white px-4 font-extrabold text-forest">
            Open the full admin site
          </a>
          {confirmSignOut ? (
            <div className="flex flex-col gap-2 rounded-lg border-2 border-bar-red bg-bar-red-soft p-3 text-sm font-semibold text-bar-red">
              Sign this iPad out of the bar screen? Someone will need the bar password to open it again.
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await client.auth.signOut({ scope: "local" });
                    await supabase.auth.signOut({ scope: "local" });
                  }}
                  className="min-h-11 rounded-lg bg-bar-red px-4 font-extrabold text-white"
                >
                  Sign out
                </button>
                <button onClick={() => setConfirmSignOut(false)} className="min-h-11 rounded-lg border-2 border-line bg-white px-4 font-extrabold text-forest">
                  Keep signed in
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmSignOut(true)} className="min-h-12 rounded-lg border-2 border-line bg-white px-4 font-extrabold text-forest">
              Sign this iPad out of the bar screen
            </button>
          )}
        </section>
      </div>

      {editing && menu && (
        <DrinkEditor
          client={client}
          drink={editing === "new" ? null : editing}
          data={menu}
          defaultCategory={menu.categories[0]?.id}
          onClose={() => setEditing(null)}
          onSaved={(name, archived) => {
            const isNew = editing === "new";
            setEditing(null);
            setStockKey((k) => k + 1);
            toast(archived ? `${name} archived. It's off the customer menu.` : isNew ? `${name} added to the menu` : `${name} saved`);
          }}
        />
      )}
    </div>
  );
}
