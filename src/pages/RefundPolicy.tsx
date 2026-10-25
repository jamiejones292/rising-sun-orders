import { useEffect } from "react";
import { Link } from "react-router-dom";

// Refund policy for table orders, linked from checkout and the tracking page.
// Agreed with the owner: refunds when the pub gets it wrong, manager's
// discretion when the customer does. Edit the wording here; keep it plain.
const UPDATED = "25 October 2026";

const ROWS: { when: string; what: string }[] = [
  { when: "A drink is out of stock, wrong, or not delivered because of our mistake", what: "Full refund for the affected drinks." },
  { when: "We refuse service, for example no ID or the customer is intoxicated", what: "Full refund for the drinks we don't serve." },
  { when: "You chose the wrong table but you're in the pub", what: "Tell the bar team and we'll bring the drinks to your actual table." },
  { when: "Nobody is at the table, or we can't find you", what: "At the manager's discretion. Normally no refund once the drinks have been poured." },
  { when: "You change your mind after paying", what: "At the manager's discretion if your drinks haven't been poured yet. No refund once they have." },
  { when: "Prank, abusive or deliberately false orders", what: "No refund. We may block further orders." },
];

export default function RefundPolicy() {
  useEffect(() => {
    document.title = "Refund policy · The Rising Sun Inn";
  }, []);

  return (
    <main className="gutter mx-auto flex min-h-dvh max-w-[640px] flex-col gap-6 bg-ivory py-8 text-ink">
      <header className="flex flex-col gap-2">
        <span className="font-caps text-[0.72rem] tracking-[0.22em] text-gold-ink uppercase">The Rising Sun Inn · Abersychan</span>
        <h1 className="text-[2.4rem] leading-tight">Refund policy</h1>
        <p className="text-muted">For drinks ordered and paid for on drinksorder.app. Last updated {UPDATED}.</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">The short version</h2>
        <p>
          If we get your order wrong, we'll put it right or refund you. Please check your table number before paying, because drinks sent to an
          empty table can't usually be refunded once they've been poured.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">When we refund</h2>
        <dl className="flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
          {ROWS.map((r) => (
            <div key={r.when} className="flex flex-col gap-1 p-4">
              <dt className="font-semibold text-forest">{r.when}</dt>
              <dd className="text-muted">{r.what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">How to ask for a refund</h2>
        <p>
          Speak to the bar team while you're in the pub and give them your order number. You'll find it on your order page and on your email
          receipt if you asked for one. A manager will look at it straight away.
        </p>
        <p>
          Refunds go back to the card or wallet you paid with (Apple Pay, Google Pay or card). They usually show within 3 to 5 working days,
          depending on your bank. If you gave us your email address, we'll email you to confirm the refund.
        </p>
        <p>We can't give refunds in cash for orders paid on the app.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">Age checks</h2>
        <p>
          We follow Challenge 25. If we ask for ID and can't serve you, or we decide not to serve someone who has had too much to drink, you'll get
          a full refund for the drinks we don't serve.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">Your rights</h2>
        <p>
          Food and drink made to be enjoyed straight away isn't covered by the 14-day cancellation period that applies to many online orders. This
          policy doesn't affect your other legal rights, including your right to a refund if we don't supply what you paid for.
        </p>
      </section>

      <Link to="/" className="inline-flex min-h-12 items-center self-start rounded bg-forest px-5 font-semibold text-ivory">
        Back to the drinks menu
      </Link>
    </main>
  );
}
