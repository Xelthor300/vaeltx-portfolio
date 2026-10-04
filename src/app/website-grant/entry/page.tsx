import Link from "next/link";
import { accountDashboard, GrantError } from "@/lib/website-grant-server";
import { campaignAvailability, Currency, money } from "@/lib/website-grant";
import { GrantPurchases, GrantSignOut, VerifyAccount } from "@/components/website-grant/GrantControls";
export const dynamic = "force-dynamic";
export default async function EntryPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const query = await searchParams;
  let dashboard;
  try { dashboard = await accountDashboard(); } catch (error) {
    return <main id="main" className="wg-main wg-narrow"><p className="wg-kicker">YOUR ENTRIES</p><h1>Your account. Your entries.</h1><p>{error instanceof GrantError ? error.message : "Your account could not be loaded. Please retry."}</p>{error instanceof GrantError && error.status === 401 ? <VerifyAccount siteKey={process.env.GRANT_CAPTCHA_SITE_KEY || null}/> : <Link href="/website-grant" className="wg-button">Campaign status ↗</Link>}</main>;
  }
  const free = (dashboard.total ?? 0) - (dashboard.paid ?? 0);
  const open = campaignAvailability(dashboard.campaign) === "open";
  return <main id="main" className="wg-main"><p className="wg-kicker">YOUR ACCOUNT / WEBSITE LAUNCH GRANT</p><h1>Your entries.</h1><p>{dashboard.email}</p><GrantSignOut/>{query.checkout && <p className="wg-status-banner" role="status">{query.checkout === "cancelled" ? "Checkout was cancelled. No payment has been confirmed by this page." : "Checkout returned. Your purchase appears as paid only after verified payment confirmation. Refresh to update."}</p>}
    <div className="wg-stats"><div><strong>{free}</strong><span>FREE VALID ENTRY</span></div><div><strong>{dashboard.paid ?? 0}</strong><span>PAID VALID ENTRIES</span></div><div><strong>{dashboard.total ?? 0}</strong><span>TOTAL VALID ENTRIES</span></div></div>
    {!dashboard.participant && <p className="wg-notice">Your email is verified. <Link href="/website-grant/apply">Complete your business application</Link> to claim your free entry.</p>}
    <section className="wg-account-list"><h2>Entry history</h2><p>Showing the latest {dashboard.entries.length} entry records. Totals above include all valid entries.</p>{dashboard.entries.map(entry => <div className="wg-account-row" key={entry.entry_number}><Link href={`/website-grant/entry/${entry.entry_number}`}>{entry.entry_number}</Link><span>{entry.entry_source === "paid" ? "Paid" : "Free"} · {entry.status}</span></div>)}</section>
    <section className="wg-account-list"><h2>Purchase history</h2>{!dashboard.orders.length && <p>No purchases recorded.</p>}{dashboard.orders.map(order => <div className="wg-account-row" key={order.id}><div><strong>{order.kind === "entries" ? `${order.quantity} entries` : order.code.replaceAll("-", " ")}</strong><p>{new Date(order.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })}</p></div><span>{money(order.amount_minor, order.currency as Currency)} · {order.status}</span></div>)}</section>
    <GrantPurchases freeClaimed={dashboard.participant} canBuyServices={open && dashboard.participant && dashboard.campaign.services_enabled} canBuyEntries={open && dashboard.participant && process.env.GRANT_STRIPE_MODE === "test" && process.env.VERCEL_ENV !== "production" && dashboard.campaign.paid_entries_enabled && !!dashboard.campaign.processor_approved_at}/>
  </main>;
}
