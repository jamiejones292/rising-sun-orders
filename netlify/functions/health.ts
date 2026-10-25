// GET /.netlify/functions/health
// Confirms the server functions are deployed and running. Later functions
// (checkout, payment confirmation, refunds, staff actions) live alongside it.
export default async function handler(): Promise<Response> {
  return Response.json({ ok: true, service: "rising-sun-orders", time: new Date().toISOString() });
}
