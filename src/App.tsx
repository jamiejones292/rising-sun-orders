import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import CustomerHome from "./pages/customer/CustomerHome";
import StaffHome from "./pages/staff/StaffHome";
import NotFound from "./pages/NotFound";

// Admin code only downloads when someone opens /admin, keeping the customer
// pages quick to load on phones.
const AdminApp = lazy(() => import("./pages/admin/AdminApp"));

// The three areas of the app share one site:
//   /        customers (opened by the table QR code)
//   /staff   bar iPads
//   /admin   owner and managers
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerHome />} />
      <Route path="/staff/*" element={<StaffHome />} />
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
