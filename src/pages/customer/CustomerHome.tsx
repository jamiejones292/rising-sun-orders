import { useEffect } from "react";
import StageNotice from "../../components/StageNotice";

// Customer welcome screen. The menu, basket and checkout are built in a later
// stage; see design/customer-prototype.html for the agreed design.
export default function CustomerHome() {
  useEffect(() => {
    document.title = "The Rising Sun Inn";
  }, []);

  return (
    <main className="gutter mx-auto flex min-h-dvh max-w-[440px] flex-col items-center gap-6 py-6">
      <img
        src="/logo.jpg"
        alt="The Rising Sun Inn, Abersychan. Free house, warm welcome, fine beers."
        width={900}
        height={842}
        className="h-auto max-h-[46vh] w-full max-w-[380px] object-contain"
      />
      <p className="text-center font-display text-[1.6rem] leading-tight text-forest">
        Croeso. <em className="text-gold-ink">Drinks to your table.</em>
      </p>
      <StageNotice stage="Coming soon" title="Table ordering is being set up">
        <p>
          Soon you'll be able to choose your drinks, pay on your phone and have them brought
          straight to your table.
        </p>
        <p>Until then, please order at the bar.</p>
      </StageNotice>
      <p className="max-w-[36ch] text-center text-sm text-muted">
        Alcohol is only served to over-18s. Please ask a member of the team about allergens.
      </p>
    </main>
  );
}
