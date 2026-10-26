// Asks the server to send an order's receipt email. The server decides what to
// send (it reads the address from the database), so this only passes the
// order's tracking token.
export type ReceiptResult = "sent" | "nothing_to_send" | "not_configured" | "failed";

export async function requestReceipt(token: string): Promise<ReceiptResult> {
  try {
    const res = await fetch("/.netlify/functions/send-receipt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      keepalive: true, // still goes if the customer moves to the order page
    });
    const body = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
    if (body.error === "receipts_not_configured") return "not_configured";
    if (res.ok && (body.status === "sent" || body.status === "nothing_to_send")) return body.status;
    return "failed";
  } catch {
    return "failed";
  }
}
