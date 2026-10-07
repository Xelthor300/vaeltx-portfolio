# VAELTX Managed Hosting & Care — Billing Runbook

## Purpose

This subsystem tracks the recurring VAELTX Managed Hosting & Care service in Stripe and keeps an internal, auditable billing ledger in Supabase.

It is intentionally separate from the website-auction payment flow.

## Live plans

| Market | Customer-facing plan | Amount | Stripe Price | Payment Link |
| --- | --- | ---: | --- | --- |
| US | VAELTX Managed Hosting & Care | USD 39/month | `price_1UNj8G4efgtFxxrtKhdFx9TI` | `plink_1UNj8Z4efgtFxxrtVEEsCW5x` |
| MX | VAELTX — Hosting administrado y mantenimiento | MXN 699/month | `price_1UNj8L4efgtFxxrtICPzpZdV` | `plink_1UNj8h4efgtFxxrtKtllr4iG` |

Payment Link URLs are distributed with explicit Checkout locales:
- US: `?locale=en`
- Mexico: `?locale=es-419`

Do not replace a Price ID in environment configuration without creating a migration/review plan. Stripe Prices are immutable commercial records; create a new Price for future pricing changes.

## Production endpoint

`POST https://vaeltx-portfolio.vercel.app/api/vaeltx/billing/webhook`

The endpoint:
1. reads the raw request body;
2. verifies the `Stripe-Signature` header with `VAELTX_BILLING_WEBHOOK_SECRET`;
3. rejects non-LIVE events;
4. normalizes only the two approved Hosting & Care plans;
5. hashes the raw payload with SHA-256;
6. applies state atomically through `va_billing_apply_event`;
7. returns 2xx only after durable processing.

Stripe should retry a non-2xx delivery. Never return success before the database transaction succeeds.

## Enabled Stripe events

Keep the endpoint narrowly scoped. Do not change to `*`.

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `invoice.marked_uncollectible`
- `invoice.finalization_failed`
- `invoice.voided`

The handler is intentionally tolerant of Stripe adding newer event-name literals before the installed SDK widens its TypeScript union.

The code also understands `customer.subscription.collection_paused` and `customer.subscription.collection_resumed` for forward compatibility, but they are **not enabled on the LIVE endpoint** because the current VAELTX Stripe account does not have access to those event types. Add them only after Stripe grants access and the endpoint update is verified.

## Activation rule

Never treat `checkout.session.completed` by itself as proof of payment.

Managed Hosting & Care is considered successfully started for notification purposes only when:
- `checkout.session.completed` has `payment_status=paid` or `no_payment_required`; or
- Stripe emits `checkout.session.async_payment_succeeded`.

`checkout.session.async_payment_failed` produces an owner alert and does not provision service.

## Internal service states

| Stripe state | VAELTX service state | Operational meaning |
| --- | --- | --- |
| active / trialing | active | Normal service |
| incomplete | pending | Initial payment/setup not complete |
| past_due | grace | Keep site online while Stripe retries |
| paused / unpaid | suspended | Requires owner review before any service action |
| canceled / incomplete_expired | ended | Service agreement is no longer active |
| unknown/new | review | Do not automate; inspect manually |

### Critical safety rule

**Never delete, unpublish, transfer, or disable a client website solely because one recurring payment failed or because an email alert was received.**

A failed renewal enters a grace/review workflow. Stripe Billing and the persisted ledger are the billing sources of truth. Any hosting suspension or handoff is an explicit VAELTX operational decision after reviewing the customer, subscription, retries, and contract terms.

## Database

RLS-protected, server-only tables:

- `va_billing_customers`
- `va_billing_subscriptions`
- `va_billing_invoices`
- `va_billing_events`

The webhook never stores the full Stripe event payload. It stores normalized operational fields plus a SHA-256 digest for audit/idempotency.

### Idempotency and ordering

`stripe_event_id` is the primary idempotency key.

`va_billing_apply_event`:
- atomically reserves the event ID;
- returns `duplicate` for an identical redelivery;
- rejects the same event ID with a different payload hash;
- prevents older subscription/invoice events from overwriting newer state;
- suppresses owner alerts from stale out-of-order events;
- permits older events to enrich missing customer fields without rolling back the authoritative event timestamp.

## Owner alerts

Important billing transitions are inserted into the existing `va_outbox` as owner-only `billing_*` notifications.

The existing Supabase cron and VAELTX operations endpoint provide:
- leasing;
- retry/backoff;
- idempotent delivery;
- provider receipts;
- review state after repeated/uncertain failures.

Alerts link to the relevant Stripe Dashboard subscription or invoice. They are operational notifications, not the billing source of truth.

## Secrets and environment variables

Non-secret IDs:
- `VAELTX_HOSTING_US_PRICE_ID`
- `VAELTX_HOSTING_US_PAYMENT_LINK_ID`
- `VAELTX_HOSTING_MX_PRICE_ID`
- `VAELTX_HOSTING_MX_PAYMENT_LINK_ID`

Production-only secret:
- `VAELTX_BILLING_WEBHOOK_SECRET`

Store the webhook signing secret as a **Sensitive** Vercel Production environment variable. Never commit it, log it, put it in client-side code, or reuse the auction webhook secret.

The webhook does not require a LIVE Stripe API secret to validate signed events.

## Secret rotation

If the webhook signing secret must be rotated:

1. create/recreate the Stripe webhook endpoint or roll the secret in Stripe;
2. copy the new signing secret directly into the Vercel Sensitive env `VAELTX_BILLING_WEBHOOK_SECRET`;
3. redeploy production so serverless functions receive the new environment value;
4. verify Stripe delivery health;
5. never paste the secret into GitHub issues, PRs, logs, chat output, or documentation.

A secret mismatch must fail closed with a non-2xx webhook response.

## Pricing changes

Do not mutate historical subscription economics implicitly.

For a future price change:
1. create a new Stripe Price;
2. keep existing customers on their agreed price unless there is an explicit migration;
3. update the plan allowlist/environment only after code review;
4. add tests/migrations where required;
5. verify webhook handling before distributing the new link.

## Tax

Automatic Stripe Tax is intentionally disabled for these links until VAELTX has confirmed applicable tax obligations and configured active registrations. Enabling automatic tax without registrations is not a substitute for tax setup.

Review thresholds and registrations before changing this policy.

## Recovery checklist

### Customer says they paid but ledger is not active
1. Open the Stripe Checkout/Subscription from Dashboard.
2. Confirm the payment is actually paid.
3. Inspect Stripe webhook delivery attempts for the event.
4. Check Vercel function logs for `vaeltx_billing_webhook_failed`.
5. Check `va_billing_events` and `va_billing_subscriptions`.
6. Replay the Stripe event from Dashboard only after the underlying failure is corrected.

### Payment failed
1. Keep the site online during `grace`.
2. Let Stripe retry according to Billing recovery settings.
3. Confirm whether the customer updates their payment method.
4. Take service action only if the subscription progresses to an ended/suspended state and VAELTX has reviewed the account.

### Cancellation scheduled
No immediate action. Service remains active through the paid period unless the commercial agreement says otherwise.

### Webhook returns errors
Do not disable signature verification. Fix the configuration/database error and replay failed events from Stripe.

## Deployment gates

Before changing the webhook or billing schema:
- TypeScript passes
- lint passes
- unit tests pass
- production build passes
- preview deployment is READY
- database migration is tested transactionally
- production deployment is READY before changing Stripe endpoint routing

No real LIVE test purchase is required to validate code. Avoid creating fake live customer charges.


## Private owner operations

The billing ledger has a private owner dashboard at:

`/admin/managed-hosting`

It uses the existing VAELTX owner identity check and never exposes the configured owner email in the browser.

If the owner session has expired, `/admin/managed-hosting/signin` requests a single-use Supabase email sign-in link:
- the owner email is read only from `AUCTION_ADMIN_AUTH_EMAIL` on the server;
- the page has no email input and never renders that address;
- Cloudflare Turnstile is required;
- requests are rate-limited to 3 per hour per network plus the existing email cooldown;
- the flow reuses `/website-auction/auth/callback?target=managed-hosting`, which is already an authorized Supabase redirect; that owner-only target remains available while the public auction stays hidden.

The dashboard is operational visibility only. It cannot charge, cancel, suspend, delete, or transfer a client site.

## Scheduled reconciliation

Webhooks are the primary near-real-time path. In addition, VAELTX reconciles the internal subscription ledger against Stripe LIVE every six hours.

Endpoint:

`GET /api/vaeltx/billing/reconcile`

Authentication uses the existing server-to-server operations bearer secret. It is never public and is supplied by Supabase Vault.

The Supabase cron job `va-managed-hosting-reconcile` runs at minute 17 every six hours.

Reconciliation:
1. verifies the configured Stripe LIVE account;
2. lists Stripe subscriptions across all statuses;
3. keeps only the two approved Managed Hosting & Care Price IDs;
4. derives the current VAELTX service state from Stripe;
5. atomically upserts drift through the same hardened billing RPC;
6. uses a deterministic state fingerprint so an unchanged subscription does not create repeated work;
7. never creates charges or modifies Stripe;
8. warns the owner if a locally tracked live subscription is unexpectedly absent from Stripe's reconciliation set.

Do not remove webhook handling after adding reconciliation. The two mechanisms are complementary: webhooks provide low-latency updates, while reconciliation is the self-healing safety net.


## LIVE read key for scheduled reconciliation

Stripe webhook delivery is the primary production mechanism and remains fully operational without a Stripe API secret.

The six-hour reconciliation safety net additionally needs a server-side LIVE Stripe key. VAELTX looks for:

`VAELTX_BILLING_STRIPE_SECRET_KEY`

and falls back to `STRIPE_SECRET_KEY` only when that fallback is itself an `sk_live_` key.

If no LIVE key is available:
- the reconciliation endpoint returns HTTP 200 in `webhook_only` mode instead of failing;
- no Stripe mutation or charge is attempted;
- if there are no tracked live subscriptions, no warning is generated;
- once tracked subscriptions exist, VAELTX queues one owner warning per day until LIVE read access is configured;
- adding the LIVE key later automatically enables the existing six-hour reconciliation job after the next Vercel deployment.

The current production `STRIPE_SECRET_KEY` is intentionally TEST-only for the hidden auction and must not be repurposed or overwritten just to satisfy billing reconciliation.

A LIVE key must be created/managed in Stripe and stored only as a Vercel Sensitive production variable. Do not paste it into source code, GitHub, logs, email, or chat.
