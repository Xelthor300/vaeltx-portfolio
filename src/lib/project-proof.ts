export type ProofCapture = {
  image: string; width: number; height: number; label: string; alt: string;
  source: string; viewport: string; mobile?: boolean;
};
export type ProjectProof = {
  name: string; matches: string[]; pitch: string; responsibility: string;
  technologies: string[]; boundary: string; responsive: string;
  paths: { label: string; href: string; instruction: string }[];
  captures: ProofCapture[];
};

const concept = (slug: string, path = "") => `/concepts/${slug}${path}`;
const capture = (name: string, label: string, alt: string, source: string, mobile = false, height?: number): ProofCapture => ({
  image: `/images/proof/${name}.webp`, width: mobile ? 375 : 1425,
  height: height ?? (mobile ? 812 : 891), label, alt, source,
  viewport: mobile ? "390 × 844" : "1440 × 900", mobile,
});

export const proofReviewed = "2026-10-09";
export const projectProof: Record<string, ProjectProof> = {
  "orynt-ai": {
    name: "ORYNT AI", matches: ["SaaS dashboards", "React", "Next.js", "TypeScript", "analytics", "product UX/UI"],
    pitch: "A working SaaS frontend concept: inspect synthetic project metrics, filter a searchable workspace and build reports from the same dataset.",
    responsibility: "VAELTX designed and developed the product website, responsive workspace, reusable UI and deterministic reporting logic.",
    technologies: ["Next.js App Router", "React", "TypeScript", "CSS", "CSV generation", "Vercel"],
    boundary: "Independent concept. Fictional teams and frozen synthetic observations; no live generative AI, paying customers, authentication or subscription billing.",
    responsive: "A mobile navigation drawer, stacked controls and contained table scrolling preserve the same report choices.",
    paths: [
      { label: "Search and filter projects", href: "https://vaeltx-orynt-ai-concept.vercel.app/app/projects", instruction: "Choose Operations: four projects remain. Try an unmatched search, then clear the filters." },
      { label: "Inspect a project", href: "https://vaeltx-orynt-ai-concept.vercel.app/app/projects/P001", instruction: "Inspect the sample project's delivery, milestones and explainable attention signals." },
      { label: "Build a report", href: "https://vaeltx-orynt-ai-concept.vercel.app/app/reports", instruction: "Change the period and grouping. Compare the chart with its exact data table and CSV export." },
    ],
    captures: [
      capture("orynt-projects-desktop", "A useful filter, not a decorative control.", "ORYNT searchable Projects workspace with twenty synthetic results", "https://vaeltx-orynt-ai-concept.vercel.app/app/projects"),
      capture("orynt-reports-mobile", "Report controls on a real mobile viewport.", "ORYNT mobile report builder with period, team, metric and grouping controls", "https://vaeltx-orynt-ai-concept.vercel.app/app/reports", true),
      { image: "/images/orynt-reports-desktop.webp", width: 1425, height: 891, label: "The chart and the underlying rows.", alt: "ORYNT 30-day report grouped by team with the exact data table", source: "https://vaeltx-orynt-ai-concept.vercel.app/app/reports", viewport: "1440 × 900" },
    ],
  },
  "aster-form": {
    name: "ASTER & FORM", matches: ["premium websites", "editorial identity", "service design", "booking UI", "responsive design"],
    pitch: "An editorial studio website with a safe, interactive reservation walkthrough and synthetic client and studio views. Full-stack certification is pending.",
    responsibility: "VAELTX designed and developed the conceptual website and interface. This evidence covers only the public website and safe preview.",
    technologies: ["Next.js", "React", "Responsive CSS", "Vercel"],
    boundary: "Independent concept. Full-stack certification pending. No production authentication, private bookings or backend behavior is certified; technical development remains paused.",
    responsive: "The same service choices and explicit simulated confirmation adapt to a narrow, single-column reading order.",
    paths: [
      { label: "Try the safe reservation preview", href: "https://asterandform.vercel.app/preview", instruction: "Choose a consultation and sample time, then simulate confirmation. No appointment is created." },
      { label: "Explore the client and studio concepts", href: "https://asterandform.vercel.app/preview", instruction: "Switch preview tabs. All records and counts are fictional, with no account access or database writes." },
    ],
    captures: [
      capture("aster-confirmation-desktop", "The boundary is part of the confirmation.", "ASTER simulated confirmation explicitly stating that no appointment, email or client record was created", "https://asterandform.vercel.app/preview"),
      capture("aster-confirmation-mobile", "The same honest outcome on mobile.", "ASTER mobile synthetic reservation confirmation with a start-again action", "https://asterandform.vercel.app/preview", true),
      { image: "/images/aster-client-desktop.webp", width: 1425, height: 891, label: "A client portal concept, clearly synthetic.", alt: "ASTER public preview of a fictional client portal", source: "https://asterandform.vercel.app/preview", viewport: "1440 × 900" },
    ],
  },
  "northstar-roofing": {
    name: "Northstar Roofing", matches: ["service-business websites", "local services", "landing pages", "lead enquiry", "website redesign"],
    pitch: "A responsive service-business website concept with situation-led navigation, inspection context and a local-only enquiry form that demonstrates useful recovery states.",
    responsibility: "VAELTX created the service architecture, visual system, responsive pages, situation selector and local form interactions.",
    technologies: ["Next.js App Router", "React", "TypeScript", "CSS", "Vercel"],
    boundary: "Independent concept. Fictional business, service areas and illustrative imagery; no roofing service, real inspection or enquiry delivery. Form entries remain in page memory only.",
    responsive: "Service information becomes a single reading column; the mobile menu and form retain visible labels and clear next steps.",
    paths: [
      { label: "Compare service situations", href: concept("northstar-roofing", "/services"), instruction: "Choose a leak or storm situation and inspect the different next-step explanation." },
      { label: "Try enquiry states", href: concept("northstar-roofing", "/request-an-inspection"), instruction: "Use sample details. Preview a failure to see answers preserved, or choose Confirmation. Nothing is sent." },
      { label: "Inspect the report interface", href: concept("northstar-roofing"), instruction: "Select an inspection marker to change the illustrative observation and next question." },
    ],
    captures: [
      capture("northstar-home-desktop", "Service context before the enquiry.", "Northstar desktop homepage with homeowner-oriented service messaging and enquiry starter", concept("northstar-roofing")),
      capture("northstar-services-mobile", "Readable service information on mobile.", "Northstar mobile service index with responsive typography and situation-based copy", concept("northstar-roofing", "/services"), true),
      capture("northstar-request-error-desktop", "A recoverable, explicitly simulated failure.", "Northstar demo request form showing simulated failure with sample answers preserved", concept("northstar-roofing", "/request-an-inspection")),
    ],
  },
  "mira-atelier": {
    name: "Mira Atelier", matches: ["artist portfolios", "galleries", "creative brands", "editorial websites", "commission UX"],
    pitch: "An artist-portfolio concept with an original fictional gallery, artwork details, a keyboard-operable image viewer and a separate local-only commission journey.",
    responsibility: "VAELTX created the editorial direction, gallery architecture, artwork presentation, responsive layouts and commission-form interface.",
    technologies: ["Next.js App Router", "React", "TypeScript", "Native HTML dialog", "CSS", "Vercel"],
    boundary: "Independent concept. Fictional atelier and artwork details; no real artist commissions, sale inventory or submission delivery. Screenshots are UI evidence, not commissioned illustration credentials.",
    responsive: "The artwork collection stacks vertically; commission controls keep their labels in a single-column layout.",
    paths: [
      { label: "Browse the gallery", href: concept("mira-atelier", "/work"), instruction: "Open an artwork to inspect its composition, concept notes and commission entry point." },
      { label: "Use the artwork viewer", href: concept("mira-atelier", "/work/midnight-garden"), instruction: "Open the viewer with Enter, zoom the image and close with Escape. Focus returns to its trigger." },
      { label: "Explore the commission form", href: concept("mira-atelier", "/commission-request"), instruction: "Inspect purpose, format and story fields. Sample submissions preview states locally; nothing is sent." },
    ],
    captures: [
      capture("mira-gallery-desktop", "A gallery with a path into each work.", "Mira desktop gallery with three original fictional artwork studies and individual detail links", concept("mira-atelier", "/work"), false, 1883),
      capture("mira-commission-mobile", "A separate commission journey.", "Mira mobile commission request with visible labels and a local-demo disclosure", concept("mira-atelier", "/commission-request"), true),
      capture("mira-viewer-desktop", "A focused, keyboard-operable viewer.", "Mira artwork dialog with image, zoom and close controls", concept("mira-atelier", "/work/midnight-garden")),
    ],
  },
  "axiom-strategy": {
    name: "Axiom Strategy", matches: ["B2B websites", "consulting websites", "information architecture", "editorial design", "service pages"],
    pitch: "A B2B advisory website concept that makes a complex offer legible through service pages, editorial hierarchy and an interactive six-stage decision framework.",
    responsibility: "VAELTX designed and developed the service architecture, editorial visual system, capability pages and interactive decision diagram.",
    technologies: ["Next.js App Router", "React", "TypeScript", "CSS", "Vercel"],
    boundary: "Independent concept. No consultants, client engagements, market figures or measured advisory outcomes. The framework explains questions; it does not make a real business recommendation.",
    responsive: "Long B2B headings wrap within a narrow reading column, while framework controls retain their sequence and selected state.",
    paths: [
      { label: "Inspect decision architecture", href: concept("axiom-strategy", "/services/decision-architecture"), instruction: "Activate Evidence or Trade-offs to change the explanation; the selected stage is exposed to assistive technology." },
      { label: "Read a service page", href: concept("axiom-strategy", "/services/growth-strategy"), instruction: "Inspect the framing, method and explicit limits around the service concept." },
      { label: "Explore an illustrative scenario", href: concept("axiom-strategy", "/case-studies/decision-field"), instruction: "Follow the framework into a clearly labelled hypothetical scenario, without invented results." },
    ],
    captures: [
      capture("axiom-framework-desktop", "An explanation that follows the selected stage.", "Axiom decision architecture with the Evidence stage selected in its interactive framework", concept("axiom-strategy", "/services/decision-architecture")),
      capture("axiom-service-mobile", "A complex offer in a simple reading order.", "Axiom mobile decision architecture service page with editorial hierarchy", concept("axiom-strategy", "/services/decision-architecture"), true),
      { image: "/images/preview-axiom-strategy.webp", width: 1425, height: 891, label: "A coherent B2B first impression.", alt: "Authentic Axiom homepage preview with service-led editorial hierarchy", source: concept("axiom-strategy"), viewport: "1440 × 900" },
    ],
  },
  "vault-tcg": {
    name: "Vault TCG", matches: ["ecommerce frontend", "product discovery", "search and filters", "cart UX", "responsive storefronts"],
    pitch: "A conceptual storefront with query-based search, set and condition filters, product details and a browser-local cart. No inventory, prices or payments are connected.",
    responsibility: "VAELTX designed and developed catalog discovery, fictional product presentation, responsive controls and local cart/checkout states.",
    technologies: ["Next.js App Router", "React", "TypeScript", "Browser local storage", "CSS", "Vercel"],
    boundary: "Independent concept. Original fictional cards, no sales or payment processing, no real stock or order creation. This is custom frontend evidence, not proof of Shopify delivery.",
    responsive: "A narrow cart stacks product information and quantity controls; catalog filters move into a mobile dialog.",
    paths: [
      { label: "Search and filter the catalog", href: concept("vault-tcg", "/search"), instruction: "Search a card name. Combine set and condition filters on the catalog to reveal a useful empty state." },
      { label: "Choose a product condition", href: concept("vault-tcg", "/cards/ember-keeper"), instruction: "Choose a condition and add a demo item. Different conditions remain separate cart lines." },
      { label: "Review the local cart", href: concept("vault-tcg", "/cart"), instruction: "Change a line's quantity or remove it, then inspect the non-payment checkout. No purchase is made." },
    ],
    captures: [
      capture("vault-catalog-desktop", "Comparison starts in the catalog.", "Vault desktop catalog with set and condition filters and four fictional cards", concept("vault-tcg", "/cards")),
      capture("vault-cart-mobile", "A browser-local cart on mobile.", "Vault mobile cart showing fictional card conditions and quantity controls", concept("vault-tcg", "/cart"), true),
      capture("vault-empty-desktop", "An honest result when no card matches.", "Vault catalog with Ember Archive and Light play filters producing an explicit no-match state", concept("vault-tcg", "/cards")),
    ],
  },
};
