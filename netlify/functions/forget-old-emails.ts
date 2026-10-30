// Runs once a day on Netlify's schedule: removes receipt email addresses older
// than the retention period in Venue settings (90 days by default), as the
// privacy notice (/privacy) promises. Uses SUPABASE_SECRET_KEY, like receipts.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://faioegqaamrvbfzurzun.supabase.co";

export default async function handler(): Promise<Response> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    console.error("forget-old-emails: SUPABASE_SECRET_KEY is not set");
    return Response.json({ error: "not_configured" }, { status: 503 });
  }
  const db = createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("forget_old_receipt_emails");
  if (error) {
    console.error("forget-old-emails failed", error.message);
    return Response.json({ error: "database_error" }, { status: 500 });
  }
  console.log(`forget-old-emails: cleared ${data} address(es)`);
  return Response.json({ cleared: data });
}

export const config = { schedule: "@daily" };
