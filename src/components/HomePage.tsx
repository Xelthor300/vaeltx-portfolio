import Link from "next/link";
import { PortfolioPreviewImage } from "@/components/PortfolioPreviewImage";
import { projects } from "@/lib/content";
import { ProjectTabs, ViewportRelay, ServiceMapper, FAQList } from "@/components/Interactive";
import { ContentSection, Eyebrow, SiteShell } from "@/components/SiteShell";

const faq = [
  { q: "Are these real client projects?", a: "No. ORYNT AI, ASTER & FORM, Northstar Roofing, Mira Atelier, Axiom Strategy and Vault TCG are independent concept projects by VAELTX. Each is labelled wherever it appears." },
  { q: "Do you design and develop?", a: "The portfolio demonstrates strategy, UX/UI and build-ready implementation. A real project scope is agreed around the problem and deliverables." },
  { q: "What if I do not know exactly what I need?", a: "That is enough to start. Share what feels unclear or difficult; the first useful step is to frame the decision, not choose a package." },
  { q: "Are performance results published?", a: "Only after measurement with the tool, profile, date and commit recorded. No scores are invented to make the studio look more credible." },
];

export function HomePage() {
  return <SiteShell mode="canvas"><main tabIndex={-1} id="main">
    <section className="home-hero"><div className="home-hero-copy"><Eyebrow>INDEPENDENT WEB &amp; CONVERSION STUDIO</Eyebrow><h1>Websites with structure, character and a clear next action.</h1><p>VAELTX connects strategy, UX/UI and build-ready systems for businesses that need clarity without looking generic.</p><div className="hero-actions"><Link className="button button-primary" href="/work">View selected work <span aria-hidden="true">↗</span></Link><Link className="button button-secondary" href="/contact">Start a project</Link></div><p className="hero-disclosure">Six independent concept projects demonstrate the work below. No fictional client claims.</p></div><ProjectTabs /></section>

    <section className="work-stage" id="work"><div className="section-shell"><div className="section-kicker"><Eyebrow number="01">SELECTED WORK</Eyebrow><span>SIX SYSTEMS / SIX DIFFERENT JOBS</span></div><div className="stage-heading"><h2>Distinct projects. Purposeful systems.</h2><Link className="text-link" href="/work">View all work <span aria-hidden="true">↗</span></Link></div>
      <div className="project-list">{projects.map((project, index) => <article className={`project-row project-row-${index + 1}`} key={project.slug} style={{ "--project-color": project.palette, "--project-signal": project.signal } as React.CSSProperties}>
        <Link className="project-image" href={`/work/${project.slug}`}><PortfolioPreviewImage slug={project.slug} width={1400} height={1000} alt={`${project.name} concept interface preview`} loading={index > 0 ? "lazy" : "eager"}/><span className="project-open" aria-hidden="true">↗</span></Link>
        <div className="project-copy"><Eyebrow number={`0${index + 1}`}>{project.sector}</Eyebrow><h3><Link href={`/work/${project.slug}`}>{project.name}</Link></h3><p>{project.objective}</p><span className="project-status">{project.status} <span aria-hidden="true">·</span> {project.scope}</span><Link className="text-link" href={`/work/${project.slug}`}>Open case study <span aria-hidden="true">→</span></Link></div>
      </article>)}</div>
      <p className="stage-disclosure">Self-directed concept work, created by VAELTX to demonstrate strategy, UX, visual design, interaction and implementation intent. Not commissioned client work.</p>
    </div></section>

    <section className="mapper-section"><div className="section-shell"><div className="section-kicker"><Eyebrow number="02">CAPABILITIES</Eyebrow><span>PROBLEM → FOCUS → OUTPUT</span></div><div className="mapper-heading"><h2>What is getting in the way?</h2><p>You do not need an agency vocabulary to explain a website problem.</p></div><ServiceMapper /></div></section>

    <section className="process-preview"><div className="section-shell"><div className="section-kicker"><Eyebrow number="03">PROCESS PREVIEW</Eyebrow><span>FIVE DECISION GATES</span></div><div className="process-preview-heading"><h2>A clear path from brief to browser.</h2><Link className="text-link" href="/process">See the full process <span aria-hidden="true">↗</span></Link></div><ol className="process-rail">{[
      ["Frame", "What must the site make obvious?"], ["Structure", "What should people see first?"], ["Design", "How should it feel and work?"], ["Build", "Does the browser preserve the intent?"], ["Verify", "Does it hold up under real use?"]
    ].map(([name, question], i) => <li key={name}><span>0{i + 1}</span><h3>{name}</h3><p>{question}</p></li>)}</ol></div></section>

    <section className="proof-section"><div className="section-shell"><div className="section-kicker"><Eyebrow number="04">THE LAB / EVIDENCE</Eyebrow><span>OBSERVABLE QUALITY, NOT ADJECTIVES</span></div><div className="proof-intro"><h2>Quality you can inspect.</h2><p>Standards are defined before claims. Measurements stay out of the site until a real test has recorded them.</p></div><div className="proof-grid">
      <article><span>01 / RESPONSIVE</span><h3>Responsive by design.</h3><p>Layout, order, controls and cropping adapt to the task.</p><b>1440 · 768 · 390</b></article>
      <article><span>02 / STATES</span><h3>Every useful state.</h3><p>Default, focus, empty, error and success states are part of the work.</p><b>VISIBLE AND KEYBOARD-READY</b></article>
      <article><span>03 / ACCESSIBILITY</span><h3>Access is part of design.</h3><p>Keyboard operation, visible focus and reduced motion are considered together.</p><b>AA-ORIENTED CHECKLIST</b></article>
      <article><span>04 / PERFORMANCE</span><h3>Measured in production.</h3><p>VAELTX Home · Lighthouse 13.5.0 · desktop and mobile · 2026-10-02 UTC · dcacfd3.</p><b>100 DESKTOP · 99 MOBILE</b></article>
    </div><Link className="text-link" href="/standards">Inspect the standards <span aria-hidden="true">↗</span></Link></div></section>

    <ContentSection number="05" label="DESIGN / BUILD CONTINUITY" title="Designed for the browser." className="continuity-section"><div className="continuity-copy"><p>Responsive behavior, focus states, error handling and component rules belong in the design — not in a last-minute interpretation.</p><Link className="text-link" href="/standards">See how the work is checked <span aria-hidden="true">→</span></Link></div><ViewportRelay /></ContentSection>

    <section className="faq-preview"><div className="section-shell faq-grid"><div><Eyebrow number="06">BEFORE WE START</Eyebrow><h2>Before we start.</h2><p>Clear scope and honest proof reduce more risk than a big promise.</p><Link className="text-link" href="/contact">Ask about a project <span aria-hidden="true">↗</span></Link><div className="studio-note"><h3>Small enough to stay direct. Structured enough to stay rigorous.</h3><p>VAELTX is built around focused web projects, clear decisions and transparent handoff. The work shown here is self-directed concept work until real client case studies replace or join it.</p><Link className="text-link" href="/about">How the studio works <span aria-hidden="true">↗</span></Link></div></div><FAQList items={faq}/></div></section>
  </main></SiteShell>;
}
