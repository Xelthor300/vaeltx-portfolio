import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { projects, processSteps } from "@/lib/content";
import { CaseStudyPage } from "@/components/CaseStudyPage";
import { ContactForm, FAQList, ServiceRows } from "@/components/Interactive";
import { ContentSection, Eyebrow, PageIntro, SiteShell } from "@/components/SiteShell";

const processFaq = [
  { q: "How are revision rounds handled?", a: "Review rounds and decision boundaries are agreed in each scope. VAELTX does not promise unlimited revisions." },
  { q: "Can scope change?", a: "Yes. If the problem or deliverables change, the impact on scope and timing is discussed before additional work begins." },
  { q: "Who owns the domain and hosting?", a: "The preferred arrangement is agreed before delivery. Clients should own their domain and provider account where appropriate." },
  { q: "Is post-launch support included?", a: "Support is a separate scope unless it is explicitly included in the engagement." },
];

function WorkIndex() {
  return <SiteShell mode="canvas"><main tabIndex={-1} id="main"><PageIntro eyebrow="SELECTED WORK / 04 INDEPENDENT CONCEPTS" title="Four industries. Four different interface systems." description="Each concept is designed from its own audience, business model and conversion path — not a VAELTX template with different colors." />
    <section className="work-index section-shell">{projects.map((p, i) => <article key={p.slug} className={`work-index-row work-index-row-${i + 1}`} style={{ "--project-color": p.palette, "--project-signal": p.signal } as React.CSSProperties}><Link className="work-index-media" href={`/work/${p.slug}`}><Image unoptimized width={1400} height={1000} src={`/images/preview-${p.slug}.webp`} alt={`${p.name} concept website interface`} loading="lazy"/><span>OPEN PROJECT ↗</span></Link><div><Eyebrow number={`0${i + 1}`}>{p.sector}</Eyebrow><h2><Link href={`/work/${p.slug}`}>{p.name}</Link></h2><p>{p.objective}</p><dl><div><dt>Scope</dt><dd>{p.scope}</dd></div><div><dt>Status</dt><dd>Independent Concept Project</dd></div></dl><Link className="text-link" href={`/work/${p.slug}`}>Open case study <span aria-hidden="true">→</span></Link></div></article>)}
      <p className="work-index-disclosure">These are self-directed concepts by VAELTX. They demonstrate work and reasoning, not commissioned client engagements or business outcomes.</p></section>
  </main></SiteShell>;
}

function ServicesPage() {
  return <SiteShell><main tabIndex={-1} id="main"><PageIntro eyebrow="SERVICES / WHAT NEEDS TO CHANGE?" title="Start with the problem, not a package." description="Focused landing pages, complete websites, redesigns, UX/UI systems and implementation support — scoped around the problem, not a bloated package." />
    <ContentSection number="01" label="PROBLEM TO SERVICE" title="What is getting in the way?"><div className="services-mapper-summary"><p>Weak visual hierarchy, unclear offers, mobile friction and design/build drift point to different work. The first step is to identify the issue you can see.</p><Link className="button button-primary" href="/contact">Describe the problem <span aria-hidden="true">↗</span></Link></div></ContentSection>
    <ContentSection number="02" label="SERVICE FAMILIES" title="Work can stay focused without losing rigor."><ServiceRows /></ContentSection>
    <ContentSection number="03" label="WHAT A SCOPE INCLUDES" title="Decisions become deliverables."><div className="deliverable-grid"><article><span>01 / STRUCTURE</span><h3>Page map</h3><p>Route, page goal, hierarchy, content and conversion path.</p></article><article><span>02 / INTERFACE</span><h3>Key views</h3><p>Visual system, responsive composition and interaction states.</p></article><article><span>03 / HANDOFF</span><h3>Build rules</h3><p>Components, behavior, accessibility notes and QA criteria.</p></article></div></ContentSection>
    <ContentSection number="04" label="ENGAGEMENT SHAPES" title="Choose the size after the problem is clear."><div className="engagement-rows">{[["Focused", "One high-value page or concentrated redesign."], ["Site", "A multi-page marketing website with a connected path."], ["System", "Reusable interface patterns and responsive rules."], ["Support", "Scoped assistance for an agency or internal team."]].map(([name, text], i) => <article key={name}><span>0{i + 1}</span><h3>{name}</h3><p>{text}</p><small>Scope and deliverables agreed per engagement. No public pricing yet.</small></article>)}</div></ContentSection>
    <ContentSection number="05" label="SCOPE BOUNDARIES" title="Clarity includes what is outside the work."><div className="editorial-columns"><p>Deliverables, exclusions and revision rounds are agreed before work starts. Scope changes may change the price or timeline and are discussed before additional work.</p><p>VAELTX delivers the files and code covered by the agreed scope. Third-party licenses transfer only when their terms allow it. Domain ownership, hosting access and post-launch support are agreed separately.</p></div><Link className="button button-primary" href="/contact">Describe the problem <span aria-hidden="true">↗</span></Link></ContentSection>
  </main></SiteShell>;
}

function ProcessPage() {
  return <SiteShell mode="lab"><main tabIndex={-1} id="main"><PageIntro eyebrow="PROCESS / FIVE DECISION GATES" title="A project should remove uncertainty as it moves." description="Each gate closes a specific kind of uncertainty before the next layer gets expensive." mode="lab" />
    <ContentSection number="01" label="FIVE GATES" title="The work advances when the decision is clear."><div className="process-gates">{processSteps.map((step, i) => <article key={step.name}><span className="gate-index">0{i + 1}</span><h3>{step.name}</h3><div><strong>{step.question}</strong><p>{step.output}</p></div><span className="gate-status">DECISION / OUTPUT</span></article>)}</div></ContentSection>
    <ContentSection number="02" label="FEEDBACK MODEL" title="Feedback should connect to the goal."><div className="editorial-columns"><p>Comments are tied to the page goal and user task. Major scope or interaction changes are recorded so the delivery boundary stays visible.</p><p>Consolidated review rounds and their timing are agreed in the project scope. There is no promise of unlimited revisions.</p></div></ContentSection>
    <ContentSection number="03" label="OWNERSHIP / HANDOFF" title="A handoff should not create dependency."><div className="ownership-list">{[["Final files", "The agreed scope defines which source files and deliverables are supplied."], ["Domain and hosting", "The client preferably owns the domain and provider account; technical access is agreed where needed."], ["Third-party assets", "Licenses are governed by their own terms and are not promised as transferable."], ["Post-launch support", "Support is separate unless the scope explicitly includes it."]].map(([heading, text], i) => <article key={heading}><span>0{i + 1}</span><h3>{heading}</h3><p>{text}</p></article>)}</div></ContentSection>
    <ContentSection number="04" label="QUESTIONS" title="What to expect."><FAQList items={processFaq}/></ContentSection>
  </main></SiteShell>;
}

function StandardsPage() {
  const rows = [
    ["Responsive", "1440 / 1280 / 1200 / 1024 / 820 / 768 / 720 / 430 / 390 / 375 / 360", "Production route sweep; horizontal overflow and response status", "80 paths × 11 widths · 0 overflow · 0 unexpected statuses"],
    ["Accessibility", "Keyboard, semantics, labels, focus, reduced motion, reflow", "axe-core WCAG 2.0/2.1 A/AA and 2.2 AA tags; selected keyboard and dialog flows", "80 paths · 0 automated findings · not a conformance certification"],
    ["Performance", "Image loading, fonts, JavaScript, route bundles, motion", "Lighthouse 13.5.0 on production homepage and four concept home routes; one immediate Northstar mobile repeat", "Desktop 100; mobile 89–100 · Northstar repeat 98 · LCP 0.5s desktop / 1.8–2.1s mobile · CLS 0"],
    ["Interaction states", "Default, focus, loading, empty, error and success where applicable", "Production smoke for navigation, contact error recovery, project interactions and Vault commerce demo", "Passed · inquiry delivery remains unconfigured and reports 503"],
    ["Content resilience", "Direct routes, titles, headings, canonicals, images and internal links", "Route and internal-link crawl against the production origin", "79 content pages · 79 internal destinations · 0 failures or broken images"],
    ["Indexability", "Canonical, robots, sitemap and preview noindex", "Production and protected Preview metadata inspection", "Intentionally noindex; sitemap empty until inquiry delivery is configured and indexing is enabled"],
  ];
  return <SiteShell mode="lab"><main tabIndex={-1} id="main"><PageIntro eyebrow="STANDARDS / EVIDENCE" title="Quality should leave evidence." description="These standards describe how VAELTX checks responsive behavior, accessibility, performance and interface states. Results are published only when they are actually measured." mode="lab" />
    <ContentSection number="01" label="THE PROTOCOL" title="Target · method · evidence · limitation"><div className="standards-table" role="table" aria-label="Quality standards and current evidence"><div className="standards-head" role="row"><span role="columnheader">AREA</span><span role="columnheader">TARGET</span><span role="columnheader">METHOD</span><span role="columnheader">CURRENT EVIDENCE</span></div>{rows.map(([area, target, method, state]) => <div className="standards-row" role="row" key={area}><span role="cell">{area}</span><span role="cell">{target}</span><span role="cell">{method}</span><span role="cell" className="evidence-state">{state}</span></div>)}</div></ContentSection>
    <ContentSection number="02" label="ACCESSIBILITY" title="Designed and tested against a practical checklist."><p className="standards-lead">The implementation targets WCAG 2.2 AA-oriented practices where applicable. This is not a claim of complete conformance or a substitute for a qualified audit.</p><div className="standards-points">{["Semantic structure and logical headings", "Keyboard operation and visible focus", "Accessible dialogs and return focus", "Persistent labels and useful form errors", "200% zoom and reflow", "Reduced motion and no hover-only meaning", "Contrast and minimum touch targets"].map((item, i) => <p key={item}><span>0{i + 1}</span>{item}</p>)}</div></ContentSection>
    <ContentSection number="03" label="WHAT VAELTX DOES NOT CLAIM" title="The interface can improve clarity; it cannot guarantee the business outcome."><div className="non-claims">{["No guaranteed rankings", "No guaranteed conversion lift", "No guaranteed revenue", "No permanent perfect score", "No fictional client results"].map(item => <span key={item}>{item}</span>)}</div></ContentSection>
    <div className="standards-cta section-shell"><Link className="button button-primary" href="/work">See the work <span aria-hidden="true">↗</span></Link><Link className="text-link" href="/contact">Start a project <span aria-hidden="true">→</span></Link></div>
  </main></SiteShell>;
}

function AboutPage() {
  return <SiteShell><main tabIndex={-1} id="main"><PageIntro eyebrow="ABOUT / INDEPENDENT STUDIO" title="Independent by structure. Exact by choice." description="VAELTX connects strategy, interface decisions and implementation intent from the first page map through verification." />
    <ContentSection number="01" label="OPERATING MODEL" title="A focused studio with visible boundaries."><div className="editorial-columns"><p>VAELTX is an independent web and conversion studio. The work centers on clear scopes, direct communication and design decisions that survive implementation.</p><p>The portfolio uses original, self-directed concepts to show the thinking. They are not commissioned projects and do not contain fabricated client history.</p></div></ContentSection>
    <ContentSection number="02" label="PRINCIPLES" title="How the work stays useful."><div className="principles-list">{[["Clarity over volume", "Fewer, stronger messages. A page should answer the question that brought someone there."], ["Systems over isolated screens", "Responsive behavior, states and reusable patterns are part of the interface."], ["Evidence over inflated claims", "Measure what can be measured; label what is conceptual."], ["Character without friction", "Distinct design should not make ordinary tasks harder."]].map(([title, text], i) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></ContentSection>
    <ContentSection number="03" label="CONCEPT DISCLOSURE" title="The work is self-directed until real evidence says otherwise."><p className="disclosure-large">The launch portfolio uses independent concept projects rather than fictional client case studies. They are intentionally detailed so the work can be evaluated on craft, UX and implementation thinking.</p><Link className="text-link" href="/work">Explore the concepts <span aria-hidden="true">↗</span></Link></ContentSection>
  </main></SiteShell>;
}

function ContactPage() {
  return <SiteShell><main tabIndex={-1} id="main"><section className="contact-page"><div className="contact-intro"><Eyebrow>START A PROJECT / DIRECT INQUIRY</Eyebrow><h1>What needs to change?</h1><p>A short brief is enough. Share the current situation, the outcome you need and any practical constraints.</p><div className="contact-context"><span>NO SALES SEQUENCE</span><p>Your details are used only to respond to this inquiry.</p><a href="mailto:vaeltxn@gmail.com">vaeltxn@gmail.com <span aria-hidden="true">↗</span></a></div><Link className="text-link" href="/work">Review the work first <span aria-hidden="true">→</span></Link></div><div className="contact-form-wrap"><ContactForm /></div></section></main></SiteShell>;
}

function PrivacyPage() {
  return <SiteShell><main tabIndex={-1} id="main"><PageIntro eyebrow="PRIVACY / PLAIN LANGUAGE" title="Your brief should have a clear purpose." description="This page describes the portfolio’s inquiry flow without claiming a processor or retention setup that has not been configured." />
    <ContentSection number="01" label="FORM DATA" title="What the contact form asks for."><div className="editorial-columns"><p>Name, email, the type of help requested and a short project description are required. A current site and timing context are optional.</p><p>The server validates submitted fields and does not write them to a database. When no email delivery endpoint is configured, it refuses the submission and retains the answers only in the visitor’s current form session.</p></div></ContentSection>
    <ContentSection number="02" label="PURPOSE / DELIVERY" title="The brief is used to respond to the inquiry."><p>When a real delivery provider is configured, the brief is forwarded to the VAELTX email address for a direct response. The delivery provider, its retention terms and the owner’s retention practice must be documented before the production form is enabled.</p></ContentSection>
    <ContentSection number="03" label="CONTACT" title="Questions about this policy."><p>Email <a className="inline-link" href="mailto:vaeltxn@gmail.com">vaeltxn@gmail.com</a>. No physical address, public phone number or social account is published.</p></ContentSection>
  </main></SiteShell>;
}

export async function ParentPage({ path }: { path: string }) {
  if (path === "work") return <WorkIndex />;
  if (path.startsWith("work/")) return <CaseStudyPage slug={path.slice("work/".length)} />;
  if (path === "services") return <ServicesPage />;
  if (path === "process") return <ProcessPage />;
  if (path === "standards") return <StandardsPage />;
  if (path === "about") return <AboutPage />;
  if (path === "contact") return <ContactPage />;
  if (path === "privacy") return <PrivacyPage />;
  notFound();
}

export function getParentMetadata(path: string) {
  const project = path.startsWith("work/") ? projects.find(item => item.slug === path.slice(5)) : undefined;
  if (project) return { title: `${project.name} — Independent Concept Case Study`, description: project.caseSummary };
  const labels: Record<string, { title: string; description: string }> = {
    work: { title: "Selected Work", description: "Four independent concept projects, each built around a different audience and interface system." },
    services: { title: "Services", description: "Web strategy, UX/UI, responsive systems and scoped implementation support." },
    process: { title: "Process", description: "Five decision gates that make scope, design, build and verification clearer." },
    standards: { title: "Standards", description: "Responsive, accessibility and performance standards with clear evidence status." },
    about: { title: "About", description: "An independent web and conversion studio built around clear decisions and transparent handoff." },
    contact: { title: "Contact", description: "Share what needs to change and start a direct project conversation with VAELTX." },
    privacy: { title: "Privacy", description: "How the VAELTX portfolio handles inquiry form information." },
  };
  return labels[path];
}
