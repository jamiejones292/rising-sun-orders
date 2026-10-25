import { useEffect } from "react";
import BrandMark from "../../components/BrandMark";
import StageNotice from "../../components/StageNotice";

// Bar iPad screen. Password sign-in, live orders and tick-off come in a later
// stage; see design/bar-screen-prototype.html for the agreed design.
export default function StaffHome() {
  useEffect(() => {
    document.title = "Bar orders · The Rising Sun Inn";
  }, []);

  return (
    <div className="min-h-dvh bg-forest-night text-ivory">
      <header className="gutter flex items-center gap-4 border-b border-gold-soft/20 bg-forest py-3">
        <BrandMark tone="light" caption="Bar orders" />
      </header>
      <main className="gutter flex justify-center py-16">
        <StageNotice tone="dark" stage="Stage 6 of the build" title="Bar screen">
          <p>
            Paid orders will appear here live, oldest first, with a timer, a new-order chime and
            a tick-off page for each order.
          </p>
          <p>This screen will need the bar password once it's built.</p>
        </StageNotice>
      </main>
    </div>
  );
}
