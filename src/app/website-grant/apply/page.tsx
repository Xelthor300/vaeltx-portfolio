import Link from "next/link";
import { campaignSnapshot, verifiedAccount } from "@/lib/website-grant-server";
import { campaignAvailability } from "@/lib/website-grant";
import { GrantApplication, VerifyAccount } from "@/components/website-grant/GrantControls";
export const dynamic = "force-dynamic";
export default async function ApplyPage() {
  const { campaign } = await campaignSnapshot(), available = campaignAvailability(campaign);
  if (!campaign || available !== "open") return <main id="main" className="wg-main wg-narrow"><p className="wg-kicker">WEBSITE LAUNCH GRANT</p><h1>{available === "closed" ? "Applications are now closed." : "A new beginning is on its way."}</h1><p>Applications open only when the dates, eligible jurisdictions and Official Rules are finalized.</p><Link className="wg-button" href="/website-grant">Back to the grant ↗</Link></main>;
  let user; try { user = await verifiedAccount(); } catch { /* Public verification view. */ }
  return <main id="main" className="wg-main wg-narrow"><p className="wg-kicker">WEBSITE LAUNCH GRANT / APPLICATION</p><h1>Your next chapter starts here.</h1>{user ? <GrantApplication campaign={campaign} email={user.email!} sandboxEntries={process.env.GRANT_STRIPE_MODE === "test" && process.env.VERCEL_ENV !== "production" && campaign.paid_entries_enabled && !!campaign.processor_approved_at}/> : <VerifyAccount siteKey={process.env.GRANT_CAPTCHA_SITE_KEY || null}/>}</main>;
}
