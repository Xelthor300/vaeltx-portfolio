import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export function SiteShell({ children, mode = "canvas", className = "" }: { children: ReactNode; mode?: "canvas" | "stage" | "lab"; className?: string }) {
  return <div className={`vaeltx-site ${className}`} data-mode={mode}><SiteNav />{children}<SiteFooter /></div>;
}

export function Eyebrow({ children, number }: { children: ReactNode; number?: string }) {
  return <span className="eyebrow">{number && <span className="eyebrow-number">{number}</span>}{children}</span>;
}

export function PageIntro({ eyebrow, title, description, mode = "canvas" }: { eyebrow: string; title: string; description: string; mode?: "canvas" | "stage" | "lab" }) {
  return <section className={`page-intro page-intro-${mode}`}><div className="page-intro-copy"><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1><p>{description}</p></div><span className="page-intro-marker" aria-hidden="true">VAELTX / 01</span></section>;
}

export function ContentSection({ number, label, title, children, className = "" }: { number?: string; label?: string; title?: string; children: ReactNode; className?: string }) {
  return <section className={`content-section ${className}`}><div className="content-section-heading">{label && <Eyebrow number={number}>{label}</Eyebrow>}{title && <h2>{title}</h2>}</div><div className="content-section-body">{children}</div></section>;
}
