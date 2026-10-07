import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { admin } from "@/lib/auction/server";
import { billingDb } from "@/lib/billing/server";
import "./managed-hosting.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Managed Hosting · Private operations",
  robots: { index: false, follow: false },
};

type SubscriptionRow = {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  plan_code: string;
  currency: string;
  unit_amount: number;
  stripe_status: string;
  service_state: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  latest_invoice_id: string | null;
  updated_at: string;
};

type CustomerRow = {
  stripe_customer_id: string;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  country: string | null;
};

type InvoiceRow = {
  stripe_invoice_id: string;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  attempt_count: number;
  next_payment_attempt: string | null;
  paid_at: string | null;
  updated_at: string;
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "mxn" ? "es-MX" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Ciudad_Juarez",
  }).format(new Date(value));
}

function customerName(customer?: CustomerRow) {
  return customer?.business_name || customer?.full_name || customer?.email || "Cliente Stripe";
}

function stripeSubscriptionURL(id: string) {
  return `https://dashboard.stripe.com/subscriptions/${encodeURIComponent(id)}`;
}

export default async function Page() {
  try {
    await admin();
  } catch {
    notFound();
  }

  const db = billingDb();
  const [subscriptionsResult, customersResult, invoicesResult] = await Promise.all([
    db
      .from("va_billing_subscriptions")
      .select("stripe_subscription_id,stripe_customer_id,plan_code,currency,unit_amount,stripe_status,service_state,cancel_at_period_end,current_period_end,latest_invoice_id,updated_at")
      .order("updated_at", { ascending: false })
      .limit(250),
    db
      .from("va_billing_customers")
      .select("stripe_customer_id,email,full_name,business_name,country")
      .limit(500),
    db
      .from("va_billing_invoices")
      .select("stripe_invoice_id,stripe_subscription_id,stripe_status,amount_due,amount_paid,amount_remaining,attempt_count,next_payment_attempt,paid_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  if (subscriptionsResult.error || customersResult.error || invoicesResult.error)
    throw new Error("Managed Hosting billing data is temporarily unavailable.");

  const subscriptions = (subscriptionsResult.data || []) as SubscriptionRow[];
  const customers = (customersResult.data || []) as CustomerRow[];
  const invoices = (invoicesResult.data || []) as InvoiceRow[];
  const customerById = new Map(customers.map((item) => [item.stripe_customer_id, item]));
  const latestInvoiceBySubscription = new Map<string, InvoiceRow>();
  for (const invoice of invoices) {
    if (invoice.stripe_subscription_id && !latestInvoiceBySubscription.has(invoice.stripe_subscription_id))
      latestInvoiceBySubscription.set(invoice.stripe_subscription_id, invoice);
  }

  const counts = {
    active: subscriptions.filter((item) => item.service_state === "active").length,
    grace: subscriptions.filter((item) => item.service_state === "grace").length,
    attention: subscriptions.filter((item) => ["suspended", "review"].includes(item.service_state)).length,
    ended: subscriptions.filter((item) => item.service_state === "ended").length,
  };

  return (
    <main className="hosting-admin">
      <header className="hosting-header">
        <div>
          <p className="hosting-kicker">VAELTX · PRIVATE OPERATIONS</p>
          <h1>Managed Hosting &amp; Care</h1>
          <p className="hosting-subtitle">
            Stripe LIVE billing ledger. Webhook state is operational; Stripe remains the payment source of truth.
          </p>
        </div>
        <nav className="hosting-nav" aria-label="Private operations">
          <Link href="/admin/website-auction">Auction admin</Link>
          <a href="https://dashboard.stripe.com/subscriptions" target="_blank" rel="noreferrer">
            Stripe
          </a>
        </nav>
      </header>

      <section className="hosting-summary" aria-label="Subscription summary">
        <article><span>Active</span><strong>{counts.active}</strong></article>
        <article><span>Grace</span><strong>{counts.grace}</strong></article>
        <article><span>Needs review</span><strong>{counts.attention}</strong></article>
        <article><span>Ended</span><strong>{counts.ended}</strong></article>
      </section>

      <section className="hosting-panel">
        <div className="hosting-panel-heading">
          <div>
            <p className="hosting-kicker">SUBSCRIPTIONS</p>
            <h2>Client billing state</h2>
          </div>
          <span>{subscriptions.length} tracked</span>
        </div>

        {subscriptions.length === 0 ? (
          <div className="hosting-empty">
            <strong>No Managed Hosting subscriptions yet.</strong>
            <span>The ledger is ready and will populate from verified Stripe LIVE events.</span>
          </div>
        ) : (
          <div className="hosting-table-wrap">
            <table className="hosting-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Plan</th>
                  <th>Service</th>
                  <th>Stripe</th>
                  <th>Period ends</th>
                  <th>Latest invoice</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => {
                  const customer = customerById.get(subscription.stripe_customer_id);
                  const invoice = latestInvoiceBySubscription.get(subscription.stripe_subscription_id);
                  return (
                    <tr key={subscription.stripe_subscription_id}>
                      <td>
                        <a
                          className="hosting-client"
                          href={stripeSubscriptionURL(subscription.stripe_subscription_id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <strong>{customerName(customer)}</strong>
                          <span>{customer?.email || subscription.stripe_customer_id}</span>
                        </a>
                      </td>
                      <td>
                        <strong>{money(subscription.unit_amount, subscription.currency)}</strong>
                        <span className="hosting-muted">/ month · {subscription.plan_code}</span>
                      </td>
                      <td>
                        <span className={`hosting-status hosting-status--${subscription.service_state}`}>
                          {subscription.service_state}
                        </span>
                        {subscription.cancel_at_period_end ? (
                          <span className="hosting-note">Cancels at period end</span>
                        ) : null}
                      </td>
                      <td>
                        <strong>{subscription.stripe_status}</strong>
                        <span className="hosting-muted">Updated {date(subscription.updated_at)}</span>
                      </td>
                      <td>{date(subscription.current_period_end)}</td>
                      <td>
                        {invoice ? (
                          <>
                            <strong>{invoice.stripe_status || "unknown"}</strong>
                            <span className="hosting-muted">
                              {money(invoice.amount_paid || invoice.amount_due, subscription.currency)}
                              {invoice.amount_remaining > 0 ? ` · ${money(invoice.amount_remaining, subscription.currency)} due` : ""}
                            </span>
                            {invoice.next_payment_attempt ? (
                              <span className="hosting-note">Retry {date(invoice.next_payment_attempt)}</span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="hosting-safety">
        <strong>Safety rule</strong>
        <span>
          A failed renewal enters grace/review. This dashboard never disables, deletes, or transfers a client site automatically.
        </span>
      </section>
    </main>
  );
}
