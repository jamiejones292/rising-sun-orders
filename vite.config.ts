import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Content Security Policy for the built app: the browser only runs our own
// scripts and only talks to our database, so injected code can't send data
// anywhere else. Added at build time (the dev server needs inline scripts),
// and as a <meta> tag so it covers the app but not the old /demo pages.
function securityPolicy(supabaseUrl: string): Plugin {
  const db = supabaseUrl ? new URL(supabaseUrl) : null;
  const connect = ["'self'", ...(db ? [db.origin, `${db.protocol === "http:" ? "ws" : "wss"}://${db.host}`] : ["https://*.supabase.co", "wss://*.supabase.co"])].join(" ");
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src ${connect}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  return {
    name: "security-policy",
    apply: "build",
    transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" }],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss(), securityPolicy(env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "")],
  };
});
