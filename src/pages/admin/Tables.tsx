import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabase";
import { useVenue } from "../../lib/adminData";
import { friendlyError } from "../../lib/errors";
import type { VenueTable } from "../../lib/types";
import { Button, Panel, Switch, inputClass, useToast } from "../../components/ui";
import { PageHeader } from "./AdminApp";

// Every table stand carries this one code.
export const ORDER_URL = "https://drinksorder.app";

export default function Tables() {
  const venue = useVenue();
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(ORDER_URL, {
      width: 1200,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#132A1F", light: "#FFFFFF" },
    }).then(setQr, () => setQr(null));
  }, []);

  async function setActive(t: VenueTable, active: boolean) {
    venue.setTables(venue.tables.map((x) => (x.id === t.id ? { ...x, active } : x)));
    const { error } = await supabase.from("venue_tables").update({ active }).eq("id", t.id);
    if (error) {
      toast(friendlyError(error), { error: true });
      return venue.reload();
    }
    toast(`Table ${t.label} ${active ? "is back in use" : "switched off. Customers can't choose it."}`);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!/^[A-Za-z0-9 -]{1,12}$/.test(label)) {
      return setAddError("Use a short table number like 26 (letters, numbers and spaces only).");
    }
    if (venue.tables.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      return setAddError(`There's already a table ${label}. Each table needs its own number.`);
    }
    setAddError(null);
    const sort = Math.max(0, ...venue.tables.map((t) => t.sort_order)) + 1;
    const { error } = await supabase.from("venue_tables").insert({ label, sort_order: sort });
    if (error) return setAddError(friendlyError(error));
    setNewLabel("");
    await venue.reload();
    toast(`Table ${label} added`);
  }

  return (
    <>
      <PageHeader
        title="Tables & QR code"
        intro="Customers pick from these at checkout. Switch a table off if it's out of use. Every table stand uses the same QR code."
      />
      <Panel>
        <div className="grid grid-cols-1 items-center gap-4.5 md:grid-cols-[260px_1fr]">
          <div className="flex max-w-[260px] flex-col items-center gap-2.5 rounded-md border border-gold bg-ivory p-4 text-center">
            <img src="/logo.jpg" alt="The Rising Sun Inn logo" width={900} height={842} className="h-auto w-[150px]" />
            <div className="grid h-[150px] w-[150px] place-items-center rounded bg-white p-2">
              {qr ? <img src={qr} alt={`QR code for ${ORDER_URL}`} className="h-[134px] w-[134px]" /> : "Making QR code…"}
            </div>
            <p className="m-0 font-display text-lg font-semibold text-forest">Scan to order drinks to your table</p>
            <span className="font-caps text-[0.65rem] tracking-[0.2em] text-gold-ink uppercase">Your table number is on this stand</span>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-2xl font-semibold">One QR code for the whole pub</h2>
            <p className="m-0 text-muted">
              It opens <b className="break-all text-ink">{ORDER_URL}</b>. The code keeps working as long as you keep the domain,
              so you only print it once.
            </p>
            {qr && (
              <a
                href={qr}
                download="rising-sun-qr-code.png"
                className="inline-flex min-h-11 items-center self-start rounded bg-forest px-4 font-semibold text-ivory"
              >
                Download QR code (PNG)
              </a>
            )}
            <p className="m-0 text-sm text-muted">
              Print at least 3cm wide. Test a printed copy with an iPhone and an Android phone before laminating. Don't print
              the final stands until the live ordering site is switched on.
            </p>
          </div>
        </div>
      </Panel>
      <Panel title="Tables" action={<span className="text-sm text-muted">{venue.tables.filter((t) => t.active).length} in use</span>}>
        {venue.error && <p className="text-alert">Couldn't load tables: {venue.error}</p>}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-7">
          {venue.tables.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2.5 border-b border-line py-2">
              <b className={`tabular-nums ${t.active ? "text-forest" : "text-muted line-through"}`}>Table {t.label}</b>
              <Switch on={t.active} label={`Table ${t.label} in use`} onChange={(on) => void setActive(t, on)} />
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2.5">
          <input
            id="new-table"
            aria-label="New table number"
            placeholder="Table number, e.g. 26"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className={`${inputClass} max-w-[240px] flex-[1_1_180px]`}
          />
          <Button>+ Add table</Button>
        </form>
        {addError && <p className="m-0 text-sm text-alert">{addError}</p>}
        <p className="m-0 text-sm text-muted">Areas such as bar, restaurant and garden can be added later.</p>
      </Panel>
    </>
  );
}
