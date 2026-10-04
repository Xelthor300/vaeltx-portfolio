import test from "node:test";
import assert from "node:assert/strict";
import { applicationSchema, campaignAvailability, countdown, currencies, entryPrice, entryQuantities, normalizeEmail, checkoutSchema, type Campaign } from "../src/lib/website-grant";
import { fulfillmentSession, verifyStripeEvent } from "../src/lib/website-grant-payments";
import Stripe from "stripe";

const campaign: Campaign = { id: "campaign", slug: "grant", name: "Grant", status: "active", start_at: "2026-10-01T00:00:00Z", end_at: "2026-10-16T00:00:00Z", prize_quantity: 1, eligible_countries: ["MX"], minimum_age: 18, rules_version: "1", rules: {}, legal_approved_at: "2026-09-30T00:00:00Z", prize_arv_minor: 10000, prize_arv_currency: "USD", paid_entries_enabled: false, processor_approved_at: null, services_enabled: false };
test("campaign gating handles draft, scheduled, exact close boundary and missing legal setup", () => {
  assert.equal(campaignAvailability(campaign, Date.parse("2026-10-04")), "open");
  assert.equal(campaignAvailability(campaign, Date.parse(campaign.end_at!)), "closed");
  assert.equal(campaignAvailability(campaign, Date.parse("2026-09-30")), "not-open");
  assert.equal(campaignAvailability({ ...campaign, status: "draft" }), "not-open");
  assert.equal(campaignAvailability({ ...campaign, legal_approved_at: null }), "not-open");
  assert.equal(campaignAvailability(null), "not-open");
  assert.deepEqual(countdown("2026-10-02T02:03:00Z", Date.parse("2026-10-01T00:00:00Z")), { days: 1, hours: 2, minutes: 3 });
  assert.deepEqual(countdown(campaign.end_at, Date.parse("2026-10-17")), { days: 0, hours: 0, minutes: 0 });
});
test("all twenty packages use exact fixed minor-unit prices in three currencies", () => {
  assert.equal(entryQuantities.length, 20);
  const expectedBase = { USD:600, CAD:847, MXN:10887 };
  for (const quantity of entryQuantities) for (const currency of currencies) assert.equal(entryPrice(quantity,currency),expectedBase[currency]*(quantity/5));
  assert.equal(entryPrice(100,"USD"), 12000);
  assert.equal(entryPrice(100,"CAD"), 16940);
  assert.equal(entryPrice(100,"MXN"), 217740);
  assert.throws(() => entryPrice(1,"USD")); assert.throws(() => entryPrice(105,"USD"));
  assert.equal(normalizeEmail("  USER@Example.com  "),"user@example.com");
});
test("client input cannot mass-assign price, ownership, consent, scheme or invalid quantities", () => {
  const selection = { kind: "entries", code: "entries-5", quantity: 5, currency: "USD", requestId: "6ca7c4d3-a732-4f83-9e58-68fa89e05d97" };
  assert.ok(checkoutSchema.safeParse(selection).success);
  assert.equal(checkoutSchema.safeParse({ ...selection, amount_minor: 1 }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...selection, quantity: 1 }).success, false);
  const app = { full_name: "Test User", business_name: "Test Business", country: "MX", city: "Juarez", website: "", social_url: "", business_description: "A real description", website_goal: "A clear business goal", has_current_website: false, age_confirmed: true, rules_accepted: true, contact_consent: true };
  assert.ok(applicationSchema.safeParse(app).success);
  assert.equal(applicationSchema.safeParse({ ...app, country: "worldwide" }).success, false);
  assert.equal(applicationSchema.safeParse({ ...app, contact_consent: false }).success, false);
  assert.equal(applicationSchema.safeParse({ ...app, auth_user_id: "other-user" }).success, false);
  assert.equal(applicationSchema.safeParse({ ...app, website: "javascript:alert(1)" }).success, false);
});
test("real Stripe signature verification rejects tampering, wrong mode and connected-account events", () => {
  const stripe = new Stripe("sk_test_local_test_placeholder"), secret = "whsec_local_signature_fixture";
  const payload = JSON.stringify({ id:"evt_test", object:"event", type:"checkout.session.completed", created:Math.floor(Date.now()/1000), livemode:false, data:{ object:{ id:"cs_test", mode:"payment", payment_status:"paid", client_reference_id:"order", metadata:{ wg_order_id:"order" } } } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const event = verifyStripeEvent(stripe,payload,signature,secret,false);
  assert.equal(fulfillmentSession(event)?.id,"cs_test");
  assert.throws(() => verifyStripeEvent(stripe,payload+" ",signature,secret,false));
  assert.throws(() => verifyStripeEvent(stripe,payload,signature,secret,true));
  const connected = JSON.stringify({ ...JSON.parse(payload), account:"acct_other" });
  assert.throws(() => verifyStripeEvent(stripe,connected,stripe.webhooks.generateTestHeaderString({ payload:connected,secret }),secret,false));
  const unpaid = { ...event, data:{ object:{ ...event.data.object, payment_status:"unpaid" } } } as unknown as Stripe.Event;
  assert.equal(fulfillmentSession(unpaid),null);
  assert.equal(fulfillmentSession({ ...event, type:"checkout.session.async_payment_succeeded" } as Stripe.Event)?.id,"cs_test");
  assert.equal(fulfillmentSession({ ...event, type:"charge.succeeded" } as Stripe.Event),null);
});
