# VAELTX — WEBSITE LAUNCH GRANT
## Production implementation
## Next.js + Supabase + Stripe + Resend + Vercel

You are the lead engineer responsible for implementing a new production-grade
campaign inside the existing VAELTX portfolio.

Repository:
https://github.com/Xelthor300/vaeltx-portfolio

Production:
https://vaeltx-portfolio.vercel.app/

You have access to:

- GitHub
- Vercel
- Supabase
- Stripe

The existing VAELTX website is already approved.

DO NOT redesign or regress the existing portfolio.

Create a new isolated campaign experience under:

/website-grant

==================================================
MISSION
==================================================

Build:

VAELTX WEBSITE LAUNCH GRANT

A premium campaign where one eligible verified business receives a custom
VAELTX website.

The experience must feel:

- premium;
- trustworthy;
- modern;
- dark;
- clean;
- deliberate;
- easy to understand;
- consistent with VAELTX.

The attached Microsoft Rewards redemption interface is visual inspiration for:

- information hierarchy;
- dark premium surface;
- large campaign card;
- clear entry quantity/status;
- prominent numerical information;
- controlled use of cards;
- high-contrast CTA.

DO NOT clone Microsoft Rewards.

DO NOT copy:

- Microsoft branding;
- logos;
- icons;
- proprietary artwork;
- exact component layout.

Use the interaction principles and information density as inspiration while
creating an original VAELTX design.

==================================================
IMPORTANT LEGAL / PRODUCT GUARDRAIL
==================================================

There are TWO different concepts in the owner's specification:

A. Optional VAELTX paid services that DO NOT change entry odds.

B. Purchasing additional sweepstakes entries.

These must NOT be conflated.

For the initial Production release:

PAID_ENTRIES_ENABLED = false

Do NOT allow users to purchase additional chances yet.

Reason:

selling additional chances can materially change the legal classification of
the promotion depending on jurisdiction.

Build the data model so paid-entry packages could be added later after the
owner has finalized applicable legal requirements, eligible jurisdictions and
Official Rules.

But DO NOT expose or activate paid entry purchases in Production yet.

Optional VAELTX services MAY be sold through Stripe because they:

- are real standalone services;
- are optional;
- do not create entries;
- do not increase winning odds.

Display prominently:

OPTIONAL PURCHASE

Purchasing a VAELTX service does not provide additional entries
and does not increase your chances of being selected.

Do NOT silently change this rule.

==================================================
IDENTITY
==================================================

Public brand:

VAELTX — Web & Conversion Studio

Public email:

vaeltxn@gmail.com

Do NOT expose the owner's personal name.

Do NOT invent:

- a corporation;
- legal entity;
- registration number;
- physical office;
- employees;
- sponsor information that has not been provided.

Official Rules must never fabricate legal sponsor information.

If legally required sponsor information is missing, clearly mark it as an
activation blocker rather than inventing it.

==================================================
CAMPAIGN ROUTES
==================================================

Create at minimum:

/website-grant

/website-grant/apply

/website-grant/entry

/website-grant/entry/[entryNumber]

/website-grant/official-rules

Existing privacy route may be reused if appropriate.

If required, create campaign-specific privacy disclosure while keeping the
existing VAELTX privacy architecture consistent.

==================================================
HERO
==================================================

Main page:

VAELTX WEBSITE LAUNCH GRANT

Win a custom website for your business.

Website design + development
Domain included
1 month of hosting included

ONE BUSINESS WILL BE SELECTED

Applications close in:

14 DAYS · 07 HOURS · 32 MINUTES

[ GET YOUR FREE ENTRY ]

Then:

No purchase necessary.
One free entry per verified participant.
18+ · Eligibility restrictions apply.

IMPORTANT:

The countdown MUST NOT be hardcoded.

It must derive from:

campaign.start_at
campaign.end_at

using the database as the authoritative source.

==================================================
CAMPAIGN LENGTH
==================================================

Default intended campaign duration:

15 days.

Database fields:

start_at
end_at

Frontend countdown must use actual campaign timestamps.

When end_at has passed:

APPLICATIONS ARE NOW CLOSED

The selected business will be contacted using the information
provided in its application.

The application endpoint must also reject new entries server-side.

Never rely only on the frontend timer.

==================================================
CAMPAIGN STATUS
==================================================

Use an explicit campaign state machine.

Suggested statuses:

draft
scheduled
active
closed
selection_pending
selected
completed
cancelled

Do not derive campaign state only from frontend state.

==================================================
STATISTICS
==================================================

Show a premium statistics section:

184
VALID ENTRIES

15 DAYS
CAMPAIGN LENGTH

1
WEBSITE AWARDED

BUT:

184 IS ONLY AN EXAMPLE FROM THE DESIGN BRIEF.

DO NOT HARDCODE IT.

VALID ENTRIES must be calculated from real valid database entries.

Example conceptual source:

COUNT(entries WHERE campaign_id = current_campaign AND status = 'valid')

The public counter must never invent participation.

If there are:

0 valid entries

show:

0 VALID ENTRIES

Do not artificially seed fake participation.

Campaign length should derive from campaign timestamps.

Prize quantity derives from campaign configuration.

==================================================
ENTRY CARD
==================================================

Create:

YOUR ENTRY

1 FREE ENTRY

$0 USD
$0 CAD
$0 MXN

Available once per verified participant.

[ CLAIM FREE ENTRY ]

After completion:

ENTRY CONFIRMED

Your entry:

VAELTX-2026-000184

You have 1 valid entry.

[ VIEW ENTRY DETAILS ]

Entry numbers must come from the database.

They must be:

- immutable;
- unique;
- concurrency-safe;
- generated server-side.

Suggested public format:

VAELTX-2026-000001
VAELTX-2026-000002
...

Do not use client-side counters.

Do not generate:

MAX(entry_number) + 1

without concurrency protection.

Use a PostgreSQL sequence, transactional RPC or equivalent safe mechanism.

==================================================
ENTRY APPLICATION
==================================================

Create:

ENTER THE VAELTX WEBSITE LAUNCH GRANT

Fields:

Full name *
Business name *
Email *
Country *
City *

Business website
Optional

Facebook / business social URL
Optional

What does your business do? *

What would you like your new website to accomplish? *

Do you currently have a website?

○ Yes
○ No

Required confirmations:

□ I am 18 or older.

□ I agree to the Official Rules and Privacy Policy.

□ I consent to VAELTX contacting me regarding this application.

[ SUBMIT & CLAIM FREE ENTRY ]

==================================================
DO NOT CONFUSE CONSENTS
==================================================

Campaign-contact consent is NOT automatically general marketing consent.

Store separate values if necessary.

Do not silently enroll participants into unrelated marketing communications.

==================================================
EMAIL VERIFICATION
==================================================

A submission is NOT immediately a valid entry.

Flow:

APPLICATION SUBMITTED
↓
EMAIL VERIFICATION REQUIRED
↓
EMAIL VERIFIED
↓
ENTRY CREATED / ACTIVATED
↓
CONFIRMATION EMAIL
↓
ENTRY CONFIRMED

Use secure verification.

Prefer the existing Supabase authentication infrastructure if appropriate,
such as OTP / magic-link verification.

Do NOT create insecure home-grown authentication when Supabase provides a
safer primitive.

==================================================
DUPLICATE FREE ENTRIES
==================================================

Rule:

ONE free entry per verified participant per campaign.

At minimum prevent duplicates by verified normalized email / authenticated
participant identity.

Enforce this at DATABASE level.

Do not depend solely on frontend validation.

Use unique constraints where appropriate.

Example conceptual constraint:

UNIQUE(campaign_id, participant_id, entry_source)

for free entry source.

A second browser or cleared cookies must NOT produce another free entry for
the same verified account.

==================================================
ACCOUNTS
==================================================

Users may authenticate using email verification.

A verified account receives at most:

1 free campaign entry.

Creating another browser session does not reset eligibility.

Do not use cookies as the primary identity boundary.

==================================================
ANTI-ABUSE
==================================================

Implement defense in depth:

- email verification;
- server-side validation;
- database unique constraints;
- rate limiting;
- duplicate detection;
- bot protection;
- normalized email handling;
- immutable entry records;
- audit logging;
- secure server-side mutations.

Do NOT rely on IP address alone.

Do NOT block multiple legitimate people in the same household/company simply
because they share an IP.

==================================================
IP PRIVACY
==================================================

If IP-derived abuse signals are stored:

do not store unnecessary raw IP addresses.

Use an appropriate keyed hash/HMAC strategy if IP signals are actually needed.

Document retention.

Do not claim IP hashing provides anonymity.

==================================================
BOT PROTECTION
==================================================

Inspect the existing stack and choose an appropriate bot-protection mechanism.

Examples may include:

Cloudflare Turnstile

or another reputable equivalent.

Do not introduce invasive fingerprinting.

==================================================
DATABASE
==================================================

Use Supabase/PostgreSQL.

Required conceptual tables:

campaigns
participants
entries
email_verifications
service_orders
payments
audit_logs

Also strongly consider:

winner_selections

if selection is ultimately random.

==================================================
CAMPAIGNS
==================================================

Suggested fields:

id
slug
name
status
start_at
end_at
prize_quantity
selection_mode
eligible_countries
minimum_age
rules_version
created_at
updated_at

==================================================
PARTICIPANTS
==================================================

Suggested fields:

id
auth_user_id
full_name
business_name
email
email_normalized
phone
country
city
website
social_url
business_description
website_goal
has_current_website
age_confirmed_at
rules_version
terms_accepted_at
campaign_contact_consent_at
created_at
updated_at

Do NOT add fields merely because this prompt lists them if the architecture
has a cleaner normalized approach.

==================================================
ENTRIES
==================================================

Suggested fields:

id
campaign_id
participant_id
entry_number
entry_source
status
created_at
verified_at
country
abuse_signal_hash

Possible entry_source values:

free_verified
paid

But:

paid MUST remain unused while PAID_ENTRIES_ENABLED=false.

==================================================
SERVICE ORDERS
==================================================

Suggested:

id
participant_id
campaign_id
service_code
currency
amount_minor
stripe_checkout_session_id
stripe_payment_intent_id
status
created_at
paid_at

==================================================
PAYMENTS
==================================================

Keep Stripe state separately auditable.

Never trust a browser redirect as payment confirmation.

Stripe webhook is authoritative.

Use idempotent webhook handling.

==================================================
AUDIT LOGS
==================================================

Track important administrative/system actions such as:

campaign activation
campaign closure
entry verification
entry invalidation
duplicate rejection
winner selection
winner acceptance
payment state changes

Do not place secrets or unnecessary personal data in logs.

==================================================
ROW LEVEL SECURITY
==================================================

Implement appropriate Supabase RLS.

Participants must never be able to query other participants.

Public users must NOT be able to enumerate:

- emails;
- applications;
- participant details;
- verification records;
- Stripe IDs.

The public site may access only deliberately exposed aggregate statistics.

Use server-side privileged operations where required.

Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.

==================================================
PUBLIC COUNTER
==================================================

Do not make the browser query the raw entries table.

Create a safe aggregate endpoint/RPC/view returning only:

valid_entries
campaign_length
website_awards

No PII.

==================================================
EMAILS
==================================================

Use the existing VAELTX transactional email system / Resend architecture.

Do not expose RESEND_API_KEY.

Required transactional emails:

1. VERIFY YOUR EMAIL

Subject concept:

Verify your VAELTX Website Launch Grant entry

2. ENTRY CONFIRMED

Subject concept:

Your VAELTX Website Launch Grant entry is confirmed

Content:

YOUR ENTRY IS CONFIRMED

Entry:
VAELTX-2026-XXXXXX

Valid entries:
1

Campaign closing date:
[REAL DATE]

View entry:
[SECURE URL]

No purchase necessary.
Purchasing optional VAELTX services does not increase your chances.

3. OPTIONAL service receipt/confirmation if purchased.

Do not send an “entry confirmed” email before verification succeeds.

==================================================
SECURE ENTRY DETAILS
==================================================

The entry number alone must not act as authentication.

Do NOT let:

/website-grant/entry/VAELTX-2026-000184

expose someone's personal data merely because someone guessed the number.

Require:

authenticated ownership

or a secure signed access mechanism.

==================================================
OPTIONAL SERVICES
==================================================

After a free entry is confirmed:

YOUR ENTRY IS CONFIRMED

Want help with your website while the grant is open?

OPTIONAL VAELTX SERVICES

Immediately above pricing:

OPTIONAL PURCHASE

Purchasing a VAELTX service does not provide additional entries
and does not increase your chances of being selected.

==================================================
SERVICE 1
==================================================

HOMEPAGE QUICK REVIEW

USD:
$9

CAD:
$12

MXN:
$180

A concise professional review of your homepage.

Includes:

• First-impression review
• CTA clarity
• Visual hierarchy
• Mobile observations
• 3 priority recommendations

==================================================
SERVICE 2
==================================================

WEBSITE STRATEGY AUDIT

USD:
$19

CAD:
$26

MXN:
$380

A deeper review of your website and conversion path.

Includes:

• Homepage analysis
• Navigation
• CTA structure
• Mobile UX
• Trust signals
• Conversion friction
• Prioritized recommendations

==================================================
SERVICE 3
==================================================

CONVERSION & UX ACTION PLAN

USD:
$39

CAD:
$53

MXN:
$780

A focused VAELTX improvement plan for your business.

Includes:

• Full website review
• Priority UX issues
• Conversion opportunities
• Recommended homepage structure
• CTA strategy
• Mobile recommendations
• Suggested next steps

==================================================
STRIPE
==================================================

Integrate Stripe Checkout for OPTIONAL SERVICES.

Supported currencies:

USD
CAD
MXN

Treat the provided prices as deliberate fixed regional prices.

Do NOT dynamically calculate them from an exchange rate.

Represent all money internally in minor currency units.

For example:

Homepage Quick Review:

USD 900
CAD 1200
MXN 18000

Website Strategy Audit:

USD 1900
CAD 2600
MXN 38000

Conversion & UX Action Plan:

USD 3900
CAD 5300
MXN 78000

Verify Stripe currency semantics before implementation.

==================================================
STRIPE SECURITY
==================================================

Create Checkout Sessions server-side.

Never trust:

price
currency
service
quantity

sent directly by the browser.

The client selects a service/currency identifier.

The server maps that identifier to an authoritative internal price catalog.

Use:

Stripe webhook

as the authoritative payment confirmation.

Verify webhook signatures.

Implement idempotency.

Do not expose secret Stripe keys.

==================================================
DO NOT MIX STRIPE ACCOUNTS
==================================================

Use ONLY the Stripe account intentionally associated with VAELTX.

Do not touch unrelated Stripe projects/accounts.

Inspect existing configuration before making any change.

==================================================
PAID ENTRIES — FUTURE ARCHITECTURE ONLY
==================================================

The owner may later want purchasable entry packages:

5
10
15
20
...
100

Potentially combined with the one free entry.

Build the schema/application architecture so this can be supported later.

For example:

entry_packages
campaign_paid_entry_policy

But for this release:

PAID_ENTRIES_ENABLED=false

Do not show:

BUY 5 ENTRIES

BUY 100 ENTRIES

or any paid-ticket selector publicly.

Do not create live Stripe products that sell chances to win.

Do not process payment for sweepstakes entries.

After legal/promotion rules are finalized, this feature can be reviewed
separately.

==================================================
THE PRIZE
==================================================

Create a major premium section:

THE PRIZE

A CUSTOM VAELTX BUSINESS WEBSITE

Included:

✓ Custom website design
✓ Development
✓ Responsive desktop + mobile
✓ Custom domain
✓ First month of hosting
✓ Contact / lead functionality
✓ Basic SEO structure
✓ Launch support

Selected business pays $0 for the included scope.

Then clearly define:

Up to 5 custom pages
or one equivalent high-detail landing website.

==================================================
DOMAIN
==================================================

Display:

Domain registration included for the first year,
up to a maximum registration value of $20 USD.

Do not imply:

- premium domains;
- aftermarket domains;
- already-owned domains;
- unusually expensive TLDs

are automatically included.

==================================================
HOSTING
==================================================

Display:

First month of VAELTX hosting included.

After the included period, the selected business may:

• continue hosting with VAELTX;
• migrate the website;
• or arrange another hosting solution.

Do not create hostage-style hosting terms.

==================================================
PRIZE VALUE
==================================================

Official Rules require an Approximate Retail Value field.

DO NOT invent one.

Create a campaign configuration field such as:

prize_arv_minor
prize_arv_currency

and leave launch validation incomplete until the owner supplies the final
approved ARV.

==================================================
OFFICIAL RULES
==================================================

Create:

/website-grant/official-rules

Structure at minimum:

1. Sponsor / Organizer

2. Eligibility

3. Promotion period

4. How to enter

5. One free entry per verified participant

6. No purchase necessary

7. Optional VAELTX purchases do not increase chances

8. Prize description

9. Approximate retail value

10. Domain limitations

11. Hosting terms

12. Website scope

13. Selected-business determination method

14. Notification

15. Response deadline

16. Alternate selection

17. Taxes and other costs

18. Intellectual property

19. Permission to display completed work

20. Data / privacy treatment

21. Fraud, bots and duplicate accounts

22. Limitation of liability

23. Platform disclaimer

24. Governing law

25. Contact information

IMPORTANT:

Do NOT fabricate missing legal details.

Create clearly structured configurable rule content.

If an item required for launch is unknown, mark campaign activation as blocked.

==================================================
ELIGIBILITY
==================================================

Do NOT automatically assume worldwide eligibility merely because currencies
USD/CAD/MXN are supported.

Campaign eligibility must be controlled separately using:

eligible_countries

and Official Rules.

Payment currency is not eligibility.

Country selector should only allow jurisdictions explicitly enabled for the
campaign.

==================================================
FACEBOOK / META DISCLAIMER
==================================================

Because this promotion may be marketed through Facebook/Instagram, include
appropriate platform disclaimer language in Official Rules where applicable.

Do not imply that Meta/Facebook sponsors, administers or endorses the campaign.

==================================================
SELECTION
==================================================

Do not implement a fake winner.

Never select from:

hardcoded IDs
frontend Math.random()
manual hidden preference

If final rules use random selection:

use a server-side auditable selection process based only on eligible valid
entries.

Use cryptographically secure randomness.

Record:

campaign
eligible pool snapshot/count
selection timestamp
selected entry
selection method/version
audit event

Do not expose participant PII publicly.

If legal review changes the promotion into a judged grant rather than random
selection, architecture should allow a different selection_mode.

==================================================
WINNER PRIVACY
==================================================

Do not publicly reveal:

email
phone
full application

without an appropriate lawful basis/permission.

==================================================
DESIGN
==================================================

Design direction:

VAELTX dark premium UI.

Think:

# near-black canvas
# restrained borders
# premium cards
# strong numerical hierarchy
# clean typography
# compact information density
# generous but controlled spacing
# excellent mobile layout

Inspired by the supplied Microsoft Rewards screenshot only in hierarchy and
clarity.

Must remain unmistakably VAELTX.

==================================================
HERO VISUAL LANGUAGE
==================================================

Primary campaign card should communicate in seconds:

WHAT:
A custom business website

PRICE TO ENTER:
$0

HOW MANY:
1 free verified entry

DEADLINE:
live countdown

PRIZE:
1 website

ACTION:
GET YOUR FREE ENTRY

==================================================
MOBILE
==================================================

Treat mobile as first-class.

At:

320
360
375
390
430px

ensure:

- no horizontal overflow;
- countdown remains legible;
- price/currency layout does not collapse;
- forms are comfortable;
- tap targets >= 44px;
- legal copy remains readable;
- cards do not become extremely tall unnecessarily.

==================================================
ACCESSIBILITY
==================================================

Meet the existing VAELTX accessibility standard.

Include:

semantic headings
real form labels
fieldset/legend for radios
descriptive errors
keyboard navigation
visible focus
screen-reader status for verification state
appropriate contrast
reduced-motion handling

Do not communicate validity by color alone.

==================================================
FORM VALIDATION
==================================================

Use shared server/client schemas where practical.

Validate server-side regardless of browser validation.

Normalize:

email
URLs
country

Limit text lengths.

Protect against:

XSS
HTML injection
unexpected payloads
mass-assignment

==================================================
CAMPAIGN ENTRY STATE UX
==================================================

Provide explicit states:

APPLICATION FORM

VERIFY YOUR EMAIL

EMAIL VERIFIED

ENTRY CONFIRMED

ENTRY ALREADY EXISTS

APPLICATIONS CLOSED

NOT ELIGIBLE

RATE LIMITED

VERIFICATION EXPIRED

SERVER ERROR

Never fail silently.

==================================================
REAL DATA ONLY
==================================================

This requirement is absolute.

Do not invent:

entry counts
participant counts
campaign dates
payments
winners
service orders
conversion numbers

If DB says:

3

display:

3 VALID ENTRIES

not:

184.

==================================================
ADMIN / OPERATIONS
==================================================

Create a secure minimal administrative capability if the existing architecture
supports it cleanly.

The owner should be able to inspect:

campaign status
valid entry count
verification count
duplicate/rejected attempts
optional service orders
Stripe payment status
campaign start/end
selection status

Do not create an unauthenticated admin page.

Do not expose service-role credentials.

==================================================
OBSERVABILITY
==================================================

Provide useful server-side structured logs for:

entry submission
verification
duplicate rejection
Stripe Checkout creation
Stripe webhook
campaign close
winner selection

Do not log:

passwords
verification tokens
full application text unnecessarily
Stripe secret data

==================================================
META PIXEL
==================================================

The existing Meta Pixel implementation is already approved.

Pixel ID:

1716784306059756

Do not regress it.

The existing marketing consent behavior must remain intact.

Do NOT automatically send entrant:

name
email
phone
business application data

to Meta.

Do not enable Advanced Matching as part of this task.

Any future:

Lead
Contact
Purchase

events must be deliberately designed and consent-aware.

For now preserve the existing behavior unless separately requested.

==================================================
SEO
==================================================

The existing portfolio currently has its own indexing policy.

Do not silently change global SEO/indexing behavior.

Determine how /website-grant should behave under the current noindex setup and
document it.

Do NOT enable global indexing as a side effect of this task.

==================================================
TESTING
==================================================

Add meaningful automated tests for:

campaign availability
countdown calculation
closed campaign rejection
input validation
email normalization
one-free-entry constraint
verification
entry number uniqueness
concurrency
public aggregate counter
RLS/security
Stripe pricing mapping
Stripe webhook idempotency
optional service order flow
entry privacy
rate limiting behavior
campaign state transitions

==================================================
CONCURRENCY TEST
==================================================

Specifically test simultaneous entry creation.

Two concurrent verification completions must NOT receive the same entry number.

A duplicate verified participant must NOT receive two free entries.

==================================================
E2E
==================================================

Test realistic Production-like paths:

NEW PARTICIPANT
→ application
→ verification
→ confirmed entry
→ confirmation email

DUPLICATE
→ same verified account
→ blocked from second free entry

OPTIONAL SERVICE
→ entry confirmed
→ select service
→ Stripe test checkout
→ webhook
→ order paid

CLOSED CAMPAIGN
→ submission rejected

==================================================
EMAIL QA
==================================================

Verify transactional emails render acceptably in Gmail.

Do not accidentally expose internal UUIDs/secrets.

==================================================
PAYMENT QA
==================================================

Use Stripe test mode during development.

Do NOT generate fake successful Production payments.

Only switch to the existing approved VAELTX Production configuration after
tests pass.

==================================================
MIGRATIONS
==================================================

All database schema changes must be reproducible migrations.

Do not manually create undocumented Production-only tables.

Commit migrations.

==================================================
SECRETS
==================================================

Do NOT put secrets in:

GitHub
client JavaScript
documentation
screenshots
logs

Inspect current Vercel variables.

Reuse existing production secrets where appropriate.

Add only genuinely required variables.

==================================================
CAMPAIGN ACTIVATION
==================================================

Do NOT accidentally start the public 15-day campaign during development.

Development / Preview:

campaign may exist in DRAFT/TEST state.

Production campaign should start only after:

- migrations applied;
- email verified;
- counter verified;
- Official Rules complete;
- eligibility finalized;
- prize ARV provided;
- required sponsor information resolved;
- Stripe optional services verified;
- Production QA passed.

Create a clear final:

CAMPAIGN_READY_FOR_ACTIVATION

state.

Do not activate prematurely merely because deployment succeeded.

==================================================
PERFORMANCE
==================================================

Do not turn the static portfolio into a globally dynamic application
unnecessarily.

Keep campaign-specific dynamic behavior isolated.

Cache safe public data appropriately while ensuring the countdown/status does
not become stale.

==================================================
DO NOT BREAK EXISTING VAELTX
==================================================

Regression-test:

Home
Work
Contact
concept pages
WhatsApp
Resend
Meta consent
Meta Pixel
navigation
mobile
accessibility

==================================================
FINAL QA
==================================================

Run:

typecheck
lint
unit tests
integration tests
production build

Then deploy Preview.

Perform browser QA.

Then Production only when safe.

==================================================
FINAL REPORT
==================================================

Return:

VAELTX_WEBSITE_GRANT_READY

and report:

Repository:
Final commit:
Preview:
Production:
Supabase migrations:
Campaign ID:
Campaign status:
Start:
End:
Valid entry count:
Free-entry uniqueness:
Email verification:
Confirmation email:
Public count endpoint:
Stripe optional services:
USD pricing:
CAD pricing:
MXN pricing:
Stripe webhook:
RLS:
Rate limiting:
Bot protection:
Official Rules:
Privacy:
Mobile:
Accessibility:
Typecheck:
Lint:
Tests:
Build:
CI:
Existing VAELTX regression:
Remaining launch blockers:

Also explicitly report:

PAID_ENTRIES_ENABLED=false

and:

NO PURCHASE AFFECTS WINNING ODDS IN THIS RELEASE.

==================================================
SUCCESS STANDARD
==================================================

Do not call this complete merely because the page looks good.

Complete means:

REAL campaign state
REAL database
REAL entry count
REAL verification
REAL unique entries
REAL transactional emails
REAL optional-service checkout
REAL payment verification
REAL security boundaries
REAL closed-campaign enforcement
REAL mobile QA
REAL auditability

No fake counters.
No fake entrants.
No fake payments.
No fake winner.
No fabricated legal information.

Build it as an actual VAELTX production system.