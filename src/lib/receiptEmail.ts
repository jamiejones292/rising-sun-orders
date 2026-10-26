// Builds the receipt email (HTML and plain text) from what the database's
// claim_receipt returns. Pure TypeScript, used by the send-receipt server
// function. Email apps ignore most modern CSS, so the HTML is tables with
// inline styles.
import { formatPence, vatIncludedPence } from "./money";

export type ReceiptData = {
  order_number: number;
  email: string;
  table: string;
  total_pence: number;
  vat_pence: number;
  paid_at: string | null;
  payment_method: string | null;
  test: boolean;
  tracking_token: string;
  items: {
    name: string;
    size: string;
    quantity: number;
    unit_price_pence: number;
    line_total_pence: number;
    vat_rate: number;
    no_ice: boolean;
    extras: { label: string; price_pence: number }[];
  }[];
  venue: {
    name: string;
    address: string | null;
    vat_registered: boolean;
    vat_number: string | null;
    sender_name: string;
    reply_to: string | null;
  };
};

const C = { forest: "#132A1F", gold: "#9C7840", goldInk: "#7A5C2C", ivory: "#FBF4EA", muted: "#6b6a60", line: "#e6dccb" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function when(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "");
  return `${date}, ${time}`;
}

// VAT per rate, worked out per line the same way the database does.
export function vatBreakdown(items: ReceiptData["items"]) {
  const byRate = new Map<number, { gross: number; vat: number }>();
  for (const i of items) {
    const rate = Number(i.vat_rate);
    const r = byRate.get(rate) ?? { gross: 0, vat: 0 };
    r.gross += i.line_total_pence;
    r.vat += vatIncludedPence(i.line_total_pence, rate);
    byRate.set(rate, r);
  }
  return [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, r]) => ({ rate, ...r }));
}

function detail(i: ReceiptData["items"][number]) {
  const extras = i.extras.map((x) => (x.price_pence ? `${x.label} (+${formatPence(x.price_pence)})` : x.label));
  return [i.size, ...extras, i.no_ice ? "No ice" : "", i.quantity > 1 ? `${formatPence(i.unit_price_pence)} each` : ""].filter(Boolean).join(" · ");
}

export function buildReceiptEmail(r: ReceiptData, siteUrl: string) {
  const v = r.venue;
  const trackUrl = `${siteUrl}/order/${r.tracking_token}`;
  const subject = `${r.test ? "[TEST] " : ""}Your receipt from ${v.name} · Order #${r.order_number}`;
  const vat = v.vat_registered ? vatBreakdown(r.items) : [];
  const vatTotal = vat.reduce((s, x) => s + x.vat, 0);
  const fmtRate = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
  const footer = [
    [v.name, v.address || "Abersychan"].join(" · "),
    v.vat_registered && v.vat_number ? `VAT reg. no. ${v.vat_number}` : "",
    `Questions about this order? Speak to the bar team and quote #${r.order_number}${v.reply_to ? ", or reply to this email" : ""}.`,
    v.reply_to ? "" : "Please don't reply to this email: replies aren't read.",
    "Any refund is confirmed in a separate email.",
  ].filter(Boolean);

  const row = (left: string, right: string, style = "") =>
    `<tr><td style="padding:6px 0;font-size:15px;${style}">${left}</td><td align="right" style="padding:6px 0;font-size:15px;white-space:nowrap;vertical-align:top;${style}">${right}</td></tr>`;
  const kv = (k: string, val: string) =>
    `<tr><td style="padding:2px 0;font-size:14px;color:${C.muted}">${k}</td><td align="right" style="padding:2px 0;font-size:14px">${esc(val)}</td></tr>`;
  const sep = `<tr><td colspan="2" style="padding:8px 0"><div style="border-top:1px solid ${C.line};height:0;line-height:0">&nbsp;</div></td></tr>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.ivory};font-family:Helvetica,Arial,sans-serif;color:${C.forest}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${C.line};border-radius:6px">
<tr><td style="padding:24px 22px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${r.test ? `<tr><td colspan="2" align="center" style="padding:0 0 14px"><div style="background:${C.forest};color:#ffffff;font-weight:bold;letter-spacing:1px;font-size:13px;padding:8px;border-radius:4px">TEST ORDER · NO PAYMENT WAS TAKEN</div></td></tr>` : ""}
<tr><td colspan="2" align="center"><img src="${siteUrl}/logo.jpg" width="132" alt="${esc(v.name)}, Abersychan" style="display:block;width:132px;height:auto;border:0"></td></tr>
<tr><td colspan="2" align="center" style="padding:14px 0 2px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:bold;color:${C.forest}">Diolch. Thank you.</td></tr>
<tr><td colspan="2" align="center" style="padding:0 0 16px;font-size:14px;color:${C.muted}">Here's your receipt for drinks ordered to your table.</td></tr>
${kv("Order", `#${r.order_number}`)}${kv("Date", when(r.paid_at))}${kv("Table", r.table)}${r.payment_method ? kv("Paid by", r.payment_method) : ""}
${sep}
${r.items
  .map((i) => row(`<b>${i.quantity} × ${esc(i.name)}</b><br><span style="font-size:13px;color:${C.muted}">${esc(detail(i))}</span>`, formatPence(i.line_total_pence)))
  .join("\n")}
${sep}
${
  v.vat_registered
    ? row("Total before VAT", formatPence(r.total_pence - vatTotal)) + vat.map((x) => row(`VAT at ${fmtRate(x.rate)}`, formatPence(x.vat))).join("")
    : ""
}
${row("Total paid", formatPence(r.total_pence), `font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:${C.forest};padding-top:10px`)}
<tr><td colspan="2" align="center" style="padding:20px 0 6px"><a href="${trackUrl}" style="display:inline-block;background:${C.forest};color:${C.ivory};text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:4px">View your order</a></td></tr>
${sep}
<tr><td colspan="2" align="center" style="font-size:12px;line-height:1.6;color:${C.muted}">${footer.map(esc).join("<br>")}</td></tr>
</table></td></tr></table>
<p style="font-size:11px;color:${C.muted};margin:14px 0 0">You're getting this because you asked for a receipt at ${esc(siteUrl.replace(/^https?:\/\//, ""))}. We don't use your email for anything else.</p>
</td></tr></table></body></html>`;

  const text = [
    r.test ? "TEST ORDER · NO PAYMENT WAS TAKEN\n" : "",
    `${v.name}: receipt for order #${r.order_number}`,
    "",
    `Date: ${when(r.paid_at)}`,
    `Table: ${r.table}`,
    r.payment_method ? `Paid by: ${r.payment_method}` : "",
    "",
    ...r.items.map((i) => `${i.quantity} × ${i.name}  ${formatPence(i.line_total_pence)}\n   ${detail(i)}`),
    "",
    ...(v.vat_registered
      ? [`Total before VAT: ${formatPence(r.total_pence - vatTotal)}`, ...vat.map((x) => `VAT at ${fmtRate(x.rate)}: ${formatPence(x.vat)}`)]
      : []),
    `Total paid: ${formatPence(r.total_pence)}`,
    "",
    `View your order: ${trackUrl}`,
    "",
    ...footer,
  ]
    .filter((l, idx, all) => l !== "" || all[idx - 1] !== "")
    .join("\n");

  return { subject, html, text };
}
