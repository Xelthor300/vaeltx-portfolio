"use client";

import { useRef, useState, type FormEvent } from "react";

type Props = { kind: "inspection" | "commission" | "message"; initialZip?: string; initialNeed?: string; className?: string };

/** A plainly disclosed local UI specimen. Never makes a request or stores a brief. */
export function DemoForm({ kind, initialZip = "", initialNeed = "", className }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "previewing" | "complete">("idle");
  const [outcome, setOutcome] = useState("success");
  const [failed, setFailed] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const complete = useRef<HTMLDivElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "previewing") return;
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = {};
    if (!String(data.get("name") || "").trim()) next.name = "What should we call you?";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get("email") || ""))) next.email = "Enter an email address to preview this field.";
    if (String(data.get("story") || "").trim().length < 8) next.story = kind === "commission" ? "A sentence about the idea is enough." : "Describe what you are noticing in a sentence.";
    setErrors(next); setFailed(false);
    if (Object.keys(next).length) { requestAnimationFrame(() => summary.current?.focus()); return; }
    setState("previewing");
    await new Promise(resolve => setTimeout(resolve, 650));
    if (outcome === "failure") { setState("idle"); setFailed(true); return; }
    setState("complete"); requestAnimationFrame(() => complete.current?.focus());
  }
  function error(name: string) { return errors[name] ? <span id={`${kind}-${name}-error`} className="concept-field-error">{errors[name]}</span> : null; }
  if (state === "complete") return <div className={className}><div className="concept-form-confirmation" tabIndex={-1} ref={complete}><span className="concept-small-label">INTERACTION PREVIEW</span><h2>Demo complete.</h2><p>Nothing was sent. This concept demonstrates validation, loading and confirmation. Your entries remain only in this page’s memory and are discarded when you leave.</p><button type="button" onClick={() => setState("idle")}>Return to the demo form →</button></div></div>;
  return <form className={className} ref={form} noValidate onSubmit={submit}>
    <p className="concept-demo-note"><strong>Demo form.</strong> No business receives these entries. Use sample details; nothing is sent or stored.</p>
    {Object.keys(errors).length > 0 && <div className="concept-error-summary" ref={summary} tabIndex={-1} role="alert"><strong>A few details need attention.</strong><ul>{Object.entries(errors).map(([key, message]) => <li key={key}><a href={`#${kind}-${key}`}>{message}</a></li>)}</ul></div>}
    <fieldset disabled={state === "previewing"}>
      <div className="concept-form-row">
        <label htmlFor={`${kind}-name`}>Name <input id={`${kind}-name`} name="name" autoComplete="name" required aria-invalid={!!errors.name} aria-describedby={errors.name ? `${kind}-name-error` : undefined} />{error("name")}</label>
        <label htmlFor={`${kind}-email`}>Email <input id={`${kind}-email`} name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} aria-describedby={errors.email ? `${kind}-email-error` : undefined} />{error("email")}</label>
      </div>
      {kind === "inspection" && <>
        <div className="concept-form-row"><label htmlFor="inspection-phone">Phone <span>(optional)</span><input id="inspection-phone" name="phone" type="tel" autoComplete="tel" /></label><label htmlFor="inspection-zip">ZIP / postal code<input id="inspection-zip" name="zip" autoComplete="postal-code" defaultValue={initialZip} /></label></div>
        <label htmlFor="inspection-need">What do you need?<select id="inspection-need" name="need" defaultValue={initialNeed || "Not sure"}><option>Leak</option><option>Storm</option><option>Aging roof</option><option>Inspection</option><option>Not sure</option></select></label>
      </>}
      {kind === "commission" && <>
        <label htmlFor="commission-purpose">What is the piece for?<select id="commission-purpose" name="purpose"><option>A person or a gift</option><option>A place or an interior</option><option>A story or publication</option><option>Something else</option></select></label>
        <label htmlFor="commission-format">Desired format<select id="commission-format" name="format"><option>Open to a recommendation</option><option>Original on paper</option><option>Digital illustration</option><option>Edition or print concept</option></select></label>
      </>}
      <label htmlFor={`${kind}-story`}>{kind === "commission" ? "Tell us about the story" : kind === "inspection" ? "What are you noticing?" : "Your message"}<textarea id={`${kind}-story`} name="story" rows={5} required aria-invalid={!!errors.story} aria-describedby={errors.story ? `${kind}-story-error` : undefined} />{error("story")}</label>
      <label htmlFor={`${kind}-timing`}>Timing <span>(optional)</span><input id={`${kind}-timing`} name="timing" placeholder={kind === "inspection" ? "Urgent, soon or planning ahead" : "A date or a little context"} /></label>
      {kind === "inspection" && <label htmlFor="inspection-contact">Preferred contact method<select id="inspection-contact" name="contact"><option>Email</option><option>Phone</option></select></label>}
      <label htmlFor={`${kind}-outcome`} className="concept-preview-control">Preview result<select id={`${kind}-outcome`} value={outcome} onChange={event => setOutcome(event.target.value)}><option value="success">Confirmation</option><option value="failure">Failure / preserve answers</option></select></label>
    </fieldset>
    {failed && <div className="concept-error-summary" role="alert"><strong>Simulated failure. Your answers are still here.</strong><p>Choose Confirmation to continue, or retry this failure state. Nothing was sent.</p></div>}
    <button className="concept-form-submit" type="submit" disabled={state === "previewing"}>{state === "previewing" ? "Previewing…" : kind === "inspection" ? "Preview inspection request" : kind === "commission" ? "Preview commission request" : "Preview message"}<span aria-hidden="true">→</span></button>
    <p className="concept-form-status" role="status">{state === "previewing" ? "Previewing the form state. No request is being sent." : "Local demonstration only. No delivery, booking or purchase."}</p>
  </form>;
}
