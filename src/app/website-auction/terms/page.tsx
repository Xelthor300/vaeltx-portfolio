import Link from "next/link";
import type { Metadata } from "next";
import { auction } from "@/lib/auction/server";
import "../auction.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Website auction terms & privacy",
  alternates: { canonical: "/website-auction/terms" },
};
export default async function Terms() {
  const a = await auction().catch(() => null);
  const terms = a?.commercial_terms || {};
  const approved = (key: string, fallback: string) =>
    typeof terms[key] === "string" && terms[key].trim() ? terms[key] : fallback;
  return (
    <div className="au">
      <a className="au-skip" href="#auction-main">
        Skip to content
      </a>
      <header className="au-header">
        <Link className="au-logo" href="/">
          VAELTX.
        </Link>
        <nav aria-label="Auction navigation">
          <Link href="/website-auction">Auction</Link>
          <Link href="/website-auction/account">My account</Link>
        </nav>
      </header>
      <main className="au-terms" id="auction-main">
        <span className="au-eyebrow">AUCTION-V1 · REVIEW BEFORE YOU BID</span>
        <h1>
          A clear agreement
          <br />
          for your next website.
        </h1>
        <p>
          {a?.status === "ready_for_activation"
            ? "The auction is being prepared. Bidding, card verification and the 25-day timer remain closed until the final commercial terms, payment configuration and launch checks are approved."
            : "Review these rules and the published service policies before confirming a bid. The server records the auction status, deadline and valid bids."}
        </p>
        <h2>1. Seller, eligibility and governing law</h2>
        <p>
          Seller:{" "}
          {approved(
            "seller_identity",
            "legal seller identity and business address will be published before activation.",
          )}
        </p>
        <p>
          Participants must be at least 18, use a verified email, provide
          accurate business and contact information, be authorized to commission
          the website, and be legally able to enter this service agreement.
          Eligible countries:{" "}
          {Array.isArray(terms.eligible_countries)
            ? terms.eligible_countries.join(", ")
            : "not yet approved; registration for bidding is blocked until eligibility is finalized."}
        </p>
        <p>
          Governing law and dispute jurisdiction:{" "}
          {approved(
            "governing_law",
            "pending seller review before activation. No jurisdiction is assumed.",
          )}
        </p>
        <h2>2. What is being auctioned</h2>
        <p>
          A custom website service delivered by VAELTX. There is no entry fee,
          random selection or payment for the right to bid. Only the highest
          valid bidder at closing wins, provided that bid meets the public
          reserve. The winner pays their own accepted bid.
        </p>
        <h2>3. Currency, starting price and public reserve</h2>
        <p>
          All bids and payments are in USD. Starting bid: $100 USD. Public
          reserve: $350 USD. If the highest valid bid is below $350 at closing,
          the auction closes without a sale, a winner payment or an automatic
          charge.
        </p>
        <p>
          Tax and invoicing policy:{" "}
          {approved(
            "tax_policy",
            "pending tax and seller review before activation. The winner must see the full payable price before bidding; undisclosed taxes or fees will not be added at checkout.",
          )}
        </p>
        <h2>4. Duration, server clock and extensions</h2>
        <p>
          Final owner approval opens bidding without starting the timer. The first valid accepted bid atomically starts the auction.
          It then runs for 25 full days. The database clock
          and recorded deadline govern acceptance; a browser countdown is
          informational. Each valid bid accepted with 120 seconds or less
          remaining adds 120 seconds to the existing deadline. Extensions can
          repeat. Pausing freezes bidding; resuming adds the paused time to the
          deadline and is recorded in the audit trail.
        </p>
        <h2>5. Accounts, card verification and bid confirmation</h2>
        <p>
          Before the first bid, create or sign in to a verified email account,
          provide full name, business name, phone, country and city, and accept
          these terms, privacy information, adult eligibility and the
          winning-payment commitment. Stripe securely verifies a card without a
          bidding fee. VAELTX stores Stripe references, never card numbers or
          security codes. Verification is not authorization for an automatic
          winning charge.
        </p>
        <p>
          Each bid has a review step and an explicit final confirmation.
          Confirmed bids are commitments to purchase the defined service if they
          win and meet the reserve. There is no lifetime account bid limit.
          Abuse prevention can temporarily limit excessive requests.
        </p>
        <h2>6. Minimum increments, concurrency and ties</h2>
        <p>
          The first valid bid may be exactly $100 USD. Each subsequent bid must
          be at least $10 above the current highest valid bid. A $125 bid after
          $110 is valid; bids need not be multiples of $10. Quick amount buttons
          help compose a bid and do not submit it. There is no commercial
          maximum bid; Stripe’s supported transaction limits still apply.
        </p>
        <p>
          The database serializes acceptance. If two bidders submit the same
          minimum simultaneously, only the first accepted transaction succeeds.
          The next bidder must review the new minimum. If identical amounts
          exist because of an administrative or historical issue, the earliest
          accepted database bid takes precedence.
        </p>
        <h2>7. Winner payment and failed payment</h2>
        <p>
          At closing, the highest valid bid from an eligible participant wins if
          it meets the reserve. The winner receives a 24-hour payment offer.
          Payment requires explicit acceptance and a separate Stripe Checkout at
          the exact recorded winning amount in USD. A redirect or confirmation
          screen alone is not proof of payment; a verified Stripe payment must
          match the offer.
        </p>
        <p>
          If payment is not completed within the deadline, the offer expires.
          VAELTX may offer the next eligible bidder the website at that bidder’s
          own highest valid bid, provided it meets the reserve. A backup offer
          has its own 24-hour deadline and requires explicit acceptance and
          payment. No bidder is charged automatically. Paid or uncertain
          transactions are reconciled before a replacement offer is made.
        </p>
        <h2>8. Included scope</h2>
        <ul>
          <li>
            Custom website design and responsive development: up to five pages
            or one detailed landing page.
          </li>
          <li>
            A lead contact form, mobile usability, basic metadata and technical
            website setup.
          </li>
          <li>
            Deployment, launch support and two revision rounds within the agreed
            scope.
          </li>
          <li>
            The first year of a standard available domain, with a maximum
            included registration value of $20 USD. Premium, aftermarket and
            higher-priced domains require a separate agreement.
          </li>
          <li>
            The first month of hosting. Afterward, agree to ongoing hosting or
            migrate the website; there is no obligation to retain VAELTX
            hosting.
          </li>
          <li>
            A finished, functional website at the agreed scope, with an
            appropriate project handoff.
          </li>
        </ul>
        <p>
          This does not include an SEO service, search ranking guarantee,
          revenue or conversion guarantee, unlimited revisions, ecommerce,
          subscriptions, complex integrations, paid third-party tools or
          additional pages unless separately agreed. Existing portfolio examples
          are independent fictional concept projects, not paid clients or
          performance claims.
        </p>
        <h2>9. Client responsibilities and delivery</h2>
        <p>
          The client supplies lawful, accurate content, logos, brand direction,
          required business details and timely review responses, and confirms
          rights to all supplied assets. Scope changes, delays in content or
          feedback, and extra functionality may require a revised agreement.
          Never submit passwords, API secrets, card details or other access
          credentials in forms.
        </p>
        <p>
          Delivery timeline and review schedule:{" "}
          {approved(
            "delivery_timeline",
            "to be confirmed and published before activation. No delivery date is promised in this preparation version.",
          )}
        </p>
        <h2>10. Payments, refunds and ownership</h2>
        <p>
          Refund and cancellation policy:{" "}
          {approved(
            "refund_policy",
            "pending seller review before activation; statutory consumer rights remain applicable and are not waived by bidding.",
          )}
        </p>
        <p>
          Intellectual property and third-party licenses:{" "}
          {approved(
            "ownership_policy",
            "final handoff rights and any third-party license conditions must be agreed before activation. Client-supplied materials remain the client’s responsibility; external fonts, plugins and services may retain their own licenses.",
          )}
        </p>
        <p>
          Future domain renewals, hosting renewals and separately approved
          extras require separate payment arrangements. No hidden subscription
          or automatic recurring billing is created by this auction checkout.
        </p>
        <h2>11. Fraud, moderation and service availability</h2>
        <p>
          VAELTX may investigate bots, false identities, unauthorized cards,
          abusive bids or other fraud. Bid invalidation requires an
          authenticated owner action, a recorded reason and an audit entry.
          Pauses, cancellations and backup offers are also recorded. Moderation
          must not manufacture activity or alter a winner’s price. Platform
          outages or disputed payments require reconciliation; no sale is
          fabricated from a browser display.
        </p>
        <h2>12. Privacy, notifications and data</h2>
        <p>
          Account, profile, bid and payment-reference information is used to
          administer the auction, prevent abuse, communicate relevant updates
          and deliver the purchased website. Supabase hosts authentication and
          auction records; Stripe processes card verification and payment; the
          configured transactional email provider delivers operational messages.
          Participant contact details and Stripe references are private. Public
          history uses anonymous bidder aliases. Private owner access is
          authenticated.
        </p>
        <p>
          Notifications cover accepted bids, outbid status, closing, winner or
          backup offers, payment reminders, payment confirmation and the project
          brief. These are operational messages; no marketing subscription is
          created. Optional marketing measurement remains governed by the
          existing consent preferences. Personal information, email, phone, card
          data and bid amounts are not sent as advertising-event parameters.
        </p>
        <p>
          Data retention, privacy rights contact and international data transfer
          disclosures:{" "}
          {approved(
            "privacy_policy",
            "the final seller policy must be published before activation. Contact VAELTX through the form below for privacy questions or account requests.",
          )}
        </p>
        <h2>13. Questions and agreement updates</h2>
        <p>
          Contact VAELTX through the{" "}
          <Link href="/contact">business contact form</Link>. Final commercial
          policies and this terms version must be reviewed before activation.
          Material changes require renewed participant acceptance. The published
          auction status, valid database bids, winner offer and verified payment
          record govern the transaction.
        </p>
        <Link className="au-primary" href="/website-auction">
          Return to the auction ↗
        </Link>
      </main>
      <footer className="au-footer">
        <Link href="/">VAELTX.</Link>
        <Link href="/contact">Contact VAELTX</Link>
        <Link href="/website-auction/account">My account</Link>
      </footer>
    </div>
  );
}
