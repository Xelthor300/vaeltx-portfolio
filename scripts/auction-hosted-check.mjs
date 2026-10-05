// Explicit, disposable TEST namespace only. Does not start the production auction.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
if (!process.argv.includes("--run-tests"))
  throw new Error("Use --run-tests deliberately.");
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const results = {
  at: new Date().toISOString(),
  namespace: "test",
  checks: [],
  production: null,
};
const users = [];
const auctions = [];
async function checked(r) {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
try {
  for (let n = 0; n < 2; n++) {
    const u = await checked(
      await db.auth.admin.createUser({
        email: `auction-qa-${randomUUID()}@example.invalid`,
        password: randomUUID() + randomUUID(),
        email_confirm: true,
      }),
    );
    users.push(u.user.id);
    await checked(
      await db
        .from("va_participants")
        .insert({
          id: u.user.id,
          alias: `QA fixture ${randomUUID()}`,
          full_name: "QA Fixture",
          business_name: "Database regression fixture",
          email: u.user.email,
          phone: "+15550100",
          country: "US",
          city: "Test fixture",
          terms_version: "auction-v1",
          accepted_at: new Date().toISOString(),
          adult_confirmed: true,
          privacy_accepted: true,
          commitment_accepted: true,
          stripe_customer_id: `cus_fixture_${randomUUID()}`,
          payment_method_id: `pm_fixture_${randomUUID()}`,
          verified_mode: "test",
          verified_at: new Date().toISOString(),
        }),
    );
  }
  for (let iteration = 0; iteration < 3; iteration++) {
    const id = randomUUID();
    auctions.push(id);
    const start = new Date(Date.now() - 86400000).toISOString();
    const end = new Date(Date.now() + 24 * 86400000).toISOString();
    await checked(
      await db
        .from("va_auctions")
        .insert({
          id,
          slug: `qa-${id}`,
          environment: "test",
          status: "active",
          starts_at: start,
          original_ends_at: end,
          ends_at: end,
        }),
    );
    const first = await checked(
      await db.rpc("va_place_bid", {
        p_auction: id,
        p_user: users[0],
        p_amount: 19000,
        p_request: randomUUID(),
      }),
    );
    assert.equal(first.ok, true);
    const same = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        db.rpc("va_place_bid", {
          p_auction: id,
          p_user: users[i % 2],
          p_amount: 20000,
          p_request: randomUUID(),
        }),
      ),
    );
    same.forEach((r) => assert.equal(r.error, null));
    assert.equal(same.filter((r) => r.data.ok).length, 1);
    assert.equal(same.filter((r) => r.data.nextMinimum === 21000).length, 19);
    results.checks.push(
      `20 concurrent HTTP RPCs: exactly one 200 USD bid accepted (${iteration + 1}/3)`,
    );
  }
  const denied = await anon.from("va_participants").select("*");
  assert.ok(denied.error);
  assert.ok(
    (
      await anon.rpc("va_place_bid", {
        p_auction: auctions[0],
        p_user: users[0],
        p_amount: 21000,
        p_request: randomUUID(),
      })
    ).error,
  );
  const snapshots = await checked(
    await anon.from("va_public_state").select("*"),
  );
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].environment, "production");
  assert.equal(snapshots[0].status, "ready_for_activation");
  assert.equal(snapshots[0].bid_count, 0);
  assert.equal(snapshots[0].starts_at, null);
  results.checks.push(
    "Anonymous private-table and bid-RPC access denied; test snapshots excluded by RLS",
  );
  const aid = snapshots[0].auction_id;
  let resolveEvent;
  const event = new Promise((resolve) => {
    resolveEvent = resolve;
  });
  const channel = anon
    .channel(`qa-realtime-${randomUUID()}`, {
      config: { postgres_changes_options: { wait: true } },
    })
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "va_public_state",
        filter: `auction_id=eq.${aid}`,
      },
      (payload) => resolveEvent(payload.new),
    );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Realtime subscription timeout")),
      15000,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve();
      } else if (status === "CHANNEL_ERROR") {
        clearTimeout(timeout);
        reject(new Error("Realtime channel error"));
      }
    });
  });
  await checked(await db.rpc("va_refresh", { p_auction: aid }));
  let timer;
  const update = await Promise.race([
    event,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Realtime update timeout")),
        15000,
      );
    }),
  ]);
  clearTimeout(timer);
  assert.equal(update.bid_count, 0);
  assert.equal(update.status, "ready_for_activation");
  assert.equal("email" in update, false);
  results.checks.push(
    "Hosted Realtime delivered a sanitized timestamp refresh; production activity unchanged",
  );
  await anon.removeChannel(channel);
  results.production = await checked(
    await db
      .from("va_public_state")
      .select("status,bid_count,current_amount,starts_at,ends_at")
      .eq("environment", "production")
      .single(),
  );
} finally {
  // Keep test audit/history visible only to the owner; stop fixtures and block test accounts.
  if (auctions.length)
    await db
      .from("va_auctions")
      .update({ status: "cancelled" })
      .in("id", auctions);
  if (users.length)
    await db
      .from("va_participants")
      .update({ status: "blocked" })
      .in("id", users);
  await anon.removeAllChannels();
  await db.removeAllChannels();
  await mkdir("output/auction-qa", { recursive: true });
  await writeFile(
    "output/auction-qa/hosted-check.json",
    JSON.stringify(results, null, 2),
  );
}
console.log(JSON.stringify(results, null, 2));
