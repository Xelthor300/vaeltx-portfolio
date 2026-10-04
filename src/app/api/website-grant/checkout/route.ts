import Stripe from "stripe";
import { checkoutSchema } from "@/lib/website-grant";
import { grantDatabase, grantFailure, GrantError, bodyJson, databaseResult, ensureOrigin, openCampaign, takeRateLimit, verifiedAccount } from "@/lib/website-grant-server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    ensureOrigin(request);
    const user = await verifiedAccount(), campaign = await openCampaign();
    await takeRateLimit("checkout", user.id, 15, 600);
    const parsed = checkoutSchema.safeParse(await bodyJson(request, 2000));
    if (!parsed.success) throw new GrantError(400, "Select an available package and currency.");
    const choice = parsed.data;
    const key = process.env.STRIPE_SECRET_KEY, live = process.env.GRANT_STRIPE_MODE === "live";
    // Prize-linked entry sales have no verified legal/provider clearance for this campaign.
    // The live-entry block is deliberate; a config toggle is not approval evidence.
    if (choice.kind === "entries" && (live || process.env.VERCEL_ENV === "production")) throw new GrantError(409, "Additional entry purchases await legal and payment-provider clearance.");
    if (!key || !process.env.STRIPE_ACCOUNT_ID || !process.env.STRIPE_WEBHOOK_SECRET) throw new GrantError(503, "Payments are not available yet.");
    if (!/^[sr]k_(live|test)_/.test(key) || key.includes("_live_") !== live || (live && process.env.VERCEL_ENV !== "production")) throw new GrantError(503, "Payment configuration is not ready.");
    const stripe = new Stripe(key);
    const account = await stripe.accounts.retrieve(null);
    if (account.id !== process.env.STRIPE_ACCOUNT_ID) throw new GrantError(503, "Payment configuration is not ready.");
    const db = grantDatabase();
    const { data: order, error } = await db.rpc("wg_create_order", { p_campaign: campaign.id, p_user: user.id, p_kind: choice.kind, p_code: choice.code, p_currency: choice.currency, p_quantity: choice.quantity, p_request: choice.requestId });
    databaseResult(error);
    if (order.status !== "pending") throw new GrantError(409, "This purchase has already been processed. Start a new purchase.");
    if (order.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      if (existing.status === "open" && existing.url) return Response.json({ ok: true, url: existing.url });
      throw new GrantError(409, "This checkout has ended. Start a new purchase.");
    }
    const expiry = Math.floor(Date.parse(order.created_at) / 1000) + 1860;
    if (expiry < Math.floor(Date.now() / 1000) + 1800) throw new GrantError(409, "This checkout attempt expired. Start a new purchase.");
    const origin = new URL(request.url).origin;
    // Derived from the persisted order, never a client-provided amount.
    const session = await stripe.checkout.sessions.create({
      mode: "payment", client_reference_id: order.id, customer_email: user.email,
      integration_identifier: `vaeltx-grant-${Array.from(createHash("sha256").update(order.id).digest().subarray(0,8), b => String.fromCharCode(97 + b % 26)).join("")}`,
      metadata: { wg_order_id: order.id }, payment_intent_data: { metadata: { wg_order_id: order.id } },
      line_items: [{ price_data: { currency: order.currency.toLowerCase(), unit_amount: order.amount_minor, product_data: { name: order.kind === "entries" ? `${order.quantity} VAELTX campaign entries` : `VAELTX ${order.code.replaceAll("-", " ")}` } }, quantity: 1 }],
      adaptive_pricing: { enabled: false },
      success_url: `${origin}/website-grant/entry?checkout=returned`, cancel_url: `${origin}/website-grant/entry?checkout=cancelled`,
      expires_at: expiry,
    }, { idempotencyKey: `wg-checkout/${order.id}` });
    const { error: linkError } = await db.from("wg_orders").update({ stripe_session_id: session.id }).eq("id", order.id).or(`stripe_session_id.is.null,stripe_session_id.eq.${session.id}`);
    databaseResult(linkError);
    if (!session.url) throw new GrantError(503, "Checkout could not be opened. Retry safely.");
    console.info(JSON.stringify({ system: "website-grant", action: "checkout_created", kind: order.kind }));
    return Response.json({ ok: true, url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return grantFailure(error); }
}
