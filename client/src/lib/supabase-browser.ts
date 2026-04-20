import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function renderConfigError(missing: string[]) {
  if (typeof document === "undefined") return;
  const root = document.getElementById("root");
  const html = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <div data-testid="supabase-config-error" style="max-width:640px;width:100%;border:1px solid rgba(148,163,184,0.25);background:rgba(30,41,59,0.6);border-radius:20px;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
        <p style="margin:0;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#67e8f9;">LibraryHub</p>
        <h1 style="margin:12px 0 0;font-size:26px;font-weight:600;">Missing Supabase configuration</h1>
        <p style="margin-top:12px;color:#cbd5e1;line-height:1.6;">
          The frontend can't start because the following environment variable${missing.length === 1 ? " is" : "s are"} missing at build time:
        </p>
        <ul style="margin:12px 0 0;padding-left:20px;color:#fca5a5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;">
          ${missing.map((name) => `<li>${name}</li>`).join("")}
        </ul>
        <div style="margin-top:20px;padding:16px;border-radius:12px;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.15);color:#cbd5e1;font-size:14px;line-height:1.6;">
          <strong style="color:#f1f5f9;">How to fix on Render:</strong>
          <ol style="margin:8px 0 0;padding-left:18px;">
            <li>Open your service &rarr; <em>Environment</em> tab.</li>
            <li>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</li>
            <li>Click <em>Manual Deploy &rarr; Clear build cache &amp; deploy</em>.</li>
          </ol>
          <p style="margin:12px 0 0;">Vite inlines <code>VITE_*</code> variables at build time, so a cache-cleared rebuild is required.</p>
        </div>
      </div>
    </div>`;
  if (root) {
    root.innerHTML = html;
  } else {
    document.body.innerHTML = html;
  }
}

let supabaseBrowser: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("VITE_SUPABASE_ANON_KEY");
  console.error("[supabase-browser] Missing env vars:", missing.join(", "));
  renderConfigError(missing);
  supabaseBrowser = new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(
        `Supabase browser client unavailable. Missing: ${missing.join(", ")}`,
      );
    },
  });
} else {
  supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      storageKey: "lib-connect-portal-auth",
    },
  });
}

export { supabaseBrowser };
