import Stripe from "stripe";

// No secret configuration in this pure module; signature behavior is testable with the real SDK.
export function verifyStripeEvent(stripe: Stripe, payload: string, signature: string, secret: string, live: boolean): Stripe.Event {
  const event = stripe.webhooks.constructEvent(payload, signature, secret);
  if (event.livemode !== live || event.account) throw new Error("Unexpected Stripe account or mode");
  return event;
}
export function fulfillmentSession(event: Stripe.Event): Stripe.Checkout.Session | null {
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return null;
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid" || session.mode !== "payment" || !session.metadata?.wg_order_id) return null;
  if (session.client_reference_id !== session.metadata.wg_order_id) throw new Error("Order reference mismatch");
  return session;
}
