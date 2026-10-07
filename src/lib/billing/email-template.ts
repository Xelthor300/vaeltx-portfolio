import { escapeHTML } from "@/lib/auction/email-template";

type Payload = Record<string, unknown>;

function money(amount: unknown, currency: unknown) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const code = String(currency || "").toUpperCase();
  if (!["USD", "MXN"].includes(code)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
  }).format(amount / 100);
}

const titles: Record<string, string> = {
  billing_subscription_started: "NEW MANAGED HOSTING SUBSCRIPTION",
  billing_checkout_failed: "HOSTING CHECKOUT PAYMENT FAILED",
  billing_payment_paid: "HOSTING PAYMENT RECEIVED",
  billing_payment_failed: "HOSTING PAYMENT FAILED",
  billing_action_required: "HOSTING PAYMENT NEEDS CUSTOMER ACTION",
  billing_cancel_scheduled: "HOSTING CANCELLATION SCHEDULED",
  billing_cancel_reversed: "HOSTING CANCELLATION REVERSED",
  billing_subscription_canceled: "HOSTING SUBSCRIPTION CANCELED",
  billing_subscription_paused: "HOSTING SUBSCRIPTION PAUSED",
  billing_subscription_resumed: "HOSTING SUBSCRIPTION RESUMED",
  billing_invoice_uncollectible: "HOSTING INVOICE MARKED UNCOLLECTIBLE",
  billing_invoice_finalization_failed: "HOSTING INVOICE FINALIZATION FAILED",
  billing_invoice_voided: "HOSTING INVOICE VOIDED",
  billing_reconciliation_warning: "HOSTING BILLING RECONCILIATION WARNING",
  billing_reconciliation_configuration_pending: "HOSTING RECONCILIATION NEEDS LIVE READ ACCESS",
};

export function renderBillingEmail(input: {
  kind: string;
  payload: Payload;
  url: string;
}) {
  if (!/^https:\/\//.test(input.url)) throw new Error("Billing email CTA requires HTTPS.");
  const p = input.payload;
  const title = titles[input.kind] || "MANAGED HOSTING UPDATE";
  const rows: Array<[string, string]> = [];
  const add = (label: string, value: unknown) => {
    if (value !== null && value !== undefined && String(value).trim())
      rows.push([label, String(value)]);
  };

  add("CUSTOMER", p.customerName || p.businessName);
  add("BUSINESS", p.businessName);
  add("EMAIL", p.customerEmail);
  add("PLAN", p.planCode);
  const amount = money(p.amountPaid ?? p.amountDue, p.currency);
  if (amount) add("AMOUNT", amount);
  add("SUBSCRIPTION", p.stripeSubscriptionId);
  add("INVOICE", p.stripeInvoiceId);
  add("STATUS", p.stripeStatus || p.serviceState);
  add("CURRENT PERIOD ENDS", p.currentPeriodEnd);
  add("CANCELLATION REASON", p.cancellationReason);
  add("CANCELLATION FEEDBACK", p.cancellationFeedback);
  add("CANCELLATION COMMENT", p.cancellationComment);
  add("NEXT PAYMENT ATTEMPT", p.nextPaymentAttempt);

  const copy =
    input.kind === "billing_reconciliation_configuration_pending"
      ? "Managed Hosting webhooks are active, but scheduled Stripe reconciliation cannot read LIVE subscriptions until a LIVE server-side Stripe key is configured. No client site is affected automatically."
      : input.kind === "billing_reconciliation_warning"
        ? "The scheduled Stripe reconciliation found one or more locally tracked subscriptions that were not returned by Stripe. Review the billing ledger and Stripe before making any client-facing change."
        : input.kind === "billing_payment_failed"
      ? "Stripe reported a failed recurring payment. Keep the customer site online during the grace period while Stripe retries; review only if the subscription later becomes unpaid or canceled."
      : input.kind === "billing_checkout_failed"
        ? "Stripe reported that an asynchronous subscription checkout payment failed. Review the Checkout and subscription state before provisioning Managed Hosting & Care."
      : input.kind === "billing_invoice_finalization_failed"
        ? "Stripe could not finalize a Managed Hosting & Care invoice. Review the invoice configuration and Stripe billing state before taking any client-facing action."
      : input.kind === "billing_invoice_voided"
        ? "A Managed Hosting & Care invoice was voided. Review the subscription and client account before making any service changes."
      : input.kind === "billing_subscription_canceled"
        ? "The recurring Managed Hosting & Care subscription has ended. Review the client account before making any service or hosting changes."
        : input.kind === "billing_cancel_scheduled"
          ? "The customer scheduled cancellation at the end of the current billing period. No immediate hosting action is required."
          : input.kind === "billing_cancel_reversed"
            ? "The customer reversed a scheduled cancellation before the paid period ended. The Managed Hosting & Care subscription remains active."
            : input.kind === "billing_payment_paid"
            ? "Stripe confirmed a recurring Managed Hosting & Care payment."
            : "Stripe reported a Managed Hosting & Care lifecycle update. Review the record if any operational action is needed.";

  const text = [
    "VAELTX · Web & Conversion Studio",
    "PRIVATE BILLING OPERATIONS",
    title,
    copy,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "OPEN STRIPE",
    input.url,
    "Do not suspend or delete a client site automatically from an email alone. Stripe and the VAELTX billing ledger are the authoritative billing sources.",
  ].join("\n\n");

  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;background:#f5f4f0;color:#242321;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #dedbd4;border-radius:12px"><tr><td style="padding:28px 24px;border-bottom:1px solid #eee"><strong style="font-size:24px;letter-spacing:2px">VAELTX<span style="color:#b84918">.</span></strong><div style="font-size:12px;color:#68645d;margin-top:6px">Web &amp; Conversion Studio</div></td></tr><tr><td style="padding:28px 24px"><span style="font-size:11px;letter-spacing:1px;color:#874019;background:#fff2e8;padding:6px 9px">PRIVATE BILLING OPERATIONS</span><h1 style="font-size:25px;line-height:1.25;margin:22px 0 14px">${escapeHTML(title)}</h1><p style="font-size:15px;line-height:1.7;color:#625e57">${escapeHTML(copy)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4dd;background:#faf9f6">${rows.map(([l,v])=>`<tr><td style="padding:14px 16px;border-bottom:1px solid #eee"><div style="font-size:10px;letter-spacing:1px;color:#6b665d">${escapeHTML(l)}</div><div style="font-size:16px;line-height:1.5;font-weight:bold;word-break:break-word">${escapeHTML(v)}</div></td></tr>`).join("")}</table><table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td bgcolor="#242321" style="border-radius:5px"><a href="${escapeHTML(input.url)}" style="display:inline-block;padding:15px 20px;color:#fff;font-size:12px;font-weight:bold;text-decoration:none">OPEN STRIPE &rarr;</a></td></tr></table><p style="font-size:12px;line-height:1.7;color:#6b665d">No automatic client-site shutdown is triggered by these alerts. Review billing state before any service change.</p></td></tr></table></td></tr></table></body></html>`;
  return { html, text };
}
