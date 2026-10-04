import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL campaign invariants, duplicate retries, RLS and transactional payment fulfillment", { timeout: 120000 }, async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);");
    await db.exec(await readFile(new URL("../supabase/migrations/20261004183131_website_grant.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261004185733_website_grant_operations.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261004191557_website_grant_judged_selection.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261004191833_website_grant_review_gate.sql",import.meta.url),"utf8"));
    const { rows } = await db.query<{ id:string }>("select id from wg_campaigns"); const campaign = rows[0].id;
    assert.equal((await db.query<Record<string, unknown>>("select status,start_at,end_at,paid_entries_enabled from wg_campaigns")).rows[0].status,"draft");
    await assert.rejects(db.query<Record<string, unknown>>("update wg_campaigns set status='active' where id=$1",[campaign]));
    const users=["a8919f46-28b0-4ad7-aaac-a22b80e86bf2","b8919f46-28b0-4ad7-aaac-a22b80e86bf2"];
    for(const user of users) await db.query<Record<string, unknown>>("insert into auth.users values($1)",[user]);
    const application={ country:"MX",age_confirmed:true,rules_accepted:true,contact_consent:true };
    await assert.rejects(db.query<Record<string, unknown>>("select wg_claim_free($1,$2,$3,$4)",[campaign,users[0],"test@example.com",application]),/CAMPAIGN_CLOSED/);
    await db.query<Record<string, unknown>>("update wg_campaigns set start_at=now()-interval '1 minute',end_at=now()+interval '15 days',legal_approved_at=now(),rules_version='test-only',sponsor_details='LOCAL TEST ONLY',prize_arv_minor=10000,eligible_countries='{MX}',selection_procedure='LOCAL TEST PROCEDURE',rules=(select jsonb_object_agg(n::text,'Local test terms only'::text) from generate_series(1,25)n),status='active',services_enabled=true where id=$1",[campaign]);
    // PGlite executes real SQL with queued retries; hosted multi-connection races need separate QA.
    const claims = await Promise.all([
      db.query<{ result:{ entry_number:string } }>("select wg_claim_free($1,$2,$3,$4) as result",[campaign,users[0],"test@example.com",application]),
      db.query<{ result:{ entry_number:string } }>("select wg_claim_free($1,$2,$3,$4) as result",[campaign,users[0],"test@example.com",application]),
      db.query<{ result:{ entry_number:string } }>("select wg_claim_free($1,$2,$3,$4) as result",[campaign,users[1],"other@example.com",application]),
    ]);
    assert.equal(claims[0].rows[0].result.entry_number,claims[1].rows[0].result.entry_number);
    assert.notEqual(claims[0].rows[0].result.entry_number,claims[2].rows[0].result.entry_number);
    assert.equal((await db.query<Record<string, unknown>>("select wg_public_count($1) count",[campaign])).rows[0].count,2);
    await assert.rejects(db.query<Record<string, unknown>>("update wg_entries set entry_number='fake'"),/immutable/);
    const createOrder=async(kind:string,code:string,q:number,currency:string,key:string) => (await db.query<{ result:{ id:string;amount_minor:number } }>("select wg_create_order($1,$2,$3,$4,$5,$6,$7) result",[campaign,users[0],kind,code,currency,q,key])).rows[0].result;
    await assert.rejects(createOrder("entries","entries-5",5,"USD","c8919f46-28b0-4ad7-aaac-a22b80e86bf2"),/PAID_ENTRIES_BLOCKED/);
    const service=await createOrder("service","homepage-review",1,"CAD","d8919f46-28b0-4ad7-aaac-a22b80e86bf2"); assert.equal(service.amount_minor,1200);
    await db.query<Record<string, unknown>>("update wg_orders set stripe_session_id='cs_service' where id=$1",[service.id]);
    await db.query<Record<string, unknown>>("select wg_fulfill_payment('evt_service','checkout.session.completed',$1,'cs_service','pi_service',1200,'cad',now())",[service.id]);
    assert.equal((await db.query<Record<string, unknown>>("select wg_public_count($1) count",[campaign])).rows[0].count,2,"services issue no entries");
    await db.query<Record<string, unknown>>("update wg_campaigns set paid_entries_enabled=true,processor_approved_at=now() where id=$1",[campaign]);
    const first=await createOrder("entries","entries-10",10,"USD","e8919f46-28b0-4ad7-aaac-a22b80e86bf2");
    const retry=await createOrder("entries","entries-10",10,"USD","e8919f46-28b0-4ad7-aaac-a22b80e86bf2"); assert.equal(first.id,retry.id);
    await assert.rejects(createOrder("entries","entries-15",15,"USD","e8919f46-28b0-4ad7-aaac-a22b80e86bf2"),/IDEMPOTENCY_CONFLICT/);
    await db.query<Record<string, unknown>>("update wg_orders set stripe_session_id='cs_first' where id=$1",[first.id]);
    await assert.rejects(db.query<Record<string, unknown>>("select wg_fulfill_payment('evt_bad','checkout.session.completed',$1,'cs_first','pi_first',1,'usd',now())",[first.id]),/PAYMENT_MISMATCH/);
    const pay = (event:string) => db.query<Record<string, unknown>>("select wg_fulfill_payment($1,'checkout.session.completed',$2,'cs_first','pi_first',1200,'usd',now())",[event,first.id]);
    await Promise.all([pay("evt_first"),pay("evt_first"),pay("evt_first_again")]);
    assert.equal((await db.query<Record<string, unknown>>("select count(*)::int count from wg_entries where order_id=$1",[first.id])).rows[0].count,10);
    const second=await createOrder("entries","entries-25",25,"MXN","f8919f46-28b0-4ad7-aaac-a22b80e86bf2"); assert.equal(second.amount_minor,54435);
    await db.query<Record<string, unknown>>("update wg_orders set stripe_session_id='cs_second' where id=$1",[second.id]);
    await db.query<Record<string, unknown>>("select wg_fulfill_payment('evt_second','checkout.session.async_payment_succeeded',$1,'cs_second','pi_second',54435,'mxn',now())",[second.id]);
    assert.equal((await db.query<Record<string, unknown>>("select count(*)::int count from wg_entries e join wg_participants p on p.id=e.participant_id where p.auth_user_id=$1",[users[0]])).rows[0].count,36);
    assert.equal((await db.query<Record<string, unknown>>("select wg_public_count($1) count",[campaign])).rows[0].count,37);
    await db.query<Record<string, unknown>>("select wg_reverse_payment('evt_refund','charge.refunded','pi_first','refunded')");
    assert.equal((await db.query<Record<string, unknown>>("select wg_public_count($1) count",[campaign])).rows[0].count,27);
    await pay("evt_first_late"); assert.equal((await db.query<Record<string, unknown>>("select wg_public_count($1) count",[campaign])).rows[0].count,27);
    assert.equal((await db.query<Record<string, unknown>>("select wg_take_rate_limit('test-key',2,600) allowed")).rows[0].allowed,true);
    assert.equal((await db.query<Record<string, unknown>>("select wg_take_rate_limit('test-key',2,600) allowed")).rows[0].allowed,true);
    assert.equal((await db.query<Record<string, unknown>>("select wg_take_rate_limit('test-key',2,600) allowed")).rows[0].allowed,false);
    for(const role of ["anon","authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query<Record<string, unknown>>("select * from wg_participants"),/permission denied/);
      await assert.rejects(db.query<Record<string, unknown>>("select * from wg_orders"),/permission denied/);
      await assert.rejects(db.query<Record<string, unknown>>("select wg_public_count($1)",[campaign]),/permission denied/);
      await assert.rejects(db.query<Record<string, unknown>>("select wg_claim_free($1,$2,$3,$4)",[campaign,users[0],"test@example.com",application]),/permission denied/);
      await assert.rejects(db.query("select wg_record_judged_selection($1,$2,'{}'::jsonb)",[campaign,users[0]]),/permission denied/);
      await db.exec("reset role");
    }
    const late=await createOrder("entries","entries-5",5,"USD","a9919f46-28b0-4ad7-aaac-a22b80e86bf2");
    await db.query<Record<string, unknown>>("update wg_orders set stripe_session_id='cs_late' where id=$1",[late.id]);
    await db.query<Record<string, unknown>>("update wg_campaigns set end_at=now()-interval '1 second' where id=$1",[campaign]);
    assert.equal((await db.query<Record<string, unknown>>("select wg_fulfill_payment('evt_late','checkout.session.completed',$1,'cs_late','pi_late',600,'usd',now()) result",[late.id])).rows[0].result,"review");
    await assert.rejects(db.query<Record<string, unknown>>("select wg_claim_free($1,$2,$3,$4)",[campaign,users[0],"test@example.com",application]),/CAMPAIGN_CLOSED/);
    await db.query("update wg_campaigns set status='selection_pending' where id=$1",[campaign]);
    const participant = (await db.query<{id:string}>("select id from wg_participants where auth_user_id=$1",[users[1]])).rows[0].id;
    const decision={rubric_version:"local-test-only",reviewers:["Local Test Reviewer"],rationale:"Documented local test rationale, not an actual review."};
    await assert.rejects(db.query("select wg_record_judged_selection($1,$2,$3)",[campaign,participant,{}]),/REVIEW_REQUIRED/);
    await assert.rejects(db.query("select wg_record_judged_selection($1,$2,$3)",[campaign,participant,decision]),/PAYMENT_RECONCILIATION_REQUIRED/);
    await db.query("update wg_orders set status='failed' where id=$1",[late.id]);
    await assert.rejects(db.query("select wg_record_judged_selection($1,$2,$3)",[campaign,users[1],decision]),/INELIGIBLE_APPLICATION/);
    const selection = (await db.query<{result:{entry_number:string;eligible_pool_count:number;eligible_application_count:number;pool_digest:string}}>("select wg_record_judged_selection($1,$2,$3) result",[campaign,participant,decision])).rows[0].result;
    assert.equal(selection.eligible_pool_count,27);
    assert.equal(selection.eligible_application_count,2);
    assert.equal(selection.entry_number,claims[2].rows[0].result.entry_number,"a free-only applicant can be selected over an account with 26 valid entries");
    assert.match(selection.pool_digest,/^[a-f0-9]{64}$/);
    assert.match(selection.entry_number,/^VAELTX-/);
    await assert.rejects(db.query("select wg_record_judged_selection($1,$2,$3)",[campaign,participant,decision]),/SELECTION_NOT_READY/);
    assert.equal((await db.query<{count:number}>("select count(*)::int count from wg_winner_selections")).rows[0].count,1);
  } finally { await db.close(); }
});
