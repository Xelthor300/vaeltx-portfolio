"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { Campaign, Currency, applicationSchema, countdown, currencies, entryPrice, entryQuantities, money, services } from "@/lib/website-grant";

async function post(path: string, body: unknown) {
  const response = await fetch(`/api/website-grant/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ...await response.json(), status: response.status };
}
export function GrantCountdown({ end, serverNow, open }: { end: string | null; serverNow: number; open: boolean }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => { const start = performance.now(); const interval = setInterval(() => setNow(serverNow + performance.now() - start), 1000); return () => clearInterval(interval); }, [serverNow]);
  if (!end || !open) return <div className="wg-deadline"><span>CAMPAIGN STATUS</span><strong>Applications are not open yet</strong><p>The closing date will appear here when the campaign opens.</p></div>;
  if (Date.parse(end) <= now) return <div className="wg-deadline"><strong>Applications are now closed</strong></div>;
  const parts = countdown(end, now);
  return <div className="wg-deadline"><span>APPLICATIONS CLOSE IN</span><div className="wg-timer" aria-label={`${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes remaining`}>{Object.entries(parts).map(([unit, value]) => <div key={unit}><strong>{String(value).padStart(2, "0")}</strong><span>{unit}</span></div>)}</div><p>Closes {new Date(end).toLocaleString("en-US", { timeZone: "UTC" })} UTC</p></div>;
}
type Turnstile = { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
export function VerifyAccount({ siteKey }: { siteKey: string | null }) {
  const router = useRouter(), captchaEl = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false), [captcha, setCaptcha] = useState(""), [email, setEmail] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email"), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    const api = (window as unknown as { turnstile?: Turnstile }).turnstile;
    if (!loaded || !siteKey || !captchaEl.current || !api || stage !== "email") return;
    const id = api.render(captchaEl.current, { sitekey: siteKey, theme: "dark", size: "flexible", callback: (token: string) => setCaptcha(token), "expired-callback": () => setCaptcha(""), "error-callback": () => setCaptcha("") });
    return () => api.remove(id);
  }, [loaded, siteKey, stage]);
  return <section className="wg-panel wg-form-panel"><p className="wg-kicker">01 / VERIFY YOUR ACCOUNT</p><h2>Your email is your entry account.</h2><p>Each verified account can claim one free entry per campaign. Signing in again keeps the same entry.</p>
    {!siteKey && <p className="wg-notice">Account verification is being prepared.</p>}
    {siteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setLoaded(true)} />}
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(e.currentTarget); try {
      const result = await post("auth", stage === "email" ? { email, captchaToken: captcha } : { email, token: String(form.get("token")) });
      setMessage(result.message); if (result.ok) { if (stage === "email") setStage("code"); else router.refresh(); }
    } catch { setMessage("Verification could not be confirmed. Please retry."); } finally { setBusy(false); } }}>
      <label htmlFor="wg-email">Email address</label><input id="wg-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} readOnly={stage === "code"} />
      {stage === "email" ? <div ref={captchaEl} className="wg-captcha" /> : <><label htmlFor="wg-token">Email verification code</label><input id="wg-token" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required minLength={6} maxLength={10} /><button type="button" className="wg-text-button" onClick={() => { setStage("email"); setCaptcha(""); }}>Request another code</button></>}
      <button className="wg-button" disabled={busy || !siteKey || stage === "email" && !captcha}>{busy ? "Please wait…" : stage === "email" ? "Send verification code" : "Verify my email"}</button>
      <p className="wg-feedback" role="status">{message}</p>
    </form>
  </section>;
}

export function GrantApplication({ campaign, email, sandboxEntries }: { campaign: Campaign; email: string; sandboxEntries: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [quantity, setQuantity] = useState(0), [currency, setCurrency] = useState<Currency>("USD");
  const textFields = [["full_name", "Full name"], ["business_name", "Business name"], ["city", "City"], ["website", "Business website (optional)"], ["social_url", "Business social URL (optional)"]] as const;
  function feedback(name: string) { return errors[name] ? <span id={`wg-${name}-error`} className="wg-field-error">{errors[name]?.join(" ")}</span> : null; }
  return <section className="wg-panel wg-form-panel"><p className="wg-kicker">02 / YOUR BUSINESS</p><h2>Give your business a new beginning.</h2><p>Verified account: {email}</p>
    <form onSubmit={async e => {
      e.preventDefault(); setMessage(""); setErrors({}); const form = new FormData(e.currentTarget);
      const values = { full_name: form.get("full_name"), business_name: form.get("business_name"), city: form.get("city"), country: form.get("country"), website: form.get("website"), social_url: form.get("social_url"), business_description: form.get("business_description"), website_goal: form.get("website_goal"), has_current_website: form.get("has_current_website") === "yes", age_confirmed: form.has("age_confirmed"), rules_accepted: form.has("rules_accepted"), contact_consent: form.has("contact_consent") };
      const parsed = applicationSchema.safeParse(values); if (!parsed.success) { setErrors(parsed.error.flatten().fieldErrors); setMessage("Check the application fields."); return; }
      setBusy(true);
      try {
        const result = await post("application", parsed.data); setMessage(result.message); if (!result.ok) { setErrors(result.errors || {}); return; }
        if (quantity > 0 && sandboxEntries) { const checkout = await post("checkout", { kind: "entries", code: `entries-${quantity}`, quantity, currency, requestId: crypto.randomUUID() }); if (checkout.ok) { window.location.assign(checkout.url); return; } setMessage(`Your free entry is confirmed. ${checkout.message} View My entries to continue.`); return; }
        router.push("/website-grant/entry"); router.refresh();
      } catch { setMessage("Your application could not be confirmed. Your answers are still here; retry safely."); } finally { setBusy(false); }
    }}>
      <div className="wg-form-grid">{textFields.map(([name, label]) => <div key={name}><label htmlFor={`wg-${name}`}>{label}{!["website", "social_url"].includes(name) && " *"}</label><input id={`wg-${name}`} name={name} type={["website", "social_url"].includes(name) ? "url" : "text"} required={!["website", "social_url"].includes(name)} maxLength={["website", "social_url"].includes(name) ? 500 : 160} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `wg-${name}-error` : undefined} />{feedback(name)}</div>)}
      <div><label htmlFor="wg-country">Country *</label><select id="wg-country" name="country" required><option value="">Select your country</option>{campaign.eligible_countries.map(c => <option key={c} value={c}>{new Intl.DisplayNames(["en"], { type: "region" }).of(c) || c}</option>)}</select>{feedback("country")}</div></div>
      {[["business_description", "What does your business do?"], ["website_goal", "What would you like your new website to accomplish?"]].map(([name, label]) => <div key={name}><label htmlFor={`wg-${name}`}>{label} *</label><textarea id={`wg-${name}`} name={name} required minLength={10} maxLength={2000} rows={4} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `wg-${name}-error` : undefined} />{feedback(name)}</div>)}
      <fieldset><legend>Do you currently have a website?</legend><label className="wg-check"><input type="radio" name="has_current_website" value="yes" required />Yes</label><label className="wg-check"><input type="radio" name="has_current_website" value="no" required />No</label></fieldset>
      <label className="wg-check"><input type="checkbox" name="age_confirmed" required />I am {campaign.minimum_age} or older.</label>{feedback("age_confirmed")}
      <label className="wg-check"><input type="checkbox" name="rules_accepted" required /><span>I agree to the <Link href="/website-grant/official-rules">Official Rules</Link> and <Link href="/website-grant/privacy">Privacy Policy</Link>.</span></label>{feedback("rules_accepted")}
      <label className="wg-check"><input type="checkbox" name="contact_consent" required />I consent to VAELTX contacting me regarding this application.</label>{feedback("contact_consent")}
      <fieldset className="wg-choice"><legend>Your entry selection</legend><label className="wg-check"><input type="checkbox" checked readOnly />1 free entry · USD 0 / CAD 0 / MXN 0</label><p>Included once for this verified account. You can also select a paid package when purchases are available.</p><label htmlFor="wg-apply-package">Additional entries (optional)</label><select id="wg-apply-package" disabled={!sandboxEntries} value={quantity} onChange={e => setQuantity(Number(e.target.value))}><option value={0}>Free entry only</option>{entryQuantities.map(q => <option key={q} value={q}>{q} additional entries</option>)}</select><label htmlFor="wg-apply-currency">Currency</label><select id="wg-apply-currency" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{currencies.map(c => <option key={c}>{c}</option>)}</select><strong>{money(quantity ? entryPrice(quantity, currency) : 0, currency)}</strong>{!sandboxEntries && <p>Additional entry purchases are not available yet.</p>}</fieldset>
      <button className="wg-button" disabled={busy}>{busy ? "Confirming…" : quantity ? "Claim free entry & continue to payment" : "Submit & claim free entry"}</button><p className="wg-feedback" role="status">{message}</p>
    </form>
  </section>;
}
export function GrantPurchases({ canBuyEntries = false, canBuyServices = false, freeClaimed = false }: { canBuyEntries?: boolean; canBuyServices?: boolean; freeClaimed?: boolean }) {
  const [currency, setCurrency] = useState<Currency>("USD"), [quantity, setQuantity] = useState(5), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  async function buy(kind: "entries" | "service", code: string, count: number) {
    setBusy(true); setMessage(""); const fingerprint = `${kind}/${code}/${currency}/${count}`;
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() };
    try { const result = await post("checkout", { kind, code, quantity: count, currency, requestId: attempt.current.id }); if (result.ok) window.location.assign(result.url); else { if (result.status === 409) attempt.current = null; setMessage(result.message); } }
    catch { setMessage("Checkout could not be confirmed. Retry safely."); } finally { setBusy(false); }
  }
  return <div className="wg-purchases"><div className="wg-section-heading"><div><p className="wg-kicker">YOUR CHOICE</p><h2>One free entry. More is optional.</h2></div><div><label htmlFor="wg-currency">Display currency</label><select id="wg-currency" value={currency} disabled={busy} onChange={e => setCurrency(e.target.value as Currency)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></div></div>
    <div className="wg-ticket-grid"><article className="wg-panel"><p className="wg-kicker">FREE ENTRY</p><strong className="wg-ticket-number">01</strong><h3>One entry per verified account.</h3><p>New verified accounts may claim one free entry. Returning to the same account never creates a second free entry.</p><strong>{money(0, currency)}</strong>{freeClaimed ? <p className="wg-notice">Free entry already claimed</p> : <Link className="wg-button" href="/website-grant/apply">Get your free entry ↗</Link>}</article>
    <article className="wg-panel"><p className="wg-kicker">ADDITIONAL ENTRIES · OPTIONAL</p><label htmlFor="wg-package">Entry package</label><select id="wg-package" value={quantity} disabled={busy} onChange={e => setQuantity(Number(e.target.value))}>{entryQuantities.map(q => <option key={q} value={q}>{q} entries</option>)}</select><strong className="wg-ticket-number">{quantity}</strong><strong className="wg-package-price">{money(entryPrice(quantity, currency), currency)}</strong><p>Packages run from 5 to 100 entries, in steps of 5. The same account may purchase again; the free entry remains limited to one.</p><button className="wg-button" disabled={!canBuyEntries || busy} onClick={() => buy("entries", `entries-${quantity}`, quantity)}>{canBuyEntries ? "Continue to payment ↗" : "Purchases not open yet"}</button><p className="wg-fine">The sales team evaluates eligible business applications under the published criteria. There is no random draw. Buying more entries does not automatically increase an evaluation score or guarantee selection.</p></article></div>
    <div className="wg-section-heading wg-services-heading"><div><p className="wg-kicker">OPTIONAL PURCHASE</p><h2>A useful next step for your website.</h2><p>Standalone VAELTX services do not provide entries or influence the team review.</p></div></div>
    <div className="wg-service-grid">{services.map(service => <article className="wg-panel" key={service.code}><h3>{service.name}</h3><p>{service.description}</p><strong className="wg-package-price">{money(service.prices[currency], currency)}</strong><button className="wg-button wg-button-secondary" disabled={!canBuyServices || busy} onClick={() => buy("service", service.code, 1)}>{canBuyServices ? "Choose service ↗" : "Service purchases not open yet"}</button></article>)}</div><p className="wg-feedback" role="status">{message}</p>
  </div>;
}
export function GrantSignOut() {
  const router = useRouter(); return <button className="wg-text-button" onClick={async () => { await fetch("/api/website-grant/auth", { method: "DELETE" }); router.refresh(); }}>Sign out</button>;
}
