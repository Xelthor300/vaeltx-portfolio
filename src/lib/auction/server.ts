import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { stateColumns, type PublicState } from "./model";
import { auctionRuntime, qaEmailAllowed } from "./runtime";
import {
  captchaTokenSchema,
  validChallengeResult,
  type ChallengeAction,
} from "./turnstile";

export class AuctionError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "invalid_request",
  ) {
    super(message);
  }
}
function required(name: string) {
  const value = process.env[name];
  if (!value)
    throw new AuctionError(
      "This service is being configured. Please try again later.",
      503,
      "configuration_pending",
    );
  return value;
}
export function db() {
  return createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function auth() {
  const jar = await cookies();
  return createServerClient(
    required("SUPABASE_URL"),
    required("SUPABASE_PUBLISHABLE_KEY"),
    {
      cookieOptions: {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            for (const { name, value, options } of values)
              jar.set(name, value, options);
          } catch {
            /* Server-component refresh is persisted by proxy.ts. */
          }
        },
      },
    },
  );
}
export async function user() {
  const client = await auth();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !data.user.email || !data.user.email_confirmed_at)
    throw new AuctionError(
      "Sign in with a verified email to continue.",
      401,
      "sign_in_required",
    );
  if (!qaEmailAllowed(data.user.email))
    throw new AuctionError("Not found.", 404);
  if (auctionRuntime().qa) {
    const a = await auction();
    const result = await db()
      .from("va_qa_access")
      .upsert({ auction_id: a.id, user_id: data.user.id });
    ensure(true, result.error);
  }
  return data.user;
}
export async function admin() {
  const u = await user();
  const expected = process.env.AUCTION_ADMIN_AUTH_EMAIL;
  if (!expected || u.email!.toLowerCase() !== expected.toLowerCase())
    throw new AuctionError("Not found.", 404, "not_found");
  // Never authorize from editable user metadata, a URL token, or a browser-provided email.
  const { error: provisionError } = await db()
    .from("va_admins")
    .upsert({ user_id: u.id, role: "owner" }, { onConflict: "user_id" });
  if (provisionError) throw new AuctionError("Admin access unavailable.", 503);
  const { data } = await db()
    .from("va_admins")
    .select("role")
    .eq("user_id", u.id)
    .single();
  if (data?.role !== "owner")
    throw new AuctionError("Not found.", 404, "not_found");
  return u;
}
export async function auction() {
  const context = auctionRuntime();
  const { data, error } = await db()
    .from("va_auctions")
    .select("*")
    .eq("slug", context.slug)
    .eq("environment", context.environment)
    .single();
  if (error || !data) throw new AuctionError("Auction unavailable.", 503);
  return data;
}
export async function publicState(): Promise<PublicState> {
  const context = auctionRuntime();
  const { data, error } = await db()
    .from("va_public_state")
    .select(stateColumns)
    .eq("slug", context.slug)
    .eq("environment", context.environment)
    .single();
  if (error || !data) throw new AuctionError("Auction unavailable.", 503);
  return data as PublicState;
}
export function origin(request: Request) {
  const allowed = new URL(required("AUCTION_SITE_URL")).origin;
  if (request.headers.get("origin") !== allowed)
    throw new AuctionError("Request origin rejected.", 403);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new AuctionError("JSON required.", 415);
}
export async function body(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 16000)
    throw new AuctionError("Request too large.", 413);
  const raw = await request.text();
  if (raw.length > 16000) throw new AuctionError("Request too large.", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new AuctionError("Invalid JSON.");
  }
}
export async function rate(
  request: Request,
  action: string,
  identity?: string,
) {
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const hashed = createHmac("sha256", required("AUCTION_ABUSE_HMAC_KEY"))
    .update(ip)
    .digest("hex");
  const limits =
    action === "bid" ? [30, 60] : action === "setup" ? [6, 3600] : [12, 3600];
  for (const key of [
    `network:${hashed}`,
    ...(identity ? [`user:${identity}`] : []),
  ]) {
    const { data, error } = await db().rpc("va_rate_limit", {
      p_key: `${action}:${key}`,
      p_limit: limits[0],
      p_seconds: limits[1],
    });
    if (error) throw new AuctionError("Please try again later.", 503);
    if (!data)
      throw new AuctionError(
        "Too many attempts. Please wait and try again.",
        429,
        "rate_limited",
      );
  }
}
export async function verificationCooldown(email: string) {
  const key = createHmac("sha256", required("AUCTION_ABUSE_HMAC_KEY")).update(email.trim().toLowerCase()).digest("hex");
  const {data,error} = await db().rpc("va_rate_limit",{p_key:`verification:${key}`,p_limit:1,p_seconds:60});
  if(error) throw new AuctionError("Please try again later.",503);
  if(!data) throw new AuctionError("Wait 60 seconds before requesting another verification link.",429,"rate_limited");
}
export async function captcha(token: unknown, action: ChallengeAction) {
  const parsed = captchaTokenSchema.safeParse(token);
  if (!parsed.success) throw new AuctionError("Complete the security check.");
  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: required("AUCTION_TURNSTILE_SECRET"),
        response: parsed.data,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const checked = await result.json();
  if (
    !validChallengeResult(
      checked,
      new URL(required("AUCTION_SITE_URL")).hostname,
      action,
    )
  )
    throw new AuctionError("Security check failed. Please try again.");
}
export function operations(request: Request) {
  const expected = `Bearer ${required("AUCTION_OPERATIONS_SECRET")}`;
  const actual = request.headers.get("authorization") || "";
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    throw new AuctionError("Not found.", 404);
}
export function siteURL(path: string) {
  return new URL(path, required("AUCTION_SITE_URL")).toString();
}
export function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof AuctionError)
    return reply({ error: error.message, code: error.code }, error.status);
  if (error && typeof error === "object" && "issues" in error)
    return reply(
      { error: "Check the required fields and confirmations." },
      400,
    );
  console.error(
    "auction_request_failed",
    error instanceof Error ? error.name : "unknown",
  );
  return reply(
    { error: "We could not complete this request. Please try again." },
    503,
  );
}
export function ensure<T>(data: T | null, error: unknown): T {
  if (error || data === null)
    throw new AuctionError("We could not save this request.", 503);
  return data;
}
