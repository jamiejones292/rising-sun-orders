import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import { useToast } from "../../components/ui";
import type { OpeningHours, VenueSettings } from "../../lib/types";
import { hhmm, todaysHours } from "../../lib/adminData";

// The big pause / resume control shown on Overview and Venue settings.
export default function OrderingCard({
  settings,
  hours,
  onChanged,
}: {
  settings: VenueSettings;
  hours: OpeningHours[];
  onChanged: (paused: boolean) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const paused = settings.ordering_paused;
  const today = todaysHours(hours);

  async function toggle() {
    setBusy(true);
    const { error } = await supabase.rpc("set_ordering_paused", { p_paused: !paused });
    setBusy(false);
    if (error) return toast(friendlyError(error), { error: true });
    onChanged(!paused);
    toast(paused ? "Online ordering resumed" : "Online ordering paused for every customer");
  }

  return (
    <section
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-4 rounded-md p-5 text-ivory ${paused ? "bg-alert" : "bg-forest"}`}
    >
      <div className="min-w-0">
        <p className={`font-caps text-xs tracking-[0.2em] uppercase ${paused ? "text-[#f6d9d2]" : "text-gold-soft"}`}>
          Online ordering
        </p>
        <h2 className="mt-1 text-3xl font-semibold text-white">
          {paused ? "Paused: customers can't check out" : "Active: taking table orders"}
        </h2>
        <p className={`mt-1 max-w-[56ch] text-sm ${paused ? "text-[#f6d9d2]" : "text-gold-soft"}`}>
          {paused
            ? "Customers can still browse the menu and see your pause message. Paid orders already in the queue stay on the bar screen."
            : today && !today.closed
              ? `Ordering hours today: ${hhmm(today.opens_at)} to ${hhmm(today.closes_at)}. Pausing applies to every customer straight away.`
              : "No ordering hours set for today. Pausing applies to every customer straight away."}
        </p>
      </div>
      <button
        onClick={() => void toggle()}
        disabled={busy}
        className={`min-h-13 rounded border border-ivory bg-ivory px-5 font-bold tracking-wide disabled:opacity-60 ${
          paused ? "text-alert" : "text-forest"
        }`}
      >
        {busy ? "Saving…" : paused ? "RESUME ONLINE ORDERS" : "PAUSE ONLINE ORDERS"}
      </button>
    </section>
  );
}
