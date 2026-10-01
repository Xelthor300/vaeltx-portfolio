"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { conceptBase, conceptRoutes, pathOf } from "@/lib/content";
import { CardArt } from "@/components/VaultExperience";
import { vaultProducts } from "@/lib/vault";

export function DecisionField({ base }: { base: string }) {
  const [active, setActive] = useState(0);
  const stages = [
    ["Objective", "What must the decision accomplish?", "A plain-language intent that can be tested."],
    ["Constraints", "What limits are real?", "Capacity, timing and non-negotiable conditions."],
    ["Evidence", "What is observed, assumed or missing?", "A visible record of sources and uncertainty."],
    ["Options", "Which choices are available?", "A bounded set of alternatives to examine."],
    ["Trade-offs", "What does each option cost or displace?", "Consequences are stated beside each choice."],
    ["Decision", "Who decides, and what changes the answer?", "A recorded choice with its rationale and review point."],
  ];
  return <div className="axiom-decision-field"><div className="decision-map" role="group" aria-label="Decision Field stages">{stages.map(([name], i) => <button key={name} type="button" aria-pressed={active === i} onClick={() => setActive(i)}><span>0{i + 1}</span><strong>{name}</strong></button>)}</div><div className="decision-connector" aria-hidden="true"><span>OBJECTIVE</span><i/><span>CHOICE</span></div><div className="decision-detail" aria-live="polite"><span>0{active + 1} / DECISION FIELD</span><h2>{stages[active][0]}</h2><p>{stages[active][1]}</p><small>{stages[active][2]}</small></div><p className="axiom-diagram-note">Original framework diagram · illustrative method, not measured client data.</p><Link href={pathOf(base, "case-studies/decision-field")} className="text-link">Open the framework scenario →</Link></div>;
}

const artworkBySlug: Record<string, { src: string; alt: string }> = {
  "midnight-garden": { src: "/images/mira-moon-garden.svg", alt: "Original illustration concept: pale moon above an indigo garden with red flowers and fine ink branches." },
  "borrowed-light": { src: "/images/mira-borrowed-light.svg", alt: "Original illustration concept: late light crosses a quiet room through a window of leaves." },
  "quiet-orchard": { src: "/images/mira-quiet-orchard.svg", alt: "Original illustration concept: a muted orchard, small orange fruit and layered watercolor foliage." },
};

export function MiraGallery({ base, selected }: { base: string; selected?: string }) {
  const pieces = Object.entries(artworkBySlug);
  const viewer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = selected ? artworkBySlug[selected] : undefined;
  const [zoomed, setZoomed] = useState(false);
  if (selected && current) return <div className="mira-artwork-detail"><div className="mira-artwork-stage"><button ref={trigger} type="button" className="mira-artwork-open" onClick={() => viewer.current?.showModal()} aria-label="Open artwork viewer"><Image unoptimized width={960} height={1200} src={current.src} alt={current.alt}/><span>OPEN ARTWORK VIEW ↗</span></button><dialog ref={viewer} className="mira-lightbox" aria-label="Artwork viewer" onClose={() => { setZoomed(false); trigger.current?.focus(); }}><div className="mira-lightbox-head"><span>ARTWORK VIEW / {selected.toUpperCase()}</span><div><button type="button" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? "Fit image" : "Zoom image"}</button><button type="button" onClick={() => viewer.current?.close()} aria-label="Close artwork viewer">Close ×</button></div></div><Image unoptimized width={960} height={1200} className={zoomed ? "is-zoomed" : ""} src={current.src} alt={current.alt}/></dialog></div><div className="mira-artwork-facts"><span>ORIGINAL CONCEPT / {selected.toUpperCase()}</span><h2>{selected.replaceAll("-", " ")}</h2><p>{current.alt}</p><dl><div><dt>Medium</dt><dd>Digital ink and color study</dd></div><div><dt>Availability</dt><dd>Concept artwork · not for sale</dd></div><div><dt>Details</dt><dd>Fictional art direction created for the VAELTX portfolio.</dd></div></dl><Link className="mira-commission-link" href={`${base}/commission-request`}>Explore the commission form demo <span aria-hidden="true">↗</span></Link></div></div>;
  return <div className="mira-gallery">{pieces.map(([slug, item], i) => <article className={`mira-art-tile mira-art-tile-${i + 1}`} key={slug}><Link href={`${base}/work/${slug}`}><Image unoptimized width={960} height={1200} src={item.src} alt={item.alt} loading="lazy"/><span className="mira-art-tile-open" aria-hidden="true">↗</span></Link><div><span>0{i + 1} / STUDY</span><h3><Link href={`${base}/work/${slug}`}>{slug.replaceAll("-", " ")}</Link></h3><p>Original illustration concept · details are fictional.</p></div></article>)}</div>;
}

export function VaultHeroCards({ base }: { base: string }) {
  return <div className="vault-hero-cards"><div className="vault-hero-card vault-hero-card-back"><CardArt product={vaultProducts[1]} compact/></div><div className="vault-hero-card vault-hero-card-front"><CardArt product={vaultProducts[0]} compact/></div><span className="vault-hero-caption">ORIGINAL CONCEPT ART / 04 SAMPLE CARDS</span><Link href={`${base}/cards`} className="vault-hero-link">Browse the demo catalog <span aria-hidden="true">↗</span></Link></div>;
}

export function ProjectFAQ({ concept }: { concept: string }) {
  const base = conceptBase[concept];
  const questions = conceptRoutes[concept].find(item => item.path === "faq")?.sections ?? [];
  if (!questions.length) return null;
  return <div className={`project-faq project-faq-${concept}`}>{questions.map((item, i) => <details key={item.heading}><summary><span>0{i + 1}</span>{item.heading}<b aria-hidden="true">+</b></summary><p>{item.body}</p></details>)}<Link href={`${base}/contact`} className="text-link">Ask a question <span aria-hidden="true">→</span></Link></div>;
}
