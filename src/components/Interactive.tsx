"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { projects, services } from "@/lib/content";
import { contactNeeds } from "@/lib/contact-options";
import { Eyebrow } from "@/components/SiteShell";

export function ProjectTabs() {
  const [active, setActive] = useState(0);
  const project = projects[active];
  return <div className="project-aperture" aria-label="Explore concept projects">
    <div className="aperture-frame" data-project={project.slug} style={{ "--project-color": project.palette, "--project-signal": project.signal } as React.CSSProperties}>
      <div className="aperture-meta"><span>{String(active + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span><span>{project.sector}</span></div>
      <div className="aperture-media"><Image unoptimized width={1200} height={750} key={project.slug} src={`/images/preview-${project.slug}.webp`} alt={`${project.name} concept interface: ${project.objective}`} /></div>
      <div className="aperture-caption"><div><strong>{project.name}</strong><span className="aperture-disclosure">{project.status}</span></div><Link href={`/work/${project.slug}`} aria-label={`Open ${project.name} case study`}>↗</Link></div>
    </div>
    <div className="aperture-tabs" role="group" aria-label="Choose a project preview">{projects.map((item, index) => <button type="button" key={item.slug} aria-pressed={active === index} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)}><span>0{index + 1}</span>{item.sector}</button>)}</div>
  </div>;
}

export function ViewportRelay({ project = "Northstar Roofing" }: { project?: string }) {
  const [size, setSize] = useState<"1440" | "768" | "390">("1440");
  const widths = { "1440": "100%", "768": "74%", "390": "42%" };
  const specimens: Record<string, { title: string; compact: string; context: string; action: string }> = {
    "Northstar Roofing": { title: "Know what your roof needs before you commit.", compact: "A clearer next step.", context: "Service fit · inspection context · clear action", action: "Request an inspection" },
    "Mira Atelier": { title: "Illustration for stories worth remembering.", compact: "Stories, rendered with care.", context: "Original studies · artwork detail · commissions", action: "View the work" },
    "Axiom Strategy": { title: "Give a complex decision a clear structure.", compact: "A clear decision model.", context: "Evidence · criteria · options · decision", action: "Explore the scenarios" },
    "Vault TCG": { title: "Inspect the detail before you collect.", compact: "Collector detail, made clear.", context: "Set · condition · availability · demo cart", action: "Browse cards" },
  };
  const specimen = specimens[project] ?? specimens["Northstar Roofing"];
  const destinations: Record<string, string> = {
    "Northstar Roofing": "/concepts/northstar-roofing/request-an-inspection",
    "Mira Atelier": "/concepts/mira-atelier/work",
    "Axiom Strategy": "/concepts/axiom-strategy/case-studies",
    "Vault TCG": "/concepts/vault-tcg/cards",
  };
  return <div className="relay" aria-label={`Responsive specimen for ${project}`}>
    <div className="relay-toolbar"><span>ONE INTERFACE · THREE VIEWPORTS</span><div role="group" aria-label="Choose specimen viewport">{(["1440", "768", "390"] as const).map(width => <button type="button" key={width} aria-pressed={size === width} onClick={() => setSize(width)}>{width}</button>)}</div></div>
    <div className={`relay-stage relay-${size}`}><div className="relay-screen" style={{ width: widths[size] }}><div className="relay-screen-bar"><span>○</span><span>○</span><span>○</span><small>{project.toLowerCase().replaceAll(" ", "-")}.concept</small></div><div className="relay-screen-content"><span className="relay-label">{project.toUpperCase()} / SAMPLE PAGE</span><strong>{size === "390" ? specimen.compact : specimen.title}</strong><p>{specimen.context}</p><Link className="relay-action" href={destinations[project] ?? destinations["Northstar Roofing"]}>{specimen.action} <span aria-hidden="true">↗</span></Link><div className="relay-screen-rule"/><span className="relay-proof">Responsive hierarchy · persistent labels · useful states</span></div></div></div>
    <p className="relay-caption" aria-live="polite">Selected layout pattern: {size}px. This specimen is scaled to fit; it is not an actual viewport or a field performance measurement.</p>
  </div>;
}

export function ServiceMapper() {
  const [active, setActive] = useState(0);
  const options = [
    { problem: "The site feels dated.", focus: "Visual hierarchy + art direction", output: "A redesign with a clear, responsive visual system." },
    { problem: "People do not understand the offer.", focus: "Information architecture + content", output: "A page structure that answers the visitor’s next question." },
    { problem: "Mobile feels like an afterthought.", focus: "Responsive composition + states", output: "A mobile experience designed around its own reading order." },
    { problem: "Design and implementation drift apart.", focus: "Components + interaction rules", output: "A build-ready system with states developers can verify." },
  ];
  return <div className="problem-mapper"><div className="mapper-options" role="group" aria-label="Choose a website problem">{options.map((item, index) => <button type="button" key={item.problem} aria-pressed={active === index} onClick={() => setActive(index)}><span>0{index + 1}</span>{item.problem}<b aria-hidden="true">↗</b></button>)}</div><div className="mapper-answer" aria-live="polite"><Eyebrow>THE FOCUS</Eyebrow><h3>{options[active].focus}</h3><p>{options[active].output}</p><Link href="/services">Explore services →</Link></div></div>;
}

export function FAQList({ items }: { items: { q: string; a: string }[] }) {
  return <div className="faq-list">{items.map((item, i) => <details key={item.q} className="faq-item"><summary><span>{String(i + 1).padStart(2, "0")}</span>{item.q}<b aria-hidden="true">+</b></summary><div className="faq-answer"><p>{item.a}</p></div></details>)}</div>;
}

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const summary = useRef<HTMLDivElement>(null);
  const success = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const submission = useRef<{ key: string; fingerprint: string } | null>(null);

  function clearFieldError(field: string) {
    setErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function focusField(field: string) {
    const target = document.getElementById(`contact-${field}`);
    target?.focus();
    target?.scrollIntoView({ block: "center" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = {};
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const need = String(data.get("need") || "");
    const detail = String(data.get("detail") || "").trim();
    const site = String(data.get("site") || "").trim();
    const timing = String(data.get("timing") || "").trim();
    let validSite = true;
    if (site) { try { new URL(site); } catch { validSite = false; } }
    if (name.length < 2 || name.length > 100) next.name = "Enter your name so the reply can be addressed.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) next.email = "Enter an email address I can reply to.";
    if (!contactNeeds.some(option => option === need)) next.need = "Choose the kind of help you have in mind.";
    if (detail.length < 12 || detail.length > 4000) next.detail = "A sentence or two is enough — what needs to change?";
    if (site && (!validSite || site.length > 2048)) next.site = "Enter a complete website URL, including https://, or leave it blank.";
    if (timing.length > 240) next.timing = "Keep the timing context within 240 characters.";
    setErrors(next); setMessage("");
    if (Object.keys(next).length) { setStatus("idle"); requestAnimationFrame(() => summary.current?.focus()); return; }
    const payload = { name, email, need, detail, site, timing, website: String(data.get("website") || "") };
    const fingerprint = JSON.stringify(payload);
    if (submission.current?.fingerprint !== fingerprint) submission.current = { key: crypto.randomUUID(), fingerprint };
    sending.current = true;
    setStatus("sending");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": submission.current.key },
        body: fingerprint, signal: controller.signal,
      });
      const body = await response.json() as { ok?: boolean; message?: string; errors?: Record<string, string> };
      if (!response.ok || !body.ok) { setErrors(body.errors ?? {}); setMessage(body.message ?? "The message did not send. Your answers are still here."); setStatus("error"); requestAnimationFrame(() => summary.current?.focus()); return; }
      setStatus("success"); requestAnimationFrame(() => success.current?.focus());
    } catch {
      setMessage("Delivery could not be confirmed. Your answers are still here. You can retry safely."); setStatus("error"); requestAnimationFrame(() => summary.current?.focus());
    } finally {
      clearTimeout(timeout);
      sending.current = false;
    }
  }

  if (status === "success") return <div className="contact-success" role="status" tabIndex={-1} ref={success}><span className="success-mark" aria-hidden="true">✓</span><Eyebrow>MESSAGE DELIVERED</Eyebrow><h2>Brief received.</h2><p>Your project context was delivered to VAELTX. You can expect a direct reply if the project looks like a potential fit.</p><Link className="text-link" href="/work">Back to work <span aria-hidden="true">→</span></Link></div>;

  return <form className="contact-form" onSubmit={submit} aria-busy={status === "sending"} noValidate>
    {Object.keys(errors).length > 0 || status === "error" ? <div className="form-error-summary" role="alert" tabIndex={-1} ref={summary}><strong>{message || "A few details need attention."}</strong>{Object.entries(errors).length > 0 && <ul>{Object.entries(errors).map(([field, text]) => <li key={field}><a href={`#contact-${field}`} onClick={event => { event.preventDefault(); focusField(field); }}>{text}</a></li>)}</ul>}{status === "error" && <><p>Your answers are still here. Correct any field if needed, then retry, or contact VAELTX directly.</p><div className="form-contact-fallback"><a href="mailto:vaeltxn@gmail.com">vaeltxn@gmail.com</a><a href="https://wa.me/19153065249" target="_blank" rel="noopener noreferrer" aria-label="Message VAELTX on WhatsApp">Message VAELTX on WhatsApp <span aria-hidden="true">↗</span></a></div></>}</div> : null}
    <div className="form-row"><label htmlFor="contact-name">Name <span>Required</span><input id="contact-name" name="name" autoComplete="name" required maxLength={100} disabled={status === "sending"} aria-invalid={!!errors.name} aria-describedby={errors.name ? "contact-name-error" : undefined} onChange={() => clearFieldError("name")} />{errors.name && <small id="contact-name-error">{errors.name}</small>}</label><label htmlFor="contact-email">Email <span>Required</span><input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={status === "sending"} aria-invalid={!!errors.email} aria-describedby={errors.email ? "contact-email-error" : undefined} onChange={() => clearFieldError("email")} />{errors.email && <small id="contact-email-error">{errors.email}</small>}</label></div>
    <fieldset className="contact-need-group" aria-invalid={!!errors.need} aria-describedby={errors.need ? "contact-need-error" : undefined}>
      <legend>What kind of help are you looking for? <span>Required</span></legend>
      <div className="contact-need-options">{contactNeeds.map((option, index) => <label className="contact-need-option" key={option} htmlFor={index === 0 ? "contact-need" : `contact-need-${index}`}>
        <input type="radio" id={index === 0 ? "contact-need" : `contact-need-${index}`} name="need" value={option} required disabled={status === "sending"} aria-describedby={errors.need ? "contact-need-error" : undefined} onChange={() => clearFieldError("need")} />
        <span className="contact-need-mark" aria-hidden="true">✓</span><span className="contact-need-text">{option}</span>
      </label>)}</div>
      {errors.need && <small className="contact-field-error" id="contact-need-error">{errors.need}</small>}
    </fieldset>
    <label htmlFor="contact-detail">What needs to change? <span>Required</span><textarea id="contact-detail" name="detail" rows={5} required maxLength={4000} disabled={status === "sending"} aria-invalid={!!errors.detail} aria-describedby={errors.detail ? "contact-detail-error" : undefined} onChange={() => clearFieldError("detail")} placeholder="A sentence or two is enough — the current situation and what would be better." />{errors.detail && <small id="contact-detail-error">{errors.detail}</small>}</label>
    <div className="form-row"><label htmlFor="contact-site">Current site <span>Optional</span><input id="contact-site" name="site" type="url" inputMode="url" placeholder="https://" autoComplete="url" maxLength={2048} disabled={status === "sending"} aria-invalid={!!errors.site} aria-describedby={errors.site ? "contact-site-error" : undefined} onChange={() => clearFieldError("site")} />{errors.site && <small id="contact-site-error">{errors.site}</small>}</label><label htmlFor="contact-timing">Timing context <span>Optional</span><input id="contact-timing" name="timing" maxLength={240} disabled={status === "sending"} aria-invalid={!!errors.timing} aria-describedby={errors.timing ? "contact-timing-error" : undefined} onChange={() => clearFieldError("timing")} placeholder="A date or a little context" />{errors.timing && <small id="contact-timing-error">{errors.timing}</small>}</label></div>
    <div className="form-honeypot" aria-hidden="true"><label htmlFor="contact-website">Leave this field empty<input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <p className="form-privacy">Your details are used only to respond to this inquiry. No sales sequence is attached.</p>
    <button className="button button-primary form-submit" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send project brief"}<span aria-hidden="true">{status === "sending" ? "···" : "↗"}</span></button>
    <p className="form-live" aria-live="polite">{status === "sending" ? "Sending your brief." : ""}</p>
  </form>;
}

export function ServiceRows() {
  return <div className="service-rows">{services.map((service, i) => <article className="service-row" key={service.title}><span className="row-index">0{i + 1}</span><h3>{service.title}</h3><p>{service.text}</p><span className="service-output">{service.output}</span></article>)}</div>;
}
