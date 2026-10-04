// Read-only configuration/evidence check. Does not send email, bid or activate.
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.AUCTION_SITE_URL;
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const a = await db
  .from("va_auctions")
  .select(
    "id,status,environment,starts_at,original_ends_at,ends_at,activation_checks",
  )
  .eq("environment", "production")
  .single();
if (a.error) throw new Error("Production auction read failed.");
const settings = await fetch(process.env.SUPABASE_URL + "/auth/v1/settings", {
  headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY },
});
const auth = await settings.json();
const publicState = await (
  await fetch(base + "/api/website-auction/state")
).json();
const direct = await fetch(process.env.SUPABASE_URL + "/auth/v1/otp", {
  method: "POST",
  headers: {
    apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    email: process.env.AUCTION_SMTP_USER,
    create_user: false,
  }),
});
const rejected = await direct.json();
const report = {
  at: new Date().toISOString(),
  production: a.data,
  publicState: publicState.state,
  activationAllowed: process.env.AUCTION_ALLOW_ACTIVATION === "true",
  stripeMode: process.env.AUCTION_STRIPE_MODE,
  smtp: {
    transport: process.env.AUCTION_EMAIL_TRANSPORT,
    host: process.env.AUCTION_SMTP_HOST,
    port: process.env.AUCTION_SMTP_PORT,
    sender: process.env.AUCTION_EMAIL_FROM,
    passwordConfigured: /^[A-Za-z0-9]{16}$/.test(
      (process.env.AUCTION_SMTP_PASSWORD || "").replace(/\s/g, ""),
    ),
    mailboxReceiptVerified: false,
  },
  auth: {
    httpStatus: settings.status,
    emailAutoConfirm: auth.mailer_autoconfirm,
    directRequestWithoutCaptcha: {
      status: direct.status,
      code: rejected.error_code || rejected.code,
      message: rejected.msg || rejected.message,
    },
  },
  emailSent: false,
};
if (
  report.activationAllowed ||
  a.data.status !== "ready_for_activation" ||
  a.data.starts_at ||
  a.data.original_ends_at ||
  a.data.ends_at ||
  report.stripeMode !== "test"
)
  throw new Error("Preparation invariant changed.");
if (
  direct.status < 400 ||
  !JSON.stringify(rejected).toLowerCase().includes("captcha")
)
  throw new Error("Direct Supabase Auth CAPTCHA guard was not proved.");
await mkdir("output/auction-qa", { recursive: true });
await writeFile(
  "output/auction-qa/preflight.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
