// Marginalia · 批注 — auth + usage guard (Supabase).
//
// Entirely optional: if SUPABASE_URL / SUPABASE_ANON_KEY are not set, the app
// runs exactly as before — no login, no limits. Set them and every /api route
// requires a signed-in user (magic-link email via Supabase).
//
// Env:
//   SUPABASE_URL                 e.g. https://abcd1234.supabase.co
//   SUPABASE_ANON_KEY            the "anon public" key (safe to expose)
//   SUPABASE_SERVICE_ROLE_KEY    optional — enables the per-user daily cap
//   MARGINALIA_DAILY_LIMIT       optional — requests/user/day (default 300)

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DAILY_LIMIT = parseInt(process.env.MARGINALIA_DAILY_LIMIT || "300", 10);

export function authEnabled() {
  return Boolean(SUPABASE_URL && ANON_KEY);
}

// Public config for the client (anon key is designed to be public).
export function publicConfig() {
  return authEnabled()
    ? { auth: true, supabase_url: SUPABASE_URL, supabase_anon_key: ANON_KEY }
    : { auth: false };
}

// Gate an API request. Returns { ok: true, userId } or { ok: false, status, error }.
export async function guard(req) {
  if (!authEnabled()) return { ok: true, userId: null }; // open mode — today's behavior

  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  const token = header ? String(header).replace(/^Bearer\s+/i, "").trim() : "";
  if (!token) return { ok: false, status: 401, error: "Please sign in to use the reading companion." };

  let user;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { ok: false, status: 401, error: "Your sign-in expired — please sign in again." };
    user = await r.json();
  } catch {
    // Supabase unreachable — don't lock the owner out of reading over an auth blip.
    return { ok: true, userId: null };
  }
  if (!user || !user.id) return { ok: false, status: 401, error: "Your sign-in expired — please sign in again." };

  const capped = await overDailyLimit(user.id);
  if (capped) {
    return { ok: false, status: 429, error: `Daily limit reached (${DAILY_LIMIT} requests). It resets at midnight UTC.` };
  }
  return { ok: true, userId: user.id };
}

// Count today's usage_log rows for this user; log this request. Fail-open:
// any error here must never block reading.
async function overDailyLimit(userId) {
  if (!SERVICE_KEY || !userId) return false;
  const svc = {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    "content-type": "application/json",
  };
  try {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const q = `${SUPABASE_URL}/rest/v1/usage_log?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${since.toISOString()}&select=id`;
    const r = await fetch(q, { headers: { ...svc, prefer: "count=exact", range: "0-0" } });
    const range = r.headers.get("content-range") || "";           // e.g. "0-0/57"
    const total = parseInt(range.split("/")[1] || "0", 10) || 0;
    if (total >= DAILY_LIMIT) return true;
    await fetch(`${SUPABASE_URL}/rest/v1/usage_log`, {
      method: "POST",
      headers: { ...svc, prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId }),
    });
    return false;
  } catch {
    return false;
  }
}
