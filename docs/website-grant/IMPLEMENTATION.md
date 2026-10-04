# VAELTX Website Launch Grant — implementation and launch record

Status: **IMPLEMENTED_PREVIEW / NOT_LAUNCH_READY**. This is a working implementation and an applied database schema, not proof of a complete production registration or payment flow.

The paid amendment supersedes the original free-only purchase policy. A later owner clarification says purchases are products and selection is not random. The owner clarified that the sales team selects a business from eligible paid/free applicants. The exact evaluation criteria and guaranteed product delivered by each package remain undefined; the implementation must not invent either or silently relabel a chance to win as merchandise.

## Verified external state

| Item | Evidence / state |
| --- | --- |
| Repository | https://github.com/Xelthor300/vaeltx-portfolio |
| Branch | codex/website-grant |
| Preview | https://vaeltx-portfolio-ldsfisbeo-xelthor300s-projects.vercel.app/website-grant |
| Deployment | dpl_4tcYPAGvJkcQA7ymtJJcXvinuXkP, Vercel READY; authenticated preview |
| Production | Existing portfolio has not been replaced by this campaign branch |
| Supabase organization | xelthor300's projects, explicitly approved by owner |
| Supabase project | vaeltx-website-grant / yrkabjxmifiiseymystk / us-east-1 |
| Provisioning estimate | Tool quoted USD 0/month at creation; actual future usage/tier changes are separate |
| Campaign ID | 71585f53-dede-42d5-800f-3b0cd69c00b9 |
| Campaign status | draft |
| Start / End | unset / unset |
| Valid entry count | 0, queried from actual Supabase through deployed stats route |
| Paid entries | PAID_ENTRIES_ENABLED=false |
| Optional services | Catalog and hosted checkout code implemented; sales disabled |
| Real charges / entrants / winner | None created by this implementation |

Migrations applied to the exclusive project:

- `supabase/migrations/20261004183131_website_grant.sql`
- `supabase/migrations/20261004185733_website_grant_operations.sql`
- `supabase/migrations/20261004191557_website_grant_judged_selection.sql`
- `supabase/migrations/20261004191833_website_grant_review_gate.sql`

There are ten isolated `wg_` tables and 69 catalog prices (60 entry-package prices, nine standalone-service prices). No other project database was reused.

## Account and entry behavior

Supabase verifies email by OTP. Server routes verify `getUser()`, confirmed email and non-anonymous identity. Account sign-in remains possible after campaign closure so participants can inspect their history; claiming and buying enforce active dates separately. Required CAPTCHA must also be enabled in Supabase itself; merely configuring the frontend site key does not protect direct Auth API requests.

`wg_claim_free` atomically owns one participant and one free entry per campaign/account. Normalized-email uniqueness adds another duplicate boundary. The database assigns immutable entry numbers. Sessions, cookies, IP addresses and frontend flags are not the free-entry identity. New verified accounts can claim once, subject to published eligibility and abuse review; this does not promise one entry per human.

Application can include the free claim and an additional package. The free claim commits independently before checkout; a failed or cancelled checkout preserves it. Paid orders use a request UUID, fixed server catalog prices, provider idempotency and a verified webhook. Repeated purchases create additional orders without a cumulative account cap. Each package contains 5–100 entries in steps of five. A successful checkout return URL never creates entries.

Accounts see all valid-entry totals and recent individual entries/purchases. Detail routes require sign-in and ownership; knowing an entry number grants no access. Lists show latest 1,000 entries and latest 100 purchases while valid totals include all entries.

## Fixed pricing

Amounts are fixed prices supplied by the owner, not live currency conversions. Each five-entry unit costs USD 6.00 / CAD 8.47 / MXN 108.87. Integer minor-unit multiplication avoids rounding drift. The independent products in the supplied launch spec retain their separate service pricing and never create entries or improve odds.

| Entries | USD | CAD | MXN |
| ---: | ---: | ---: | ---: |
| 5 | 6.00 | 8.47 | 108.87 |
| 10 | 12.00 | 16.94 | 217.74 |
| 15 | 18.00 | 25.41 | 326.61 |
| 20 | 24.00 | 33.88 | 435.48 |
| 25 | 30.00 | 42.35 | 544.35 |
| 30 | 36.00 | 50.82 | 653.22 |
| 35 | 42.00 | 59.29 | 762.09 |
| 40 | 48.00 | 67.76 | 870.96 |
| 45 | 54.00 | 76.23 | 979.83 |
| 50 | 60.00 | 84.70 | 1088.70 |
| 55 | 66.00 | 93.17 | 1197.57 |
| 60 | 72.00 | 101.64 | 1306.44 |
| 65 | 78.00 | 110.11 | 1415.31 |
| 70 | 84.00 | 118.58 | 1524.18 |
| 75 | 90.00 | 127.05 | 1633.05 |
| 80 | 96.00 | 135.52 | 1741.92 |
| 85 | 102.00 | 143.99 | 1850.79 |
| 90 | 108.00 | 152.46 | 1959.66 |
| 95 | 114.00 | 160.93 | 2068.53 |
| 100 | 120.00 | 169.40 | 2177.40 |

## Stripe integration and evidence

Hosted Checkout uses payment mode, server-calculated amounts, disabled adaptive pricing, explicit account verification and stable retry parameters. No Stripe key appears in client variables or source control. The existing VAELTX **test** key was configured in the Vercel preview environment only. No live secret was configured.

Actual Stripe test API calls verified account `acct_1ULYYw4efgtFxxrt` and created then expired these sessions without payment:

| Currency | Minor amount | Session |
| --- | --- | --- |
| USD | 600 | cs_test_a1wreZ68XHkA1dr2bHQja45lndJzKom5Wjmf9u89kdAKw0ap010hGMKl0t |
| CAD | 847 | cs_test_a1kR5MQ4vraH148yMPrJeWYc66mE7LpO94vQ6wlQM0oqZby0yzbXnbt0yI |
| MXN | 10887 | cs_test_a1BkWBLO5MYXvmT1agW2NIMThqsKdAFGlXAerhcs9KpFcaPrzr0IX071q3 |

These API checks confirm currency/amount/session creation, not end-to-end purchase, delivery, receipt or webhook processing. Test metadata explicitly identifies integration checks and issues no entries.

The webhook verifies the raw Stripe signature, expected live/test mode and absence of connected-account impersonation. Paid fulfillment matches session, order, currency and amount transactionally; duplicate events cannot duplicate tickets. Unpaid events issue nothing. Late payments are flagged for review. Refunds invalidate paid entries; disputes and partial refunds exclude entries pending review. Errors return retryable failures rather than false confirmation.

Live paid-entry creation and live/production paid-entry webhook fulfillment remain blocked pending an explicitly supported transaction model and verified approval. [Stripe's published policy](https://stripe.com/legal/restricted-businesses), checked October 4, 2026 (updated September 22), prohibits commercial chance contests and certain prize competitions. Its charity fundraising exception cannot be assumed for this commercial promotion. [Stripe's Mexico guidance](https://support.stripe.com/questions/restricted-businesses-in-mexico?locale=es-419) requires prior written approval for restricted activities. The manual review clarification is not processor approval, and this report does not assert a definitive legal classification of the revised model. A config toggle is not an approval. A genuine product sale requires an actual guaranteed deliverable; changing a label does not change the transaction.

## Security and operations

All ten campaign tables have RLS enabled and privileges revoked from public, anon and authenticated roles. Browser roles cannot execute mutation RPCs. The service-role key exists only in private local/Vercel settings. Backend routes enforce verified ownership, exact Origin comparison, strict schemas and body limits. Rate limits persist in the DB with keyed hashes; they do not use IP as account identity. Public stats expose aggregate counts, dates and status only, never applications, email or payment identifiers. Campaign routes have private/no-store and noindex headers; existing portfolio indexing behavior is unchanged.

The Supabase security advisor reported INFO `rls_enabled_no_policy` for the ten tables. This is intentional deny-all browser access, not an instruction to add public policies. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

`POST /api/website-grant/operations` requires the server operations bearer secret. Empty JSON closes expired active campaigns, retries pending confirmation emails and returns campaign/order/audit summaries. Schedule an authenticated call externally; never put this secret in the browser, source control, or public cron URL. No scheduler has yet been installed. Read the operation response and retry failures; the public application RPC independently enforces closure without a scheduler.

`{"action":"select","participantId":"...","rubricVersion":"...","reviewers":["..."],"rationale":"..."}` requires an approved, closed, selection_pending campaign with a meaningful published team evaluation procedure. SQL freezes the eligible-entry pool, accepts a chosen eligible application with a free or paid entry, and records the reviewers supplied by the operator, rationale, rubric version, rules version, procedure, eligible entry/application counts and pool hash. These reviewer names are operator-supplied records, not proof of each reviewer's authentication. Additional entry quantity supplies no automatic review score or weight. Pending/review/disputed orders block selection. Random selection has been removed from the final schema and API. No real selection was performed.

Confirmation emails use a persistent DB outbox and Resend idempotency. Pending messages survive request failures and are retried through operations. An entry can be confirmed by the database while its email is pending. Actual delivery has not been tested.

## QA evidence and limits

| Check | Result |
| --- | --- |
| Typecheck | passed |
| Lint | passed |
| Automated tests | 22 passed, including existing contact and Meta-consent regression tests |
| Build | local and Vercel preview passed |
| SQL behavior | real PostgreSQL code executed in PGlite: duplicate claims/retries, two accounts, repeated purchases, exact prices, payment mismatch, service isolation, refunds, expiry, permissions, audit and selection reconciliation |
| Concurrency | queued overlapping calls tested in PGlite; hosted multi-connection race stress is still required |
| Stripe signatures | real SDK validates fixtures, mode, account boundary and tampering; no provider-delivered payment webhook tested |
| Public count | preview returned HTTP 200, available=true, valid_entries=0, unset dates, not-open |
| Routes | five campaign pages HTTP 200 locally; unauthenticated checkout/application 401, foreign Origin 403, operations without bearer 401, unsigned webhook 400 |
| Mobile | actual browser checked 390 and 320 pixel widths; no horizontal overflow |
| Desktop | actual browser checked 1440 width; no horizontal overflow; saved screenshot |
| Accessibility | semantic headings/navigation, labels, focus styles, reduced-motion CSS and status feedback; browser found no unlabeled landing form controls. Full assistive technology audit remains unverified |
| Pricing UI | actual browser verified 100-entry CAD 169.40; automated tests verify all 60 package/currency combinations |
| Existing portfolio | home/work/contact HTTP 200; existing contact/Meta tests passed; no new real contact delivery test |
| Email verification | implemented, not exercised with a delivered real OTP |
| Confirmation email | implemented outbox, no receipt/delivery proof |
| Bot protection | frontend Turnstile integration implemented; site key and Supabase CAPTCHA provider not configured |
| Official Rules / Privacy | preparation pages exist; 25 rules sections, required legal facts still missing |
| CI | GitHub workflow exists; branch run must be checked after push |

Screenshots are private local artifacts under ignored `output/playwright/`. They are visual evidence, not proof of purchase or legal approval. Test fixtures and fake legal/test values were used only in the local PGlite engine, never in the actual Supabase project. Use a separate database/campaign for future payment E2E testing so test tickets cannot become real public entrants.

## OWNER ACTION REQUIRED

1. Finalize the published evaluation criteria, conflict controls and tie resolution for the sales-team review. Define any product delivered to **every** purchaser at each package size; if payment buys only participation for a prize, it is not a standalone product sale. The final code and copy use team selection with no automatic ticket weighting. Alternatively, provide processor-approved campaign documentation for a lawful entry-sale model. Do not record fictitious approvals or classify a chance as a service.
2. Finalize sponsor identity, eligible jurisdictions, age, dates, prize value, official rules, classification, permits if applicable, taxes, retention and selection procedure. No launch date or jurisdiction has been invented.
3. Configure Supabase email OTP template using `{{ .Token }}`, verified SMTP and CAPTCHA (including server Auth provider configuration). Add the public CAPTCHA site key to the relevant Vercel environment. Verify delivery/sign-in with a real account and run hosted ownership/duplicate tests.
4. Configure a verified Resend campaign sender, `GRANT_EMAIL_FROM`, provider credentials and the intended site origin. Prove the entry confirmation arrives. Keep original portfolio contact settings intact.
5. Configure an appropriate Stripe webhook/signing secret and approved live product settings only after the product model is resolved. Preview is Vercel-authenticated, so a provider webhook needs an explicitly supported test endpoint/protection exception or isolated staging configuration. Do not disable the entire preview protection or embed a secret bypass token in a public URL.
6. Complete actual test checkout/payment/fulfillment/refund/retry/receipt E2E in an isolated test database, followed by safe production deployment verification. No real payment is authorized merely to generate QA evidence.

Until these facts and checks are complete, do not label the campaign READY_FOR_LEGAL_ACTIVATION or fully operational. No active sales or participant registration has been claimed.
