import { createClient } from "@supabase/supabase-js";

// Browser connection to the database. Uses the PUBLISHABLE key, which is safe to
// ship to browsers: what each visitor can read or change is decided by the
// database's security rules, not by keeping this key secret.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !publishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. They are set in netlify.toml for the live site and in .env for local development.",
  );
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true, // bar iPads stay signed in
    autoRefreshToken: true,
  },
});
