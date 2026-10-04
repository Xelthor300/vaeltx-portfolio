==================================================
PAID ENTRIES
==================================================

Paid entries are ENABLED for this campaign.

A verified participant receives:

1 FREE ENTRY

The participant may also purchase additional entry packages.

Available quantities:

5
10
15
20
25
30
35
40
45
50
55
60
65
70
75
80
85
90
95
100

Each purchased entry is a separate valid campaign entry.

A participant may hold:

1 free entry
+
any valid paid entries purchased for the same campaign.

Purchasing additional entries does NOT guarantee winning.

However, because each purchased entry is a separate valid entry, having more
valid entries may increase the participant's probability of being selected.

Display this clearly and truthfully.

Do NOT display language claiming that purchasing more entries does not affect
the odds.

Display:

“Purchasing additional entries does not guarantee selection or winning.
Odds depend on the total number of eligible entries received.”

==================================================
FREE ENTRY
==================================================

Each verified participant may receive exactly:

1 FREE ENTRY

per campaign.

The free entry:

- requires email verification;
- is tied to the verified participant account;
- cannot be claimed twice;
- cannot be reset by clearing cookies;
- cannot be duplicated from another browser.

Database constraints must enforce this rule.

==================================================
PAID ENTRY PURCHASES
==================================================

Paid entries may be purchased repeatedly.

A verified participant may complete multiple purchases.

Example:

Free entry: 1
First purchase: 10
Second purchase: 25

TOTAL VALID ENTRIES:

36

The user's dashboard must always calculate this from real database records.

Never hardcode totals.

==================================================
ENTRY PRICING
==================================================

Do NOT invent prices.

Create configurable database/admin pricing for:

USD
CAD
MXN

for each available entry package.

Campaign activation must remain blocked until the owner supplies and approves
the exact pricing.

==================================================
STRIPE
==================================================

Stripe Checkout must handle paid entry purchases.

The server must determine:

campaign
package
quantity
currency
price

from trusted server-side configuration.

Never trust amounts submitted by the client.

Stripe webhook is the authoritative payment confirmation.

Only after successful verified payment:

create the paid entries.

Do NOT create valid paid entries merely because the browser reaches a success
URL.

==================================================
ENTRY CREATION
==================================================

For a package of 25:

create 25 separate valid entry records

OR use an equivalent auditable weighted-entry model if technically superior.

Whichever architecture is used must preserve:

- exact entry count;
- auditability;
- deterministic participant totals;
- concurrency safety;
- winner-selection fairness.

==================================================
PUBLIC COUNTER
==================================================

VALID ENTRIES means:

FREE VALID ENTRIES
+
PAID VALID ENTRIES

Example:

184 VALID ENTRIES

may only appear when the database actually contains 184 eligible entries.

No fake seed numbers.

==================================================
USER DASHBOARD
==================================================

Display:

YOUR ENTRIES

FREE ENTRY
1

PAID ENTRIES
25

TOTAL VALID ENTRIES
26

Also show:

Purchase history
Entry status
Entry numbers / entry range as appropriate

==================================================
ODDS DISCLOSURE
==================================================

Use truthful language:

“Purchasing additional entries does not guarantee selection or winning.
The odds of being selected depend on the total number of eligible entries
received.”

Do NOT write:

“Purchasing additional entries does not increase your chances.”

because additional valid entries can mathematically affect selection odds.

==================================================
LEGAL ACTIVATION GATE
==================================================

Because this campaign contains:

- a prize;
- random selection;
- paid entries;

do not assume that it can legally operate in every jurisdiction.

Before Production activation require campaign configuration for:

eligible jurisdictions
age restrictions
promotion classification
required permits/licenses if applicable
Official Rules
payment legality
tax treatment
selection procedure

Do not fabricate legal approval.

If these items are unresolved, the implementation may be complete but the
campaign must remain:

READY_FOR_LEGAL_ACTIVATION

rather than automatically opening paid entry sales.