import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { admin, db } from "@/lib/auction/server";
import {
  addProjectItem,
  createClientProject,
  lockProjectScope,
  setProjectItemStatus,
  updateClientProject,
} from "./actions";
import "./client-ops.css";
import "./client-ops-v2.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Client Ops · VAELTX Private Operations",
  robots: { index: false, follow: false },
};

type ClientRow = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  region: string | null;
  timezone: string | null;
  website_url: string | null;
  preferred_channel: string;
  communication_profile: Record<string, unknown> | null;
};

type ProjectRow = {
  id: string;
  client_id: string;
  project_name: string;
  sales_stage: string;
  project_status: string;
  priority: number;
  effort_points: number;
  original_client_request: string | null;
  request_capture_mode: string;
  request_source: string | null;
  request_source_url: string | null;
  problem_opportunity: string | null;
  scope_summary: string | null;
  client_context: string | null;
  deliverables: string[] | null;
  exclusions: string[] | null;
  client_requirements: string[] | null;
  assets_missing: string[] | null;
  client_promises: string[] | null;
  vaeltx_promises: string[] | null;
  hosting_mode: string;
  hosting_details: string | null;
  delivery_instructions: string | null;
  currency: string;
  quoted_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_plan: string;
  payment_status: string;
  agreed_at: string | null;
  ready_at: string | null;
  start_date: string | null;
  target_delivery_date: string | null;
  client_deadline: string | null;
  deadline_exception_reason: string | null;
  risk_level: string;
  risk_reason: string | null;
  calendar_event_id: string | null;
  next_action: string | null;
  next_action_at: string | null;
  approval_evidence: string | null;
  approved_at: string | null;
  scope_locked_at: string | null;
  scope_locked_snapshot: Record<string, unknown> | null;
  scope_revision: number;
  owner_notes: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  project_id: string;
  item_type: string;
  title: string;
  details: string | null;
  owner: string;
  status: string;
  required: boolean;
  due_date: string | null;
  sort_order: number;
};

type ActivityRow = {
  id: number;
  project_id: string;
  event_type: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  actor: string;
  created_at: string;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(
    currency === "MXN" ? "es-MX" : currency === "CAD" ? "en-CA" : "en-US",
    { style: "currency", currency },
  ).format(Number(value || 0));
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Ciudad_Juarez",
  }).format(new Date(`${value.length === 10 ? value + "T12:00:00Z" : value}`));
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Ciudad_Juarez",
  }).format(new Date(value));
}

function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const today = new Date();
  const target = new Date(`${value}T12:00:00Z`);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12));
  return Math.ceil((target.getTime() - start.getTime()) / 86400000);
}

function durationDays(start: string | null, end: string | null) {
  if (!start || !end) return null;
  return Math.round(
    (new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000,
  );
}

function customerName(client?: ClientRow) {
  return client?.business_name || client?.contact_name || client?.email || "Client";
}

function list(value: string[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function Lines({ values, empty = "Nothing recorded." }: { values: string[]; empty?: string }) {
  if (!values.length) return <p className="muted-inline">{empty}</p>;
  return (
    <ul className="ops-list">
      {values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}
    </ul>
  );
}

const terminalStatuses = new Set(["delivered", "cancelled"]);

export default async function Page() {
  try {
    await admin();
  } catch {
    redirect("/admin/client-ops/signin");
  }

  const client = db();
  const [clientsResult, projectsResult, itemsResult, activityResult] = await Promise.all([
    client
      .from("va_clients")
      .select("id,business_name,contact_name,email,phone,country_code,region,timezone,website_url,preferred_channel,communication_profile")
      .order("updated_at", { ascending: false })
      .limit(1000),
    client
      .from("va_projects")
      .select("id,client_id,project_name,sales_stage,project_status,priority,effort_points,original_client_request,request_capture_mode,request_source,request_source_url,problem_opportunity,scope_summary,client_context,deliverables,exclusions,client_requirements,assets_missing,client_promises,vaeltx_promises,hosting_mode,hosting_details,delivery_instructions,currency,quoted_amount,amount_paid,balance_due,payment_plan,payment_status,agreed_at,ready_at,start_date,target_delivery_date,client_deadline,deadline_exception_reason,risk_level,risk_reason,calendar_event_id,next_action,next_action_at,approval_evidence,approved_at,scope_locked_at,scope_locked_snapshot,scope_revision,owner_notes,created_at,updated_at")
      .order("target_delivery_date", { ascending: true, nullsFirst: false })
      .limit(1000),
    client
      .from("va_project_items")
      .select("id,project_id,item_type,title,details,owner,status,required,due_date,sort_order")
      .order("sort_order", { ascending: true })
      .limit(5000),
    client
      .from("va_project_activity")
      .select("id,project_id,event_type,summary,metadata,actor,created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  if (clientsResult.error || projectsResult.error || itemsResult.error || activityResult.error) {
    throw new Error("Client Ops data is temporarily unavailable.");
  }

  const clients = (clientsResult.data || []) as ClientRow[];
  const projects = (projectsResult.data || []) as ProjectRow[];
  const items = (itemsResult.data || []) as ItemRow[];
  const activities = (activityResult.data || []) as ActivityRow[];

  const clientById = new Map(clients.map((entry) => [entry.id, entry]));
  const itemsByProject = new Map<string, ItemRow[]>();
  const activityByProject = new Map<string, ActivityRow[]>();

  for (const item of items) {
    const current = itemsByProject.get(item.project_id) || [];
    current.push(item);
    itemsByProject.set(item.project_id, current);
  }
  for (const activity of activities) {
    const current = activityByProject.get(activity.project_id) || [];
    current.push(activity);
    activityByProject.set(activity.project_id, current);
  }

  const active = projects.filter((project) => !terminalStatuses.has(project.project_status));
  const dueSoon = active.filter((project) => {
    const remaining = daysUntil(project.target_delivery_date);
    return remaining !== null && remaining >= 0 && remaining <= 7;
  });
  const atRisk = active.filter((project) => ["watch", "at_risk", "blocked"].includes(project.risk_level));
  const outstandingProjects = projects.filter((project) => Number(project.balance_due || 0) > 0);
  const activeEffort = active.reduce((sum, project) => sum + Number(project.effort_points || 0), 0);
  const lockedScopes = projects.filter((project) => project.scope_locked_at).length;

  return (
    <main className="client-ops client-ops-v2">
      <header className="client-ops-header ops-command-header">
        <div>
          <p className="client-ops-kicker">VAELTX · PRIVATE OPERATIONS</p>
          <h1>Client Operations</h1>
          <p>
            The operational source of truth for what the client asked for, what VAELTX agreed to build,
            what has been paid, what is still missing, and exactly what must happen next.
          </p>
        </div>
        <nav className="client-ops-nav" aria-label="Private operations">
          <Link href="/admin/managed-hosting">Managed Hosting</Link>
          <Link href="/admin/website-auction">Auction admin</Link>
        </nav>
      </header>

      <section className="client-ops-summary ops-summary-v2">
        <article><span>Active projects</span><strong>{active.length}</strong><small>Current delivery load</small></article>
        <article><span>Due ≤ 7 days</span><strong>{dueSoon.length}</strong><small>Needs deadline awareness</small></article>
        <article><span>Risk / blocked</span><strong>{atRisk.length}</strong><small>Intervention required</small></article>
        <article><span>Active effort</span><strong>{activeEffort}</strong><small>Normal capacity ≈ 10 pts</small></article>
        <article><span>Balances due</span><strong>{outstandingProjects.length}</strong><small>Projects with money outstanding</small></article>
        <article><span>Locked scopes</span><strong>{lockedScopes}</strong><small>Baseline agreements protected</small></article>
      </section>

      <section className="ops-command-strip">
        <div><span className="ops-dot ops-dot--green" />Source of truth</div>
        <p>
          Original request and final agreed scope are intentionally separate. Once scope is locked,
          later scope changes require a reason and are written to the activity history.
        </p>
      </section>

      <details className="client-ops-panel client-ops-create ops-create-v2">
        <summary>
          <span>
            <small>NEW CLIENT / PROJECT</small>
            <strong>Register a real agreement</strong>
            <em>Capture the brief, commercial terms, delivery plan and evidence before work begins.</em>
          </span>
          <b>+</b>
        </summary>

        <form action={createClientProject} className="client-ops-form ops-form-v2">
          <fieldset className="ops-form-section">
            <legend>01 · Client identity</legend>
            <div className="form-grid">
              <label>Business name<input name="business_name" required /></label>
              <label>Contact name<input name="contact_name" /></label>
              <label>Email<input name="email" type="email" /></label>
              <label>Phone<input name="phone" /></label>
              <label>Country code<input name="country_code" placeholder="US / CA / MX" /></label>
              <label>Region / city<input name="region" /></label>
              <label>Timezone<input name="timezone" placeholder="America/Toronto" /></label>
              <label>Website<input name="website_url" type="url" /></label>
              <label>Preferred channel
                <select name="preferred_channel" defaultValue="sms">
                  <option value="sms">SMS</option><option value="rcs">RCS</option><option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option><option value="phone">Phone</option><option value="other">Other</option>
                </select>
              </label>
              <label>Lead source<input name="source" placeholder="SMS outreach, referral, Facebook…" /></label>
              <label>Communication tone<input name="communication_tone" placeholder="direct, concise, formal…" /></label>
              <label>Communication notes<input name="communication_notes" placeholder="Short replies; non-technical; evidence-seeking…" /></label>
            </div>
          </fieldset>

          <fieldset className="ops-form-section ops-form-section--brief">
            <legend>02 · Client brief / original request</legend>
            <div className="form-grid">
              <label>Request capture mode
                <select name="request_capture_mode" defaultValue="verbatim">
                  <option value="verbatim">Verbatim / exact wording</option>
                  <option value="faithful_summary">Faithful summary</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <label>Request source<input name="request_source" placeholder="Facebook post, SMS, email, referral…" /></label>
              <label className="span-2">Source URL<input name="request_source_url" type="url" placeholder="https://…" /></label>
            </div>
            <label>Original Client Request<textarea name="original_client_request" rows={7} placeholder="Paste the client's exact request where possible. If not, write a faithful summary without adding assumptions." /></label>
            <div className="ops-two-col">
              <label>Business Context<textarea name="client_context" rows={5} placeholder="What the business does, audience, services, decision context, concerns and relevant background." /></label>
              <label>Problem / Opportunity<textarea name="problem_opportunity" rows={5} placeholder="The verified website/business opportunity and why it matters to the customer's next action." /></label>
            </div>
          </fieldset>

          <fieldset className="ops-form-section ops-form-section--agreement">
            <legend>03 · Client Brief / Agreed Scope</legend>
            <label>Exact Agreed Scope<textarea name="scope_summary" rows={7} placeholder="Exactly what VAELTX agreed to build. This is not the original request; it is the final negotiated scope." /></label>
            <div className="ops-three-col">
              <label>Deliverables — one per line<textarea name="deliverables" rows={6} placeholder={"Homepage\nServices page\nQuote/contact flow"} /></label>
              <label>Exclusions — one per line<textarea name="exclusions" rows={6} placeholder={"No ecommerce\nNo logo redesign\nNo copy translation"} /></label>
              <label>Client Requirements — one per line<textarea name="client_requirements" rows={6} placeholder={"Keep current domain\nEnglish + Spanish\nEditable service content"} /></label>
            </div>
            <div className="ops-three-col">
              <label>Assets / Access Required<textarea name="assets_missing" rows={5} placeholder={"Logo SVG\nService photos\nDomain/DNS access"} /></label>
              <label>Client Promises<textarea name="client_promises" rows={5} placeholder={"Provide photos by Oct 10\nApprove copy within 24h"} /></label>
              <label>VAELTX Promises<textarea name="vaeltx_promises" rows={5} placeholder={"Responsive implementation\nStaging review before handoff"} /></label>
            </div>
            <label className="ops-lock-checkbox">
              <input name="lock_scope" type="checkbox" />
              <span>
                <strong>Lock agreed scope when this project is created</strong>
                <small>Creates an immutable baseline snapshot. Future scope edits require a written change reason.</small>
              </span>
            </label>
          </fieldset>

          <fieldset className="ops-form-section">
            <legend>04 · Commercial + delivery control</legend>
            <div className="form-grid">
              <label>Project name<input name="project_name" required /></label>
              <label>Sales stage
                <select name="sales_stage" defaultValue="agreed">
                  {["prospect","responded","discovery","scope_defined","offer_presented","negotiating","agreed","payment_pending","paid_project_start","won","lost"].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>Project status
                <select name="project_status" defaultValue="scheduled">
                  {["scheduled","waiting_client","ready","in_progress","client_review","changes","ready_to_deliver","delivered","on_hold","cancelled"].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>Priority<input name="priority" type="number" min="1" max="5" defaultValue="3" /></label>
              <label>Effort points<input name="effort_points" type="number" min="1" max="10" defaultValue="3" /></label>
              <label>Currency<input name="currency" maxLength={3} defaultValue="USD" /></label>
              <label>Quoted amount<input name="quoted_amount" type="number" min="0" step="0.01" defaultValue="0" /></label>
              <label>Amount paid<input name="amount_paid" type="number" min="0" step="0.01" defaultValue="0" /></label>
              <label>Payment plan
                <select name="payment_plan" defaultValue="undecided">
                  <option value="undecided">Undecided</option><option value="50_50">50 / 50</option>
                  <option value="full_completion">100% at completion</option><option value="full_upfront">100% upfront</option><option value="custom">Custom</option>
                </select>
              </label>
              <label>Hosting
                <select name="hosting_mode" defaultValue="undecided">
                  <option value="undecided">Undecided</option><option value="vaeltx_managed">VAELTX Managed</option>
                  <option value="client_hosting">Client hosting</option><option value="handoff">Handoff/files</option>
                </select>
              </label>
              <label>Start date<input name="start_date" type="date" /></label>
              <label>Target delivery<input name="target_delivery_date" type="date" /></label>
              <label>Client hard deadline<input name="client_deadline" type="date" /></label>
              <label>Ready at<input name="ready_at" type="datetime-local" /></label>
              <label>Agreed at<input name="agreed_at" type="datetime-local" /></label>
              <label>Risk
                <select name="risk_level" defaultValue="normal">
                  <option value="normal">normal</option><option value="watch">watch</option><option value="at_risk">at_risk</option><option value="blocked">blocked</option>
                </select>
              </label>
              <label>Next action<input name="next_action" placeholder="Request logo, send scope…" /></label>
              <label>Next action at<input name="next_action_at" type="datetime-local" /></label>
            </div>
          </fieldset>

          <fieldset className="ops-form-section">
            <legend>05 · Approval + handoff</legend>
            <div className="ops-two-col">
              <label>Hosting details<textarea name="hosting_details" rows={4} placeholder="Provider, account ownership, domain/DNS plan, handoff path…" /></label>
              <label>Delivery Instructions<textarea name="delivery_instructions" rows={4} placeholder="Where to deploy, what to hand over, final access path, production-transfer notes…" /></label>
            </div>
            <div className="ops-two-col">
              <label>Approval Evidence<textarea name="approval_evidence" rows={4} placeholder="What the client approved and where that approval is recorded." /></label>
              <label>Approved at<input name="approved_at" type="datetime-local" /></label>
            </div>
            <div className="ops-two-col">
              <label>Risk reason<textarea name="risk_reason" rows={3} /></label>
              <label>Deadline exception reason<textarea name="deadline_exception_reason" rows={3} placeholder="Required if the planned window exceeds 15 calendar days." /></label>
            </div>
            <label>Calendar event ID<input name="calendar_event_id" /></label>
            <label>Owner notes<textarea name="owner_notes" rows={4} /></label>
            <label>Client notes<textarea name="client_notes" rows={3} /></label>
          </fieldset>

          <button type="submit" className="ops-primary-action">Create Client Ops record</button>
        </form>
      </details>

      <section className="client-ops-panel ops-pipeline-panel">
        <div className="client-ops-panel-title">
          <div>
            <p className="client-ops-kicker">DELIVERY CONTROL</p>
            <h2>Project pipeline</h2>
          </div>
          <span>{projects.length} tracked</span>
        </div>

        {projects.length === 0 ? (
          <div className="client-ops-empty">
            <strong>No projects registered yet.</strong>
            <span>Register only real agreed projects here. Cold prospects belong outside Client Ops.</span>
          </div>
        ) : (
          <div className="project-stack">
            {projects.map((project) => {
              const owner = clientById.get(project.client_id);
              const projectItems = itemsByProject.get(project.id) || [];
              const projectActivity = activityByProject.get(project.id) || [];
              const remaining = daysUntil(project.target_delivery_date);
              const duration = durationDays(project.start_date, project.target_delivery_date);
              const completed = terminalStatuses.has(project.project_status);
              const snapshot = project.scope_locked_snapshot || {};

              return (
                <details className={`project-card project-card--${project.risk_level} ops-project-card`} key={project.id} open={!completed && project.risk_level !== "normal"}>
                  <summary>
                    <div className="project-main">
                      <span className="project-client">{customerName(owner)}</span>
                      <strong>{project.project_name}</strong>
                      <small>{owner?.region || owner?.country_code || "Location not recorded"} · {project.sales_stage}</small>
                    </div>
                    <div className="project-facts">
                      <span className={`pill pill--${project.project_status}`}>{project.project_status}</span>
                      <span>{project.target_delivery_date ? `Due ${date(project.target_delivery_date)}` : "No delivery date"}</span>
                      <strong>{money(project.quoted_amount, project.currency)}</strong>
                      <small>{project.payment_status} · {money(project.balance_due, project.currency)} due</small>
                      <span className={project.scope_locked_at ? "scope-chip scope-chip--locked" : "scope-chip"}>
                        {project.scope_locked_at ? `Scope locked · rev ${project.scope_revision}` : "Scope not locked"}
                      </span>
                    </div>
                  </summary>

                  <div className="project-body ops-project-body">
                    <section className="ops-brief-shell">
                      <div className="ops-brief-header">
                        <div>
                          <span>CLIENT BRIEF / AGREEMENT</span>
                          <h3>What was requested vs. what was agreed</h3>
                        </div>
                        {project.request_source_url ? (
                          <a href={project.request_source_url} target="_blank" rel="noreferrer">Open source ↗</a>
                        ) : null}
                      </div>

                      <div className="ops-brief-grid">
                        <article className="ops-brief-card ops-brief-card--request">
                          <header><span>Original Client Request</span><b>{project.request_capture_mode}</b></header>
                          <p>{project.original_client_request || "Original request has not been captured yet."}</p>
                          <footer>{project.request_source || "Source not recorded"}</footer>
                        </article>

                        <article className="ops-brief-card">
                          <header><span>Business Context</span></header>
                          <p>{project.client_context || "No business context recorded."}</p>
                          <div className="contact-line">
                            {owner?.phone ? <span>{owner.phone}</span> : null}
                            {owner?.email ? <span>{owner.email}</span> : null}
                            {owner?.website_url ? <a href={owner.website_url} target="_blank" rel="noreferrer">Website ↗</a> : null}
                          </div>
                        </article>

                        <article className="ops-brief-card ops-brief-card--opportunity">
                          <header><span>Problem / Opportunity</span></header>
                          <p>{project.problem_opportunity || "No verified opportunity recorded."}</p>
                        </article>

                        <article className="ops-brief-card ops-brief-card--scope">
                          <header><span>Exact Agreed Scope</span></header>
                          <p>{project.scope_summary || "No agreed scope recorded."}</p>
                          <div className="delivery-health">
                            <span>Effort {project.effort_points}/10</span>
                            <span>Priority {project.priority}/5</span>
                            <span>{duration === null ? "Window not set" : `${duration} day window`}</span>
                            <span>{remaining === null ? "No deadline" : remaining < 0 ? `${Math.abs(remaining)}d overdue` : `${remaining}d remaining`}</span>
                          </div>
                        </article>
                      </div>

                      <div className="ops-contract-grid">
                        <article><h4>Deliverables</h4><Lines values={list(project.deliverables)} /></article>
                        <article><h4>Exclusions</h4><Lines values={list(project.exclusions)} /></article>
                        <article><h4>Client requirements</h4><Lines values={list(project.client_requirements)} /></article>
                        <article><h4>Assets / access required</h4><Lines values={list(project.assets_missing)} /></article>
                        <article><h4>Client promises</h4><Lines values={list(project.client_promises)} /></article>
                        <article><h4>VAELTX promises</h4><Lines values={list(project.vaeltx_promises)} /></article>
                      </div>

                      <div className="ops-handoff-grid">
                        <article>
                          <span>Delivery / Handoff</span>
                          <p>{project.delivery_instructions || project.hosting_details || "No final delivery instructions recorded."}</p>
                          <small>Hosting mode: {project.hosting_mode}</small>
                        </article>
                        <article>
                          <span>Approval evidence</span>
                          <p>{project.approval_evidence || "No approval evidence recorded yet."}</p>
                          <small>{project.approved_at ? `Approved ${dateTime(project.approved_at)}` : "Approval timestamp not recorded"}</small>
                        </article>
                      </div>

                      <div className="ops-scope-lock">
                        <div>
                          <strong>{project.scope_locked_at ? "Baseline agreement protected" : "Scope baseline not locked yet"}</strong>
                          <span>
                            {project.scope_locked_at
                              ? `Locked ${dateTime(project.scope_locked_at)} · revision ${project.scope_revision}. Future scope edits require a reason and remain in history.`
                              : "Lock scope after price, deliverables and client agreement are clear."}
                          </span>
                        </div>
                        {!project.scope_locked_at ? (
                          <form action={lockProjectScope}>
                            <input type="hidden" name="project_id" value={project.id} />
                            <button type="submit">Lock agreed scope</button>
                          </form>
                        ) : null}
                      </div>

                      {project.scope_locked_at ? (
                        <details className="ops-snapshot">
                          <summary>View immutable locked baseline</summary>
                          <pre>{JSON.stringify(snapshot, null, 2)}</pre>
                        </details>
                      ) : null}
                    </section>

                    <section className="checklist ops-checklist-v2">
                      <div className="checklist-title">
                        <h3>Delivery checklist</h3>
                        <span>{projectItems.filter((item) => ["done","approved","received","not_needed"].includes(item.status)).length}/{projectItems.length} cleared</span>
                      </div>
                      {projectItems.length ? (
                        <div className="checklist-items">
                          {projectItems.map((item) => (
                            <form action={setProjectItemStatus} className="checklist-item" key={item.id}>
                              <input type="hidden" name="item_id" value={item.id} />
                              <input type="hidden" name="project_id" value={project.id} />
                              <div>
                                <strong>{item.title}</strong>
                                <small>{item.item_type} · owner: {item.owner}{item.due_date ? ` · due ${date(item.due_date)}` : ""}</small>
                                {item.details ? <small>{item.details}</small> : null}
                              </div>
                              <select name="status" defaultValue={item.status}>
                                {["pending","received","in_progress","done","approved","blocked","not_needed"].map((value) => <option key={value}>{value}</option>)}
                              </select>
                              <button type="submit">Save</button>
                            </form>
                          ))}
                        </div>
                      ) : <p className="muted">No checklist items yet.</p>}

                      <form action={addProjectItem} className="add-item">
                        <input type="hidden" name="project_id" value={project.id} />
                        <select name="item_type" defaultValue="deliverable">
                          <option value="deliverable">Deliverable</option><option value="asset">Asset</option>
                          <option value="credential">Access request</option><option value="task">Task</option><option value="approval">Approval</option>
                        </select>
                        <select name="owner" defaultValue="vaeltx"><option value="vaeltx">VAELTX</option><option value="client">Client</option></select>
                        <input name="title" required placeholder="Add checklist item" />
                        <input name="due_date" type="date" />
                        <input name="details" placeholder="Optional details — never store passwords/secrets" />
                        <button type="submit">Add</button>
                      </form>
                    </section>

                    <section className="ops-activity">
                      <div className="ops-activity-title">
                        <div><span>PROJECT HISTORY</span><h3>Material changes stay visible</h3></div>
                        <b>{projectActivity.length}</b>
                      </div>
                      {projectActivity.length ? (
                        <div className="ops-timeline">
                          {projectActivity.slice(0, 12).map((event) => (
                            <article key={event.id}>
                              <i />
                              <div>
                                <strong>{event.summary}</strong>
                                <small>{event.event_type} · {dateTime(event.created_at)}</small>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : <p className="muted">No activity history yet.</p>}
                    </section>

                    <details className="ops-edit-panel">
                      <summary>Edit project / record a scope change</summary>
                      <form action={updateClientProject} className="project-edit ops-project-edit-v2">
                        <input type="hidden" name="project_id" value={project.id} />

                        <fieldset className="ops-form-section">
                          <legend>Client brief</legend>
                          <div className="form-grid">
                            <label>Request capture mode
                              <select name="request_capture_mode" defaultValue={project.request_capture_mode || "unknown"}>
                                <option value="verbatim">Verbatim / exact wording</option>
                                <option value="faithful_summary">Faithful summary</option>
                                <option value="unknown">Unknown</option>
                              </select>
                            </label>
                            <label>Request source<input name="request_source" defaultValue={project.request_source || ""} /></label>
                            <label className="span-2">Source URL<input name="request_source_url" type="url" defaultValue={project.request_source_url || ""} /></label>
                          </div>
                          <label>Original Client Request<textarea name="original_client_request" rows={6} defaultValue={project.original_client_request || ""} /></label>
                          <div className="ops-two-col">
                            <label>Business Context<textarea name="client_context" rows={4} defaultValue={project.client_context || ""} /></label>
                            <label>Problem / Opportunity<textarea name="problem_opportunity" rows={4} defaultValue={project.problem_opportunity || ""} /></label>
                          </div>
                        </fieldset>

                        <fieldset className="ops-form-section ops-form-section--agreement">
                          <legend>Agreed scope</legend>
                          <label>Exact Agreed Scope<textarea name="scope_summary" rows={6} defaultValue={project.scope_summary || ""} /></label>
                          <div className="ops-three-col">
                            <label>Deliverables<textarea name="deliverables" rows={5} defaultValue={list(project.deliverables).join("\n")} /></label>
                            <label>Exclusions<textarea name="exclusions" rows={5} defaultValue={list(project.exclusions).join("\n")} /></label>
                            <label>Client Requirements<textarea name="client_requirements" rows={5} defaultValue={list(project.client_requirements).join("\n")} /></label>
                          </div>
                          <div className="ops-two-col">
                            <label>Client Promises<textarea name="client_promises" rows={5} defaultValue={list(project.client_promises).join("\n")} /></label>
                            <label>VAELTX Promises<textarea name="vaeltx_promises" rows={5} defaultValue={list(project.vaeltx_promises).join("\n")} /></label>
                          </div>
                          {project.scope_locked_at ? (
                            <label className="scope-change-reason">
                              Scope Change Reason — required if any locked commercial/scope field changes
                              <textarea name="scope_change_reason" rows={4} placeholder="What changed, who requested it, and why the change is being accepted." />
                            </label>
                          ) : null}
                        </fieldset>

                        <fieldset className="ops-form-section">
                          <legend>Commercial + schedule</legend>
                          <div className="form-grid">
                            <label>Sales stage<select name="sales_stage" defaultValue={project.sales_stage}>{["prospect","responded","discovery","scope_defined","offer_presented","negotiating","agreed","payment_pending","paid_project_start","won","lost"].map((value) => <option key={value}>{value}</option>)}</select></label>
                            <label>Status<select name="project_status" defaultValue={project.project_status}>{["scheduled","waiting_client","ready","in_progress","client_review","changes","ready_to_deliver","delivered","on_hold","cancelled"].map((value) => <option key={value}>{value}</option>)}</select></label>
                            <label>Priority<input name="priority" type="number" min="1" max="5" defaultValue={project.priority} /></label>
                            <label>Effort<input name="effort_points" type="number" min="1" max="10" defaultValue={project.effort_points} /></label>
                            <label>Currency<input name="currency" maxLength={3} defaultValue={project.currency} /></label>
                            <label>Quoted<input name="quoted_amount" type="number" min="0" step="0.01" defaultValue={project.quoted_amount} /></label>
                            <label>Paid<input name="amount_paid" type="number" min="0" step="0.01" defaultValue={project.amount_paid} /></label>
                            <label>Payment plan<select name="payment_plan" defaultValue={project.payment_plan}><option value="undecided">Undecided</option><option value="50_50">50 / 50</option><option value="full_completion">100% completion</option><option value="full_upfront">100% upfront</option><option value="custom">Custom</option></select></label>
                            <label>Hosting<select name="hosting_mode" defaultValue={project.hosting_mode}><option value="undecided">Undecided</option><option value="vaeltx_managed">VAELTX Managed</option><option value="client_hosting">Client hosting</option><option value="handoff">Handoff/files</option></select></label>
                            <label>Start<input name="start_date" type="date" defaultValue={project.start_date || ""} /></label>
                            <label>Target delivery<input name="target_delivery_date" type="date" defaultValue={project.target_delivery_date || ""} /></label>
                            <label>Client deadline<input name="client_deadline" type="date" defaultValue={project.client_deadline || ""} /></label>
                            <label>Ready at<input name="ready_at" type="datetime-local" defaultValue={dateTimeLocal(project.ready_at)} /></label>
                            <label>Risk<select name="risk_level" defaultValue={project.risk_level}><option value="normal">normal</option><option value="watch">watch</option><option value="at_risk">at_risk</option><option value="blocked">blocked</option></select></label>
                            <label>Next action<input name="next_action" defaultValue={project.next_action || ""} /></label>
                            <label>Next action at<input name="next_action_at" type="datetime-local" defaultValue={dateTimeLocal(project.next_action_at)} /></label>
                          </div>
                        </fieldset>

                        <fieldset className="ops-form-section">
                          <legend>Approval + handoff</legend>
                          <div className="ops-two-col">
                            <label>Hosting details<textarea name="hosting_details" rows={4} defaultValue={project.hosting_details || ""} /></label>
                            <label>Delivery Instructions<textarea name="delivery_instructions" rows={4} defaultValue={project.delivery_instructions || ""} /></label>
                          </div>
                          <div className="ops-two-col">
                            <label>Approval Evidence<textarea name="approval_evidence" rows={4} defaultValue={project.approval_evidence || ""} /></label>
                            <label>Approved at<input name="approved_at" type="datetime-local" defaultValue={dateTimeLocal(project.approved_at)} /></label>
                          </div>
                          <div className="ops-two-col">
                            <label>Risk reason<textarea name="risk_reason" rows={3} defaultValue={project.risk_reason || ""} /></label>
                            <label>Deadline exception<textarea name="deadline_exception_reason" rows={3} defaultValue={project.deadline_exception_reason || ""} /></label>
                          </div>
                          <label>Calendar event ID<input name="calendar_event_id" defaultValue={project.calendar_event_id || ""} /></label>
                          <label>Owner notes<textarea name="owner_notes" rows={3} defaultValue={project.owner_notes || ""} /></label>
                        </fieldset>

                        <button type="submit">Save project state</button>
                      </form>
                    </details>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section className="client-ops-rule">
        <strong>Failure-proof rule</strong>
        <span>
          REPLIED is not CLIENT. AGREED is not PAID. A deposit is not payment in full.
          A locked scope cannot be silently rewritten. Client Ops should always let VAELTX reconstruct the deal from evidence.
        </span>
      </section>
    </main>
  );
}
