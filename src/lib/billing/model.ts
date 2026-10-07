import type Stripe from "stripe";

export type HostingPlan = {
  code: "hosting_care_us" | "hosting_care_mx";
  currency: "usd" | "mxn";
  unitAmount: number;
  priceId: string;
  paymentLinkId: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing billing configuration: ${name}`);
  return value;
}

export function hostingPlans(): HostingPlan[] {
  return [
    {
      code: "hosting_care_us",
      currency: "usd",
      unitAmount: 3900,
      priceId: required("VAELTX_HOSTING_US_PRICE_ID"),
      paymentLinkId: required("VAELTX_HOSTING_US_PAYMENT_LINK_ID"),
    },
    {
      code: "hosting_care_mx",
      currency: "mxn",
      unitAmount: 69900,
      priceId: required("VAELTX_HOSTING_MX_PRICE_ID"),
      paymentLinkId: required("VAELTX_HOSTING_MX_PAYMENT_LINK_ID"),
    },
  ];
}

export function planByPrice(priceId: string | null | undefined) {
  if (!priceId) return null;
  return hostingPlans().find((plan) => plan.priceId === priceId) || null;
}

export function planByPaymentLink(id: string | null | undefined) {
  if (!id) return null;
  return hostingPlans().find((plan) => plan.paymentLinkId === id) || null;
}

export function serviceState(status: string) {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "grace";
    case "incomplete":
      return "pending";
    case "paused":
    case "unpaid":
      return "suspended";
    case "canceled":
    case "incomplete_expired":
      return "ended";
    default:
      return "review";
  }
}

export function stripeId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export function unixISO(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

export function subscriptionPriceId(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] as unknown as {
    price?: { id?: string };
    pricing?: { price_details?: { price?: string; price_id?: string } };
  };
  return (
    item?.price?.id ||
    item?.pricing?.price_details?.price ||
    item?.pricing?.price_details?.price_id ||
    null
  );
}

export function subscriptionPeriod(subscription: Stripe.Subscription) {
  const s = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
    items?: {
      data?: Array<{
        current_period_start?: number;
        current_period_end?: number;
      }>;
    };
  };
  const item = s.items?.data?.[0];
  return {
    start: unixISO(s.current_period_start ?? item?.current_period_start),
    end: unixISO(s.current_period_end ?? item?.current_period_end),
  };
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const i = invoice as unknown as {
    subscription?: unknown;
    parent?: {
      subscription_details?: {
        subscription?: unknown;
      };
    };
  };
  return (
    stripeId(i.subscription) ||
    stripeId(i.parent?.subscription_details?.subscription)
  );
}

export function invoicePriceIds(invoice: Stripe.Invoice) {
  const ids = new Set<string>();
  for (const raw of invoice.lines?.data || []) {
    const line = raw as unknown as {
      price?: { id?: string };
      pricing?: { price_details?: { price?: string; price_id?: string } };
    };
    const id =
      line.price?.id ||
      line.pricing?.price_details?.price ||
      line.pricing?.price_details?.price_id;
    if (id) ids.add(id);
  }
  return [...ids];
}

export function dashboardURL(subscriptionId?: string | null, invoiceId?: string | null) {
  if (subscriptionId && /^sub_[A-Za-z0-9]+$/.test(subscriptionId))
    return `https://dashboard.stripe.com/subscriptions/${subscriptionId}`;
  if (invoiceId && /^in_[A-Za-z0-9]+$/.test(invoiceId))
    return `https://dashboard.stripe.com/invoices/${invoiceId}`;
  return "https://dashboard.stripe.com/subscriptions";
}

export function checkoutPaymentConfirmed(eventName: string, paymentStatus: string | null | undefined) {
  return (
    eventName === "checkout.session.async_payment_succeeded" ||
    (eventName === "checkout.session.completed" &&
      (paymentStatus === "paid" || paymentStatus === "no_payment_required"))
  );
}
