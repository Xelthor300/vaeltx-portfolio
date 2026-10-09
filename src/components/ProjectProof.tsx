import Image from "next/image";
import Link from "next/link";
import { projectProof, proofReviewed } from "@/lib/project-proof";
import { Eyebrow } from "@/components/SiteShell";

export function ProjectProof({ slug }: { slug: string }) {
  const proof = projectProof[slug];
  if (!proof) return null;
  return <section className="project-proof" aria-labelledby={`${slug}-proof`}>
    <div className="section-shell">
      <div className="proof-heading"><Eyebrow>WORKING INTERFACE / OBSERVABLE PROOF</Eyebrow><span>PUBLIC UI REVIEW · {proofReviewed}</span></div>
      <h2 id={`${slug}-proof`}>See it. Then try it.</h2>
      <p className="proof-intro">{proof.pitch}</p>
      <div className="proof-gallery">{proof.captures.map((shot, i) => <figure key={shot.image} className={shot.mobile ? "proof-mobile" : "proof-desktop"}>
        <a href={shot.image} target="_blank" rel="noreferrer" aria-label={`Open full capture: ${shot.label}`}>
          <Image src={shot.image} width={shot.width} height={shot.height} alt={shot.alt} loading="lazy" sizes={shot.mobile ? "(max-width: 767px) 280px, 250px" : "(max-width: 767px) 100vw, 900px"}/>
        </a>
        <figcaption><span>0{i + 1} / {shot.mobile ? "MOBILE" : "DESKTOP"} · {shot.viewport}</span><strong>{shot.label}</strong><Link href={shot.source}>Inspect this interface <span aria-hidden="true">↗</span></Link></figcaption>
      </figure>)}</div>
      <p className="proof-capture-note">Authentic public-interface captures, including synthetic states. Open an image to inspect it at full size. Screenshots are not editable Figma files.</p>
      <div className="proof-paths">{proof.paths.map((path, i) => <article key={path.label}><span>TRY 0{i + 1}</span><h3><Link href={path.href}>{path.label} <span aria-hidden="true">↗</span></Link></h3><p>{path.instruction}</p></article>)}</div>
      <div className="proof-scope"><div><h3>Designed and developed by VAELTX.</h3><p>{proof.responsibility}</p><p>{proof.responsive}</p><ul aria-label="Verified technologies">{proof.technologies.map(tech => <li key={tech}>{tech}</li>)}</ul></div><aside><h3>Independent Concept Project.</h3><p>{proof.boundary}</p><small>Public UI observations demonstrate the stated paths; they are not client results, a full accessibility certification or a production-backend audit.</small></aside></div>
    </div>
  </section>;
}
