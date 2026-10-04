# VAELTX — LIVE WEBSITE AUCTION
## FINAL PRODUCTION IMPLEMENTATION BRIEF

You are implementing a REAL production-grade live auction inside the existing VAELTX portfolio.

Repository:
https://github.com/Xelthor300/vaeltx-portfolio

Production:
https://vaeltx-portfolio.vercel.app/

Existing connected infrastructure may include:

- GitHub
- Vercel
- Supabase / PostgreSQL
- Supabase Auth
- Supabase Realtime
- Stripe
- Resend / transactional email
- Meta Pixel
- existing VAELTX contact system
- existing VAELTX portfolio/design system

You have permission to:

- inspect the existing codebase;
- inspect the current architecture;
- create a feature branch;
- create database migrations;
- implement frontend and backend;
- implement secure server-side auction logic;
- implement Supabase RLS;
- implement authentication;
- implement email verification;
- implement Stripe SetupIntent/payment-method setup if appropriate;
- implement Stripe Checkout for the winner;
- implement Stripe webhooks;
- implement transactional email;
- deploy Vercel Preview;
- run tests;
- prepare Production.

DO NOT redesign or regress unrelated VAELTX functionality.

The existing VAELTX portfolio is approved.

==================================================
PRIMARY OBJECTIVE
==================================================

Build:

VAELTX WEBSITE AUCTION

This is a normal competitive auction for a real website-development service.

There is:

NO raffle.
NO lottery.
NO random winner.
NO ticket system.
NO paid entry.
NO free-entry promotion.
NO chance-based mechanic.

Participants place monetary bids for the defined VAELTX Website Launch Package.

The highest VALID bid at auction close wins ONLY if the PUBLIC reserve has been met.

The winning bidder then purchases the package for the exact amount of the winning bid.

==================================================
REMOVE / DISABLE PREVIOUS GRANT SYSTEM
==================================================

The previous Website Launch Grant / ticket architecture must remain completely DISABLED.

Do not expose publicly:

- Website Launch Grant
- tickets
- free tickets
- paid tickets
- entries
- raffle
- sweepstakes
- random winner
- lottery terminology

Remove old campaign references from:

- homepage;
- navigation;
- footer;
- CTA components;
- account pages;
- promotional cards;
- event/campaign UI;
- sitemap-visible promotional routes.

If this route exists:

/website-grant

redirect cleanly to:

/website-auction

Prefer a permanent SEO-safe redirect if appropriate for the existing framework.

Do NOT destroy useful historical data solely to hide the old system.

==================================================
PUBLIC ROUTES
==================================================

Implement:

/website-auction
/website-auction/bid
/website-auction/account
/website-auction/history
/website-auction/terms

Secure post-auction routes:

/website-auction/winner
/website-auction/payment
/website-auction/onboarding

Secure admin route:

/admin/website-auction

The admin route must NEVER be publicly accessible without authorization.

==================================================
FINAL COMMERCIAL CONFIGURATION
==================================================

AUTHORITATIVE CURRENCY:

USD

STARTING BID:

$100 USD

PUBLIC RESERVE:

$350 USD

MINIMUM INCREMENT:

$10 USD

AUCTION DURATION:

25 COMPLETE DAYS

WINNER PAYMENT DEADLINE:

24 HOURS

ANTI-SNIPING:

Final 2-minute window.
Each valid bid in the final 2 minutes extends the auction by 2 additional minutes.

BIDDING:

UNLIMITED valid bids per verified bidder.

There is no lifetime bid-count limit.

There is no artificial public maximum winning bid.

Backend/Stripe technical limits still apply where required by infrastructure.

==================================================
BID CALCULATION — IMPORTANT
==================================================

When there are ZERO valid bids:

starting reference = $100 USD

The first valid bid may be:

$100 USD or greater.

Examples:

$100 = valid
$110 = valid
$150 = valid
$500 = valid

If a bidder uses the:

+$10

quick action while there are no bids:

result = $110 USD.

Once there is a valid highest bid:

next minimum bid =
current highest valid bid + $10 USD

Examples:

Current:
$110

Next minimum:
$120

Valid:
$120
$130
$175
$500

Invalid:
$111
$115
$119

If current bid is:

$175

next minimum is:

$185

NOT $176.

Minimum increment means a minimum difference of $10 from the current highest valid bid.

==================================================
PUBLIC RESERVE
==================================================

The reserve is PUBLIC.

$350 USD

There is NO hidden reserve.

Before current highest bid reaches $350:

RESERVE NOT MET

Public copy:

The auction must reach the $350 USD public reserve for the website package to sell.

Once:

current_highest_valid_bid >= $350

display:

RESERVE MET

Public copy:

The website package will sell to the highest valid bidder when the auction closes.

If the auction closes below $350:

NO SALE.

No winner.
No payment obligation.
No Stripe Checkout.
No charge.

Use status:

closed_no_sale

or equivalent.

If auction closes at $350 or above:

highest valid bidder becomes winner.

==================================================
NO PAYMENT TO BID
==================================================

Participants must NOT pay a fee to place bids.

There is:

NO bid fee.
NO bid-credit system.
NO paid bidding token.
NO entry fee.

Placing a legitimate bid costs:

$0

Only the winner purchases the actual VAELTX website service.

==================================================
PAYMENT-METHOD VERIFICATION BEFORE REAL BIDDING
==================================================

To reduce fake bids, before a participant places their FIRST Production bid:

1. authenticate participant;
2. verify email;
3. require participant profile;
4. require valid payment-method setup through Stripe where technically and contractually appropriate.

Prefer Stripe SetupIntent or the appropriate Stripe-supported setup flow.

IMPORTANT:

DO NOT CHARGE THE PARTICIPANT WHEN THEY BID.

Public copy:

VERIFY YOUR PAYMENT METHOD

No charge is made when you bid.
Only the winning bidder is required to pay after the auction closes.

Do not store card number, CVC or sensitive payment credentials.

Stripe handles payment-method details.

Store only appropriate non-sensitive Stripe identifiers server-side.

Do not expose Stripe identifiers publicly.

A payment-method setup must NOT be interpreted as permission to arbitrarily charge a participant.

The winning payment still occurs through the explicit approved post-auction payment flow.

If the currently connected Stripe account or jurisdiction does not support this exact setup cleanly:

FLAG IT AS AN ACTIVATION BLOCKER.

Do not invent or bypass Stripe requirements.

==================================================
PAYMENT SETUP ABUSE PROTECTION
==================================================

Protect SetupIntent/payment setup from card-testing abuse.

Require:

- authenticated session;
- verified email;
- server-side validation;
- rate limiting;
- CSRF protection where relevant;
- bot protection where appropriate;
- Stripe-recommended integration;
- no anonymous unlimited SetupIntent creation.

==================================================
AUCTION TIMER
==================================================

DO NOT start the 25-day timer during development.

DO NOT start it in Vercel Preview.

DO NOT start it simply because code reaches Production.

Production should initially contain:

READY_FOR_ACTIVATION

or equivalent.

Provide one secure deliberate activation action.

At real activation:

start_at = authoritative server/database timestamp

end_at = start_at + 25 days

original_end_at = end_at

status = active

Persist all values.

Create audit record.

Only then does the public 25-day countdown begin.

==================================================
ANTI-SNIPING
==================================================

Configure:

anti_sniping_enabled = true

anti_sniping_window_seconds = 120

anti_sniping_extension_seconds = 120

Example:

Auction has:

01:20 remaining

Valid bid arrives.

New remaining time should effectively become approximately:

03:20

depending on authoritative server timing.

If another valid bid happens during the renewed final 2-minute window:

extend another 2 minutes.

Extensions may repeat legitimately.

Auction therefore may end slightly later than the original 25-day endpoint.

Database:

end_at

is authoritative.

Frontend countdown must react to extensions in realtime.

Public copy:

If a valid bid is placed during the final 2 minutes, the closing time is automatically extended by 2 minutes so other verified bidders have an opportunity to respond.

==================================================
WEBSITE PACKAGE
==================================================

Public product name:

VAELTX WEBSITE LAUNCH PACKAGE

Primary headline:

A CUSTOM BUSINESS WEBSITE.
BUILT. LAUNCHED. READY TO USE.

Included:

✓ Custom website design
✓ Development
✓ Responsive desktop + mobile
✓ Up to 5 standard custom pages
  OR one equivalent high-detail landing website
✓ Contact / lead functionality
✓ Basic metadata & technical web setup
✓ Domain registration for first year
✓ First month of hosting
✓ Deployment
✓ Launch support
✓ Two reasonable revision rounds
✓ Finished production website

The final deliverable must be:

FUNCTIONAL
DEPLOYED
RESPONSIVE
READY FOR REAL BUSINESS USE

It must NOT merely be:

- Figma;
- mockup;
- unfinished prototype;
- source code only;
- static concept;
- incomplete deployment.

==================================================
DOMAIN
==================================================

Included:

Domain registration for the first year.

Maximum included registration value:

$20 USD

Public copy:

Domain registration included for the first year, up to a maximum registration value of $20 USD.

Exclude automatically:

- premium domains;
- aftermarket domains;
- domains exceeding allowance.

If winner already has a domain:

VAELTX may connect the existing domain.

Prefer the client to ultimately own/control their domain.

No artificial lock-in.

==================================================
HOSTING
==================================================

Included:

FIRST MONTH OF HOSTING

Public copy:

First month of VAELTX hosting included.

After that period the client may:

- continue hosting with VAELTX;
- migrate;
- choose another provider.

Never hold the website/domain hostage.

==================================================
OUT OF SCOPE BY DEFAULT
==================================================

Unless separately quoted/agreed:

- complex ecommerce;
- large product catalogs;
- marketplaces;
- SaaS applications;
- membership platforms;
- advanced authentication;
- large custom backends;
- advanced booking engines;
- regulated-data systems;
- complex API integrations;
- paid external software/licenses;
- premium paid fonts/assets;
- unlimited revisions.

Additional work may be quoted separately.

The winning bid purchases the defined base package.

==================================================
DO NOT POSITION AS SEO SERVICE
==================================================

Do NOT market the package as:

SEO services
SEO campaign
ranking optimization
ranking guarantee
link building

Use:

Basic metadata & technical web setup

Possible normal implementation items:

- page titles;
- metadata;
- semantic structure;
- sitemap where appropriate;
- robots configuration where appropriate;
- ordinary technical indexing readiness.

Do not promise search rankings.

==================================================
VISUAL DIRECTION
==================================================

Use existing VAELTX identity.

Style:

premium
modern
minimal
dark
high-end digital studio
technology
live auction
professional

Prefer:

near-black / charcoal
off-white text
restrained accents
excellent spacing
high-end typography
subtle motion
premium card treatment
clean hierarchy

Avoid:

casino aesthetic
slot-machine aesthetic
flashing lights
gambling language
cheap gradients
fake urgency
red spam
fake bidders
fake activity
fake viewers
fake numbers
“WIN BIG!”

This is a professional auction for a real digital service.

==================================================
MAIN HERO
==================================================

Design around:

LIVE · VAELTX WEBSITE AUCTION

A CUSTOM BUSINESS WEBSITE.
BUILT. LAUNCHED. READY TO USE.

Bid for a complete custom website designed and developed by VAELTX.

CURRENT BID
$XXX USD

PUBLIC RESERVE
$350 USD

RESERVE STATUS
RESERVE MET / RESERVE NOT MET

TIME REMAINING
XX DAYS · XX HOURS · XX MINUTES · XX SECONDS

NEXT MINIMUM BID
$XXX USD

[ PLACE A BID ]

Supporting copy:

Highest valid bid wins once the public reserve is met.

Verified bidders only.
Unlimited bidding.
You only pay if you win.

==================================================
ZERO-BID STATE
==================================================

When there are zero valid bids:

NO BIDS YET

STARTING BID
$100 USD

[ PLACE THE FIRST BID ]

Do not imply fake activity.

==================================================
LIVE METRICS
==================================================

Public metrics may include:

CURRENT BID

VALID BIDS

VERIFIED BIDDERS

TIME REMAINING

RESERVE STATUS

All values must come from real database state.

NEVER hardcode fake Production values.

==================================================
VAELTX PORTFOLIO PROOF
==================================================

May show:

Northstar Roofing
Mira Atelier
Axiom Strategy
Vault TCG

But clearly label:

VAELTX INDEPENDENT CONCEPT WORK

Never imply these are paid client projects.

==================================================
DATABASE
==================================================

Use existing Supabase/PostgreSQL.

Prefer committed migrations.

Suggested tables:

auctions
auction_participants
bids
bidder_verifications
auction_payment_methods
auction_extensions
auction_winners
auction_payments
auction_notifications
audit_logs

Reuse existing infrastructure where cleaner.

==================================================
AUCTIONS TABLE
==================================================

Suggested fields:

id
slug
title
status
currency
starting_bid_minor
public_reserve_minor
minimum_increment_minor
duration_days
start_at
end_at
original_end_at
anti_sniping_enabled
anti_sniping_window_seconds
anti_sniping_extension_seconds
winner_payment_deadline_hours
created_at
updated_at

Statuses may include:

draft
ready_for_activation
scheduled
active
paused
closing
closed_no_sale
payment_pending
completed
cancelled

==================================================
PARTICIPANTS
==================================================

Store privately:

id
auth_user_id
email
email_normalized
email_verified_at
full_name
business_name
phone_number
country
city
business_website
stripe_customer_id where appropriate
payment_method_verified_at
created_at
updated_at

Required:

Full name
Business name
Business email
Phone number
Country
City

Optional:

Existing website

Required acknowledgement:

I am 18 or older.

I agree to the Auction Terms and Privacy Policy.

I understand that if I finish as the highest valid bidder after the public reserve is met, my winning bid represents a commitment to purchase the VAELTX Website Launch Package subject to the Auction Terms.

Do NOT automatically subscribe auction users to unrelated marketing.

==================================================
PUBLIC PRIVACY
==================================================

The public must NEVER see:

participant full name
email
phone
private business contact data
IP
Supabase auth ID
Stripe Customer ID
Stripe PaymentMethod ID
private admin email

Public sanitized identities may appear like:

Bidder •••184

Bidder •••621

==================================================
AUTHENTICATION
==================================================

Preferred flow:

CREATE / ACCESS ACCOUNT
↓
VERIFY EMAIL
↓
COMPLETE BIDDER PROFILE
↓
VERIFY PAYMENT METHOD
↓
BIDDING ENABLED

Prefer Supabase Auth magic link / OTP if suitable.

Do not create insecure custom authentication unnecessarily.

==================================================
BIDS TABLE
==================================================

Suggested:

id
auction_id
bidder_id
amount_minor
currency
status
created_at
supersedes_bid_id
request_id

Possible statuses:

valid
superseded
invalidated
winner
cancelled

The database determines authoritative ordering.

==================================================
BID UI
==================================================

Example:

CURRENT BID
$220

PUBLIC RESERVE
$350

RESERVE NOT MET

NEXT MINIMUM
$230

YOUR BID
$ [________]

Quick actions:

+$10
+$25
+$50
+$100

[ REVIEW BID ]

If current bid is $220:

+$10 → $230
+$25 → $245
+$50 → $270
+$100 → $320

Custom bid may be any amount satisfying:

custom_bid >= next_minimum_bid

==================================================
BID CONFIRMATION
==================================================

Never commit from a single accidental click.

Show confirmation:

CONFIRM YOUR BID

You are bidding:

$XXX USD

If this is the highest valid bid when the auction closes and the public reserve has been met, you agree to purchase the VAELTX Website Launch Package for this amount subject to the Auction Terms.

[ CONFIRM $XXX BID ]

[ CANCEL ]

==================================================
SERVER-SIDE VALIDATION
==================================================

Frontend is NOT authoritative.

For every bid:

1. authenticate participant;
2. verify email;
3. verify participant profile;
4. verify approved payment-method setup if required;
5. confirm auction status = active;
6. lock/read authoritative auction state;
7. read highest valid bid transactionally;
8. determine authoritative minimum;
9. validate submitted amount;
10. atomically insert bid;
11. update previous leader state if appropriate;
12. evaluate reserve status;
13. evaluate anti-sniping;
14. update end_at if necessary;
15. create audit event;
16. enqueue notifications;
17. return authoritative fresh auction state.

Do NOT trust browser-supplied:

currentBid
nextMinimum
reserveMet
endAt
bid count
winner
bidder count

==================================================
CONCURRENCY — CRITICAL
==================================================

Two bidders may submit simultaneously.

Use proper:

PostgreSQL transactional locking
Supabase RPC
database function
or equivalent concurrency-safe architecture.

Never:

read current bid
→ calculate separately
→ blindly insert.

Required test:

Current:
$190

User A:
$200

User B:
$200

Only one $200 bid becomes valid.

After commit:

next minimum = $210

Second request must receive the new authoritative minimum.

==================================================
SUPABASE REALTIME
==================================================

Use Realtime appropriately.

Open clients should update quickly when:

current bid changes
next minimum changes
reserve status changes
bid count changes
auction extends
auction closes

Realtime is not authoritative.

Database remains authoritative.

Periodically reconcile.

==================================================
PUBLIC BID HISTORY
==================================================

Example:

LIVE BID HISTORY

Bidder •••184
$470 USD
2 minutes ago

Bidder •••621
$460 USD
11 minutes ago

Bidder •••184
$440 USD
34 minutes ago

Do not expose PII.

==================================================
MY ACCOUNT
==================================================

/website-auction/account

Show:

CURRENT HIGHEST BID

YOUR HIGHEST BID

STATUS

Possible:

YOU'RE CURRENTLY WINNING

OUTBID

RESERVE NOT MET

AUCTION PAUSED

AUCTION CLOSED

PAYMENT REQUIRED

Show private participant bid history.

Allow unlimited legitimate rebidding while active.

==================================================
PRIVATE ADMIN PANEL
==================================================

Create secure:

/admin/website-auction

Admin must be able to see REAL participant information.

For each bidder show privately:

Full name
Business name
Email
Phone
Country
City
Website
Verification status
Payment-method verification status
All bids
Highest bid
Current status
Created timestamp

Auction-level admin should show:

Auction status
Current bid
Public reserve
Reserve state
Next minimum
Start
Original end
Current end
Number of extensions
Bid count
Verified bidder count
Current leader
Full bid timeline
Winner
Winner contact information
Payment status
Stripe state

Admin actions if safely implemented:

PAUSE AUCTION
RESUME AUCTION
CANCEL AUCTION
INVALIDATE FRAUDULENT BID
VIEW AUDIT LOG

Sensitive actions require:

authentication
authorization
confirmation
reason where appropriate
audit trail

==================================================
PRIVATE OWNER EMAIL
==================================================

Send private auction notifications to:

[PRIVATE_ADMIN_EMAIL — configure only on the server]

BUT:

Do NOT put this address in frontend code.

Store server-side as:

AUCTION_ADMIN_EMAIL

or equivalent environment variable.

It must NEVER appear publicly in:

HTML
frontend JS
metadata
API responses
public auction history
Meta Pixel
customer emails
public Terms unless deliberately changed later

==================================================
OWNER EMAIL — NEW VALID BID
==================================================

Whenever a REAL valid Production bid successfully commits:

send exactly ONE private owner email.

Subject:

VAELTX Auction — New Bid: $XXX USD

Body:

VAELTX WEBSITE AUCTION

A new valid bid has been placed.

Bid:
$XXX USD

Current highest bid:
$XXX USD

Next minimum:
$XXX USD

Public reserve:
$350 USD

Reserve status:
MET / NOT MET

Valid bids:
X

Verified bidders:
X

Time remaining:
XX days XX hours

BIDDER

Name:
[full private name]

Business:
[private business]

Email:
[private email]

Phone:
[private phone]

Country:
[country]

Admin:
[secure admin URL]

Timestamp:
[authoritative timestamp]

Do NOT include:

card number
CVC
password
auth token
Stripe secret
Supabase secret

==================================================
ADMIN EMAIL IDEMPOTENCY
==================================================

One committed bid ID = maximum one owner new-bid notification.

Retries must NOT send duplicates.

Use notification persistence/idempotency.

==================================================
OTHER PRIVATE ADMIN EMAILS
==================================================

Also notify AUCTION_ADMIN_EMAIL when:

PUBLIC RESERVE FIRST BECOMES MET

AUCTION CLOSED — NO SALE

WINNER DETERMINED

WINNER PAYMENT DEADLINE APPROACHING

WINNER PAYMENT EXPIRED

BACKUP BIDDER OFFER CREATED

PAYMENT CONFIRMED

PROJECT ONBOARDING STARTED

Optionally summarize anti-sniping extensions rather than spamming repeated emails if bidding becomes extremely active.

==================================================
PARTICIPANT EMAILS
==================================================

Use Resend/existing transactional email.

Send as appropriate:

EMAIL VERIFICATION

BID CONFIRMED

OUTBID

RESERVE MET
only if useful

AUCTION WON

AUCTION ENDED — NOT WINNER

WINNER PAYMENT REMINDER

PAYMENT CONFIRMED

Throttle/dedupe appropriately.

==================================================
AUCTION CLOSE
==================================================

Browser countdown reaching 0 must NOT determine outcome.

Server/database performs authoritative close.

When:

current_time >= end_at

execute safe close operation.

CASE A:

no valid bid reaches reserve

status:
closed_no_sale

No winner.
No payment.
No charge.

CASE B:

highest valid bid >= $350

identify:

highest valid bid
highest valid bidder

Create immutable winner record.

Set:

auction.status = payment_pending

winner payment deadline:

close timestamp + 24 hours

==================================================
WINNER INFORMATION
==================================================

Admin must immediately see:

WINNER

Full name
Business
Email
Phone
Country
Winning bid
Payment status
Payment deadline
Full bid history

Send private administrator winner email.

==================================================
TIES
==================================================

Normal bid rules should prevent ties.

If legacy/migration/concurrency anomaly creates identical valid amounts:

earliest authoritative committed database order wins.

Document this rule.

==================================================
STRIPE WINNER PAYMENT
==================================================

Do NOT charge normal bidders.

After winner is determined:

create server-side Stripe Checkout Session.

Amount MUST come from immutable winner database record.

Never from browser input.

Use:

winning_bid_amount_minor
USD
one-time payment

Include appropriate metadata:

auction_id
winner_id

Use only the Stripe account intentionally belonging to VAELTX.

==================================================
STRIPE WEBHOOK
==================================================

Stripe webhook is authoritative.

Verify:

signature
event validity
expected auction/winner
amount
currency

Implement idempotency.

A return URL containing:

?success=true

does NOT mean payment succeeded.

Persist webhook-confirmed status.

==================================================
WINNER PAGE
==================================================

Show:

YOU WON THE VAELTX WEBSITE AUCTION

WINNING BID

$XXX USD

YOUR PACKAGE

✓ Custom design
✓ Development
✓ Up to 5 pages
✓ Responsive desktop/mobile
✓ Domain registration
✓ First month hosting
✓ Contact functionality
✓ Metadata & technical setup
✓ Deployment
✓ Launch support
✓ Two revision rounds

PAYMENT DEADLINE

XX : XX : XX

[ COMPLETE PAYMENT ]

==================================================
FAILURE TO PAY
==================================================

Original winner has:

24 hours

to pay.

If payment deadline expires:

mark:

payment_expired

Do NOT delete/alter historical bid data.

The package may then be offered to:

NEXT HIGHEST ELIGIBLE BIDDER

IMPORTANT:

The backup bidder pays:

THEIR OWN HIGHEST VALID BID

NOT the original winner's bid.

Example:

Winner A:
$800
fails to pay

Bidder B highest valid bid:
$610

Backup offer:
$610 USD

Backup bidder payment deadline:

24 hours by default

or configurable.

Persist:

original winner
original winning bid
payment expiry
backup bidder
backup bidder amount
backup offer timestamp
backup deadline
backup result

==================================================
AFTER PAYMENT
==================================================

Once Stripe confirms payment:

PAYMENT CONFIRMED

YOUR VAELTX WEBSITE PROJECT
IS READY TO BEGIN.

[ START PROJECT ONBOARDING ]

Notify private admin.

==================================================
PROJECT ONBOARDING
==================================================

Collect securely:

Business name
Industry
Existing website
Primary services/products
Desired pages
Primary website goal
Preferred design direction
Logo/assets
Brand colors
Existing copy/content
Contact information
Required functionality
Domain preference
Existing domain status

Do NOT request passwords in ordinary forms.

==================================================
AUCTION TERMS
==================================================

Create:

/website-auction/terms

Must clearly cover at minimum:

Organizer:
VAELTX — Web & Conversion Studio

Eligibility

Minimum age

Eligible jurisdictions

Auction period

25-day duration

Starting bid:
$100 USD

Public reserve:
$350 USD

No-sale behavior below reserve

Minimum increment:
$10 USD

Unlimited legitimate bidding

No bid fees

No entry fees

Payment-method verification

Email verification

Bid confirmation

Binding nature of winning bid

Anti-sniping

Highest-valid-bid determination

Tie handling

Winner notification

Winner payment deadline:
24 hours

Failure to pay

Backup bidder process

Backup bidder pays their own valid bid

Website scope

Five-page / landing-page limit

Two revision rounds

Domain allowance:
first year up to $20

Hosting:
first month included

Additional/out-of-scope work

Client responsibilities

Project process

Delivery timeline
DO NOT fabricate until approved

Payment/refund terms

Intellectual property

Third-party assets/services

Privacy

Fraud/bots

Bid invalidation

Auction pause/cancellation

Service availability

Limitation of liability

Applicable law/jurisdiction
DO NOT fabricate

Contact information

Do not expose the private owner email publicly.

If legal/jurisdiction information is unresolved:

FLAG AS ACTIVATION BLOCKER.

==================================================
TAX / INVOICING
==================================================

DO NOT invent tax treatment.

Before real activation resolve:

seller / merchant identity

applicable tax obligations

receipt/invoice process

whether winning bid displayed is tax-inclusive or tax-exclusive

international customer treatment

currency/payment treatment

Do not surprise the winner with undisclosed charges after bidding.

Until resolved:

TAX_AND_INVOICING = ACTIVATION_BLOCKER

==================================================
STRIPE BUSINESS MODEL REVIEW
==================================================

Architecture must remain:

NO BID FEES
NO PAID BID CREDITS
NO RANDOM WINNER
NO ENTRY FEES
NO CHANCE-BASED MECHANISM

Only the highest valid bidder purchases the actual website-development service.

Before activation:

review current Stripe configuration and ensure the implementation is compatible with the actual Stripe account/business configuration.

If uncertain:

STRIPE_BUSINESS_MODEL_REVIEW_REQUIRED

DO NOT activate until resolved.

Never disguise the business model from Stripe.

==================================================
META PIXEL
==================================================

Preserve current consent-gated implementation.

Pixel ID:

1716784306059756

Do NOT send automatically to Meta:

participant email
participant name
phone
business name
exact bid amount
Stripe information
payment details

Do not enable Advanced Matching as part of this project.

==================================================
SECURITY
==================================================

Protect against:

bot bidding
automated bid spam
card testing
duplicate requests
replay attacks
race conditions
malformed amounts
unauthorized API calls
IDOR
RLS bypass

Use:

authentication
authorization
email verification
payment-method verification
server validation
database transactions
RLS
rate limiting
idempotency
audit logs
CSRF protections where applicable
bot protection where appropriate

==================================================
AUDIT LOG
==================================================

Record:

auction created
auction activated
auction paused
auction resumed
auction cancelled
bid attempted
bid accepted
bid rejected
bid invalidated
reserve met
auction extended
participant outbid
auction closed
closed_no_sale
winner determined
winner notified
Stripe Checkout created
payment confirmed
payment expired
backup bidder selected
backup offer created
backup payment
onboarding started

Do not log secrets.

==================================================
MOBILE
==================================================

Mobile first-class.

Test:

320px
360px
375px
390px
430px

Current bid, reserve, timer and CTA must appear quickly.

No horizontal overflow.

Tap targets >=44px.

Bid review must be easy on mobile.

==================================================
ACCESSIBILITY
==================================================

Implement:

semantic HTML
labels
accessible dialogs
keyboard support
visible focus
screen-reader auction updates
accessible countdown
reduced-motion support
high contrast

Do not make Realtime updates excessively noisy for screen readers.

==================================================
REAL DATA ONLY
==================================================

Never fake:

bids
participants
bid count
current bid
reserve status
activity
winner
payments
auction extensions

ZERO means ZERO.

No fake social proof.

==================================================
DEVELOPMENT MODE
==================================================

During implementation:

auction = draft/test

Stripe = TEST MODE

Use fake/test bidders only in development/Preview.

Do NOT insert fake Production bids.

Do NOT accidentally activate Production auction.

==================================================
TESTS
==================================================

Automated/integration tests must cover:

zero-bid state

first $100 bid

first $110 bid

bid below starting amount

minimum $10 increment

$110 current → $111 rejected

$110 current → $119 rejected

$110 current → $120 accepted

custom high bid

unlimited repeated bids

public reserve not met

reserve reached exactly at $350

reserve exceeded

close below reserve → no sale

close above reserve → winner

same-user repeated bidding

concurrent bidding

idempotency

closed-auction rejection

paused-auction rejection

not-started rejection

email verification

payment-method verification

payment setup abuse controls

authentication

RLS

anti-sniping

repeated anti-sniping

Realtime

winner determination

tie fallback

winner contact visibility in ADMIN ONLY

admin email generation

admin email idempotency

Stripe Checkout amount

Stripe webhook signature

Stripe webhook idempotency

winner payment expiry

backup bidder price rule

backup bidder payment

PII exposure

admin authorization

==================================================
CRITICAL CONCURRENCY TEST
==================================================

Current highest:

$190

User A submits:

$200

User B submits:

$200

Only one $200 bid becomes valid.

After first commit:

next minimum = $210

Second user gets updated authoritative state.

==================================================
CRITICAL INCREMENT TEST
==================================================

Current highest:

$110

Reject:

$111
$115
$119

Accept:

$120
$125
$200

After $125 becomes highest:

next minimum = $135

==================================================
ADMIN EMAIL TEST
==================================================

A valid committed bid creates exactly ONE owner notification.

Retries must not duplicate it.

Verify private admin email is absent from:

public HTML
browser JavaScript
metadata
API payloads
Meta data
public auction history

==================================================
FULL E2E TEST
==================================================

USER A

create account
verify email
complete profile
verify payment method
bid $100

USER B

create account
verify email
complete profile
verify payment method
bid $110

USER A

bid $120

PUBLIC UI

shows:

$120
reserve not met

Continue controlled TEST bidding to:

$350

PUBLIC UI

shows:

RESERVE MET

Place bid in final 2 minutes.

Auction extends 2 minutes.

Auction closes.

Highest valid bidder becomes winner.

Admin can see winner identity/contact.

Winner receives email.

Admin receives winner email.

Stripe TEST Checkout generated from authoritative winner amount.

Stripe webhook confirms.

Payment status becomes confirmed.

Admin receives payment-confirmed email.

Winner begins onboarding.

==================================================
EXISTING VAELTX REGRESSION
==================================================

Verify:

/
 /work
/contact
portfolio
project pages
WhatsApp
Resend contact
Meta consent
Meta Pixel
navigation
mobile
existing design

Do not regress unrelated systems.

==================================================
GIT / DEPLOYMENT WORKFLOW
==================================================

1. Inspect main first.

2. Understand current architecture.

3. Create branch:

feat/live-website-auction

4. Implement database migrations.

5. Implement backend auction system.

6. Implement auth/profile flow.

7. Implement payment-method verification.

8. Implement bid engine.

9. Implement transactional concurrency.

10. Implement reserve logic.

11. Implement anti-sniping.

12. Implement Supabase Realtime.

13. Implement frontend.

14. Implement participant account.

15. Implement public history.

16. Implement private admin dashboard.

17. Implement transactional participant email.

18. Implement private admin notifications.

19. Implement winner logic.

20. Implement backup-bidder logic.

21. Implement Stripe winner Checkout.

22. Implement Stripe webhook.

23. Implement onboarding.

24. Implement Terms.

25. Disable old Grant/ticket system publicly.

26. Run:

typecheck
lint
tests
build

27. Deploy Vercel Preview.

28. Perform browser QA.

29. Perform mobile QA.

30. Perform concurrency testing.

31. Perform Stripe TEST mode E2E.

32. Verify Supabase RLS.

33. Verify private admin data is not leaked.

34. Verify email idempotency.

35. Verify old grant is inaccessible publicly.

36. Deploy Production only in:

READY_FOR_ACTIVATION

state.

DO NOT ACTIVATE THE REAL 25-DAY AUCTION.

==================================================
ACTIVATION BLOCKERS
==================================================

Before ACTIVE require:

Website auction implementation:
PASS

Previous ticket/grant system:
DISABLED

Auction Terms:
PASS

Jurisdictions/eligibility:
APPROVED

Duration:
25 DAYS

Starting bid:
$100 USD

Public reserve:
$350 USD

Minimum increment:
$10 USD

Unlimited bidding:
PASS

No artificial maximum bid:
PASS

No bid fee:
PASS

Anti-sniping:
2 MIN + 2 MIN

Payment deadline:
24 HOURS

Backup bidder rule:
PASS

Domain:
FIRST YEAR / MAX $20

Hosting:
FIRST MONTH

Revision rounds:
2

Delivery timeline:
APPROVED

Tax/invoicing:
PASS

Stripe business-model review:
PASS

Stripe live configuration:
PASS

Payment-method setup:
PASS

Payment setup abuse protection:
PASS

Stripe winner Checkout:
PASS

Stripe webhook:
PASS

Webhook idempotency:
PASS

Supabase RLS:
PASS

Authentication:
PASS

Email verification:
PASS

Realtime:
PASS

Concurrency:
PASS

Rate limiting:
PASS

Private admin dashboard:
PASS

Private admin bid emails:
PASS

Admin email privacy:
PASS

Mobile:
PASS

Accessibility:
PASS

Production QA:
PASS

If any launch-critical item fails or remains unresolved:

DO NOT ACTIVATE.

==================================================
FINAL REPORT
==================================================

When implementation is complete, return:

VAELTX_WEBSITE_AUCTION_READY

Then report:

Repository:

Branch:

Final commit:

Preview URL:

Production URL:

Auction status:

Previous Grant/ticket system:
DISABLED / FAIL

Auction route:
PASS / FAIL

Admin route:
PASS / FAIL

Duration:
25 DAYS

Starting bid:
$100 USD

Public reserve:
$350 USD

Minimum increment:
$10 USD

Unlimited bidding:
PASS / FAIL

Artificial max bid:
NONE / PRESENT

Currency:
USD

Start:
NOT STARTED unless explicitly activated

End:
NOT STARTED unless explicitly activated

Anti-sniping:
2 MIN + 2 MIN

Winner payment deadline:
24 HOURS

Authentication:
PASS / FAIL

Email verification:
PASS / FAIL

Payment-method verification:
PASS / FAIL

Supabase:
PASS / FAIL

RLS:
PASS / FAIL

Realtime:
PASS / FAIL

Concurrency:
PASS / FAIL

Rate limiting:
PASS / FAIL

Audit log:
PASS / FAIL

Private admin dashboard:
PASS / FAIL

Private new-bid email:
PASS / FAIL

Winner admin email:
PASS / FAIL

Admin email exposed publicly:
NO / YES

Current real bid:
$0 / value

Real valid bid count:

Verified bidders:

Reserve status:

Winner logic:
PASS / FAIL

Closed-below-reserve:
PASS / FAIL

Backup bidder:
PASS / FAIL

Backup bidder own-bid price:
PASS / FAIL

Stripe SetupIntent/payment setup:
PASS / FAIL

Stripe winner Checkout:
PASS / FAIL

Stripe webhook:
PASS / FAIL

Webhook idempotency:
PASS / FAIL

Domain:
PASS / FAIL

Hosting:
PASS / FAIL

Scope:
PASS / FAIL

Revision policy:
PASS / FAIL

Auction Terms:
PASS / FAIL

Privacy:
PASS / FAIL

Tax/invoicing:
PASS / BLOCKED

Stripe business-model review:
PASS / BLOCKED

Desktop:
PASS / FAIL

Mobile:
PASS / FAIL

Accessibility:
PASS / FAIL

Meta Pixel regression:
PASS / FAIL

Resend regression:
PASS / FAIL

WhatsApp regression:
PASS / FAIL

Typecheck:
PASS / FAIL

Lint:
PASS / FAIL

Tests:
PASS / FAIL

Build:
PASS / FAIL

CI:
PASS / FAIL

Remaining activation blockers:

==================================================
ABSOLUTE SUCCESS STANDARD
==================================================

Do NOT call this finished merely because a page renders.

Success requires:

REAL verified bidder accounts

REAL private bidder identity available to VAELTX admin

REAL database-backed bids

REAL $10 minimum-increment enforcement

REAL unlimited legitimate bidding

REAL public reserve

REAL no-sale behavior below reserve

REAL concurrency safety

REAL authoritative current bid

REAL Supabase Realtime updates

REAL authoritative 25-day timer

REAL anti-sniping

REAL sanitized public bid history

REAL private admin dashboard

REAL private owner email for every valid bid

REAL winner identification

REAL winner contact information for VAELTX

REAL Stripe winner payment

REAL webhook confirmation

REAL payment expiry

REAL backup bidder process

REAL secure onboarding

REAL privacy protection

REAL responsive UI

REAL automated tests

NO fake bidders.

NO fake bids.

NO fake counters.

NO fake activity.

NO fake winner.

NO fake payment.

NO public owner email.

NO accidental auction activation.

Build everything, validate everything, deploy it in READY_FOR_ACTIVATION state, return the full report, and STOP.

DO NOT activate the real auction until explicit final approval is given after reviewing the Preview and activation blockers.