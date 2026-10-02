import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";

export default function NotFound() {
  return <SiteShell mode="lab"><main tabIndex={-1} id="main" className="not-found"><span className="eyebrow">404 / ROUTE NOT FOUND</span><p className="not-found-coordinate">COORDINATE / — —</p><h1>This page is not in the system.</h1><p>The URL may have changed, or the page may never have existed.</p><div><Link className="button button-primary" href="/work">View work <span aria-hidden="true">↗</span></Link><Link className="text-link" href="/">Go home <span aria-hidden="true">→</span></Link></div></main></SiteShell>;
}
