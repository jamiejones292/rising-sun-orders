import type { ReactNode } from "react";

type Props = {
  title: string;
  stage: string;
  children: ReactNode;
  tone?: "light" | "dark";
};

// Shown on pages that are set up but not built yet, so a visitor is never
// left looking at a blank screen.
export default function StageNotice({ title, stage, children, tone = "light" }: Props) {
  const card =
    tone === "dark"
      ? "bg-ivory text-ink shadow-2xl shadow-black/40"
      : "bg-paper text-ink border border-line";
  return (
    <section className={`w-full max-w-md rounded-xl p-6 ${card}`}>
      <p className="font-caps text-xs uppercase tracking-[0.2em] text-gold-ink">{stage}</p>
      <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-muted">{children}</div>
    </section>
  );
}
