import { Route, Routes } from "react-router-dom";
import CustomerHome from "./pages/customer/CustomerHome";
import StaffHome from "./pages/staff/StaffHome";
import AdminHome from "./pages/admin/AdminHome";
import NotFound from "./pages/NotFound";

// The three areas of the app share one site:
//   /        customers (opened by the table QR code)
//   /staff   bar iPads
//   /admin   owner and managers
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerHome />} />
      <Route path="/staff/*" element={<StaffHome />} />
      <Route path="/admin/*" element={<AdminHome />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
