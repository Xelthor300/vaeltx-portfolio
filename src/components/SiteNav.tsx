"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const links = [{ label: "Work", href: "/work" }, { label: "Services", href: "/services" }, { label: "Process", href: "/process" }, { label: "Standards", href: "/standards" }, { label: "About", href: "/about" }];

export function SiteNav() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-nav"><Link className="site-wordmark" href="/" aria-label="VAELTX home">VAELTX<span aria-hidden="true">.</span></Link>
      <nav className="site-links" aria-label="Main navigation">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined}>{link.label}</Link>)}</nav>
      <Link className="nav-cta" href="/contact">Start a project <span aria-hidden="true">↗</span></Link>
      <button ref={trigger} className="menu-trigger" type="button" aria-haspopup="dialog" aria-label="Open navigation" onClick={() => dialog.current?.showModal()}><span/><span/></button>
      <dialog className="site-menu" ref={dialog} aria-label="Site navigation" onClose={() => trigger.current?.focus()}>
        <div className="site-menu-top"><Link className="site-wordmark" href="/" onClick={() => dialog.current?.close()}>VAELTX<span aria-hidden="true">.</span></Link><button type="button" className="menu-close" autoFocus onClick={() => dialog.current?.close()}>Close <span aria-hidden="true">×</span></button></div>
        <nav aria-label="Mobile navigation">{links.map((link, i) => <Link key={link.href} href={link.href} onClick={() => dialog.current?.close()}><span>0{i + 1}</span>{link.label}<b aria-hidden="true">↗</b></Link>)}</nav>
        <Link className="nav-cta menu-project-cta" href="/contact" onClick={() => dialog.current?.close()}>Start a project <span aria-hidden="true">↗</span></Link>
        <p>Independent web &amp; conversion studio</p>
      </dialog>
    </header>
  </>;
}
