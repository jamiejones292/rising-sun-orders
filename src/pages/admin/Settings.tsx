import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { hhmm, useVenue } from "../../lib/adminData";
import { friendlyError } from "../../lib/errors";
import { formatPence } from "../../lib/money";
import type { OpeningHours, VenueSettings } from "../../lib/types";
import { Button, Field, Panel, Switch, inputClass, useToast } from "../../components/ui";
import OrderingCard from "./OrderingCard";
import { parsePrice } from "./DrinkEditor";
import { PageHeader } from "./AdminApp";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Settings() {
  const venue = useVenue();
  if (!venue.settings) {
    return venue.error ? <p className="text-alert">Couldn't load settings: {venue.error}</p> : <p className="text-muted">Loading…</p>;
  }
  return (
    <>
      <PageHeader title="Venue settings" intro="These apply to every customer and the bar screens. Save each section when you're done." />
      <OrderingCard
        settings={venue.settings}
        hours={venue.hours}
        onChanged={(p) => venue.setSettings({ ...venue.settings!, ordering_paused: p })}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-5.5">
        <HoursPanel hours={venue.hours} onSaved={venue.reload} />
        <OperationsPanel settings={venue.settings} onSaved={venue.setSettings} />
        <AgePanel settings={venue.settings} onSaved={venue.setSettings} />
        <ReceiptsPanel settings={venue.settings} onSaved={venue.setSettings} />
      </div>
    </>
  );
}

// Save a few settings fields, then hand back the updated row.
function useSaveSettings(onSaved: (s: VenueSettings) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function save(patch: Partial<VenueSettings>, message: string) {
    setBusy(true);
    const { data, error } = await supabase.from("venue_settings").update(patch).eq("id", 1).select("*").single();
    setBusy(false);
    if (error) return toast(friendlyError(error), { error: true });
    onSaved(data as VenueSettings);
    toast(message);
  }
  return { busy, save };
}

function HoursPanel({ hours, onSaved }: { hours: OpeningHours[]; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [rows, setRows] = useState(hours);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRows(hours), [hours]);

  const update = (weekday: number, patch: Partial<OpeningHours>) =>
    setRows(rows.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_save_opening_hours", {
      p_hours: rows.map((r) => ({ weekday: r.weekday, opens_at: hhmm(r.opens_at), closes_at: hhmm(r.closes_at), closed: r.closed })),
    });
    setBusy(false);
    if (error) return toast(friendlyError(error), { error: true });
    await onSaved();
    toast("Ordering hours saved");
  }

  return (
    <Panel title="Ordering hours">
      <p className="m-0 text-sm text-muted">
        Outside these hours customers can browse but not pay. Keep them inside your premises licence hours. A closing time
        earlier than the opening time means after midnight.
      </p>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.weekday}
            className="grid grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 border-b border-line py-1.5"
          >
            <b className="text-forest">{DAYS[r.weekday - 1]}</b>
            <input
              id={`opens-${r.weekday}`}
              type="time"
              aria-label={`${DAYS[r.weekday - 1]} opens`}
              disabled={r.closed}
              value={hhmm(r.opens_at)}
              onChange={(e) => update(r.weekday, { opens_at: e.target.value })}
              className={`${inputClass} tabular-nums disabled:opacity-40`}
            />
            <input
              id={`closes-${r.weekday}`}
              type="time"
              aria-label={`${DAYS[r.weekday - 1]} closes`}
              disabled={r.closed}
              value={hhmm(r.closes_at)}
              onChange={(e) => update(r.weekday, { closes_at: e.target.value })}
              className={`${inputClass} tabular-nums disabled:opacity-40`}
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="h-4.5 w-4.5 accent-forest"
                checked={r.closed}
                onChange={(e) => update(r.weekday, { closed: e.target.checked })}
              />
              Closed
            </label>
          </div>
        ))}
      </div>
      <Button className="self-start" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save hours"}
      </Button>
    </Panel>
  );
}

function OperationsPanel({ settings, onSaved }: { settings: VenueSettings; onSaved: (s: VenueSettings) => void }) {
  const { busy, save } = useSaveSettings(onSaved);
  const [pauseMsg, setPauseMsg] = useState(settings.pause_message);
  const [amber, setAmber] = useState(String(settings.wait_amber_minutes));
  const [red, setRed] = useState(String(settings.wait_red_minutes));
  const [barStock, setBarStock] = useState(settings.bar_staff_can_toggle_stock);
  const [minOrder, setMinOrder] = useState(settings.minimum_order_pence ? (settings.minimum_order_pence / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const a = Number(amber),
      r = Number(red);
    if (!Number.isInteger(a) || !Number.isInteger(r) || a < 1 || r <= a || r > 240) {
      return setError("Red needs to be a bigger whole number of minutes than amber, for example 5 and 10.");
    }
    const min = minOrder.trim() === "" ? 0 : parsePrice(minOrder);
    if (min === null) return setError("Minimum order should be an amount like 5.00, or left empty for none.");
    if (!pauseMsg.trim()) return setError("The pause message can't be empty.");
    setError(null);
    void save(
      {
        pause_message: pauseMsg.trim(),
        wait_amber_minutes: a,
        wait_red_minutes: r,
        bar_staff_can_toggle_stock: barStock,
        minimum_order_pence: min,
      },
      "Settings saved",
    );
  }

  return (
    <Panel title="Service">
      <Field label="Pause message" hint="customers see this while ordering is paused">
        <textarea
          id="pause-message"
          className={`${inputClass} h-auto min-h-21 py-2.5`}
          value={pauseMsg}
          onChange={(e) => setPauseMsg(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bar timer amber after" hint="minutes">
          <input id="wait-amber" type="number" min={1} className={`${inputClass} tabular-nums`} value={amber} onChange={(e) => setAmber(e.target.value)} />
        </Field>
        <Field label="Red after" hint="minutes">
          <input id="wait-red" type="number" min={2} className={`${inputClass} tabular-nums`} value={red} onChange={(e) => setRed(e.target.value)} />
        </Field>
      </div>
      <Field label="Minimum order" hint={settings.minimum_order_pence ? `now ${formatPence(settings.minimum_order_pence)}` : "none at the moment"}>
        <span className="relative">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">£</span>
          <input
            id="min-order"
            inputMode="decimal"
            placeholder="0.00"
            className={`${inputClass} pl-6 tabular-nums`}
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
          />
        </span>
      </Field>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm">
          <b className="block text-forest">Bar staff can switch drinks out of stock</b>
          <span className="text-muted">Off means only managers and the owner can.</span>
        </span>
        <Switch on={barStock} label="Bar staff can switch stock" onChange={setBarStock} />
      </div>
      {error && <p className="m-0 text-sm text-alert">{error}</p>}
      <Button className="self-start" disabled={busy} onClick={submit}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </Panel>
  );
}

function AgePanel({ settings, onSaved }: { settings: VenueSettings; onSaved: (s: VenueSettings) => void }) {
  const { busy, save } = useSaveSettings(onSaved);
  const [text, setText] = useState(settings.age_declaration_text);
  return (
    <Panel title="Age & alcohol">
      <Field label="Age declaration shown at checkout">
        <textarea id="age-text" className={`${inputClass} h-auto min-h-24 py-2.5`} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <p className="m-0 text-sm text-muted">
        Staff still check ID on delivery (Challenge 25). Ticking this box online is not a legal age check.
      </p>
      <Button className="self-start" disabled={busy || !text.trim()} onClick={() => void save({ age_declaration_text: text.trim() }, "Age declaration saved")}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </Panel>
  );
}

function ReceiptsPanel({ settings, onSaved }: { settings: VenueSettings; onSaved: (s: VenueSettings) => void }) {
  const { busy, save } = useSaveSettings(onSaved);
  const [vatReg, setVatReg] = useState(settings.vat_registered);
  const [vatNo, setVatNo] = useState(settings.vat_number ?? "");
  const [sender, setSender] = useState(settings.receipt_sender_name);
  const [replyTo, setReplyTo] = useState(settings.receipt_reply_to ?? "");
  const [retention, setRetention] = useState(String(settings.email_retention_days));
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (replyTo.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(replyTo.trim())) {
      return setError("The reply-to address doesn't look like an email address.");
    }
    if (!sender.trim()) return setError("Add a sender name for receipts.");
    setError(null);
    void save(
      {
        vat_registered: vatReg,
        vat_number: vatNo.trim() || null,
        receipt_sender_name: sender.trim(),
        receipt_reply_to: replyTo.trim() || null,
        email_retention_days: Number(retention),
      },
      "VAT and receipt settings saved",
    );
  }

  return (
    <Panel title="VAT & receipts">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4.5 w-4.5 accent-forest" checked={vatReg} onChange={(e) => setVatReg(e.target.checked)} />
        We're VAT-registered (menu prices include VAT)
      </label>
      <Field label="VAT registration number" hint="printed on receipts">
        <input id="vat-number" className={`${inputClass} tabular-nums`} placeholder="GB 123 4567 89" value={vatNo} onChange={(e) => setVatNo(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Receipt sender name">
          <input id="receipt-sender" className={inputClass} value={sender} onChange={(e) => setSender(e.target.value)} />
        </Field>
        <Field label="Replies go to">
          <input id="receipt-reply" type="email" className={inputClass} placeholder="hello@yourdomain" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
        </Field>
      </div>
      <Field label="Delete customer email addresses after">
        <select id="retention" className={inputClass} value={retention} onChange={(e) => setRetention(e.target.value)}>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </select>
      </Field>
      {error && <p className="m-0 text-sm text-alert">{error}</p>}
      <Button className="self-start" disabled={busy} onClick={submit}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </Panel>
  );
}
