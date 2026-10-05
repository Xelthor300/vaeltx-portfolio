import { test } from "node:test";
import assert from "node:assert/strict";
import { auctionRuntime, qaEmailAllowed } from "../src/lib/auction/runtime";
test("QA cannot select test data in production, LIVE mode, unlocked activation or an arbitrary slug", () => {
  assert.equal(auctionRuntime({}).environment, "production");
  const qa = {
    VERCEL_ENV: "preview",
    AUCTION_STRIPE_MODE: "test",
    AUCTION_ALLOW_ACTIVATION: "false",
    AUCTION_QA_SLUG: "qa-ui-20261004",
  };
  assert.equal(auctionRuntime(qa).environment, "test");
  for (const change of [
    { VERCEL_ENV: "production" },
    { AUCTION_STRIPE_MODE: "live" },
    { AUCTION_ALLOW_ACTIVATION: "true" },
    { AUCTION_QA_SLUG: "website-auction" },
  ])
    assert.throws(() => auctionRuntime({ ...qa, ...change }));
  assert.equal(qaEmailAllowed("qa@example.invalid", qa), false);
  assert.equal(
    qaEmailAllowed("QA@example.invalid", {
      ...qa,
      AUCTION_QA_EMAILS: "qa@example.invalid",
    }),
    true,
  );
});
