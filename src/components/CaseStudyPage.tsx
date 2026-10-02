import Link from "next/link";
import Image from "next/image";
import { projectBySlug, projects } from "@/lib/content";
import { ContentSection, Eyebrow, SiteShell } from "@/components/SiteShell";
import { ViewportRelay } from "@/components/Interactive";

const performanceSnapshots: Record<string, { desktop: number; mobile: number; mobileLcp: string; repeat?: { score: number; mobileLcp: string } }> = {
  "northstar-roofing": { desktop: 100, mobile: 89, mobileLcp: "2.1", repeat: { score: 98, mobileLcp: "2.0" } },
  "mira-atelier": { desktop: 100, mobile: 99, mobileLcp: "2.0" },
  "axiom-strategy": { desktop: 100, mobile: 100, mobileLcp: "1.9" },
  "vault-tcg": { desktop: 100, mobile: 99, mobileLcp: "2.0" },
};

export function CaseStudyPage({ slug }: { slug: string }) {
  const project = projectBySlug[slug];
  if (!project) return null;
  const index = projects.findIndex(item => item.slug === slug);
  const next = projects[(index + 1) % projects.length];
  const performance = performanceSnapshots[slug];
  const mode = "canvas";
  return <SiteShell mode={mode} className={`case-study case-${slug}`}><main id="main">
    <section className="case-hero" style={{ "--project-color": project.palette, "--project-signal": project.signal } as React.CSSProperties}>
      <div className="case-hero-top"><Eyebrow>INDEPENDENT CONCEPT / {project.name.toUpperCase()}</Eyebrow><span>VAELTX / CASE STUDY 0{index + 1}</span></div>
      <div className="case-hero-title"><h1>{project.caseTitle}</h1><p>{project.caseSummary}</p></div>
      <div className="case-meta"><div><span>SECTOR</span><b>{project.sector}</b></div><div><span>SCOPE</span><b>{project.scope}</b></div><div><span>STATUS</span><b>{project.status}</b></div></div>
      <div className="case-hero-image"><Image unoptimized width={1400} height={1000} src={`/images/preview-${project.slug}.webp`} alt={`${project.name} concept website interface preview`}/><span>01 / PROJECT APERTURE · CONCEPT INTERFACE PREVIEW</span></div>
      <p className="case-disclosure">Independent concept by VAELTX. Created to demonstrate strategy, UX, visual design, responsive behavior and implementation intent. Not commissioned client work.</p>
    </section>

    <div className="case-evidence-grid">
    <ContentSection number="01" label="EXECUTIVE BRIEF" title="The task to solve." className="case-brief"><div className="case-brief-grid"><div><span className="case-subhead">THE AUDIENCE</span><p>{project.audience}</p></div><div><span className="case-subhead">THE DESIGN RESPONSE</span><p>{project.objective}</p></div></div></ContentSection>

    <ContentSection number="02" label="AUDIENCE / TASK" title="From arrival to action." className="case-task"><div className="task-sequence">{["Arrive", "Orient", "Inspect", "Decide", "Act"].map((task, i) => <div key={task}><span>0{i + 1}</span><h3>{task}</h3><p>{["What is this system for?", "Does it fit my situation?", "What evidence can I examine?", "What remains uncertain?", "What can I do next?"][i]}</p></div>)}</div></ContentSection>

    <section className="case-architecture"><div className="section-shell"><div className="section-kicker"><Eyebrow number="03">EXPERIENCE ARCHITECTURE</Eyebrow><span>INTENT → ROUTE → NEXT STEP</span></div><h2>Architecture around the decision.</h2><ol>{project.architecture.map((step, i) => <li key={step}><span>0{i + 1}</span><p>{step}</p><b aria-hidden="true">{i < project.architecture.length - 1 ? "↓" : "↗"}</b></li>)}</ol></div></section>

    <ContentSection number="04" label="CONVERSION PATH" title="Question → answer → action." className="case-conversion"><div className="conversion-frames">{["The question", "The interface answer", "The next action"].map((label, i) => <article key={label}><span>0{i + 1} / {label.toUpperCase()}</span><strong>{[project.audience, project.interaction, "A transparent next step with its limits visible."][i]}</strong><div className="conversion-connector" aria-hidden="true">{i < 2 ? "→" : "✓"}</div></article>)}</div></ContentSection>

    <section className="case-visual-system"><div className="section-shell"><div className="section-kicker"><Eyebrow number="05">VISUAL DIRECTION</Eyebrow><span>THE SYSTEM IN USE</span></div><h2>A distinct visual system.</h2><div className="visual-system-grid"><div className="visual-swatch" style={{ background: project.palette }}><span>PRIMARY FIELD</span><b>{project.palette}</b></div><div className="visual-swatch visual-swatch-signal" style={{ background: project.signal }}><span>SELECTED SIGNAL</span><b>{project.signal}</b></div><div className="visual-rules"><span className="case-subhead">COMPOSITION / TYPE / IMAGE</span><p>{project.system}</p><p>Project color, density, typography and image behavior stay specific to this concept; the VAELTX parent shell does not overwrite their visual language.</p></div></div></div></section>

    <ContentSection number="06" label="SIGNATURE INTERACTION" title="Decision, interaction, trade-off." className="case-interaction"><div className="interaction-proof"><span className="case-subhead">THE DECISION</span><p>{project.decision}</p><span className="case-subhead">WHY</span><p>{project.interaction}</p><span className="case-subhead">TRADE-OFF</span><p>{project.tradeoff}</p></div><div className="interaction-specimen"><span className="specimen-label">INTERFACE SPECIMEN / DEFAULT → FOCUS → CONFIRMATION</span><div className="specimen-screen"><div className="specimen-screen-head"><span>{project.name.toUpperCase()}</span><span>CONCEPT / INTERACTION</span></div><strong>{project.objective}</strong><button type="button" aria-label="Sample action shown as a non-submitting interface specimen">Inspect this path <span aria-hidden="true">↗</span></button><small>No external action is performed by this specimen.</small></div></div></ContentSection>

    <ContentSection number="07" label="RESPONSIVE PROOF" title="Responsive by intent." className="case-responsive"><p className="responsive-explanation">{project.responsive}</p><ViewportRelay project={project.name}/></ContentSection>

    <ContentSection number="08" label="COMPONENT STATES" title="States beyond the default." className="case-states"><div className="state-strip">{["DEFAULT", "FOCUS", "LOADING", "ERROR", "SUCCESS"].map((state, i) => <div key={state} data-state={state.toLowerCase()}><span>0{i + 1}</span><b>{state}</b><p>{["Ready for input", "Visible keyboard location", "Action is underway", "Answers remain available", "Outcome is stated plainly"][i]}</p></div>)}</div></ContentSection>

    <ContentSection number="09" label="TECHNICAL / ACCESSIBILITY PROOF" title="Technical evidence." className="case-tech"><div className="tech-record"><div><span>RESPONSIVE QA</span><b>80 production paths · 0 overflow</b><small>Eleven widths from 360px to 1440px; 880 route-width checks, including the custom 404.</small></div><div><span>ACCESSIBILITY</span><b>0 Axe findings · 80 paths</b><small>WCAG A/AA-oriented automated checks plus keyboard and dialog focus tests. This is not a conformance certification.</small></div><div><span>PERFORMANCE / {project.route.toUpperCase()}</span><b>{performance.desktop} desktop · {performance.mobile} mobile</b><small>Lighthouse 13.5.0 production snapshot · LCP 0.5s desktop / {performance.mobileLcp}s mobile{performance.repeat ? ` · immediate repeat ${performance.repeat.score} mobile / ${performance.repeat.mobileLcp}s LCP` : ""} · CLS 0 · 2026-10-01.</small></div></div></ContentSection>

    <section className="case-conclusion"><div className="section-shell"><Eyebrow number="10">WHAT THIS CONCEPT DEMONSTRATES</Eyebrow><h2>{project.objective}</h2><p>{project.tradeoff}</p><div className="case-conclusion-actions"><Link className="button button-primary" href={project.route}>Explore the concept <span aria-hidden="true">↗</span></Link><Link className="button button-secondary" href="/contact">Start a project</Link></div></div></section>

    </div>
    <section className="next-project"><Link href={`/work/${next.slug}`} className="next-project-link" style={{ "--project-color": next.palette } as React.CSSProperties}><span><Eyebrow>0{(index + 1) % projects.length + 1} / NEXT PROJECT · {next.sector.toUpperCase()}</Eyebrow><strong>{next.name}</strong><span className="next-project-title">{next.caseTitle}</span><span className="next-arrow" aria-hidden="true">↗</span></span><Image unoptimized width={230} height={150} src={`/images/preview-${next.slug}.webp`} alt="" loading="lazy"/></Link></section>
  </main></SiteShell>;
}
