import { useEffect, type ReactNode } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, isManagerRole, isOwnerRole, useAuth } from "../../lib/auth";
import { ToastProvider } from "../../components/ui";
import AdminLogin from "./AdminLogin";
import Overview from "./Overview";
import Drinks from "./Drinks";
import Categories from "./Categories";
import Extras from "./Extras";
import Tables from "./Tables";
import Settings from "./Settings";

const ICONS: Record<string, string> = {
  overview: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  drinks: '<path d="M6 3h12l-1.5 17a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z"/><path d="M6.5 8h11"/>',
  categories: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  extras: '<path d="M7 3h10l-1 6H8z"/><path d="M12 9v9"/><path d="M8 21h8"/><circle cx="17.5" cy="5.5" r="1.5"/>',
  tables: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9 9h2v2H9zM13 13h2v2h-2z"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
};

const NAV = [
  { to: "/admin", key: "overview", label: "Overview", owner: false, end: true },
  { to: "/admin/drinks", key: "drinks", label: "Drinks & stock", owner: false },
  { to: "/admin/extras", key: "extras", label: "Mixers & extras", owner: false },
  { to: "/admin/categories", key: "categories", label: "Categories", owner: false },
  { to: "/admin/tables", key: "tables", label: "Tables & QR code", owner: true },
  { to: "/admin/settings", key: "settings", label: "Venue settings", owner: true },
];

export default function AdminApp() {
  useEffect(() => {
    document.title = "Admin · The Rising Sun Inn";
  }, []);
  return (
    <AuthProvider>
      <ToastProvider>
        <AdminGate />
      </ToastProvider>
    </AuthProvider>
  );
}

function AdminGate() {
  const { loading, session, profile, signOut } = useAuth();
  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center bg-forest text-gold-soft">Loading…</div>;
  }
  if (!session) return <AdminLogin />;
  if (!isManagerRole(profile)) {
    return (
      <main className="gutter flex min-h-dvh items-center justify-center bg-forest">
        <div className="flex max-w-md flex-col gap-3 rounded-xl bg-ivory p-6 text-center">
          <h1 className="text-3xl font-semibold">Admin is for managers</h1>
          <p className="text-muted">
            {profile
              ? `${profile.display_name} is a ${profile.role === "bar" ? "bar staff" : profile.role} account, which can't open the admin site.`
              : "This login isn't set up as a staff account yet. Ask the owner to add it."}
          </p>
          <button onClick={() => void signOut()} className="min-h-12 rounded bg-forest font-bold text-ivory">
            Sign out
          </button>
        </div>
      </main>
    );
  }
  return <AdminShell />;
}

function AdminShell() {
  const { profile, signOut } = useAuth();
  const owner = isOwnerRole(profile);
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[236px_1fr]">
      <aside className="flex flex-col bg-forest text-ivory lg:sticky lg:top-0 lg:h-dvh lg:py-5">
        <div className="pt-4 pb-2.5 pl-[max(1.1rem,env(safe-area-inset-left,0px))] pr-4">
          <span className="block font-display text-2xl leading-none font-semibold">The Rising Sun Inn</span>
          <span className="font-caps text-[0.6rem] tracking-[0.3em] text-gold-soft uppercase">Admin · Abersychan</span>
        </div>
        <nav
          aria-label="Admin sections"
          className="flex gap-0.5 overflow-x-auto px-3 pt-1 pb-2.5 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pt-5"
        >
          {NAV.filter((n) => owner || !n.owner).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2.5 rounded px-3 py-2.5 font-medium whitespace-nowrap ${
                  isActive ? "bg-ivory font-bold text-forest" : "text-gold-soft hover:bg-white/5"
                }`
              }
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px] shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: ICONS[n.key] ?? "" }}
              />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden px-4.5 py-4 text-sm text-gold-soft lg:block">
          Signed in as <b className="text-ivory">{profile?.display_name}</b>
          <br />
          <span className="capitalize">{profile?.role}</span>
          <button onClick={() => void signOut()} className="mt-3 block font-bold text-ivory underline">
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <div className="gutter flex items-center justify-end gap-3 border-b border-line bg-paper py-2.5 lg:hidden">
          <span className="text-sm text-muted">{profile?.display_name}</span>
          <button onClick={() => void signOut()} className="text-sm font-bold text-forest underline">
            Sign out
          </button>
        </div>
        <main className="gutter flex w-full max-w-[1180px] flex-col gap-5.5 pt-6 pb-16">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="drinks" element={<Drinks />} />
            <Route path="extras" element={<Extras />} />
            <Route path="categories" element={<Categories />} />
            <Route path="tables" element={owner ? <Tables /> : <Navigate to="/admin" replace />} />
            <Route path="settings" element={owner ? <Settings /> : <Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, intro, action }: { title: string; intro?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-4xl font-semibold">{title}</h1>
        {intro && <p className="mt-1 max-w-[62ch] text-muted">{intro}</p>}
      </div>
      {action}
    </div>
  );
}
