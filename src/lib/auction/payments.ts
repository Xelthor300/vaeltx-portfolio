import "server-only";
import Stripe from "stripe";
import { auction, AuctionError, db, ensure, siteURL } from "./server";

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  const mode = process.env.AUCTION_STRIPE_MODE || "test";
  if (
    !key ||
    !["test", "live"].includes(mode) ||
    !key.startsWith(mode === "live" ? "sk_live_" : "sk_test_")
  )
    throw new AuctionError("Payments are being configured.", 503);
  return new Stripe(key, { maxNetworkRetries: 2 });
}
export async function verifiedStripe() {
  const s = stripe();
  const account = await s.accounts.retrieve(null);
  if (
    account.id !== process.env.STRIPE_ACCOUNT_ID ||
    !account.charges_enabled ||
    !account.details_submitted
  )
    throw new AuctionError("Payment account unavailable.", 503);
  return s;
}
export async function setupCard(userId: string) {
  const a = await auction();
  if (
    a.status !== "active" ||
    a.environment !== "production" ||
    process.env.AUCTION_STRIPE_MODE !== "live"
  )
    throw new AuctionError(
      "Card verification opens when the auction starts.",
      409,
    );
  const { data: p, error } = await db()
    .from("va_participants")
    .select("*")
    .eq("id", userId)
    .single();
  ensure(p, error);
  if (p.status !== "eligible" || p.terms_version !== a.terms_version)
    throw new AuctionError("Complete your bidder profile first.", 409);
  const s = await verifiedStripe();
  let customer = p.stripe_customer_id as string | null;
  if (!customer) {
    const created = await s.customers.create(
      {
        email: p.email,
        name: p.full_name,
        metadata: { auction_participant: userId },
      },
      { idempotencyKey: `va-customer:${userId}` },
    );
    customer = created.id;
    const saved = await db()
      .from("va_participants")
      .update({ stripe_customer_id: customer })
      .eq("id", userId);
    ensure(true, saved.error);
  }
  const { data: pending } = await db()
    .from("va_payment_setups")
    .select("*")
    .eq("participant_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pending?.session_id) {
    const old = await s.checkout.sessions.retrieve(pending.session_id);
    if (old.status === "open" && old.url) return { url: old.url };
    if (old.status === "complete")
      throw new AuctionError(
        "Verification is being confirmed. Refresh your account shortly.",
        409,
      );
    await db()
      .from("va_payment_setups")
      .update({ status: "expired" })
      .eq("id", pending.id);
  }
  const record = ensure(
    ...asResult(
      await db()
        .from("va_payment_setups")
        .insert({ participant_id: userId, customer_id: customer, mode: "live" })
        .select()
        .single(),
    ),
  );
  const session = await s.checkout.sessions.create(
    {
      mode: "setup",
      currency: "usd",
      customer,
      allowed_payment_method_types: ["card"],
      setup_intent_data: { metadata: { auction_setup: record.id } },
      metadata: { auction_setup: record.id },
      success_url: siteURL("/website-auction/account?verification=returned"),
      cancel_url: siteURL("/website-auction/account"),
      custom_text: {
        submit: {
          message:
            "Verify a card to bid. No bidding fee. Winning bidders pay separately after the auction closes.",
        },
      },
    },
    { idempotencyKey: `va-setup:${record.id}` },
  );
  ensure(
    true,
    (
      await db()
        .from("va_payment_setups")
        .update({ session_id: session.id })
        .eq("id", record.id)
    ).error,
  );
  return { url: session.url };
}
function asResult<T>(result: { data: T; error: unknown }): [T, unknown] {
  return [result.data, result.error];
}
export async function checkoutWinner(userId: string, winnerId: string) {
  const s = await verifiedStripe();
  const result = await db().rpc("va_reserve_checkout", {
    p_winner: winnerId,
    p_user: userId,
  });
  if (result.error)
    throw new AuctionError(
      "This payment offer is unavailable or has expired.",
      409,
    );
  const w = result.data;
  const { data: p } = await db()
    .from("va_participants")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();
  if (!p?.stripe_customer_id)
    throw new AuctionError("Verified payment profile required.", 409);
  const a = await auction();
  if (
    (a.environment === "production") !==
    (process.env.AUCTION_STRIPE_MODE === "live")
  )
    throw new AuctionError("Payment environment unavailable.", 503);
  if (w.checkout_session_id) {
    const old = await s.checkout.sessions.retrieve(w.checkout_session_id);
    if (old.status === "open" && old.url) return { url: old.url };
    throw new AuctionError(
      "Payment is being confirmed or the checkout has expired.",
      409,
    );
  }
  const session = await s.checkout.sessions.create(
    {
      mode: "payment",
      customer: p.stripe_customer_id,
      allowed_payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: w.amount,
            product_data: {
              name: "VAELTX custom website service",
              description:
                "Winning website auction offer · agreed scope and terms",
            },
          },
        },
      ],
      metadata: { auction_winner: w.id },
      payment_intent_data: { metadata: { auction_winner: w.id } },
      // Stripe requires at least 30 minutes. The service deadline remains immutable;
      // scheduler expiry and verified Charge.created enforce it even in the final minute.
      expires_at: Math.floor(Date.parse(w.checkout_expires_at) / 1000),
      success_url: siteURL("/website-auction/payment?payment=returned"),
      cancel_url: siteURL("/website-auction/payment"),
    },
    { idempotencyKey: `va-winner:${w.id}` },
  );
  ensure(
    true,
    (
      await db()
        .from("va_winners")
        .update({ checkout_session_id: session.id, checkout_state: "open" })
        .eq("id", w.id)
        .eq("status", "pending")
    ).error,
  );
  return { url: session.url };
}
export async function processEvent(event: Stripe.Event, s: Stripe) {
  const mode = event.livemode ? "live" : "test";
  if (mode !== (process.env.AUCTION_STRIPE_MODE || "test"))
    throw new AuctionError("Webhook environment mismatch.", 400);
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
    ].includes(event.type)
  )
    return;
  const session = event.data.object as Stripe.Checkout.Session;
  const setupId = session.metadata?.auction_setup;
  if (setupId) {
    const { data: record } = await db()
      .from("va_payment_setups")
      .select("*")
      .eq("id", setupId)
      .single();
    if (
      !record ||
      record.session_id !== session.id ||
      record.customer_id !== session.customer ||
      record.mode !== mode ||
      session.mode !== "setup"
    )
      throw new AuctionError("Setup ownership mismatch.", 400);
    if (event.type === "checkout.session.expired") {
      await db()
        .from("va_payment_setups")
        .update({ status: "expired" })
        .eq("id", record.id)
        .eq("status", "pending");
      return;
    }
    if (
      session.status !== "complete" ||
      typeof session.setup_intent !== "string"
    )
      throw new AuctionError("Setup incomplete.", 400);
    const intent = await s.setupIntents.retrieve(session.setup_intent);
    if (
      intent.status !== "succeeded" ||
      intent.customer !== record.customer_id ||
      typeof intent.payment_method !== "string" ||
      intent.livemode !== event.livemode
    )
      throw new AuctionError("Setup verification mismatch.", 400);
    const pm = await s.paymentMethods.retrieve(intent.payment_method);
    if (pm.customer !== record.customer_id || pm.type !== "card")
      throw new AuctionError("Payment method mismatch.", 400);
    const result = await db().rpc("va_record_setup", {
      p_event: event.id,
      p_setup: record.id,
      p_intent: intent.id,
      p_method: pm.id,
      p_mode: mode,
    });
    ensure(true, result.error);
    return;
  }
  const winnerId = session.metadata?.auction_winner;
  if (!winnerId) return;
  const { data: w } = await db()
    .from("va_winners")
    .select("*")
    .eq("id", winnerId)
    .single();
  if (!w || w.checkout_session_id !== session.id || session.mode !== "payment")
    throw new AuctionError("Checkout ownership mismatch.", 400);
  const { data: p } = await db()
    .from("va_participants")
    .select("stripe_customer_id")
    .eq("id", w.participant_id)
    .single();
  if (p?.stripe_customer_id !== session.customer)
    throw new AuctionError("Customer mismatch.", 400);
  if (event.type === "checkout.session.expired") {
    ensure(
      true,
      (
        await db()
          .from("va_winners")
          .update({ checkout_state: "expired" })
          .eq("id", w.id)
          .eq("status", "pending")
      ).error,
    );
    await db().rpc("va_expire_winner", { p_winner: w.id });
    return;
  }
  if (
    session.payment_status !== "paid" ||
    typeof session.payment_intent !== "string"
  )
    return;
  const intent = await s.paymentIntents.retrieve(session.payment_intent);
  if (
    intent.status !== "succeeded" ||
    intent.amount_received !== w.amount ||
    intent.currency !== "usd" ||
    intent.customer !== session.customer ||
    intent.livemode !== event.livemode
  )
    throw new AuctionError("Paid amount mismatch.", 400);
  if (typeof intent.latest_charge !== "string")
    throw new AuctionError("Payment receipt missing.", 400);
  const charge = await s.charges.retrieve(intent.latest_charge);
  if (
    !charge.paid ||
    charge.payment_intent !== intent.id ||
    charge.amount !== w.amount ||
    charge.currency !== "usd" ||
    charge.livemode !== event.livemode
  )
    throw new AuctionError("Charge receipt mismatch.", 400);
  const result = await db().rpc("va_record_payment", {
    p_event: event.id,
    p_winner: w.id,
    p_session: session.id,
    p_intent: intent.id,
    p_amount: session.amount_total,
    p_currency: session.currency,
    p_mode: mode,
    p_paid_at: new Date(charge.created * 1000).toISOString(),
  });
  ensure(true, result.error);
}
