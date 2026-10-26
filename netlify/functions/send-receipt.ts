// POST /.netlify/functions/send-receipt  { "token": "<order tracking token>" }
// Sends the receipt email for a paid order that has a receipt address. Safe to
// call more than once: the database hands out each receipt only once
// (claim_receipt), so the order page, checkout and later the payment webhook
// can all ask without the customer getting duplicates.
//
// Needs two Netlify environment variables (never in the code):
//   SUPABASE_SECRET_KEY  the database's secret key (server only)
//   RESEND_API_KEY       the email service's API key
import { createClient } from "@supabase/supabase-js";
import { buildReceiptEmail, type ReceiptData } from "../../src/lib/receiptEmail";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://faioegqaamrvbfzurzun.supabase.co";
const RESEND_URL = process.env.RESEND_API_URL ?? "https://api.resend.com";
const FROM_ADDRESS = process.env.RECEIPT_FROM ?? "receipts@drinksorder.app";
const SITE_URL = process.env.SITE_URL ?? "https://drinksorder.app";

const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const secret = process.env.SUPABASE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!secret || !resendKey) return reply(503, { error: "receipts_not_configured" });

  let token = "";
  try {
    token = String(((await req.json()) as { token?: unknown }).token ?? "");
  } catch {
    // fall through to the check below
  }
  if (!/^[0-9a-f]{64}$/.test(token)) return reply(400, { error: "bad_token" });

  const db = createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("claim_receipt", { p_token: token });
  if (error) {
    console.error("claim_receipt failed", error.message);
    return reply(500, { error: "database_error" });
  }
  if (!data) return reply(200, { status: "nothing_to_send" });

  const receipt = data as ReceiptData;
  const email = buildReceiptEmail(receipt, SITE_URL);
  try {
    const res = await fetch(`${RESEND_URL}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: `${receipt.venue.sender_name} <${FROM_ADDRESS}>`,
        to: [receipt.email],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(receipt.venue.reply_to ? { reply_to: receipt.venue.reply_to } : {}),
      }),
    });
    if (!res.ok) throw new Error(`email service ${res.status}: ${(await res.text()).slice(0, 300)}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("receipt not sent", receipt.order_number, message);
    await db.rpc("receipt_failed", { p_token: token, p_error: message });
    return reply(502, { error: "send_failed" });
  }
  return reply(200, { status: "sent" });
}
