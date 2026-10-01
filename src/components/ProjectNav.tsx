"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { conceptBase, conceptNames, pathOf } from "@/lib/content";
import { useCommerce } from "@/components/VaultExperience";

const projectLinks: Record<string, string[]> = {
  "northstar-roofing": ["services", "service-areas", "about", "faq"],
  "mira-atelier": ["work", "commissions", "about", "shop"],
  "axiom-strategy": ["services", "industries", "case-studies", "insights", "about"],
  "vault-tcg": ["collections", "cards", "shipping", "faq"],
};
const labels: Record<string, string> = { services: "Services", "service-areas": "Service areas", about: "About", faq: "FAQ", work: "Work", commissions: "Commissions", shop: "Shop", industries: "Industries", "case-studies": "Scenarios", insights: "Insights", collections: "Collections", cards: "Cards", shipping: "Shipping" };

export function ProjectNav({ concept }: { concept: string }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const base = conceptBase[concept];
  const { cartCount } = useCommerce();
  const links = projectLinks[concept] ?? [];
  const close = () => dialog.current?.close();
  return <>
    <div className="concept-disclosure-bar"><span>INDEPENDENT CONCEPT PROJECT BY VAELTX</span><Link href="/work">Return to portfolio <span aria-hidden="true">↗</span></Link></div>
    <header className={`project-nav project-nav-${concept}`}><Link href={base} className="project-wordmark" aria-label={`${conceptNames[concept]} concept home`}>{conceptNames[concept]}<span aria-hidden="true">{concept === "northstar-roofing" ? "✳" : concept === "mira-atelier" ? "" : concept === "axiom-strategy" ? "." : " /"}</span></Link>
      <nav aria-label={`${conceptNames[concept]} navigation`} className="project-nav-links">{links.map(key => { const target = pathOf(base, key); return <Link key={key} href={target} aria-current={pathname === target ? "page" : undefined}>{labels[key]}</Link>; })}</nav>
      {concept === "northstar-roofing" ? <Link className="project-nav-action" href={`${base}/request-an-inspection`}>Request inspection <span aria-hidden="true">↗</span></Link> : null}
      {concept === "mira-atelier" ? <Link className="project-nav-action" href={`${base}/commission-request`}>Commission <span aria-hidden="true">↗</span></Link> : null}
      {concept === "axiom-strategy" ? <Link className="project-nav-action" href={`${base}/contact`}>Contact <span aria-hidden="true">↗</span></Link> : null}
      {concept === "vault-tcg" ? <div className="vault-nav-tools"><Link href={`${base}/search`} aria-label="Search cards">⌕</Link><Link href={`${base}/account`} aria-label="Account">○</Link><Link href={`${base}/cart`} aria-label={`Cart, ${cartCount} items`}>Bag ({cartCount})</Link></div> : null}
      <button ref={trigger} className="project-menu-trigger" type="button" aria-haspopup="dialog" aria-label={`Open ${conceptNames[concept]} navigation`} onClick={() => dialog.current?.showModal()}><span/><span/></button>
      <dialog className="project-menu" ref={dialog} aria-label={`${conceptNames[concept]} navigation`} onClose={() => trigger.current?.focus()}>
        <div className="project-menu-top"><Link href={base} onClick={close}>{conceptNames[concept]}</Link><button type="button" autoFocus onClick={close}>Close <span aria-hidden="true">×</span></button></div>
        <nav>{links.map((key, i) => <Link key={key} href={pathOf(base, key)} onClick={close}><span>0{i + 1}</span>{labels[key]}<b aria-hidden="true">↗</b></Link>)}<Link href={`${base}/contact`} onClick={close}><span>0{links.length + 1}</span>Contact<b aria-hidden="true">↗</b></Link></nav>
        {concept === "vault-tcg" ? <Link href={`${base}/cart`} onClick={close}>Cart · {cartCount}</Link> : null}
        <p>Independent concept by VAELTX · Not a real business</p>
      </dialog>
    </header>
  </>;
}
