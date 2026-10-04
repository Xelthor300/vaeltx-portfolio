import type { Metadata } from "next";
import Link from "next/link";
import "./website-grant.css";

export const metadata: Metadata = { title: "Website Launch Grant", description: "A custom VAELTX business website. One free entry per verified account, subject to campaign eligibility and Official Rules.", robots: { index: false, follow: false } };
export default function GrantLayout({ children }: { children: React.ReactNode }) {
  return <div className="wg"><a className="wg-skip" href="#main">Skip to content</a><header className="wg-nav"><Link href="/" className="wg-wordmark" aria-label="VAELTX home">VAELTX<span>.</span></Link><nav aria-label="Campaign navigation"><Link href="/website-grant">The grant</Link><Link href="/website-grant/official-rules">Official Rules</Link><Link href="/website-grant/entry">My entries ↗</Link></nav></header>{children}<footer className="wg-footer"><div><Link href="/">VAELTX — Web &amp; Conversion Studio</Link><p>Independent work. A deliberate next step.</p></div><nav aria-label="Campaign footer"><Link href="/website-grant/official-rules">Official Rules</Link><Link href="/website-grant/privacy">Privacy</Link><a href="mailto:vaeltxn@gmail.com">vaeltxn@gmail.com</a></nav></footer></div>;
}
