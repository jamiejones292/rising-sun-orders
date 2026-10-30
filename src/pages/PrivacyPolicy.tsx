import { useEffect } from "react";
import { Link } from "react-router-dom";

// Privacy notice for drinksorder.app (UK GDPR). Describes what the ordering
// site actually stores: keep it in step with the code when that changes.
const UPDATED = "30 October 2026";
// Who runs the pub (the data controller) and how to reach them about privacy.
const CONTROLLER = "TODO_CONTROLLER";
const CONTACT_EMAIL = "TODO_EMAIL";
const ADDRESS = "The Rising Sun Inn, Cwmavon Road, Abersychan, Pontypool NP4 8PP";

const COLLECT: { what: string; why: string }[] = [
  { what: "Your table number and the drinks you order", why: "To make your drinks and bring them to the right table." },
  {
    what: "Payment details",
    why: "Taken and stored by our card payment provider, not by us. We only see the amount, whether it was paid, and the card type with its last four digits, so we can match payments and give refunds.",
  },
  { what: "Your email address, if you ask for a receipt", why: "To send your receipt and, if you're refunded, to confirm it. We never use it for marketing." },
  { what: "That you confirmed you're 18 or over", why: "Recorded with orders that contain alcohol, as part of selling alcohol responsibly." },
  {
    what: "Basic technical information, such as your IP address",
    why: "Our hosting providers keep short-lived logs of this to run the site and keep it secure.",
  },
];

const PROVIDERS: { who: string; does: string }[] = [
  { who: "Supabase", does: "Stores orders and the menu (servers in London)." },
  { who: "Netlify", does: "Hosts the website." },
  { who: "Resend", does: "Sends receipt emails." },
  { who: "Our card payment provider", does: "Takes payments (Apple Pay, Google Pay and card)." },
  { who: "Google Fonts", does: "Supplies the lettering used on the site, so your browser contacts Google." },
];

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = "Privacy · The Rising Sun Inn";
  }, []);

  return (
    <main className="gutter mx-auto flex min-h-dvh max-w-[640px] flex-col gap-6 bg-ivory py-8 text-ink">
      <header className="flex flex-col gap-2">
        <span className="font-caps text-[0.72rem] tracking-[0.22em] text-gold-ink uppercase">The Rising Sun Inn · Abersychan</span>
        <h1 className="text-[2.4rem] leading-tight">Privacy notice</h1>
        <p className="text-muted">For ordering drinks on drinksorder.app. Last updated {UPDATED}.</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">The short version</h2>
        <p>
          You don't need an account to order. We keep only what we need to get your drinks to your table, take payment and send a receipt if you
          ask for one. We don't sell your information or use it for marketing, and the site has no advertising or tracking.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">Who we are</h2>
        <p>
          {CONTROLLER} runs The Rising Sun Inn and is responsible for your information. You can contact us about privacy at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-gold-ink underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          , by post to {ADDRESS}, or by speaking to the manager at the bar.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">What we collect and why</h2>
        <dl className="flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
          {COLLECT.map((r) => (
            <div key={r.what} className="flex flex-col gap-1 p-4">
              <dt className="font-semibold text-forest">{r.what}</dt>
              <dd className="text-muted">{r.why}</dd>
            </div>
          ))}
        </dl>
        <p>
          Our legal reason for using this information is that we need it to fulfil the order you've asked for (a contract with you), and to meet
          our legal duties, such as keeping sales and VAT records and selling alcohol responsibly.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">How long we keep it</h2>
        <p>
          Your email address is deleted 90 days after your order. Order and payment records are kept for 6 years, because the law requires us to
          keep sales and VAT records. Those records don't include your email address after the 90 days.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">Stored on your phone</h2>
        <p>
          The site saves your basket, your table number and your recent orders in your phone's browser, so they're still there if you close the
          page and so "Same again" works. Recent orders are cleared after 7 days. This stays on your phone and isn't sent to us. We don't use
          cookies for tracking or advertising, so there's no cookie banner. Clearing your browser's data removes it all.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Companies that help us</h2>
        <p>These companies handle information for us, only to provide their service, and must keep it secure:</p>
        <dl className="flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
          {PROVIDERS.map((p) => (
            <div key={p.who} className="flex flex-col gap-1 p-4">
              <dt className="font-semibold text-forest">{p.who}</dt>
              <dd className="text-muted">{p.does}</dd>
            </div>
          ))}
        </dl>
        <p>
          Some of them are based in, or use services in, the United States. Where information leaves the UK, it's protected by the safeguards UK
          law requires, such as the UK–US data bridge or standard contract terms.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">Your rights</h2>
        <p>
          You can ask for a copy of the information we hold about you, ask us to correct it, or ask us to delete it where we don't have to keep it
          by law. You can also object to how we use it. Contact us using the details above, and we'll reply within one month. Your order number
          helps us find your order.
        </p>
        <p>
          If you're unhappy with how we've handled your information, you can complain to the Information Commissioner's Office at{" "}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener" className="font-semibold text-gold-ink underline underline-offset-2">
            ico.org.uk
          </a>{" "}
          or on 0303 123 1113. We'd appreciate the chance to put it right first.
        </p>
      </section>

      <Link to="/" className="inline-flex min-h-12 items-center self-start rounded bg-forest px-5 font-semibold text-ivory">
        Back to the drinks menu
      </Link>
    </main>
  );
}
