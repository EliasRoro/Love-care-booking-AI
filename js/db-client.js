/* Supabase client singleton. Requires js/config.js to be loaded first. */

let supabase = null;

function getSupabase() {
  if (supabase) return supabase;

  if (typeof CONFIG === "undefined") {
    throw new Error("CONFIG is not loaded. Include js/config.js before js/supabase-client.js.");
  }
  if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL === "YOUR_SUPABASE_URL") {
    throw new Error(
      "Supabase is not configured yet. Open js/config.js and set SUPABASE_URL and SUPABASE_ANON_KEY. See DEPLOY.md."
    );
  }
  if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
    throw new Error("Supabase JS library failed to load. Check your network connection.");
  }

  supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return supabase;
}

/* Generate a human-friendly booking reference code, e.g. CN-7KQ2XA */
function makeReferenceCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const prefix = (CONFIG.BRAND_NAME || "CN").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "CN";
  return `${prefix}-${code}`;
}
