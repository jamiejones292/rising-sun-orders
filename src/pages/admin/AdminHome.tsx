import { useEffect } from "react";
import BrandMark from "../../components/BrandMark";
import StageNotice from "../../components/StageNotice";

// Admin site. Drinks, stock, tables, staff and reports come in a later stage;
// see design/admin-prototype.html for the agreed design.
export default function AdminHome() {
  useEffect(() => {
    document.title = "Admin · The Rising Sun Inn";
  }, []);

  return (
    <div className="min-h-dvh">
      <header className="gutter flex items-center gap-4 bg-forest py-4">
        <BrandMark tone="light" caption="Admin · Abersychan" />
      </header>
      <main className="gutter flex justify-center py-16">
        <StageNotice stage="Stage 4 of the build" title="Admin">
          <p>
            This is where the owner and managers will manage drinks, prices, stock, tables, staff
            accounts, refunds and sales reports.
          </p>
          <p>It will need a staff ID and password once it's built.</p>
        </StageNotice>
      </main>
    </div>
  );
}
