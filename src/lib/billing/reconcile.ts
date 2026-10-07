import "server-only";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { billingDb } from "./server";
import {
  hostingPlans,
  serviceState,
  stripeId,
  subscriptionPeriod,
  subscriptionPriceId,
} from "./model";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing billing configuration: ${name}`);
  return value;
}

async function liveStripe() {
  const key = (
    process.env.VAELTX_BILLING_STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    ""
  ).trim();
  if (!(key.startsWith("sk_live_") || key.startsWith("rk_live_"))) return null;
  const stripe = new Stripe(key, { maxNetworkRetries: 2 });
  const account = await stripe.accounts.retrieve(null);
  if (
    account.id !== required("STRIPE_ACCOUNT_ID") ||
    !account.charges_enabled ||
    !account.details_submitted
  )
    throw new Error("Stripe account verification failed.");
  return stripe;
}

function interval(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] as unknown as {
    price?: { recurring?: { interval?: string | null } };
    pricing?: { price_details?: { recurring?: { interval?: string | null } } };
  };
  return (
    item?.price?.recurring?.interval ||
    item?.pricing?.price_details?.recurring?.interval ||
    "month"
  );
}

function reconciliationKey(subscription: Stripe.Subscription) {
  const period = subscriptionPeriod(subscription);
  const value = JSON.stringify({
    id: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    periodEnd: period.end,
    latestInvoice: stripeId(subscription.latest_invoice),
    price: subscriptionPriceId(subscription),
  });
  return createHash("sha256").update(value).digest("hex");
}

export async function reconcileManagedBilling() {
  const db = billingDb();
  const stripe = await liveStripe();

  if (!stripe) {
    const { count, error } = await db
      .from("va_billing_subscriptions")
      .select("stripe_subscription_id", { count: "exact", head: true })
      .in("service_state", ["active", "grace", "pending", "suspended", "review"]);
    if (error) throw new Error("Could not inspect tracked subscription count.");

    const tracked = count || 0;
    if (tracked > 0) {
      const dateKey = new Date().toISOString().slice(0, 10);
      const { error: warningError } = await db.from("va_outbox").upsert(
        {
          dedupe_key: `billing:reconcile-key-pending:${dateKey}`,
          kind: "billing_reconciliation_configuration_pending",
          audience: "owner",
          participant_id: null,
          payload: {
            trackedSubscriptions: tracked,
            checkedAt: new Date().toISOString(),
          },
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      );
      if (warningError)
        throw new Error("Could not queue reconciliation configuration warning.");
    }

    return {
      ok: true,
      mode: "webhook_only",
      configurationPending: "live_stripe_read_key",
      tracked,
      matched: 0,
      processed: 0,
      duplicates: 0,
      missing: 0,
    };
  }

  const plans = hostingPlans();
  const planByPrice = new Map(plans.map((plan) => [plan.priceId, plan]));
  const seen = new Set<string>();
  let matched = 0;
  let processed = 0;
  let duplicates = 0;

  for await (const subscription of stripe.subscriptions.list({
    status: "all",
    limit: 100,
  })) {
    const priceId = subscriptionPriceId(subscription);
    const plan = priceId ? planByPrice.get(priceId) : null;
    if (!plan) continue;

    const customerId = stripeId(subscription.customer);
    if (!customerId)
      throw new Error(`Stripe subscription ${subscription.id} has no customer id.`);

    matched += 1;
    seen.add(subscription.id);
    const period = subscriptionPeriod(subscription);
    const stateHash = reconciliationKey(subscription);
    const eventId = `reconcile:subscription:${subscription.id}:${stateHash.slice(0, 32)}`;
    const now = new Date().toISOString();
    const payloadHash = createHash("sha256")
      .update(`${subscription.id}:${stateHash}`)
      .digest("hex");

    const { data, error } = await db.rpc("va_billing_apply_event", {
      p_event_id: eventId,
      p_event_type: "vaeltx.billing.reconcile.subscription",
      p_object_id: subscription.id,
      p_event_created_at: now,
      p_api_version: "server_reconcile",
      p_livemode: true,
      p_payload_sha256: payloadHash,
      p_customer: {
        stripe_customer_id: customerId,
        last_event_id: eventId,
        last_event_created_at: now,
      },
      p_subscription: {
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        stripe_price_id: plan.priceId,
        plan_code: plan.code,
        currency: plan.currency,
        unit_amount: plan.unitAmount,
        billing_interval: interval(subscription),
        stripe_status: subscription.status,
        service_state: serviceState(subscription.status),
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_start: period.start,
        current_period_end: period.end,
        cancel_at:
          typeof subscription.cancel_at === "number"
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : null,
        canceled_at:
          typeof subscription.canceled_at === "number"
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
        ended_at:
          typeof subscription.ended_at === "number"
            ? new Date(subscription.ended_at * 1000).toISOString()
            : null,
        latest_invoice_id: stripeId(subscription.latest_invoice),
      },
      p_invoice: null,
      p_notification: null,
    });
    if (error)
      throw new Error(
        `Managed billing reconciliation failed for ${subscription.id}: ${error.code || "database_error"}`,
      );
    if (data === "duplicate") duplicates += 1;
    else processed += 1;
  }

  const { data: tracked, error: trackedError } = await db
    .from("va_billing_subscriptions")
    .select("stripe_subscription_id,service_state")
    .in("service_state", ["active", "grace", "pending", "suspended", "review"]);
  if (trackedError)
    throw new Error("Could not verify tracked subscription coverage.");

  const missing = (tracked || [])
    .map((item) => item.stripe_subscription_id as string)
    .filter((id) => !seen.has(id));

  if (missing.length) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const { error } = await db.from("va_outbox").upsert(
      {
        dedupe_key: `billing:reconcile-missing:${dateKey}`,
        kind: "billing_reconciliation_warning",
        audience: "owner",
        participant_id: null,
        payload: {
          missingSubscriptions: missing.slice(0, 50),
          missingCount: missing.length,
          checkedAt: new Date().toISOString(),
        },
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    if (error) throw new Error("Could not queue reconciliation warning.");
  }

  return {
    ok: true,
    matched,
    processed,
    duplicates,
    missing: missing.length,
  };
}
