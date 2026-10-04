import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import {
  parseAmount,
  profileSchema,
  onboardingSchema,
} from "../src/lib/auction/model";

test("USD decimal parsing uses integer minor units and rejects malformed or unsafe amounts", () => {
  assert.equal(parseAmount("125"), 12500);
  assert.equal(parseAmount("125.01"), 12501);
  for (const v of [
    "99.99",
    "1e6",
    "-100",
    "100.001",
    "100,00",
    "1000000",
    "NaN",
  ])
    assert.throws(() => parseAmount(v));
});
test("bidder and onboarding schemas require explicit commitments and reject extra secret fields", () => {
  const p = {
    full_name: "Test Bidder",
    business_name: "Test Business",
    phone: "+1 555 0100",
    country: "US",
    city: "Test City",
    website: "",
    adult_confirmed: true,
    privacy_accepted: true,
    commitment_accepted: true,
    terms_accepted: true,
  };
  assert.equal(profileSchema.safeParse(p).success, true);
  assert.equal(
    profileSchema.safeParse({ ...p, adult_confirmed: false }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ ...p, email: "spoof@example.invalid" }).success,
    false,
  );
  assert.equal(
    onboardingSchema.safeParse({ passwords: "secret" }).success,
    false,
  );
});
test("Stripe signature verification rejects tampered, unsigned and stale payloads", () => {
  const s = new Stripe("sk_test_fixture");
  const payload = JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
  });
  const secret = "whsec_test_fixture";
  const header = s.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(
    s.webhooks.constructEvent(payload, header, secret).id,
    "evt_test",
  );
  assert.throws(() => s.webhooks.constructEvent(payload + " ", header, secret));
  assert.throws(() => s.webhooks.constructEvent(payload, "", secret));
  const stale = s.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: 1,
  });
  assert.throws(() => s.webhooks.constructEvent(payload, stale, secret));
});

test("auction PostgreSQL transaction, deadline, payments, permissions and notification invariants", async (t) => {
  const pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table public.wg_campaigns(slug text,status text,paid_entries_enabled boolean,services_enabled boolean);
    insert into public.wg_campaigns values('website-launch-grant','draft',false,false);`);
  let sql = await readFile(
    new URL(
      "../supabase/migrations/20261004202835_website_auction.sql",
      import.meta.url,
    ),
    "utf8",
  );
  sql = sql.replace(
    "alter publication supabase_realtime add table public.va_public_state;",
    "-- Publication is verified separately against hosted Supabase.",
  );
  await pg.exec(sql);
  const hardening = (
    await readFile(
      new URL(
        "../supabase/migrations/20261004203452_website_auction_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    )
  ).replace(/-- START HOSTED SCHEDULER:[\s\S]*?-- END HOSTED SCHEDULER/, "");
  await pg.exec(hardening);
  await pg.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261004204112_website_auction_notifications.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261004204555_website_auction_profile_visibility.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261004205412_website_auction_payment_safety.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261004214013_website_auction_smtp_delivery.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const users = [randomUUID(), randomUUID(), randomUUID()];
  await pg.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261004220126_website_auction_isolated_qa.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (let i = 0; i < users.length; i++)
    await pg.query(`insert into auth.users(id) values($1);`, [users[i]]);
  for (let i = 0; i < users.length; i++)
    await pg.query(
      `insert into va_participants(id,alias,full_name,business_name,email,phone,country,city,terms_version,accepted_at,adult_confirmed,privacy_accepted,commitment_accepted,stripe_customer_id,payment_method_id,verified_mode,verified_at)
    values($1,$2,'Fixture Bidder','Fixture Business',$3,'+15550100','US','Fixture City','auction-v1',now(),true,true,true,$4,$5,'test',now())`,
      [
        users[i],
        `Fixture ${i}`,
        `fixture${i}@example.invalid`,
        `cus_fixture${i}`,
        `pm_fixture${i}`,
      ],
    );
  await pg.query(`insert into va_admins values($1,'owner')`, [users[2]]);
  async function fixture() {
    const id = randomUUID();
    await pg.query(
      `insert into va_auctions(id,slug,environment,status,starts_at,original_ends_at,ends_at) values($1,$2,'test','active',now()-interval '1 day',now()+interval '24 days',now()+interval '24 days')`,
      [id, `fixture-${id}`],
    );
    await pg.query(`select va_refresh($1)`, [id]);
    return id;
  }
  async function bid(
    a: string,
    u = users[0],
    amount = 10000,
    request = randomUUID(),
  ) {
    return (
      await pg.query<{
        r: {
          ok: boolean;
          code?: string;
          duplicate?: boolean;
          bidId: number;
          nextMinimum?: number;
        };
      }>(`select va_place_bid($1,$2,$3,$4) r`, [a, u, amount, request])
    ).rows[0].r;
  }
  async function row(table: string, id: string) {
    return (
      await pg.query<Record<string, unknown>>(
        `select * from ${table} where id=$1`,
        [id],
      )
    ).rows[0];
  }
  async function close(a: string) {
    await pg.query(
      `update va_auctions set original_ends_at=now()-interval '1 second',ends_at=now()-interval '1 second' where id=$1`,
      [a],
    );
    return (
      await pg.query<{ r: { winnerId: string | null } }>(
        `select va_close($1) r`,
        [a],
      )
    ).rows[0].r;
  }
  await t.test(
    "new production state is ready with no timer, zero activity and old campaign cancelled",
    async () => {
      const a = (
        await pg.query<Record<string, unknown>>(
          `select * from va_auctions where slug='website-auction'`,
        )
      ).rows[0];
      assert.equal(a.status, "ready_for_activation");
      assert.equal(a.starts_at, null);
      assert.equal(a.ends_at, null);
      assert.equal(
        (await pg.query<{ status: string }>(`select status from wg_campaigns`))
          .rows[0].status,
        "cancelled",
      );
    },
  );
  await t.test(
    "100 -> 110 -> custom 125 -> minimum 135; duplicate retries do not create activity",
    async () => {
      const a = await fixture();
      const id = randomUUID();
      assert.equal((await bid(a, users[0], 10000, id)).ok, true);
      assert.equal((await bid(a, users[0], 10000, id)).duplicate, true);
      assert.equal((await bid(a, users[1], 11000)).ok, true);
      assert.equal((await bid(a, users[0], 12500)).ok, true);
      const reject = await bid(a, users[1], 13000);
      assert.equal(reject.ok, false);
      assert.equal(reject.nextMinimum, 13500);
      assert.equal(
        (await bid(a, users[0], 12000, id)).code,
        "request_conflict",
      );
    },
  );
  await t.test(
    "same competing minimum is accepted once and then increases",
    async () => {
      const a = await fixture();
      await bid(a, users[0], 19000);
      const results = await Promise.all([
        bid(a, users[0], 20000),
        bid(a, users[1], 20000),
      ]);
      assert.equal(results.filter((r) => r.ok).length, 1);
      assert.equal(results.find((r) => !r.ok)?.nextMinimum, 21000);
    },
  );
  await t.test(
    "late valid bid adds 120 seconds to existing end, retries do not extend",
    async () => {
      const a = await fixture();
      await pg.query(
        `update va_auctions set original_ends_at=now()+interval '80 seconds',ends_at=now()+interval '80 seconds' where id=$1`,
        [a],
      );
      const before = await row("va_auctions", a);
      const req = randomUUID();
      await bid(a, users[0], 10000, req);
      const after = await row("va_auctions", a);
      assert.equal(
        new Date(after.ends_at as string).getTime() -
          new Date(before.ends_at as string).getTime(),
        120000,
      );
      assert.equal(after.extension_count, 1);
      await bid(a, users[0], 10000, req);
      assert.equal((await row("va_auctions", a)).extension_count, 1);
    },
  );
  await t.test(
    "expired, paused, unverified, wrong-mode and missing-profile bids are rejected",
    async () => {
      const a = await fixture();
      await pg.query(`update va_auctions set status='paused' where id=$1`, [a]);
      assert.equal((await bid(a)).code, "auction_not_active");
      await pg.query(`update va_auctions set status='active' where id=$1`, [a]);
      await pg.query(
        `update va_participants set verified_mode='live' where id=$1`,
        [users[0]],
      );
      assert.equal((await bid(a)).code, "card_verification_required");
      await pg.query(
        `update va_participants set verified_mode='test' where id=$1`,
        [users[0]],
      );
      assert.equal((await bid(a, randomUUID())).code, "profile_required");
      await close(a);
      assert.equal((await bid(a)).ok, false);
    },
  );
  await t.test(
    "reserve below 350 produces no sale, no winner and no checkout",
    async () => {
      const a = await fixture();
      await bid(a, users[0], 34900);
      assert.equal((await close(a)).winnerId, null);
      assert.equal((await row("va_auctions", a)).status, "closed_no_sale");
    },
  );
  await t.test(
    "winning offer is immutable; only owner can reserve checkout; exact payment is idempotent",
    async () => {
      const a = await fixture();
      await bid(a, users[0], 35000);
      const w = (await close(a)).winnerId!;
      const offer = await row("va_winners", w);
      assert.equal(offer.amount, 35000);
      assert.equal(
        new Date(offer.deadline as string).getTime() -
          new Date(offer.offered_at as string).getTime(),
        86400000,
      );
      await assert.rejects(
        pg.query(`update va_winners set amount=36000 where id=$1`, [w]),
        /winner_offer_immutable/,
      );
      await assert.rejects(
        pg.query(`select va_reserve_checkout($1,$2)`, [w, users[1]]),
        /payment_unavailable/,
      );
      await pg.query(`select va_reserve_checkout($1,$2)`, [w, users[0]]);
      await pg.query(
        `update va_winners set checkout_session_id='cs_fixture_paid',checkout_state='open' where id=$1`,
        [w],
      );
      await assert.rejects(
        pg.query(
          `select va_record_payment('evt_bad',$1,'cs_fixture_paid','pi_fixture',36000,'usd','test',now())`,
          [w],
        ),
        /payment_mismatch/,
      );
      await assert.rejects(
        pg.query(
          `select va_record_payment('evt_bad',$1,'cs_fixture_paid','pi_fixture',35000,'cad','test',now())`,
          [w],
        ),
        /payment_mismatch/,
      );
      await assert.rejects(
        pg.query(
          `select va_record_payment('evt_bad',$1,'cs_fixture_paid','pi_fixture',35000,'usd','live',now())`,
          [w],
        ),
        /payment_mismatch/,
      );
      await pg.query(
        `select va_record_payment('evt_good',$1,'cs_fixture_paid','pi_fixture',35000,'usd','test',now())`,
        [w],
      );
      const again = (
        await pg.query<{ r: { duplicate: boolean } }>(
          `select va_record_payment('evt_good',$1,'cs_fixture_paid','pi_fixture',35000,'usd','test',now()) r`,
          [w],
        )
      ).rows[0].r;
      assert.equal(again.duplicate, true);
      assert.equal((await row("va_auctions", a)).status, "completed");
    },
  );
  await t.test(
    "unreconciled checkout cannot expire or create a backup; backup uses its own bid",
    async () => {
      const a = await fixture();
      await bid(a, users[1], 35000);
      await bid(a, users[0], 40000);
      const winner = (await close(a)).winnerId!;
      // Fixture clock is advanced through an internal test-only trigger bypass, not production mutation.
      await pg.exec(
        "alter table va_winners disable trigger va_winner_immutable",
      );
      await pg.query(
        `update va_winners set offered_at=now()-interval '25 hours',deadline=now()-interval '1 hour',checkout_state='open' where id=$1`,
        [winner],
      );
      await pg.exec(
        "alter table va_winners enable trigger va_winner_immutable",
      );
      assert.equal(
        (
          await pg.query<{ r: boolean }>(`select va_expire_winner($1) r`, [
            winner,
          ])
        ).rows[0].r,
        false,
      );
      await pg.query(
        `update va_winners set checkout_state='expired' where id=$1`,
        [winner],
      );
      await pg.query(`select va_expire_winner($1)`, [winner]);
      await pg.query(
        `select va_admin_action($1,$2,'backup','Fixture backup reconciliation',null)`,
        [a, users[2]],
      );
      const backup = (
        await pg.query<{ amount: number; participant_id: string }>(
          `select * from va_winners where auction_id=$1 and is_backup`,
          [a],
        )
      ).rows[0];
      assert.equal(backup.amount, 35000);
      assert.equal(backup.participant_id, users[1]);
      assert.equal((await row("va_winners", winner)).status, "expired");
    },
  );
  await t.test(
    "activation gates and admin membership are enforced inside the database",
    async () => {
      const production = (
        await pg.query<{ id: string }>(
          `select id from va_auctions where slug='website-auction'`,
        )
      ).rows[0].id;
      await assert.rejects(
        pg.query(
          `select va_admin_action($1,$2,'activate','Fixture activation check',null)`,
          [production, users[0]],
        ),
        /admin_required/,
      );
      await assert.rejects(
        pg.query(
          `select va_admin_action($1,$2,'activate','Fixture activation check',null)`,
          [production, users[2]],
        ),
        /activation_gate_missing/,
      );
    },
  );
  await t.test(
    "outbox dedupe and leases protect accepted-bid notifications",
    async () => {
      await pg.exec(
        `select va_notify('fixture-key','bid_accepted','owner',null,'{}');select va_notify('fixture-key','bid_accepted','owner',null,'{}');`,
      );
      assert.equal(
        (
          await pg.query<{ n: number }>(
            `select count(*)::int n from va_outbox where dedupe_key='fixture-key'`,
          )
        ).rows[0].n,
        1,
      );
      const leased = await pg.query(`select * from va_lease_notifications(10)`);
      assert.equal(leased.rows.length, 1);
      assert.equal(
        (await pg.query(`select * from va_lease_notifications(10)`)).rows
          .length,
        0,
      );
    },
  );
  await t.test(
    "anon may see only production snapshot and cannot read private tables or call bid RPC",
    async () => {
      await pg.exec("set role anon");
      assert.equal(
        (await pg.query(`select * from va_public_state`)).rows.length,
        1,
      );
      await assert.rejects(
        pg.query("select * from va_participants"),
        /permission denied/,
      );
      await assert.rejects(
        pg.query(`select va_place_bid($1,$2,10000,$3)`, [
          randomUUID(),
          users[0],
          randomUUID(),
        ]),
        /permission denied/,
      );
      await pg.exec("reset role");
    },
  );
  await t.test(
    "late paid receipt enters owner review and cannot complete the auction",
    async () => {
      const a = await fixture();
      await bid(a, users[0], 35000);
      const w = (await close(a)).winnerId!;
      await pg.query(
        `update va_winners set checkout_session_id='cs_fixture_late',checkout_state='open' where id=$1`,
        [w],
      );
      await pg.query(
        `select va_record_payment('evt_fixture_late',$1,'cs_fixture_late','pi_fixture_late',35000,'usd','test',(select deadline+interval '1 second' from va_winners where id=$1))`,
        [w],
      );
      assert.equal((await row("va_winners", w)).status, "review");
      assert.notEqual((await row("va_auctions", a)).status, "completed");
    },
  );
  await t.test(
    "production notification invariants in embedded fixtures: one owner message per committed bid, reserve once, outbid throttled",
    async () => {
      const a = await fixture();
      await pg.query(
        `update va_auctions set environment='production',commercial_terms='{"eligible_countries":["US"]}' where id=$1`,
        [a],
      );
      for (const id of users.slice(0, 2)) {
        await pg.query(
          `update va_participants set verified_mode='live' where id=$1`,
          [id],
        );
        await pg.query(
          `update auth.users set email=(select email from va_participants where id=$1),email_confirmed_at=now() where id=$1`,
          [id],
        );
      }
      await bid(a, users[0], 10000);
      await bid(a, users[1], 11000);
      const req = randomUUID();
      await bid(a, users[0], 35000, req);
      await bid(a, users[0], 35000, req);
      const messages = (
        await pg.query<{
          kind: string;
          audience: string;
          payload: Record<string, unknown>;
        }>(
          `select kind,audience,payload from va_outbox where payload->>'auctionId'=$1`,
          [a],
        )
      ).rows;
      assert.equal(
        messages.filter(
          (m) => m.kind === "bid_accepted" && m.audience === "owner",
        ).length,
        3,
      );
      assert.equal(messages.filter((m) => m.kind === "reserve_met").length, 1);
      const owner = messages.find((m) => m.kind === "bid_accepted")!;
      assert.ok(owner.payload.email);
      assert.ok(owner.payload.fullName);
      assert.ok(owner.payload.phone);
      assert.equal(owner.payload.reserveAmount, 35000);
    },
  );
  await t.test(
    "QA access is private, test-only, and opts notifications in without publishing fixtures to anonymous users",
    async () => {
      for (const id of users.slice(0, 2))
        await pg.query(
          "update va_participants set verified_mode='test' where id=$1",
          [id],
        );
      const a = await fixture();
      await pg.query("update va_auctions set slug=$2 where id=$1", [
        a,
        `qa-ui-${a}`,
      ]);
      await pg.query(
        "insert into va_qa_runs values($1,true,'https://qa-vaeltx.vercel.app')",
        [a],
      );
      await pg.query("insert into va_qa_access values($1,$2)", [a, users[0]]);
      const req = randomUUID();
      assert.equal((await bid(a, users[0], 35000, req)).ok, true);
      assert.equal((await bid(a, users[0], 35000, req)).duplicate, true);
      const messages = (
        await pg.query<{ payload: { qa: boolean } }>(
          "select payload from va_outbox where payload->>'auctionId'=$1",
          [a],
        )
      ).rows;
      assert.equal(messages.length, 3);
      assert.ok(messages.every((m) => m.payload.qa === true));
      await assert.rejects(
        pg.query(
          "insert into va_qa_runs values((select id from va_auctions where slug='website-auction'),true,'https://qa-vaeltx.vercel.app')",
        ),
        /qa_requires_test_auction/,
      );
      await pg.exec(
        `grant usage on schema auth to authenticated; set role authenticated; set request.jwt.claim.sub='${users[0]}'`,
      );
      assert.equal(
        (
          await pg.query("select * from va_public_state where auction_id=$1", [
            a,
          ])
        ).rows.length,
        1,
      );
      await assert.rejects(
        pg.query("insert into va_qa_access values($1,$2)", [a, users[1]]),
        /permission denied/,
      );
      await pg.exec(`set request.jwt.claim.sub='${users[1]}'`);
      assert.equal(
        (
          await pg.query("select * from va_public_state where auction_id=$1", [
            a,
          ])
        ).rows.length,
        0,
      );
      await pg.exec("set role anon");
      assert.equal(
        (
          await pg.query("select * from va_public_state where auction_id=$1", [
            a,
          ])
        ).rows.length,
        0,
      );
      await pg.exec("reset role");
      assert.equal(
        (
          await pg.query<{ status: string }>(
            "select status from va_auctions where slug='website-auction'",
          )
        ).rows[0].status,
        "ready_for_activation",
      );
    },
  );
  await pg.close();
});
