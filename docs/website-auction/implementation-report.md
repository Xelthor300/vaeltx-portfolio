# VAELTX website auction — implementation and evidence

State: implementation deployed in preparation; production activation remains blocked. This report does not claim the complete `VAELTX_WEBSITE_AUCTION_READY` acceptance standard.

Repository: https://github.com/Xelthor300/vaeltx-portfolio

Branch: `feat/live-website-auction`

Production route: https://vaeltx-portfolio.vercel.app/website-auction

## Deployment receipt — 2026-10-04

Production application commit: `8a345ba6226b54f8c5b35518cf6f627bcc211774`. The report-only commit after this revision does not change deployed application code.

Production deployment: `dpl_un1JwwFAwE5eqEtVobuWTbT7csuq`, READY, target production. Vercel metadata independently confirms the branch, application SHA and stable production alias. [Deployment inspector](https://vercel.com/xelthor300s-projects/vaeltx-portfolio/un1JwwFAwE5eqEtVobuWTbT7csuq).

Preview: https://vaeltx-portfolio-pwffpb1nz-xelthor300s-projects.vercel.app/website-auction — implementation revision `a244c5781c0c6ed633ef831351ba1ebc739ec698`, protected by Vercel authentication. Its state endpoint was verified using authenticated Vercel CLI access. Production additionally contains the subsequent Remotion text-color correction.

Draft review: https://github.com/Xelthor300/vaeltx-portfolio/pull/4. The superseded grant PR is closed. `main` remains the approved portfolio branch; the published auction application is the explicitly deployed feature revision.

GitHub CI: PASS on the production application SHA, [run 37235452614](https://github.com/Xelthor300/vaeltx-portfolio/actions/runs/37235452614) and [run 37235449856](https://github.com/Xelthor300/vaeltx-portfolio/actions/runs/37235449856). Typecheck, lint, 34 tests and build passed.

Production HTTP evidence: 15 routes checked, expected 200/404/401/308/410 responses and no configured private administrator email, Supabase service credential, Stripe secret or operations secret in their responses. Unsigned webhook request returns 400. Authenticated operations access reaches the handler and returns 503, `Email delivery is not configured.` This is a verified remaining dependency, not a successful notification-worker acceptance test.

An actual Stripe TEST Checkout setup session was created for a clearly labeled, blocked QA fixture and expired without collecting a card or charging a customer. Stripe event `evt_1UMwkc4efgtFxxrt3cMn6P3J` reached the production webhook, which changed setup `828a7d4e-46e2-4e5d-9ad5-89e9391d0f16` to expired. This verifies actual signed provider delivery for `checkout.session.expired`; it does not verify successful card setup or winner payment. Test webhook endpoint: `we_1UMwP24efgtFxxrtBS4y0x6L`.

Hosted SQL final check: production auction `c5a29233-c51c-4032-bd5f-efcf9ca1b656` is `ready_for_activation`, all three dates NULL, all eight activation checks false, commercial policies empty, real bids 0, real verified bidders 0 and notification rows 0. The old campaign remains cancelled with both paid entries and services disabled. The minute Cron job exists and is enabled; it has no auction work to run in preparation.

## Recorded auction configuration

| Requirement | Configuration / evidence |
| --- | --- |
| Auction status | `ready_for_activation`; activation flag false; all launch checks false |
| Start / original end / current end | NULL / NULL / NULL; NOT STARTED |
| Duration | Exactly 25 days from explicit owner activation, enforced in PostgreSQL |
| Starting bid / public reserve / increment | USD 100 / USD 350 / USD 10 |
| Currency / bidding fee | USD only / no fee |
| Bid limit | No lifetime count limit; temporary abuse throttles only |
| Maximum bid | No commercial cap; integer minor units respect Stripe's 8-digit technical transaction limit |
| Custom amounts | 125 after 110 accepted; next minimum becomes 135 |
| Anti-sniping | Accepted bid with <=120 seconds remaining adds 120 seconds to the existing deadline |
| Winner / reserve | Highest valid eligible bid; no sale and no winner below USD 350 |
| Payment deadline | Immutable offer has 24 hours from server closing |
| Backup | Eligible next bidder receives a new offer at that bidder's own highest valid bid, never the original winner's price |
| Current real bid / valid bids / bidding participants | No accepted bid / 0 / 0 |
| Reserve | Not met |
| Prior campaign | Cancelled; paid entries and services disabled; all history retained |

The dedicated Supabase project remains `vaeltx-website-grant`, ref `yrkabjxmifiiseymystk`. Its existing project name is retained to avoid replacing the database. The new system uses separate `va_` tables. The four existing `wg_` migrations are retained, and source filenames match the actual hosted migration history.

## Implemented routes and behaviors

- `/website-auction`: service scope, truthful state, public reserve, server clock and real counters, four disclosed independent concept projects, FAQ, and a three-second Remotion composition with a reduced-motion fallback.
- `/website-auction/bid`: minimum and custom amounts, quick amount choices, separate review and explicit confirmation, idempotent submission, fresh state after rejection.
- `/website-auction/account`: verified-email session, business profile, explicit age/terms/privacy/commitment acceptance, Stripe card verification, own bids and offers.
- `/website-auction/history`: accepted database bids with anonymous aliases; no private contact or Stripe references.
- `/website-auction/terms`: auction rules and service scope; missing seller policies are visibly pending and block activation.
- `/website-auction/winner`, `/payment`, `/onboarding`: private winner offers, explicit fixed-amount Checkout, confirmed-payment project brief. Paid offers from test auctions cannot unlock production onboarding.
- `/admin/website-auction`: verified owner email plus private administrator authorization; unauthorized page returns 404. The API requires authorization. Directory, bid timeline, leader, winner contact/payment state, extensions, notification receipts and audits are private; records support pagination.
- Old grant pages redirect permanently to the auction; old campaign APIs return 410.

Only sanitized production `va_public_state` is published to Realtime. Browser roles have SELECT on that snapshot and are denied every private table and mutation RPC. The backend validates the authenticated Supabase user; it never authorizes from editable user metadata. Sessions use secure HttpOnly cookies and are refreshed through the Next.js proxy. Mutations require the configured Origin and JSON; sensitive requests use persistent HMAC rate limits. Sign-in and card setup require a verified Turnstile challenge.

## Payment and notification implementation

Stripe account ownership is checked against the configured VAELTX account. Hosted Checkout setup collects a reusable card reference; backend verification checks session ownership, succeeded SetupIntent, payment-method customer, card type, and test/live mode. No card number or CVC is stored. There are no automatic off-session charges.

Winner Checkout gets its amount, currency, customer and deadline from the immutable database offer. Raw-body webhook signature checks precede processing. A paid session, succeeded PaymentIntent and paid Charge must match the offer, customer, USD amount and environment. Event IDs are idempotent. The Charge timestamp controls deadline eligibility; a late paid receipt is held for owner review and cannot silently award a website. Open/uncertain checkouts must be reconciled or expired through Stripe before a replacement offer is created. Checkout expiry parameters are persisted so repeated creation requests reuse identical idempotency parameters, including payments initiated in the last 30 minutes.

Transactional email uses a durable outbox. Each committed production bid has one unique owner notification key and one participant confirmation; reserve is announced once, outbid notifications are limited to one per bidder per ten-minute interval. Winner, no-sale, reminders, expiry, backup, payment and onboarding notifications are separate. Leases prevent concurrent workers from claiming the same pending row. Exact recipient and message content are persisted before sending; retries reuse the same Resend idempotency key. Provider receipts are recorded. Uncertain delivery after the provider's 24-hour idempotency window is held for manual reconciliation instead of risking a duplicate. This is implemented delivery protection, not evidence that real messages have arrived.

A Supabase Cron job runs each minute and uses `pg_net` with an encrypted Vault authorization secret to call the production operations endpoint only while work exists. It never starts an auction. Read-only preparation has no production bids or pending notifications. Live scheduler delivery and email receipts must be proved before activation.

## Verified evidence

- TypeScript, ESLint and production build pass locally.
- 34 automated tests pass, including actual PostgreSQL functions in PGlite, amount parsing, concurrency minimum enforcement, duplicate requests, reserve/no-sale, immutable winner price, deadline extension, backup own-price, late paid receipts, permissions, activation gates, notification dedupe and Stripe signature tampering/staleness. These are automated fixture evidence, not real buyer validation.
- Three hosted Supabase race trials used 20 concurrent HTTP RPC requests each: exactly one USD 200 bid was accepted after USD 190; the other 19 received the authoritative USD 210 minimum.
- Hosted anonymous access to participants and bid RPCs was denied. Anonymous snapshots excluded every test auction.
- Hosted Realtime delivered a sanitized timestamp refresh; the production status, zero activity and NULL dates remained unchanged. Subscription waits for PostgreSQL readiness, avoiding an early SUBSCRIBED acknowledgement.
- Public and private route HTTP checks: public pages 200; unauthorized administrator page 404, admin API 401, operations API 404; old pages 308; old API 410; wrong-origin mutation 403.
- Public HTML checks found neither the private administrator email nor the service credential in auction, account, payment, onboarding or approved portfolio pages. Private outbox message recipients are excluded even from dashboard responses.
- Browser layout inspection at 320, 360, 375, 390, 430, 768 and 1440 pixels found no horizontal document overflow. The auction panel precedes decorative motion on mobile. Native screenshots are saved in ignored `output/auction-qa/`.
- Existing Meta consent/event-counting and contact-delivery regression tests pass. Marketing automatic form detection remains disabled; no bid or identity advertising parameters were added. WhatsApp and existing contact routes remain intact.
- Supabase Auth Site URL is saved as the production portfolio origin. Exact production and localhost:3100 callback paths are allowed; the initial localhost:3000 default and empty redirect list were corrected and verified in the owner dashboard.
- Production dependencies: npm audit reports zero advisories. Development tooling still has five high transitive findings stemming from the current `braces` package used by Next ESLint; no fixed newer braces release was available. Do not use `npm audit fix --force` to downgrade the framework configuration.
- Supabase RLS/privilege advisors show no exposed auction-table warning. A separate Auth warning remains for leaked-password protection; the public auction UI uses email links, and QA password accounts use random test-only credentials. [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Raw local reports and screenshots: `output/auction-qa/hosted-check.json`, `responsive.json`, `routes.json`, `production-check.json`, `desktop-1440.png`, `mobile-320.png`. Hosted fixtures are clearly labeled QA, isolated under `environment=test`, cancelled after their run and blocked from participating. No fake activity was written to the production auction.

## Acceptance matrix

PASS identifies the stated evidence level only. A fixture PASS is not live commercial acceptance. FAIL / BLOCKED means the full launch requirement is unproved or unavailable.

| Requested item | Result and evidence level |
| --- | --- |
| Previous Grant/ticket system | DISABLED; hosted campaign flags and production routes verified |
| Auction route | PASS; production HTTP and native browser |
| Admin route / private dashboard | PASS unauthorized exclusion; BLOCKED authenticated owner browser journey |
| Duration / start / end | 25 DAYS; NOT STARTED / NOT STARTED |
| Starting bid / reserve / minimum increment | USD 100 / USD 350 / USD 10; database enforced |
| Unlimited bidding / artificial maximum | PASS no lifetime limit; NONE commercial cap. Stripe's technical ceiling is 99,999,999 minor units |
| Currency | USD, as required by the replacement auction brief |
| Anti-sniping / winner payment deadline | 2 MIN + 2 MIN / 24 HOURS; PostgreSQL fixtures PASS |
| Authentication / email verification | Secure implementation and hosted Auth configuration verified; FAIL launch acceptance pending actual email journey |
| Payment-method verification / Stripe setup | FAIL launch acceptance; card verification code and test expiry delivery verified, successful hosted card setup pending |
| Supabase / RLS / Realtime / concurrency | PASS hosted database, denied browser access, sanitized real subscription and 3 x 20 HTTP race trials |
| Rate limiting / audit log | PASS automated database fixtures; production participation journey pending |
| Private new-bid / winner admin email | FAIL; sender configuration and actual private receipts pending |
| Admin email exposed publicly | NO; production response and local bundle scans |
| Current real bid / valid bid count / verified bidders | USD 0, no accepted bid / 0 / 0 |
| Reserve status | NOT MET |
| Winner logic / below-reserve close / backup / backup own price | PASS PostgreSQL fixtures; actual buyer journey pending |
| Stripe winner Checkout | FAIL launch acceptance; fixed-price implementation present, actual TEST payment pending |
| Stripe webhook / webhook idempotency | PASS actual TEST expiry delivery and automated signature/idempotency fixtures; successful payment webhook acceptance pending |
| Domain | PASS published USD 20 first-year service scope; no registration performed or falsely claimed |
| Hosting | PASS deployed production site and published first-month service scope; no paid hosting plan purchased |
| Scope / revision policy | PASS published 5 pages or one detailed landing page, two revision rounds, explicit exclusions |
| Auction Terms / Privacy / Tax and invoicing | FAIL / BLOCKED; required owner commercial and retention policies missing |
| Stripe business-model review | BLOCKED; no verified live approval |
| Desktop / mobile | PASS native production checks at 1440 and 320; seven-width local layout checks |
| Accessibility / performance / complete production QA | FAIL full acceptance pending measured audit and authenticated journeys; keyboard focus and reduced-motion implementation are not a complete audit |
| Meta Pixel regression | PASS automated consent and event-counting tests; no buyer PII advertising parameters |
| Resend regression | PASS existing contact regression tests; no claim of a new actual contact email or auction receipt |
| WhatsApp regression | PASS retained contact destination and route checks; no message sent |
| Typecheck / lint / tests / build / CI | PASS; production application revision |

Remaining activation blockers are consolidated below. No activation request was executed.

## OWNER ACTION REQUIRED — activation blockers

1. Publish the real legal seller identity/address, eligible countries, governing law, tax/invoicing policy, refund policy, ownership/license terms, privacy/retention policy and delivery timeline. These values cannot be inferred or invented. Complete the database commercial-policy record and evidence-backed launch checks only after approval.
2. Complete the Stripe business-model review for the actual website service auction and configure the live VAELTX secret plus matching live webhook. Current configuration is TEST only; test account readiness is not live review evidence.
3. Configure production Turnstile site/secret keys for the real hostname. Do not bypass card-setup abuse protection.
4. Verify a transactional email sender/domain and configure Supabase custom SMTP plus the auction Resend sender/key. The existing portfolio contact sender does not establish authorization to send bidder emails. Prove actual signup verification, owner new-bid receipt, outbid notification, winner/reminder/payment/onboarding receipt, dedupe and recovery.
5. Complete the authenticated browser journey with real verified test accounts, hosted Stripe card setup and winner payment, multi-user realtime/anti-sniping, owner dashboard authorization, webhook delivery/replays and paid onboarding. Full end-to-end, authorized-owner browser QA and measured accessibility/performance acceptance remain pending; rendered pages and SQL fixtures do not replace them.
6. Validate the minute scheduler's authenticated production response and payment reconciliation, then obtain deliberate final owner activation. Keep `AUCTION_ALLOW_ACTIVATION=false`, dates NULL and all unproved launch checks false until that review. A review or deployment must never start the 25-day clock.

Domain first-year standard registration up to USD 20, first hosting month, two revision rounds and the defined website scope are published as service terms. No domain was purchased and no paid plan was enabled. Future renewals and extras need separate agreement.

## Official references used

- [Stripe hosted card setup](https://docs.stripe.com/payments/checkout/save-and-reuse?payment-ui=stripe-hosted)
- [Stripe Checkout session API](https://docs.stripe.com/api/checkout/sessions/create)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase Cron](https://supabase.com/docs/guides/cron/install), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase authentication redirects](https://supabase.com/docs/guides/auth/redirect-urls)
- [Remotion Player](https://www.remotion.dev/docs/player/player)
