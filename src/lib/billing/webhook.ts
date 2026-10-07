import "server-only";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { billingDb } from "./server";
import {
  hostingPlans,
  invoicePriceIds,
  invoiceSubscriptionId,
  planByPaymentLink,
  planByPrice,
  serviceState,
  stripeId,
  subscriptionPeriod,
  subscriptionPriceId,
  unixISO,
} from "./model";

type Normalized = {
  customer?: Record<string, unknown> | null;
  subscription?: Record<string, unknown> | null;
  invoice?: Record<string, unknown> | null;
  notification?: Record<string, unknown> | null;
  objectId?: string | null;
};

const verifier = new Stripe(
  process.env.STRIPE_SECRET_KEY || "webhook-verification-only",
  { maxNetworkRetries: 0 },
);

function eventTime(event: Stripe.Event) {
  return new Date(event.created * 1000).toISOString();
}

function customerPayload(customerId: string, event: Stripe.Event, values: Record<string, unknown> = {}) {
  return {
    stripe_customer_id: customerId,
    last_event_id: event.id,
    last_event_created_at: eventTime(event),
    ...values,
  };
}

function baseNotification(plan: ReturnType<typeof planByPrice>, values: Record<string, unknown> = {}) {
  return {
    planCode: plan?.code || null,
    currency: plan?.currency || null,
    ...values,
  };
}

async function knownSubscriptionPlan(subscriptionId: string | null) {
  if (!subscriptionId) return null;
  const { data, error } = await billingDb()
    .from("va_billing_subscriptions")
    .select("plan_code,currency,stripe_price_id,unit_amount")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (error || !data) return null;
  const plan = planByPrice(data.stripe_price_id);
  return plan || {
    code: data.plan_code,
    currency: data.currency,
    priceId: data.stripe_price_id,
    unitAmount: data.unit_amount,
    paymentLinkId: "",
  };
}

function checkoutCustomer(session: Stripe.Checkout.Session, event: Stripe.Event) {
  const customerId = stripeId(session.customer);
  if (!customerId) return null;
  const details = session.customer_details as unknown as {
    email?: string | null;
    name?: string | null;
    business_name?: string | null;
    address?: { country?: string | null } | null;
  } | null;
  const s = session as unknown as { locale?: string | null };
  return customerPayload(customerId, event, {
    email: details?.email || null,
    full_name: details?.name || null,
    business_name: details?.business_name || null,
    country: details?.address?.country || null,
    locale: s.locale || null,
    last_checkout_session_id: session.id,
  });
}

function subscriptionNormalized(subscription: Stripe.Subscription, event: Stripe.Event) {
  const priceId = subscriptionPriceId(subscription);
  const plan = planByPrice(priceId);
  const customerId = stripeId(subscription.customer);
  if (!plan || !customerId) return null;
  const period = subscriptionPeriod(subscription);
  const item = subscription.items.data[0] as unknown as {
    price?: { recurring?: { interval?: string | null } };
    pricing?: { price_details?: { recurring?: { interval?: string | null } } };
  };
  const interval =
    item?.price?.recurring?.interval ||
    item?.pricing?.price_details?.recurring?.interval ||
    "month";
  return {
    plan,
    customer: customerPayload(customerId, event),
    subscription: {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      stripe_price_id: plan.priceId,
      plan_code: plan.code,
      currency: plan.currency,
      unit_amount: plan.unitAmount,
      billing_interval: interval,
      stripe_status: subscription.status,
      service_state: serviceState(subscription.status),
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: period.start,
      current_period_end: period.end,
      cancel_at: unixISO(subscription.cancel_at),
      canceled_at: unixISO(subscription.canceled_at),
      ended_at: unixISO(subscription.ended_at),
      latest_invoice_id: stripeId(subscription.latest_invoice),
    },
  };
}

async function normalize(event: Stripe.Event): Promise<Normalized> {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return { objectId: session.id };
    const paymentLinkId = stripeId(session.payment_link);
    const plan = planByPaymentLink(paymentLinkId);
    if (!plan) return { objectId: session.id };
    const customer = checkoutCustomer(session, event);
    const subscriptionId = stripeId(session.subscription);
    return {
      objectId: session.id,
      customer,
      notification:
        event.type === "checkout.session.completed"
          ? {
              kind: "billing_subscription_started",
              ...baseNotification(plan, {
                stripeSubscriptionId: subscriptionId,
                customerEmail: customer?.email || null,
                customerName: customer?.full_name || null,
                businessName: customer?.business_name || null,
                stripeStatus: session.status,
              }),
            }
          : null,
    };
  }

  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    const normalized = subscriptionNormalized(subscription, event);
    if (!normalized) return { objectId: subscription.id };

    const previous = (event.data as unknown as { previous_attributes?: Record<string, unknown> })
      .previous_attributes || {};
    let notification: Record<string, unknown> | null = null;
    if (event.type === "customer.subscription.deleted") {
      notification = {
        kind: "billing_subscription_canceled",
        ...baseNotification(normalized.plan, {
          stripeSubscriptionId: subscription.id,
          stripeStatus: subscription.status,
          serviceState: serviceState(subscription.status),
          currentPeriodEnd: normalized.subscription.current_period_end,
        }),
      };
    } else if (
      event.type === "customer.subscription.updated" &&
      subscription.cancel_at_period_end &&
      previous.cancel_at_period_end === false
    ) {
      notification = {
        kind: "billing_cancel_scheduled",
        ...baseNotification(normalized.plan, {
          stripeSubscriptionId: subscription.id,
          stripeStatus: subscription.status,
          currentPeriodEnd: normalized.subscription.current_period_end,
        }),
      };
    } else if (event.type === "customer.subscription.paused") {
      notification = {
        kind: "billing_subscription_paused",
        ...baseNotification(normalized.plan, {
          stripeSubscriptionId: subscription.id,
          stripeStatus: subscription.status,
        }),
      };
    } else if (event.type === "customer.subscription.resumed") {
      notification = {
        kind: "billing_subscription_resumed",
        ...baseNotification(normalized.plan, {
          stripeSubscriptionId: subscription.id,
          stripeStatus: subscription.status,
        }),
      };
    }
    return {
      objectId: subscription.id,
      customer: normalized.customer,
      subscription: normalized.subscription,
      notification,
    };
  }

  if (event.type.startsWith("invoice.")) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    let plan = invoicePriceIds(invoice).map(planByPrice).find(Boolean) || null;
    if (!plan) plan = await knownSubscriptionPlan(subscriptionId);
    if (!plan) return { objectId: invoice.id };

    const customerId = stripeId(invoice.customer);
    const invoiceAny = invoice as unknown as {
      number?: string | null;
      billing_reason?: string | null;
      status?: string | null;
      currency?: string | null;
      amount_due?: number;
      amount_paid?: number;
      amount_remaining?: number;
      attempt_count?: number;
      next_payment_attempt?: number | null;
      status_transitions?: { paid_at?: number | null };
      customer_email?: string | null;
      customer_name?: string | null;
    };

    const customer = customerId
      ? customerPayload(customerId, event, {
          email: invoiceAny.customer_email || null,
          full_name: invoiceAny.customer_name || null,
        })
      : null;

    const normalizedInvoice = {
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      invoice_number: invoiceAny.number || null,
      billing_reason: invoiceAny.billing_reason || null,
      stripe_status: invoiceAny.status || null,
      currency: invoiceAny.currency || plan.currency,
      amount_due: invoiceAny.amount_due || 0,
      amount_paid: invoiceAny.amount_paid || 0,
      amount_remaining: invoiceAny.amount_remaining || 0,
      attempt_count: invoiceAny.attempt_count || 0,
      next_payment_attempt: unixISO(invoiceAny.next_payment_attempt),
      paid_at: unixISO(invoiceAny.status_transitions?.paid_at),
    };

    let notification: Record<string, unknown> | null = null;
    if (
      event.type === "invoice.paid" &&
      invoiceAny.billing_reason !== "subscription_create"
    ) {
      notification = {
        kind: "billing_payment_paid",
        ...baseNotification(plan, {
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: invoice.id,
          customerEmail: invoiceAny.customer_email || null,
          customerName: invoiceAny.customer_name || null,
          amountPaid: normalizedInvoice.amount_paid,
          stripeStatus: invoiceAny.status,
        }),
      };
    } else if (event.type === "invoice.payment_failed") {
      notification = {
        kind: "billing_payment_failed",
        ...baseNotification(plan, {
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: invoice.id,
          customerEmail: invoiceAny.customer_email || null,
          customerName: invoiceAny.customer_name || null,
          amountDue: normalizedInvoice.amount_due,
          stripeStatus: invoiceAny.status,
          nextPaymentAttempt: normalizedInvoice.next_payment_attempt,
        }),
      };
    } else if (event.type === "invoice.payment_action_required") {
      notification = {
        kind: "billing_action_required",
        ...baseNotification(plan, {
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: invoice.id,
          customerEmail: invoiceAny.customer_email || null,
          customerName: invoiceAny.customer_name || null,
          amountDue: normalizedInvoice.amount_due,
          stripeStatus: invoiceAny.status,
        }),
      };
    } else if (event.type === "invoice.marked_uncollectible") {
      notification = {
        kind: "billing_invoice_uncollectible",
        ...baseNotification(plan, {
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: invoice.id,
          customerEmail: invoiceAny.customer_email || null,
          customerName: invoiceAny.customer_name || null,
          amountDue: normalizedInvoice.amount_due,
          stripeStatus: invoiceAny.status,
        }),
      };
    }

    return {
      objectId: invoice.id,
      customer,
      invoice: normalizedInvoice,
      notification,
    };
  }

  return {};
}

export async function processBillingWebhook(raw: string, signature: string, secret: string) {
  let event: Stripe.Event;
  try {
    event = verifier.webhooks.constructEvent(raw, signature, secret);
  } catch {
    throw new Error("Invalid Stripe webhook signature.");
  }
  if (!event.livemode) throw new Error("Billing webhook requires LIVE Stripe events.");

  const normalized = await normalize(event);
  const payloadHash = createHash("sha256").update(raw).digest("hex");
  const { data, error } = await billingDb().rpc("va_billing_apply_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_object_id: normalized.objectId || null,
    p_event_created_at: eventTime(event),
    p_api_version: event.api_version || "",
    p_livemode: event.livemode,
    p_payload_sha256: payloadHash,
    p_customer: normalized.customer || null,
    p_subscription: normalized.subscription || null,
    p_invoice: normalized.invoice || null,
    p_notification: normalized.notification || null,
  });
  if (error) throw new Error(`Billing ledger update failed: ${error.code || "database_error"}`);
  return { received: true, result: data, eventId: event.id };
}
