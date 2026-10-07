import test from "node:test";
import assert from "node:assert/strict";
import { serviceState, stripeId, unixISO } from "../src/lib/billing/model";

test("billing service state preserves a grace period for failed renewals", () => {
  assert.equal(serviceState("active"), "active");
  assert.equal(serviceState("trialing"), "active");
  assert.equal(serviceState("past_due"), "grace");
  assert.equal(serviceState("unpaid"), "suspended");
  assert.equal(serviceState("canceled"), "ended");
  assert.equal(serviceState("future_status"), "review");
});

test("stripeId accepts string ids and expanded resources", () => {
  assert.equal(stripeId("sub_123"), "sub_123");
  assert.equal(stripeId({ id: "cus_123" }), "cus_123");
  assert.equal(stripeId(null), null);
});

test("unixISO converts Stripe seconds safely", () => {
  assert.equal(unixISO(0), "1970-01-01T00:00:00.000Z");
  assert.equal(unixISO(null), null);
});
