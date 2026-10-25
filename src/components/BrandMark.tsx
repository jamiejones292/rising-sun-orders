type Props = {
  tone?: "light" | "dark";
  caption?: string;
};

// Text wordmark for headers. The full logo artwork is used on the customer
// welcome screen and sign-in screens; this is for compact bars.
export default function BrandMark({ tone = "dark", caption = "Abersychan" }: Props) {
  const name = tone === "light" ? "text-ivory" : "text-forest";
  const sub = tone === "light" ? "text-gold-soft" : "text-gold-ink";
  return (
    <div className="leading-none">
      <span className={`block font-display text-2xl font-semibold ${name}`}>
        The Rising Sun Inn
      </span>
      <span className={`mt-1 block font-caps text-[0.62rem] uppercase tracking-[0.3em] ${sub}`}>
        {caption}
      </span>
    </div>
  );
}
