import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import CustomerHome from "./CustomerHome";

const CustomerApp = lazy(() => import("./CustomerApp"));
const PREVIEW_KEY = "rs-preview";

function readPreview(): boolean {
  try {
    return localStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

// drinksorder.app shows the real menu once the owner switches it on in Venue
// settings. Before that, visiting drinksorder.app/?preview on a phone turns on
// a preview for that phone only (and /?preview=off turns it off again).
export default function CustomerRoot() {
  const [params, setParams] = useSearchParams();
  const [preview, setPreview] = useState(readPreview);
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!params.has("preview")) return;
    const on = params.get("preview") !== "off";
    try {
      if (on) localStorage.setItem(PREVIEW_KEY, "1");
      else localStorage.removeItem(PREVIEW_KEY);
    } catch {
      // private browsing: preview lasts for this visit only
    }
    setPreview(on);
    params.delete("preview");
    setParams(params, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    void supabase
      .from("venue_settings")
      .select("customer_menu_live")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => setLive(error ? false : !!data?.customer_menu_live));
  }, []);

  if (live === null && !preview) return <div className="min-h-dvh bg-ivory" />;
  if (!live && !preview) return <CustomerHome />;
  return (
    <Suspense fallback={<main className="gutter py-20 text-center text-muted">Loading the drinks menu…</main>}>
      <CustomerApp preview={!live} />
    </Suspense>
  );
}
