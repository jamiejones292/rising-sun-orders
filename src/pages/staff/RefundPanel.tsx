import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "../../lib/errors";
import { formatPence } from "../../lib/money";
import { Button, Drawer, Field, inputClass, useToast } from "../../components/ui";
import { parseMixerPrice } from "../admin/DrinkEditor";

// Refund all or part of an order, from the bar screen's admin section (manager
// sign-in). For now only test orders can be refunded (staff_refund_order,
// migration 010): nothing real is paid back. Card refunds plug in here once a
// payment provider is set up.

type RefundOrder = {
  id: string;
  order_number: number;
  table_label: string;
  total_pence: number;
  refunded_pence: number;
  payment_status: string;
  payment_provider: string | null;
  fulfilment_status: string;
  problem_reason: string | null;
  order_items: { id: string; drink_name: string; variant_label: string; quantity: number; line_total_pence: number; sort_order: number }[];
  refunds: { amount_pence: number; reason: string; created_at: string }[];
};

const SELECT =
  "id, order_number, table_label, total_pence, refunded_pence, payment_status, payment_provider, fulfilment_status, problem_reason, " +
  "order_items(id, drink_name, variant_label, quantity, line_total_pence, sort_order), refunds(amount_pence, reason, created_at)";

// The reasons in the refund policy (/refunds).
const REASONS = [
  "Out of stock",
  "Wrong drink",
  "Not delivered (our mistake)",
  "Refused service (ID or intoxicated)",
  "Changed mind (not poured yet)",
  "Other",
];

const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export default function RefundPanel({
  client,
  orderId,
  onClose,
  onDone,
}: {
  client: SupabaseClient;
  orderId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [order, setOrder] = useState<RefundOrder | null>(null);
  const [lookup, setLookup] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [reason, setReason] = useState(REASONS[0]!);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (by: { id: string } | { number: number }) => {
      const q = client.from("orders").select(SELECT);
      const { data, error: err } = await ("id" in by ? q.eq("id", by.id) : q.eq("order_number", by.number)).maybeSingle();
      if (err) return setError(friendlyError(err));
      if (!data) return setError("No order with that number. Check the number on the customer's order page or receipt.");
      const o = data as unknown as RefundOrder;
      o.order_items.sort((a, b) => a.sort_order - b.sort_order);
      setOrder(o);
      setPicked([]);
      setOther("");
      setError(null);
    },
    [client],
  );

  useEffect(() => {
    if (orderId) void load({ id: orderId });
  }, [orderId, load]);

  async function find(e: FormEvent) {
    e.preventDefault();
    const n = Number(lookup.trim().replace(/^#/, ""));
    if (!Number.isInteger(n) || n <= 0) return setError("Type the order number, e.g. 1042.");
    await load({ number: n });
  }

  const left = order ? order.total_pence - order.refunded_pence : 0;
  const linesPence = order ? order.order_items.filter((i) => picked.includes(i.id)).reduce((t, i) => t + i.line_total_pence, 0) : 0;
  const otherPence = other.trim() ? parseMixerPrice(other) : null;
  const amount = other.trim() ? (otherPence ?? 0) : Math.min(linesPence, left);
  const isTest = order?.payment_provider === "test";
  const canRefund = !!order && isTest && order.payment_status === "paid" && left > 0;

  async function refund() {
    if (!order) return;
    if (other.trim() && (otherPence === null || otherPence <= 0)) return setError("Write the amount like 3.50.");
    if (amount <= 0) return setError("Tick the drinks to refund, or type an amount.");
    if (amount > left) return setError(`The most you can refund is ${formatPence(left)}.`);
    if (reason === "Other" && !note.trim()) return setError("Add a short note saying why.");
    const drinks = order.order_items
      .filter((i) => picked.includes(i.id) && !other.trim())
      .map((i) => `${i.quantity} × ${i.drink_name}`)
      .join(", ");
    const text = [reason === "Other" ? note.trim() : reason, reason !== "Other" && note.trim() ? note.trim() : "", drinks]
      .filter(Boolean)
      .join(": ")
      .slice(0, 200);
    setBusy(true);
    const { error: err } = await client.rpc("staff_refund_order", { p_order_id: order.id, p_amount_pence: amount, p_reason: text });
    // The refund deals with the reported problem, so clear the flag too.
    if (!err && order.problem_reason) await client.rpc("staff_clear_problem", { p_order_id: order.id });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    const full = amount === left;
    toast(`Test refund of ${formatPence(amount)} on order #${order.order_number}${full ? ". Order fully refunded." : ""}`);
    onDone();
    await load({ id: order.id });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Refund"
      title={order ? `Order #${order.order_number} · Table ${order.table_label}` : "Refund an order"}
      footer={
        order && (
          <>
            <Button onClick={() => void refund()} disabled={busy || !canRefund || amount <= 0}>
              {busy ? "Refunding…" : `Refund ${formatPence(Math.max(amount, 0))}${isTest ? " (test)" : ""}`}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </>
        )
      }
    >
      {!orderId && (
        <form onSubmit={find} className="flex items-end gap-2">
          <Field label="Order number">
            <input
              id="refund-order-number"
              className={`${inputClass} tabular-nums`}
              inputMode="numeric"
              placeholder="e.g. 1042"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
            />
          </Field>
          <Button variant="ghost">Find</Button>
        </form>
      )}

      {order && (
        <>
          <div className="grid grid-cols-3 gap-2 rounded border border-line bg-paper p-3 text-center text-sm">
            <span>
              <small className="block text-muted">Paid</small>
              <b className="tabular-nums">{formatPence(order.total_pence)}</b>
            </span>
            <span>
              <small className="block text-muted">Refunded</small>
              <b className="tabular-nums">{formatPence(order.refunded_pence)}</b>
            </span>
            <span>
              <small className="block text-muted">Left to refund</small>
              <b className="tabular-nums">{formatPence(left)}</b>
            </span>
          </div>

          {!isTest && (
            <p className="m-0 rounded border border-alert bg-[#fbeae5] p-3 text-sm text-alert">
              Card refunds arrive once payments are set up. For now, only test orders can be refunded here.
            </p>
          )}
          {isTest && (
            <p className="m-0 rounded bg-ink px-3 py-2 text-center text-sm font-bold tracking-wide text-white">
              TEST ORDER · PRACTICE REFUND, NO MONEY MOVES
            </p>
          )}
          {order.payment_status !== "paid" && <p className="m-0 font-semibold text-forest">This order has been refunded in full.</p>}
          {order.problem_reason && <p className="m-0 text-sm font-semibold text-alert">Problem reported: {order.problem_reason}</p>}

          {canRefund && (
            <>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-bold text-forest">Drinks to refund</legend>
                {order.order_items.map((i) => (
                  <label key={i.id} className="flex items-center gap-2.5 border-b border-line py-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-forest"
                      checked={picked.includes(i.id)}
                      disabled={!!other.trim()}
                      onChange={() => setPicked(picked.includes(i.id) ? picked.filter((x) => x !== i.id) : [...picked, i.id])}
                    />
                    <span className="flex-1">
                      {i.quantity} × {i.drink_name} <small className="text-muted">{i.variant_label}</small>
                    </span>
                    <span className="tabular-nums">{formatPence(i.line_total_pence)}</span>
                  </label>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="ghost" small onClick={() => (setOther(""), setPicked(order.order_items.map((i) => i.id)))}>
                    Tick everything
                  </Button>
                </div>
              </fieldset>
              <Field label="Or a different amount" hint="e.g. one of two drinks on a line">
                <span className="relative max-w-[160px]">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">£</span>
                  <input
                    id="refund-other"
                    className={`${inputClass} pl-6 tabular-nums`}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                  />
                </span>
              </Field>
              <Field label="Reason">
                <select id="refund-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
                  {REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Note" hint={reason === "Other" ? "required" : "optional"}>
                <input id="refund-note" className={inputClass} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              {amount === left && order.fulfilment_status !== "delivered" && order.fulfilment_status !== "cancelled" && (
                <p className="m-0 text-sm text-muted">A full refund also cancels the order, so it leaves the bar screen.</p>
              )}
            </>
          )}

          {order.refunds.length > 0 && (
            <div className="flex flex-col gap-1 text-sm">
              <b className="text-forest">Refunds so far</b>
              {order.refunds.map((r, i) => (
                <span key={i} className="flex justify-between gap-3 border-t border-line pt-1">
                  <span>
                    {hm(r.created_at)} · {r.reason}
                  </span>
                  <b className="tabular-nums">{formatPence(r.amount_pence)}</b>
                </span>
              ))}
            </div>
          )}
        </>
      )}
      {error && <p className="m-0 text-sm font-semibold text-alert">{error}</p>}
    </Drawer>
  );
}
