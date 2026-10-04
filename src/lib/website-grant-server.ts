import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { Campaign, GRANT_SLUG, campaignAvailability } from "./website-grant";

export class GrantError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function grantDatabase() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new GrantError(503, "The campaign is being prepared. Applications are not open yet.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function grantAuth() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new GrantError(503, "Account verification is not available yet.");
  const jar = await cookies();
  return createServerClient(url, key, { cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/website-grant" }, cookies: {
    getAll: () => jar.getAll(),
    setAll: values => { for (const { name, value, options } of values) { try { jar.set(name, value, { ...options, path: "/", httpOnly: true }); } catch { /* Server Components cannot write; mutation routes refresh cookies. */ } } },
  } });
}
export async function verifiedAccount() {
  const auth = await grantAuth();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user?.email || !data.user.email_confirmed_at || data.user.is_anonymous) throw new GrantError(401, "Verify your email to continue.");
  return data.user;
}
export async function campaignSnapshot() {
  try {
    const db = grantDatabase();
    const { data, error } = await db.from("wg_campaigns").select("id,slug,name,status,start_at,end_at,prize_quantity,eligible_countries,minimum_age,rules_version,rules,legal_approved_at,prize_arv_minor,prize_arv_currency,paid_entries_enabled,processor_approved_at,services_enabled").eq("slug", GRANT_SLUG).single();
    if (error || !data) throw new Error("campaign_missing");
    const { data: count, error: countError } = await db.rpc("wg_public_count", { p_campaign: data.id });
    if (countError) throw new Error("count_unavailable");
    return { campaign: data as Campaign, validEntries: Number(count), unavailable: false, serverNow: Date.now() };
  } catch { return { campaign: null, validEntries: null, unavailable: true, serverNow: Date.now() }; }
}
export async function openCampaign() {
  const snapshot = await campaignSnapshot();
  if (!snapshot.campaign || campaignAvailability(snapshot.campaign) !== "open") throw new GrantError(409, campaignAvailability(snapshot.campaign) === "closed" ? "Applications are now closed." : "Applications are not open yet.");
  return snapshot.campaign;
}
export function ensureOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new GrantError(403, "Reload this page before trying again.");
}
export async function bodyJson(request: Request, limit = 16000): Promise<unknown> {
  const text = await request.text();
  if (text.length > limit) throw new GrantError(413, "Keep your answers concise.");
  try { return JSON.parse(text); } catch { throw new GrantError(400, "The request could not be read."); }
}
export function databaseResult(error: { message: string } | null) {
  if (!error) return;
  const messages: Record<string, string> = { CAMPAIGN_CLOSED: "Applications are now closed.", NOT_ELIGIBLE: "Your jurisdiction is not eligible for this campaign.", APPLICATION_REQUIRED: "Complete your application first.", PAID_ENTRIES_BLOCKED: "Additional entry purchases are not available.", SERVICES_BLOCKED: "Service purchases are not available yet.", IDEMPOTENCY_CONFLICT: "This purchase changed. Start a new purchase.", INVALID_PRICE: "Select an available package.", CONSENT_REQUIRED: "Confirm the required agreements." };
  const key = Object.keys(messages).find(k => error.message.includes(k));
  throw new GrantError(key ? 409 : 503, key ? messages[key] : "This action could not be confirmed. You can retry safely.");
}
export async function takeRateLimit(scope: string, identity: string, limit: number, seconds: number) {
  const secret = process.env.GRANT_ABUSE_HMAC_KEY;
  if (!secret || secret.length < 32) throw new GrantError(503, "Verification is being prepared. Please try again later.");
  const key = createHmac("sha256", secret).update(`${scope}:${identity}`).digest("hex");
  const { data, error } = await grantDatabase().rpc("wg_take_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: seconds });
  databaseResult(error);
  if (!data) throw new GrantError(429, "Too many attempts. Wait a few minutes before trying again.");
}
export function grantFailure(error: unknown) {
  const known = error instanceof GrantError;
  if (!known) console.error(JSON.stringify({ system: "website-grant", action: "request_failed", category: "unexpected" }));
  return Response.json({ ok: false, message: known ? error.message : "This action could not be confirmed. Please retry." }, { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
}
export async function accountDashboard() {
  const user = await verifiedAccount(), db = grantDatabase();
  const { campaign } = await campaignSnapshot();
  if (!campaign) throw new GrantError(503, "The campaign is not available yet.");
  const { data: participant, error } = await db.from("wg_participants").select("id").eq("auth_user_id", user.id).eq("campaign_id", campaign.id).maybeSingle();
  databaseResult(error);
  if (!participant) return { email: user.email!, participant: false, entries: [], orders: [], campaign };
  const [tickets, purchases] = await Promise.all([
    db.from("wg_entries").select("entry_number,entry_source,status,created_at").eq("participant_id", participant.id).order("id", { ascending: false }).limit(1000),
    db.from("wg_orders").select("id,kind,code,quantity,currency,amount_minor,status,created_at").eq("participant_id", participant.id).order("created_at", { ascending: false }).limit(100),
  ]);
  databaseResult(tickets.error); databaseResult(purchases.error);
  const { count, error: totalError } = await db.from("wg_entries").select("id", { count: "exact", head: true }).eq("participant_id", participant.id).eq("status", "valid");
  const { count: paid, error: paidError } = await db.from("wg_entries").select("id", { count: "exact", head: true }).eq("participant_id", participant.id).eq("status", "valid").eq("entry_source", "paid");
  databaseResult(totalError); databaseResult(paidError);
  return { email: user.email!, participant: true, entries: tickets.data || [], orders: purchases.data || [], campaign, total: totalError ? null : count, paid: paidError ? null : paid };
}
