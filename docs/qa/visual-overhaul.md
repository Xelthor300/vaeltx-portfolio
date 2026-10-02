# VAELTX visual overhaul — verified handoff

Production: https://vaeltx-portfolio.vercel.app

Tested application commit: `bfd3d9ef072f489e5771569ee44f4bc7bbb58d86` on `main` and `codex/astra-visual-overhaul`.
Production deployment tested: `dpl_84v9ophHWdJ7bTcdVMWM8gW4V46E`.
Evidence collected on 2026-10-02 UTC. A later documentation-only handoff commit does not change this tested application source.

## Visual changes

- Loaded Instrument Sans locally and reduced studio headline, section and supporting type scales. Rebalanced headline measures, gutters, grids and opening screens at desktop, tablet and mobile sizes.
- Rebuilt the home and work presentation around four actual concept-interface previews. Reduced repeated dark poster sections, oversized media and redundant visual framing.
- Paired case-study evidence into compact reading layouts. Preserved brief, audience, architecture, conversion, visual direction, interaction, responsive, states and technical evidence.
- Refined Northstar's inspection/service interface, Mira's curated art and commission paths, Axiom's decision diagrams and Vault's collector catalog/product UI. Each retains its own visual language.
- Integrated original Canva-generated concept artwork with explicit disclosures, responsive optimized images and bounded crops. Asset provenance is in [visual-assets.md](../visual-assets.md).
- Preserved route architecture, form behavior, concept boundaries, search/filter/cart state, keyboard overlays, reduced motion and metadata/noindex rules. Fixed keyboard entry focus and sampled touch-target sizes.

At 1440 px, home height changed from 9,201 to 5,638 px (39% shorter); Work from 3,587 to 2,460 px (31%); case studies from about 8,224 to about 4,000 px (51%). These are measured document heights, not conversion results. Full measurements: [page comparison](visual-page-comparison.json).

## Actual browser screenshots

Baseline: main `da798aa`. After: production application `bfd3d9e`. These are browser captures, not mockups.

- [Home before/after — desktop](images/comparison-home-desktop.webp)
- [Home before/after — mobile](images/comparison-home-mobile.webp)
- Parent: [desktop](images/parent-desktop-overview.webp), [mobile](images/parent-mobile-overview.webp)
- All four case studies: [desktop](images/cases-desktop-overview.webp), [mobile](images/cases-mobile-overview.webp)
- All four concept homes: [desktop](images/concepts-desktop-overview.webp), [mobile](images/concepts-mobile-overview.webp)
- Representative service/form/gallery/catalog/product routes: [desktop](images/deep-desktop-overview.webp), [mobile](images/deep-mobile-overview.webp)

The local evidence gallery at `output/playwright/visual-rescue/index.html` contains 22 representative routes, before/after full-page and viewport captures for desktop 1440 × 900 and mobile 390 × 844 (176 images). Another 56 screenshots cover eight representative pages at 1440, 1280, 1024, 768, 430, 390 and 360 px. Full-page exports stay out of the production bundle and Git; compact representative evidence is versioned here.

## QA

| Check | Verified result |
| --- | --- |
| TypeScript / ESLint / unit tests / production build | Passed; all 3 existing unit tests passed |
| GitHub CI | Main run 36953515700 passed for tested application commit |
| Route audit | 79 content routes + custom 404; zero unexpected status, image, heading, canonical or noindex failures |
| Internal links | 79 pages / 79 unique destinations; zero failures |
| Responsive reflow | 880 checks: 80 routes × 11 widths, 360–1440 px; zero horizontal overflow |
| Automated accessibility | 80 desktop routes + 10 representative mobile routes; zero Axe WCAG A/AA findings |
| Mobile keyboard / focus / reduced motion / form states | 13 checks passed; no sampled visible buttons below 44 × 44 px |
| Representative interactions | 14 checks passed across navigation, Northstar, Mira, Axiom and Vault |
| Aperture / search / filters / wishlist | 10 checks passed, including empty state and persisted saved card |
| Vault products | All 4 products returned 200; condition selection and add-to-cart acknowledgement passed |
| Contact recovery | Expected 503; truthful error announced, visitor input preserved, direct email available |
| Production assets / runtime | No unexpected missing assets or uncaught browser errors in tested flows |
| Robots / sitemap / HTTPS | HTTPS live; intentional noindex/disallow and empty sitemap preserved |

Detailed machine-readable evidence: [audits](visual-final-audits.json), [route inventory](visual-route-inventory.json).

## Final Lighthouse measurements

Production application commit `bfd3d9e`, Lighthouse 13.5.0. Mobile is a simulated lab profile, not field data.

| Page | Desktop performance | Mobile performance | Mobile LCP | Mobile TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| vaeltx-home | 100 | 98 | 2.13 s | 100.5 ms | 0 |
| northstar | 100 | 98 | 2.24 s | 36.0 ms | 0 |
| mira | 100 | 98 | 2.31 s | 99.0 ms | 0 |
| axiom | 100 | 98 | 2.15 s | 94.0 ms | 0 |
| vault | 100 | 96 | 2.65 s | 98.0 ms | 0 |

Accessibility and best practices scored 100 in all 10 final runs. SEO scored 66–69 because search indexing remains intentionally disabled; this is not represented as production search readiness.

[Final measurements](visual-final-performance.json) retain timestamp, profile, source commit and all scores. [Earlier initial and repeat measurements](visual-performance-snapshots.json) remain separately recorded for application commit `dcacfd3`; they show lab variation and are not substituted for the final measurements. Published technical cards remain explicitly dated historical snapshots.

## Remaining boundaries

- Email delivery is deliberately unconfigured for this visual mission. Contact responds honestly with 503 and preserves input; configure delivery separately after owner visual approval. This is not a claim that the complete end-to-end portfolio mission is finished.
- Search indexing is intentionally disabled as requested. Concept stores, requests and checkout remain demonstrative; no real order, appointment, inventory or payment is created.
- Zero automated accessibility findings are not a certification. Native screen-reader and actual OS/browser zoom conformance were not independently certified.
- Canva assets are browser display-size exports, not full source-resolution downloads. Current presentations use optimized crops; no client property, physical original artwork or real card inventory is claimed.
- Design quality was reviewed from actual desktop/mobile screenshots; no commercial conversion outcomes or owner approval are inferred.

Visual implementation and its QA are complete. No owner action is required to view this published visual revision.
