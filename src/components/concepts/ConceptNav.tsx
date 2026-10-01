"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

type Props = { brand: string; home: string; links: { label: string; href: string }[]; variant: "north" | "mira"; className: string; cta?: { label: string; href: string } };

export function ConceptNav({ brand, home, links, className, cta, variant }: Props) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() { dialog.current?.close(); }
  return <header className={className} data-variant={variant}>
    <Link className="concept-wordmark" href={home} aria-label={`${brand} concept home`}>{variant === "north" && <span aria-hidden="true">✳</span>}{brand}</Link>
    <nav className="concept-desktop-nav" aria-label={`${brand} navigation`}>{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>)}</nav>
    {cta && <Link href={cta.href} className="concept-nav-cta">{cta.label} <span aria-hidden="true">↗</span></Link>}
    <button type="button" className="concept-menu-trigger" ref={trigger} onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">Menu <span aria-hidden="true">☰</span></button>
    <dialog ref={dialog} className="concept-menu" aria-labelledby={`${variant}-menu-title`} onClose={() => trigger.current?.focus()}>
      <div className="concept-menu-top"><span id={`${variant}-menu-title`}>{brand}</span><button type="button" onClick={close} autoFocus>Close ×</button></div>
      <nav aria-label={`${brand} mobile navigation`}>{links.map(link => <Link key={link.href} href={link.href} onClick={close} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>)}</nav>
      {cta && <Link href={cta.href} onClick={close} className="concept-nav-cta">{cta.label} ↗</Link>}
      <p>Independent Concept Project by VAELTX</p><Link href="/work" onClick={close}>Return to VAELTX →</Link>
    </dialog>
  </header>;
}
