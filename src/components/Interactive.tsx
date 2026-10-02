"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { projects, services } from "@/lib/content";
import { Eyebrow } from "@/components/SiteShell";

export function ProjectTabs() {
  const [active, setActive] = useState(0);
  const project = projects[active];
  return <div className="project-aperture" aria-label="Explore concept projects">
    <div className="aperture-frame" data-project={project.slug} style={{ "--project-color": project.palette, "--project-signal": project.signal } as React.CSSProperties}>
      <Image unoptimized width={1400} height={1000} key={project.slug} src={`/images/preview-${project.slug}.webp`} alt={`${project.name} concept interface: ${project.objective}`} />
      <div className="aperture-meta"><span>{String(active + 1).padStart(2, "0")} / 04</span><span>{project.sector}</span></div>
      <strong>{project.name}</strong><span className="aperture-disclosure">{project.status}</span>
      <Link href={`/work/${project.slug}`} aria-label={`Open ${project.name} case study`}>↗</Link>
    </div>
    <div className="aperture-tabs" role="group" aria-label="Choose a project preview">{projects.map((item, index) => <button type="button" key={item.slug} aria-pressed={active === index} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)}><span>0{index + 1}</span>{item.sector}</button>)}</div>
  </div>;
}

export function ViewportRelay({ project = "Northstar Roofing" }: { project?: string }) {
  const [size, setSize] = useState<"1440" | "768" | "390">("1440");
  const widths = { "1440": "100%", "768": "74%", "390": "42%" };
  return <div className="relay" aria-label={`Responsive specimen for ${project}`}>
    <div className="relay-toolbar"><span>ONE INTERFACE · THREE VIEWPORTS</span><div role="group" aria-label="Choose specimen viewport">{(["1440", "768", "390"] as const).map(width => <button type="button" key={width} aria-pressed={size === width} onClick={() => setSize(width)}>{width}</button>)}</div></div>
    <div className={`relay-stage relay-${size}`}><div className="relay-screen" style={{ width: widths[size] }}><div className="relay-screen-bar"><span>○</span><span>○</span><span>○</span><small>{project.toLowerCase().replaceAll(" ", "-")}.concept</small></div><div className="relay-screen-content"><span className="relay-label">{project.toUpperCase()} / SAMPLE PAGE</span><strong>{size === "390" ? "A clearer next step." : "Know what your roof needs before you commit."}</strong><p>Service fit · inspection context · clear action</p><b>Request an inspection ↗</b><div className="relay-screen-rule"/><span className="relay-proof">Responsive hierarchy · persistent labels · useful states</span></div></div></div>
    <p className="relay-caption" aria-live="polite">The same content reflows at {size}px. This specimen shows layout behavior; it is not a field performance measurement.</p>
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
  const idempotencyKey = useRef(crypto.randomUUID());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = {};
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const need = String(data.get("need") || "");
    const detail = String(data.get("detail") || "").trim();
    if (name.length < 2) next.name = "Enter your name so the reply can be addressed.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter an email address I can reply to.";
    if (!need) next.need = "Choose the kind of help you have in mind.";
    if (detail.length < 12) next.detail = "A sentence or two is enough — what needs to change?";
    setErrors(next); setMessage("");
    if (Object.keys(next).length) { setStatus("idle"); requestAnimationFrame(() => summary.current?.focus()); return; }
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({ name, email, need, detail, site: data.get("site"), timing: data.get("timing"), website: data.get("website") }),
      });
      const body = await response.json() as { ok?: boolean; message?: string; errors?: Record<string, string> };
      if (!response.ok || !body.ok) { setErrors(body.errors ?? {}); setMessage(body.message ?? "The message did not send. Your answers are still here."); setStatus("error"); requestAnimationFrame(() => summary.current?.focus()); return; }
      setStatus("success"); requestAnimationFrame(() => success.current?.focus());
    } catch {
      setMessage("The message did not send. Your answers are still here."); setStatus("error"); requestAnimationFrame(() => summary.current?.focus());
    }
  }

  if (status === "success") return <div className="contact-success" role="status" tabIndex={-1} ref={success}><span className="success-mark" aria-hidden="true">✓</span><Eyebrow>MESSAGE DELIVERED</Eyebrow><h2>Brief received.</h2><p>Your project context was delivered to <a href="mailto:vaeltxn@gmail.com">vaeltxn@gmail.com</a>. The next step is a direct reply with useful questions or a suggested way forward.</p><Link className="text-link" href="/work">Back to work <span aria-hidden="true">→</span></Link></div>;

  return <form className="contact-form" onSubmit={submit} noValidate>
    {Object.keys(errors).length > 0 || status === "error" ? <div className="form-error-summary" role="alert" tabIndex={-1} ref={summary}><strong>{message || "A few details need attention."}</strong>{Object.entries(errors).length > 0 && <ul>{Object.entries(errors).map(([field, text]) => <li key={field}><a href={`#contact-${field}`}>{text}</a></li>)}</ul>}{status === "error" && <p>Nothing was cleared. Correct any field if needed, then retry, or email <a href="mailto:vaeltxn@gmail.com">vaeltxn@gmail.com</a>.</p>}</div> : null}
    <div className="form-row"><label htmlFor="contact-name">Name <span>Required</span><input id="contact-name" name="name" autoComplete="name" required aria-invalid={!!errors.name} aria-describedby={errors.name ? "contact-name-error" : undefined} />{errors.name && <small id="contact-name-error">{errors.name}</small>}</label><label htmlFor="contact-email">Email <span>Required</span><input id="contact-email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} aria-describedby={errors.email ? "contact-email-error" : undefined} />{errors.email && <small id="contact-email-error">{errors.email}</small>}</label></div>
    <label htmlFor="contact-need">What kind of help are you looking for? <span>Required</span><select id="contact-need" name="need" defaultValue="" aria-invalid={!!errors.need} aria-describedby={errors.need ? "contact-need-error" : undefined}><option value="" disabled>Select one</option><option>New website</option><option>Redesign</option><option>Landing page</option><option>UX/UI system</option><option>Ecommerce</option><option>Implementation support</option><option>Not sure yet</option></select>{errors.need && <small id="contact-need-error">{errors.need}</small>}</label>
    <label htmlFor="contact-detail">What needs to change? <span>Required</span><textarea id="contact-detail" name="detail" rows={5} required aria-invalid={!!errors.detail} aria-describedby={errors.detail ? "contact-detail-error" : undefined} placeholder="A sentence or two is enough — the current situation and what would be better." />{errors.detail && <small id="contact-detail-error">{errors.detail}</small>}</label>
    <div className="form-row"><label htmlFor="contact-site">Current site <span>Optional</span><input id="contact-site" name="site" type="url" inputMode="url" placeholder="https://" autoComplete="url" /></label><label htmlFor="contact-timing">Timing context <span>Optional</span><input id="contact-timing" name="timing" placeholder="A date or a little context" /></label></div>
    <div className="form-honeypot" aria-hidden="true"><label htmlFor="contact-website">Leave this field empty<input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <p className="form-privacy">Your details are used only to respond to this inquiry. No sales sequence is attached.</p>
    <button className="button button-primary form-submit" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send project brief"}<span aria-hidden="true">{status === "sending" ? "···" : "↗"}</span></button>
    <p className="form-live" aria-live="polite">{status === "sending" ? "Sending your brief." : ""}</p>
  </form>;
}

export function ServiceRows() {
  return <div className="service-rows">{services.map((service, i) => <article className="service-row" key={service.title}><span className="row-index">0{i + 1}</span><h3>{service.title}</h3><p>{service.text}</p><span className="service-output">{service.output}</span></article>)}</div>;
}
