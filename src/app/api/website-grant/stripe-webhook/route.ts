import Stripe from "stripe";
import { grantDatabase } from "@/lib/website-grant-server";
import { fulfillmentSession, verifyStripeEvent } from "@/lib/website-grant-payments";
import { flushGrantEmails } from "@/lib/website-grant-email";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY, secret = process.env.STRIPE_WEBHOOK_SECRET, signature = request.headers.get("stripe-signature");
  if (!key || !secret || !signature) return Response.json({ ok: false }, { status: 400 });
  const payload = await request.text();
  if (payload.length > 250000) return Response.json({ ok: false }, { status: 413 });
  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try { event = verifyStripeEvent(stripe, payload, signature, secret, process.env.GRANT_STRIPE_MODE === "live"); }
  catch { return Response.json({ ok: false }, { status: 400 }); }
  try {
    const db = grantDatabase(), session = fulfillmentSession(event);
    if (session) {
      const { data: order, error: orderError } = await db.from("wg_orders").select("kind").eq("id",session.metadata!.wg_order_id).single();
      if (orderError || !order) throw new Error("order_unavailable");
      if (order.kind === "entries" && (event.livemode || process.env.VERCEL_ENV === "production")) throw new Error("paid_entries_blocked");
      const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!intent || session.amount_total === null || !session.currency) throw new Error("missing_payment_fields");
      const { error } = await db.rpc("wg_fulfill_payment", { p_event: event.id, p_type: event.type, p_order: session.metadata!.wg_order_id, p_session: session.id, p_intent: intent, p_amount: session.amount_total, p_currency: session.currency, p_paid_at: new Date(event.created * 1000).toISOString() });
      if (error) throw error;
      await flushGrantEmails();
    } else if (["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) {
      const object = event.data.object as Stripe.Checkout.Session;
      const { error } = await db.from("wg_orders").update({ status: event.type.endsWith("expired") ? "expired" : "failed" }).eq("stripe_session_id", object.id).eq("status", "pending");
      if (error) throw error;
    } else if (["charge.refunded", "charge.dispute.created"].includes(event.type)) {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute;
      const intent = typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id;
      if (intent) {
        const { error } = await db.rpc("wg_reverse_payment", { p_event: event.id, p_type: event.type, p_intent: intent, p_status: event.type === "charge.refunded" ? ((object as Stripe.Charge).refunded ? "refunded" : "review") : "disputed" });
        if (error) throw error;
      }
    }
    console.info(JSON.stringify({ system: "website-grant", action: "webhook_processed", type: event.type }));
    return Response.json({ ok: true });
  } catch {
    console.error(JSON.stringify({ system: "website-grant", action: "webhook_retry_required", type: event.type }));
    return Response.json({ ok: false }, { status: 500 });
  }
}
