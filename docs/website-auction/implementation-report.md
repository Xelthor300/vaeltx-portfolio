# VAELTX Website Auction — continuation evidence

Updated: 2026-10-05 UTC (2026-10-04 local). The interrupted authenticated Stripe TEST journey and implementation are complete. Production remains unstarted. Full commercial launch acceptance and unrestricted `VAELTX_WEBSITE_AUCTION_CONTINUATION_COMPLETE` are not claimed while the specific validation limitations below remain.

Repository: https://github.com/Xelthor300/vaeltx-portfolio · draft OPEN [PR #4](https://github.com/Xelthor300/vaeltx-portfolio/pull/4) · branch `feat/live-website-auction`. The approved portfolio/main, existing QA users, TEST payments, audit history and fixtures are preserved. No merge, PR closure or branch deletion.

## Production invariants

Published preparation: https://vaeltx-portfolio.vercel.app/website-auction

Hosted production auction: `c5a29233-c51c-4032-bd5f-efcf9ca1b656`, slug `website-auction`.

| Property | Verified final state |
| --- | --- |
| status | ready_for_activation |
| AUCTION_ALLOW_ACTIVATION | false |
| Stripe mode | test; no LIVE switch |
| starts_at / original_ends_at / ends_at | NULL / NULL / NULL |
| Production bids / LIVE-verified participants | 0 / 0 |
| Commercial policies / eight activation checks | {} / all false |
| Previous grant | cancelled; paid entries and services disabled; records retained |

The user's timestamp names map to the actual database columns above. QA accounts have global profiles and explicit TEST access; bids/offers/payments/onboarding belong to TEST auctions, not the production auction. No real first bid or timer start occurred.

## Deployment receipt

Final application SHA: `44b044daa8af5dc2f3a80cdb55c98ce291c992eb`. Subsequent report-only commits do not change application behavior.

Production: `dpl_FcFHvwPaqz79VpgFzcqafDNmrsZh`, https://vaeltx-portfolio-f9hytkv4y-xelthor300s-projects.vercel.app. [Inspector](https://vercel.com/xelthor300s-projects/vaeltx-portfolio/FcFHvwPaqz79VpgFzcqafDNmrsZh).

Protected QA preview: `dpl_6npeQm148qJDigqyLwXUzpkkRfFf`, https://vaeltx-portfolio-a6glvqjyd-xelthor300s-projects.vercel.app. Existing exact branch alias: https://vaeltx-portfolio-git-feat-live-webs-7bb286-xelthor300s-projects.vercel.app. Runtime selects the isolated countdown fixture; Vercel authentication remains enabled. Provider readiness/CI receipts are appended after completion below.

Local verification: **52 tests passed, zero failed/skipped**, TypeScript, ESLint and optimized Next.js build pass. Tests execute all 13 migrations and actual PostgreSQL functions in PGlite. These are fixture tests, not commercial buyer validation. Existing contact, Meta consent/event-counting, routes and concept-project regressions pass.

## Phase 1 — authenticated Stripe TEST E2E

Continued existing `qa-ui-20261004-email-e2e`, auction `5c8ef703-f829-4c46-85bb-825378ad0526`. A/B completed native signup, actual Gmail verification links, business profiles and successful hosted Stripe TEST card setup. Actual setup webhook events: `evt_1UMxjn4efgtFxxrtYAfqhe1w`, `evt_1UMxrO4efgtFxxrtpAapM6UC`. No real card or funds; no card/CVC stored.

Native bids: A USD 100 (13), B USD 110 (14), B USD 350 (15). Two authenticated browsers observed leader change/reserve transition. The controlled TEST deadline was accelerated; bid 15 added 120 seconds. This is not a natural 25-day wait.

Authoritative close: **2026-10-04T22:32:24.939220Z**. Winner B, immutable offer `6dd77a70-7e85-4961-ad4a-4642fc9fce29`, **35000 USD minor units / USD 350**, server-created 24-hour deadline. Winner email actually received in Gmail (`1a1090d7dd59943f`, INBOX/SENT).

Native Checkout: `cs_test_a1bG5LScBRDXFe31No0p6CbVJg50X7MIuwGoKm7Yvt2gf3YOcQD84NW7e2`. Actual Stripe: `livemode=false`, USD 350; PaymentIntent `pi_3UN0Ao4efgtFxxrt0hRLyAfI` succeeded with amount_received35000; Charge `ch_3UN0Ao4efgtFxxrt08QsHTKJ` paid **2026-10-05T00:54:35Z**.

Actual signed webhook `evt_1UN0Aq4efgtFxxrtXginLDHR` reached the production handler **00:54:38.560148Z** and changed only the TEST offer to paid/Checkout paid, TEST auction completed. Replay of the actual event, freshly signed with the configured TEST webhook secret, returned HTTP200 `{"received":true}`. Counts stayed one event, one payment-paid audit and two payment-confirmation messages (one per audience). No duplicate payment processing.

Native B onboarding: denied before payment, unlocked after payment, fictional QA project brief saved. The same verified TEST-paid account was then authenticated on production: production onboarding remained denied, confirmed production payment required. Native owner signup/verification/dashboard showed private bidders, all three bids, winner USD 350, paid and email receipts. Personal owner address is server-only and redacted from saved public evidence.

Participant payment confirmation: `1a1098e924f56a57`, INBOX/SENT,00:55:00Z. Private owner confirmation actually observed in native Gmail **Recibidos**. A previous owner new-bid email was received in **Spam**. Receipt is proved; universal Inbox/Primary placement is not.

## Phase 2 — SMTP, premium email and verification UX

Supabase custom SMTP and auction SMTP use **VAELTX <vaeltxn@gmail.com>**, smtp.gmail.com:465, validated TLS and privately supplied Google App Password. Password excluded from Git/client/report; Auth auto-confirm false. Real signup, resend and verification succeeded. Owner destination comes only from `AUCTION_ADMIN_EMAIL`. Resend remains available for future owned-domain migration; no custom domain is required for the tested Gmail transport. No domain/paid plan purchased.

Reusable HTML/text templates cover confirmation/sign-in, accepted bid, outbid, reserve, closure/no-sale, winner/backup, payment reminder/expiry/confirmation, onboarding and private owner review. Neutral canvas, white card, charcoal/orange, escaped real text, tables/inline CSS, one CTA/fallback URL; no image/video dependency. QA badge and explicit TEST disclaimer remain prominent. Participant field whitelist excludes competing name/email/phone/business/account. Owner cards retain operational contacts/counts/bid references.

Representative messages used separate `qa-design:20261005:*` keys: manual design samples, not extra bid events. Three outbox samples (outbid/payment/owner) sent once, attempts=1, persisted HTML+text. Actual received outbid MIME is multipart/alternative, text/plain + text/html. Native Gmail desktop inspected. Exact received HTML was inspected at 390px: no overflow, readable amounts/CTA/footer. This is responsive received-HTML browser evidence, **not native Gmail mobile-app validation**. Apple Mail/Outlook not observed.

Supabase confirmation/sign-in HTML templates were saved in the owner dashboard and reread; redesigned Auth mail arrived and verified successfully. **Auth MIME limitation:** built-in Supabase authentication mail was observed as text/html only, without a separate plain-text MIME part. Auction outbox messages have both. Do not claim universal Auth multipart fallback.

Verification UI: CHECK YOUR EMAIL, masked address, Spam/Junk/Promotions, unobtrusive Not spam guidance, optional public-sender contact and Promotions-to-Primary advice; explicit no guaranteed Inbox delivery. Important outbid/winner/reminder/payment/onboarding messages explained. Resend has60-second UI cooldown, fresh challenge, server per-email HMAC1 per minute plus network limits. Native resend/success EMAIL VERIFIED / CONTINUE TO ACCOUNT observed.360px guidance readable without document overflow. Narrow containers now choose compact Turnstile; [Cloudflare flexible widgets require at least 300px](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).

### Outbid semantics, throttling and safe delivery

The database locks the auction, identifies the immediately prior eligible authoritative leader, and creates an outbid event only when another valid committed bid takes that lead. Rejected/duplicate/same-user bids and historical non-leaders do not receive extra events.

Executed PostgreSQL sequence A110 → B202 → C250 → A270 → B300 notifies A/B/C/A respectively. First A event carries previous 110, current 202, next 212 USD. A is not re-notified for C250 merely because price increases. Later loss after regaining produces a new A event, deferred at least 10 minutes; it is retained, never discarded by the throttle. Rapid genuine transitions can queue; account/Realtime remains current. Amounts represent the authoritative committed transition, and time remaining is labeled at email preparation.

Unique keys per committed bid, leased outbox, persisted exact recipient/HTML/text/transport before SMTP, stable Message-ID and pre-send marker prevent ordinary duplicate retries. Explicit SMTP rejection may retry; ambiguous DATA/disconnect or failed receipt persistence goes to manual review without automatic resend. SMTP does not provide guaranteed exactly-once delivery. Resend retains its safe-window idempotency behavior.

Payment reminder: twice exercised existing reconcile() on separate TEST auction `da88458f-95cf-4abc-b56c-962162d87dca`, with manually prepared 19-hour-old pending offer/about 5 hours left. Original paid offer unchanged. One reminder per audience queued/sent, attempts=1. B received `1a109b41ce2f47e0` INBOX **01:36:01Z**; owner SMTP/SENT proved, owner Inbox not newly inspected. This is an accelerated isolated window, not an observed natural 18-hour wait. Tests cover strict final six-hour boundary, paid/expired exclusions.

Minute Cron/pg_net produced actual authenticated HTTP200 responses (8 visible in final three-hour window). Private operations returns activation=false, Stripe TEST and SMTP; it never approves/starts production.

## Phase 3 — first-valid-bid start

Implemented: ready_for_activation → gated deliberate owner approval → waiting_for_first_bid/datesNULL → first valid committed bid → active. Tested only in TEST fixtures. Production did not enter waiting.

Row lock validates participant/profile/card/mode/eligibility/request/minimum before setting dates. Invalid bids never start. First acceptance atomically writes clock_timestamp(), original/current end=start+exactly25days, bid, snapshot and one auction_started_by_first_valid_bid audit. Idempotent requests do not reset. Production commercial/launch gates still apply to waiting and first start.

Hosted concurrency: **3×20 independent simultaneous HTTP RPC calls** on TEST auctions `66f34bef-b369-444f-bd6e-5a78471c11c8`, `7deec9f1-c175-4ad5-9d63-9bd3ed15f84b`, `10304d0e-9c49-413c-b9ae-e039a12ec270`. Each accepted one USD 100, rejected 19 at authoritative next minimum USD 110, one start audit, original=current end, **2160000 seconds**. Cancelled race fixtures after proof; records retained.

Native fixture `1a4c41be-eb90-48ff-ae5d-4fb68a957008` / qa-ui-20261005-countdown: waiting displayed no fake countdown; first-bid confirmation explained 25 days. B100 accepted start **01:18:31.960343Z**, original/current end **2026-10-30T01:18:31.960343Z**, one audit. Later deliberate TEST-only deadline acceleration enabled close QA; start unchanged. This is fixture preparation, not normal production deadline mutation.

## Phase 4 — live authoritative countdown

Server time/end anchored to monotonic performance.now(), latency compensated; local one-second ticks, no per-second DB calls.15-second reconciliation plus visibility/focus/online/Realtime/subscription/reconnect and apparent zero. Zero shows closing and asks server, never selects a winner. Waiting/paused/closed have distinct non-running display. Four tabular cells, no flash/sound; changing digits hidden from assistive announcements, meaningful static deadline.

Native samples at01:20:29.851 /01:20:31.120 /01:20:32.293Z: seconds **03→02→01**. Two browsers approximately synchronized; unit tests use differing clock anchors/wall-clock independence.

Controlled TEST deadline01:22:36.539014Z; B350 accepted01:21:45.401Z extended to **01:24:36.539014Z**, exactly +120 seconds and reserve met. Both browsers adopted it. Actual incoming postgres_changes frames carried sanitized state and errors=null. Multiple-extension database tests add 120 seconds twice without resetting start/original end.

Actual server close **01:24:40.458864Z** selected B350/payment pending; incoming Realtime close captured. Fresh subscription/reconnect plus subsequent state update also captured. An early empty trace used an incorrect buffer cursor; saved sequence-zero history recovered actual frames and supersedes it.

320px DOM: document width 320,timer width 284,no overflow. Reduced-motion/accessibility implemented/inspected; full native assistive-technology audit not performed. Focus/foreground hooks implemented; dedicated native background-return timing test remains unobserved.

## Acceptance matrix

PASS refers only to the stated evidence level. FAIL identifies an explicitly requested validation still unproved, not an invented malfunction.

| Requested item | Result / evidence |
| --- | --- |
| Phase1 / authoritative close / winner | PASS native authenticated journey + hosted offer |
| Winner admin visibility | PASS verified owner browser |
| Winner TEST Checkout / successful payment | PASS native + actual Stripe USD 350 receipt |
| Signed webhook / idempotency / payment confirmed | PASS provider event/replay, one event/audit |
| Onboarding unlock / TEST isolation | PASS prepay denial, QA brief, production denial |
| Owner payment notification | PASS actual Recibidos; earlier bid received Spam |
| Supabase SMTP / sender / signup verification | PASS actual Gmail deliveries/links |
| Real-hostname Turnstile | PASS native signup/setup/bid; direct Auth without CAPTCHA rejected |
| Email design / desktop Gmail | PASS received HTML/MIME + native desktop |
| Gmail mobile | FAIL complete native-app validation; received390px HTML PASS |
| Plain-text fallback | PASS auction multipart; FAIL universal Auth fallback (HTML-only) |
| Admin privacy / no competitor PII | PASS whitelist/escaping, actual participant mail, public checks |
| Notification idempotency / rapid bidding | PASS transition keys/deferred events/tests/samples1attempt |
| Verification panel / resend / cooldown / success | PASS native link/resend/success, masked guidance/server guards |
| Immediate leader-only / regained lead / next minimum | PASS executed database sequence + native leader-loss receipt |
| First-bid / waiting / concurrency | PASS PostgreSQL, native first bid, hosted3×20 |
| Live countdown / server clock / one-second ticks | PASS native samples/two browsers + clock tests |
| Realtime deadline / anti-sniping / server close | PASS incoming frames +120 and correct close |
| Reconnect/focus | PASS reconnect/hooks; FAIL complete native foreground timing test |
| Countdown mobile | PASS scoped320px DOM inspection |
| Countdown accessibility | PASS implementation; FAIL complete native assistive audit |
| Typecheck / lint / tests / build | PASS, 52 tests, final application |
| CI | Provider receipts appended below |
| Production status / flag / dates / real bids | PASS ready_for_activation /false /NULL /0 |
| Full LIVE launch acceptance | BLOCKED; intentionally not executed |

## Privacy and evidence preservation

QA is TEST/preview-only, allowlisted, private QA-run/access records. Anonymous snapshots exclude TEST auctions; production QA-session404. Public bid history uses anonymous aliases; contacts/Stripe/outbox/admin details stay server-side. Authorization validates Supabase user, not editable metadata. Origin/JSON/HMAC limits/challenge checks remain.

Public/private HTTP regression: expected200public, admin401/404, operations404, QA-session404, unsigned webhook400. No configured owner email, Supabase service key, Stripe secret or operations secret in inspected responses. This is scoped evidence, not a full penetration-test claim.

Source migrations match hosted history, including20261004214013SMTP,20261004220126QA,20261005010405email transitions,20261005011241firstbid. Advisor INFO for service-only va_qa_runs/no browser policy is intentional deny-by-default. Existing leaked-password-protection warning remains; auction uses email links.

Local evidence under Git-ignored output/auction-qa/ may contain private QA detail; do not publish wholesale:

- payment-e2e-receipt.json, authenticated-admin-paid.txt, authenticated-onboarding-paid.txt, admin-payment-mailbox-receipt.txt, test-payment-production-onboarding-denied.txt.
- premium-email-transport-evidence.json, premium-email-desktop.png, received-outbid.html, received-email-mobile-390.png, verification-success.txt, verification-guidance-mobile-360.png.
- hosted-first-bid-races.json, native-first-bid-start.json, native-countdown-samples.json, countdown-realtime-history.json, countdown-realtime-reconnect.json.
- preflight.json, final-production-privacy.json, final-tests.txt.

Paid fixture/history preserved. Separate pending countdown/reminder offers remain clearly TEST; no real obligations. Preview currently points to countdown fixture, while the completed paid journey remains preserved in the database/evidence. No QA user/payment/audit deletion.

## OWNER ACTION REQUIRED — future activation

1. Approve actual seller identity/address, eligible jurisdictions, tax/invoicing, refund, ownership/license, privacy/retention, governing law and delivery timeline. Keep unresolved values pending. Never copy QA placeholders into production.
2. Complete processor business-model review and intentionally configure matching LIVE credentials/webhook only in a separately approved task. TEST success is not live acceptance.
3. Review deliverability evidence. Gmail SMTP works without custom domain, but native Gmail mobile/Apple Mail/Outlook, Auth plain-text MIME and the specific foreground/assistive/performance observations above remain unproved. Future owned-domain/Resend migration is optional, not a present sender blocker.
4. After review, obtain explicit future owner approval. Approval would allow waiting_for_first_bid, not immediate timer start; only first valid REAL bid starts the 25-day clock. This task stops before approval/action.

No live funds, paid plan, domain registration, real bid or production start performed.

## Final provider completion — 2026-10-05T01:53Z

Both final deployments are READY. Production alias points to `dpl_FcFHvwPaqz79VpgFzcqafDNmrsZh`; the protected branch alias points to `dpl_6npeQm148qJDigqyLwXUzpkkRfFf`, both application SHA `44b044daa8af5dc2f3a80cdb55c98ce291c992eb`.

Final application CI: PASS [37252792967](https://github.com/Xelthor300/vaeltx-portfolio/actions/runs/37252792967), PASS [37252789205](https://github.com/Xelthor300/vaeltx-portfolio/actions/runs/37252789205). These verify the 52-test revision, not only an earlier build.

Production preflight at **01:53:08.101Z**: actual stable production URL, ready_for_activation, all dates NULL, zero public bid/participant counters, activation false, Stripe TEST, SMTP configured, Auth auto-confirm false, direct Auth request without CAPTCHA rejected with HTTP 400 / captcha_failed. Final 11-route privacy scan passed; authenticated operations200 returned processed=0, activationAllowed=false, stripeMode test, emailTransport smtp. Compact Turnstile was actually observed on the final production account page at 360px, challenge successful and fully within its card; screenshot `turnstile-compact-mobile-360.png`.

Observed recovery limitations: one production verification callback and one Node fetch encountered transient connection/PKCE failures during QA. A fresh verification link was requested and successfully verified; the subsequent authenticated production onboarding-isolation check passed. Later read-only preflight succeeded. No success is inferred from the failed attempts.

STOPPED BEFORE ACTIVATION. Production remains unstarted. PR #4 remains draft/open and the feature branch is retained.

## Final launch request — 2026-10-05T07:32Z

The owner now conditionally authorizes real launch, only after all hard blockers pass. Initial hosted SQL and actual production preflight confirmed ready_for_activation, activation=false, all three dates NULL, zero production bids, Stripe TEST. No discrepancy and no activation mutation occurred.

The Stripe connector now exposes LIVE context for the existing VAELTX account (`acct_1ULYYw4efgtFxxrt`). This is access availability, not proof of this website auction's business-model approval or deployed LIVE configuration. The existing server credential is TEST. A read-only account API check using that credential returned country MX/business_type sole_prop and enabled flags, but no usable seller legal name, business address or business profile. TEST enabled flags were not used as evidence of LIVE approval. Private raw account evidence is Git-ignored; no personal identity or credential was published.

Hard blockers only:

1. Production commercial_terms is empty. Required approved fields remain missing: seller_identity (legal seller name/address), eligible_countries, tax_policy (tax/invoicing/full payable-price treatment), governing_law, refund_policy, ownership_policy (handoff/licenses), privacy_policy (retention/rights/transfers) and delivery_timeline. Account country is not an eligible-country policy or governing-law agreement. These cannot be inferred or invented.
2. This exact business model's LIVE acceptance has not been verified; the deployed integration still uses TEST credentials/mode and its TEST webhook secret. A secure matching LIVE credential/webhook configuration is required after the commercial blocker is resolved. No LIVE endpoint/key mutation, mode switch, partial activation or first bid was performed.

Known client compatibility observations and Auth HTML-only MIME are non-critical under the owner's new launch instructions and are not launch blockers by themselves. Completed TEST/SMTP/countdown/admin evidence was preserved and not rerun. Remaining security/payment checks were not expanded into redundant QA after the commercial hard stop.

Result: VAELTX_WEBSITE_AUCTION_NOT_ACTIVATED. Production remains ready_for_activation, activation=false, timestamps NULL, bids0. Conditional launch authorization does not satisfy missing commercial policies or LIVE evidence.


## Post-Codex completion — 2026-10-05 final handoff

The remaining technical launch work was continued after the Codex session limit.

- PR #4 was marked ready and squash-merged to `main` as `65542e9ba104e9504664f1496c1212dd81ab6aa5`.
- Vercel production deployment `dpl_7zgw4bqAWxRGbsqmV9LTuChFYE4f` is READY and serves the stable production alias.
- Winner Checkout was hardened for LIVE use: Stripe Adaptive Pricing is enabled for eligible hosted Checkout sessions, billing address is required, customer name/address may be saved, optional tax ID collection is enabled, post-purchase invoice creation is enabled, and a LIVE receipt email is requested.
- Stripe LIVE account `acct_1ULYYw4efgtFxxrt` reports card payments and payouts enabled, details submitted, and no currently-due/past-due verification requirements.
- Stripe Tax settings are LIVE/active, but there are currently no tax registrations recorded in Stripe.
- A fresh enabled LIVE webhook endpoint was created for `/api/website-auction/webhook` with only `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired`; its signing secret was stored only as a Vercel Production sensitive environment variable.
- Production commercial terms now include the approved MX/US/CA eligibility, four-week delivery terms, refund/cancellation rules, ownership/reusable-IP rules, one-year operational retention, Mexico-based governing-law wording, seller/privacy wording, exact-winning-bid/no-hidden-Stripe-fee policy, Stripe receipt/post-purchase invoice process, and USD/local-presentment policy.
- Launch checks now PASS internally for seller identity verification, eligibility, delivery terms, email delivery, end-to-end QA, and Stripe business-model policy review. The model has no bid fee, paid bid credits, random winner, or chance-based mechanism; Stripe's Mexico restricted-business list specifically prohibits penny/bid-fee auctions, which this implementation is not.
- Production remains deliberately `ready_for_activation`, with zero real bids and no start/end timestamps.

Remaining hard blockers:

1. `tax_and_invoicing=false`: Stripe receipts/post-purchase invoices do not establish a Mexican SAT CFDI process. A compliant fiscal path must exist for any CFDI or other mandatory fiscal document that applicable law requires.
2. `live_payments=false`: the application still needs its Vercel Production `STRIPE_SECRET_KEY` replaced with the dedicated LIVE server key created in Stripe, and `AUCTION_STRIPE_MODE=live`. The LIVE webhook secret is already configured. Do not activate until the deployed app can authenticate the LIVE account with its own server credential.

No real bid was created and the 25-day clock remains unstarted.
