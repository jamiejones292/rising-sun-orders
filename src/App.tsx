import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import CustomerRoot from "./pages/customer/CustomerRoot";
import NotFound from "./pages/NotFound";

// Staff and admin code only downloads when someone opens /staff or /admin,
// keeping the customer pages quick to load on phones.
const AdminApp = lazy(() => import("./pages/admin/AdminApp"));
const StaffApp = lazy(() => import("./pages/staff/StaffApp"));
const TrackOrder = lazy(() => import("./pages/customer/TrackOrder"));

// The three areas of the app share one site:
//   /        customers (opened by the table QR code)
//   /staff   bar iPads
//   /admin   owner and managers
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerRoot />} />
      <Route
        path="/order/:token"
        element={
          <Suspense fallback={<main className="gutter py-20 text-center text-muted">Loading your order…</main>}>
            <TrackOrder />
          </Suspense>
        }
      />
      <Route
        path="/staff/*"
        element={
          <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-forest-night text-gold-soft">Loading…</div>}>
            <StaffApp />
          </Suspense>
        }
      />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-forest text-gold-soft">Loading…</div>}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
