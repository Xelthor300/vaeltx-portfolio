import Link from "next/link";
import { campaignSnapshot } from "@/lib/website-grant-server";
import { ruleSections, money } from "@/lib/website-grant";
export const dynamic = "force-dynamic";
export default async function RulesPage() {
  const { campaign } = await campaignSnapshot();
  const approved = !!campaign?.legal_approved_at;
  const defaults: Record<string, string> = {
    "5": "One free entry per verified account per campaign. Sign-ins, devices and browser sessions do not reset this limit.",
    "6": "No purchase is necessary to claim the single free entry. Entry requires email verification, a completed business application and acceptance of the published rules.",
    "7": "Additional entry purchases are not open. The proposed packages are 5 through 100 entries in steps of 5, with repeated purchases permitted for the same account. Selection is by a documented sales-team evaluation, not a random draw. Additional entry quantity does not automatically improve a review score or guarantee selection. Standalone VAELTX services create no entries and do not influence review.",
    "8": "One custom VAELTX business website, responsive design and development, contact / lead functionality, basic SEO structure and launch support.",
    "9": campaign?.prize_arv_minor ? money(campaign.prize_arv_minor, campaign.prize_arv_currency) : "Approximate retail value has not been finalized.",
    "10": "First-year domain registration is included up to USD 20. Premium, aftermarket and unusually expensive domains are excluded.",
    "11": "First month of hosting included. Afterward, the selected business may continue with VAELTX, migrate or arrange another hosting solution.",
    "12": "Up to five custom pages or one equivalent high-detail landing website. Additional scope requires a separate agreement.",
    "13": "The VAELTX sales team evaluates eligible applications using criteria published before opening. There is no random draw. Evaluation criteria, conflict controls and tie resolution must be finalized before participation opens.",
    "23": "This promotion is not sponsored, endorsed or administered by, or associated with, Meta, Facebook or Instagram.",
    "25": "VAELTX — Web & Conversion Studio. Campaign questions: vaeltxn@gmail.com. Legal sponsor details must be finalized separately.",
  };
  return <main id="main" className="wg-main wg-narrow"><p className="wg-kicker">WEBSITE LAUNCH GRANT / OFFICIAL RULES</p><h1>Clear rules.<br/>A fair beginning.</h1><p className="wg-status-banner">{approved ? `Rules version: ${campaign.rules_version}` : "Preparation draft. These rules are incomplete and the campaign is not open for participation or payment."}</p><p>Currency support does not establish jurisdiction eligibility. Eligibility and the selection procedure must be approved before activation.</p>
    <div className="wg-rules">{ruleSections.map((title, i) => { const key = String(i + 1); return <section key={title}><p className="wg-kicker">{String(i + 1).padStart(2, "0")}</p><h2>{title}</h2><p>{campaign?.rules[key] || defaults[key] || "Pending final approved campaign terms. This item must be resolved before applications open."}</p></section>; })}</div><Link href="/website-grant" className="wg-button">Back to the grant ↗</Link>
  </main>;
}
