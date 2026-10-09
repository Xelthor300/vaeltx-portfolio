import { projectProof } from "../src/lib/project-proof";

// Evidence selection only. This does not qualify a job, draft or send a proposal.
const brief = process.argv.slice(2).join(" ").toLowerCase();
const patterns: Record<string, RegExp[]> = {
  "orynt-ai": [/saas|dashboard|analytics|analítica/, /react|next\.?js|typescript|frontend/, /product design|ux\/ui/],
  "aster-form": [/premium|luxury|editorial/, /booking|reservation|reservas|consultation/],
  "northstar-roofing": [/service.business|local business|roofing|negocio.*servicio/, /landing|enquiry|lead|inspection/],
  "mira-atelier": [/artist|gallery|galería|creative brand|artwork/, /commission|comisión/],
  "axiom-strategy": [/b2b|consulting|consultoría|advisory/, /information architecture|service page/],
  "vault-tcg": [/ecommerce|e-commerce|storefront|commerce|tienda/, /cart|product discovery|catalog|filter|shopify/],
};
if (!brief) throw new Error('Pass a buyer brief: node --import tsx scripts/select-project-proof.ts "SaaS React dashboard"');
const ranked = Object.entries(projectProof).map(([slug, proof]) => ({
  slug, score: patterns[slug].reduce((sum, pattern, i) => sum + (pattern.test(brief) ? (i === 0 ? 4 : 1) : 0), 0), proof,
})).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
console.log(JSON.stringify({
  purpose: "Select relevant concept evidence; ranking reflects keywords, not buyer interest or probability.",
  recommendations: ranked.map(({ slug, proof }) => ({
    project: proof.name, description: proof.pitch,
    caseStudy: `https://vaeltx-portfolio.vercel.app/work/${slug}`,
    demonstrations: proof.paths, evidence: proof.captures.map(shot => ({
      label: shot.label, url: `https://vaeltx-portfolio.vercel.app${shot.image}`, source: shot.source,
    })), limits: proof.boundary,
  })),
  requirements: "Read the entire job; verify mandatory skills, scope, remote eligibility, schedule, duplicates and funding. Concept evidence is not paid-client history or platform certification.",
}, null, 2));
