"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const base = "/concepts/northstar-roofing";
const fit = [
  { label: "I can see a leak", type: "Something is wrong now", href: "services/roof-repair", title: "Start with the source, not a guess.", text: "A roof inspection helps distinguish localized damage from a wider problem. The next step is documenting what you can safely see." },
  { label: "A storm just passed", type: "Something is wrong now", href: "services/storm-damage", title: "A calm next step after a storm.", text: "Stay clear of damaged areas. The inspection path gathers context and demonstrates how findings could be documented." },
  { label: "My roof is getting older", type: "I am planning ahead", href: "services/roof-replacement", title: "Compare options before replacing.", text: "Condition, materials and repair history matter more than age alone. An inspection provides the basis for a written scope." },
  { label: "I am not sure yet", type: "I am planning ahead", href: "services/roof-inspection", title: "You do not need to diagnose it.", text: "Describe what you notice. A structured inspection is the starting point for understanding the roof and the available options." },
];

export function ServiceFit() {
  const [selected, setSelected] = useState(0);
  return <div className="north-fit"><div className="north-fit-options">{["Something is wrong now", "I am planning ahead"].map(group => <fieldset key={group}><legend>{group}</legend>{fit.map((item, index) => item.type === group && <label key={item.label}><input type="radio" name="roof-condition" checked={selected === index} onChange={() => setSelected(index)} />{item.label}<span aria-hidden="true">↗</span></label>)}</fieldset>)}</div><div className="north-fit-result" aria-live="polite"><span className="concept-small-label">YOUR NEXT STEP</span><h3>{fit[selected].title}</h3><p>{fit[selected].text}</p><Link href={`${base}/${fit[selected].href}`}>See the inspection path →</Link></div></div>;
}

export function QuoteStarter() {
  return <form className="north-quote-starter" action={`${base}/request-a-quote`} method="get"><span className="concept-small-label">START WITH THE BASICS</span><h2>What is happening?</h2><p>A little context helps choose the next step.</p><label htmlFor="starter-zip">ZIP / postal code<input id="starter-zip" name="zip" autoComplete="postal-code" placeholder="Your postal code" /></label><label htmlFor="starter-need">What do you need?<select id="starter-need" name="need"><option>Not sure</option><option>Leak</option><option>Storm</option><option>Aging roof</option><option>Inspection</option></select></label><button type="submit">Check service & request inspection <span aria-hidden="true">→</span></button><small>Concept journey. No appointment is booked.</small></form>;
}

export const areas = [{ slug: "north-district", name: "North district", note: "An illustrative suburban service zone." }, { slug: "central-district", name: "Central district", note: "An illustrative town-center service zone." }, { slug: "lakeside-district", name: "Lakeside district", note: "An illustrative outer service zone." }];

export function AreaSearch() {
  const [query, setQuery] = useState("");
  const matches = areas.filter(area => area.name.toLowerCase().includes(query.toLowerCase()));
  return <div className="north-area-grid"><div><span className="concept-small-label">ILLUSTRATIVE SERVICE REGION</span><h2>Close enough to start a conversation.</h2><p>This map demonstrates a service-area experience. These districts are fictional; no real coverage is offered.</p><label htmlFor="north-area-search">Find a concept district<input type="search" id="north-area-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try North or Lakeside" /></label><div aria-live="polite">{matches.length ? matches.map(area => <Link className="north-area-row" key={area.slug} href={`${base}/service-areas/${area.slug}`}><span>{area.name}<small>{area.note}</small></span><span aria-hidden="true">↗</span></Link>) : <p>No matching concept district. Try North, Central or Lakeside.</p>}</div></div><div className="north-map" role="img" aria-label="Illustrative service map with North, Central and Lakeside districts, not a real geographic coverage area"><div className="north-map-river"/><span className="north-map-north">01 / NORTH DISTRICT</span><span className="north-map-center">02 / CENTRAL DISTRICT</span><span className="north-map-lake">03 / LAKESIDE DISTRICT</span><small>SCHEMATIC / NOT A REAL SERVICE MAP</small></div></div>;
}

export function InspectionReport() {
  const [issue, setIssue] = useState(0);
  const points = [{ title: "Flashing junction", observation: "An example detail at the meeting of roof planes.", question: "Is the flashing sealed and draining as intended?" }, { title: "Shingle surface", observation: "An example close inspection of the roof covering.", question: "Is wear localized or distributed across the surface?" }, { title: "Water path", observation: "An example view of a potential drainage route.", question: "Where should water move, and is that path clear?" }];
  return <div className="north-report"><div className="north-report-photo"><Image unoptimized width={1200} height={900} src="/images/northstar-inspection.svg" alt="Original illustrative roof inspection report diagram"/><div className="north-report-markers">{points.map((point, index) => <button key={point.title} type="button" onClick={() => setIssue(index)} aria-label={`Inspect ${point.title}`} aria-pressed={issue === index}>{index + 1}</button>)}</div></div><div className="north-report-detail"><span className="concept-small-label">ILLUSTRATIVE INSPECTION REPORT INTERFACE</span><h3>{points[issue].title}</h3><dl><div><dt>Observation</dt><dd>{points[issue].observation}</dd></div><div><dt>Next question</dt><dd>{points[issue].question}</dd></div><div><dt>Status</dt><dd>Sample interface — no actual roof assessment</dd></div></dl></div></div>;
}

export function StickyQuoteBar() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => {
      const hero = document.querySelector("[data-north-hero]");
      const blocked = document.querySelector("[data-north-no-sticky]");
      const footer = document.querySelector("[data-north-footer]");
      setVisible(!blocked && !!hero && hero.getBoundingClientRect().bottom < 0 && (!footer || footer.getBoundingClientRect().top > window.innerHeight));
    };
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return visible ? <aside className="north-sticky-quote" aria-label="Inspection action"><Link href={`${base}/contact`}>Contact options</Link><Link href={`${base}/request-a-quote`}>Request inspection →</Link></aside> : null;
}
