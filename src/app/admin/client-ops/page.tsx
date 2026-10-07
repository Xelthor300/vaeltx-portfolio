import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { admin, db } from "@/lib/auction/server";
import {
  addProjectItem,
  createClientProject,
  setProjectItemStatus,
  updateClientProject,
} from "./actions";
import "./client-ops.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Client Ops · Private operations",
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
  scope_summary: string | null;
  client_context: string | null;
  hosting_mode: string;
  hosting_details: string | null;
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

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "MXN" ? "es-MX" : currency === "CAD" ? "en-CA" : "en-US", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Ciudad_Juarez",
  }).format(new Date(`${value.length === 10 ? value + "T12:00:00Z" : value}`));
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

const terminalStatuses = new Set(["delivered", "cancelled"]);

export default async function Page() {
  try {
    await admin();
  } catch {
    redirect("/admin/client-ops/signin");
  }

  const client = db();
  const [clientsResult, projectsResult, itemsResult] = await Promise.all([
    client
      .from("va_clients")
      .select("id,business_name,contact_name,email,phone,country_code,region,timezone,website_url,preferred_channel,communication_profile")
      .order("updated_at", { ascending: false })
      .limit(1000),
    client
      .from("va_projects")
      .select("id,client_id,project_name,sales_stage,project_status,priority,effort_points,scope_summary,client_context,hosting_mode,hosting_details,currency,quoted_amount,amount_paid,balance_due,payment_plan,payment_status,agreed_at,ready_at,start_date,target_delivery_date,client_deadline,deadline_exception_reason,risk_level,risk_reason,calendar_event_id,next_action,next_action_at,owner_notes,created_at,updated_at")
      .order("target_delivery_date", { ascending: true, nullsFirst: false })
      .limit(1000),
    client
      .from("va_project_items")
      .select("id,project_id,item_type,title,details,owner,status,required,due_date,sort_order")
      .order("sort_order", { ascending: true })
      .limit(5000),
  ]);

  if (clientsResult.error || projectsResult.error || itemsResult.error)
    throw new Error("Client Ops data is temporarily unavailable.");

  const clients = (clientsResult.data || []) as ClientRow[];
  const projects = (projectsResult.data || []) as ProjectRow[];
  const items = (itemsResult.data || []) as ItemRow[];
  const clientById = new Map(clients.map((entry) => [entry.id, entry]));
  const itemsByProject = new Map<string, ItemRow[]>();
  for (const item of items) {
    const list = itemsByProject.get(item.project_id) || [];
    list.push(item);
    itemsByProject.set(item.project_id, list);
  }

  const active = projects.filter((project) => !terminalStatuses.has(project.project_status));
  const dueSoon = active.filter((project) => {
    const remaining = daysUntil(project.target_delivery_date);
    return remaining !== null && remaining >= 0 && remaining <= 7;
  });
  const atRisk = active.filter((project) => ["watch", "at_risk", "blocked"].includes(project.risk_level));
  const outstanding = projects.reduce((sum, project) => sum + Number(project.balance_due || 0), 0);
  const activeEffort = active.reduce((sum, project) => sum + Number(project.effort_points || 0), 0);

  return (
    <main className="client-ops">
      <header className="client-ops-header">
        <div>
          <p className="client-ops-kicker">VAELTX · PRIVATE OPERATIONS</p>
          <h1>Client Ops</h1>
          <p>
            One source of truth for client context, scope, schedule, payment state, hosting, delivery and next action.
          </p>
        </div>
        <nav className="client-ops-nav" aria-label="Private operations">
          <Link href="/admin/managed-hosting">Managed Hosting</Link>
          <Link href="/admin/website-auction">Auction admin</Link>
        </nav>
      </header>

      <section className="client-ops-summary">
        <article><span>Active projects</span><strong>{active.length}</strong></article>
        <article><span>Due ≤ 7 days</span><strong>{dueSoon.length}</strong></article>
        <article><span>Risk / blocked</span><strong>{atRisk.length}</strong></article>
        <article><span>Active effort</span><strong>{activeEffort}</strong></article>
        <article><span>Outstanding</span><strong>{money(outstanding, "USD")}</strong><small>mixed-currency indicator</small></article>
      </section>

      <section className="client-ops-rule">
        <strong>Delivery discipline</strong>
        <span>
          Normal VAELTX projects should target 15 calendar days or less once scope, required assets/access and the agreed payment condition make the project ready. Longer windows require an explicit reason before being promised.
        </span>
      </section>

      <details className="client-ops-panel client-ops-create">
        <summary>
          <span>
            <small>NEW CLIENT / PROJECT</small>
            <strong>Register an agreed project</strong>
          </span>
          <b>+</b>
        </summary>

        <form action={createClientProject} className="client-ops-form">
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
            <label>Communication notes<input name="communication_notes" placeholder="Uses short replies; non-technical…" /></label>
          </div>

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

          <label>Client/business context<textarea name="client_context" rows={4} placeholder="What they sell, why the website matters, buying concerns, decision context…" /></label>
          <label>Scope summary<textarea name="scope_summary" rows={4} placeholder="What VAELTX agreed to build." /></label>
          <label>Deliverables — one per line<textarea name="deliverables" rows={5} placeholder={"Homepage\nServices page\nContact/booking flow"} /></label>
          <label>Client requirements — one per line<textarea name="client_requirements" rows={4} placeholder={"Keep current domain\nNeeds editable service content"} /></label>
          <label>Missing assets/access — one per line<textarea name="assets_missing" rows={4} placeholder={"Logo SVG\nService photos\nDomain DNS access"} /></label>
          <label>Hosting details<textarea name="hosting_details" rows={3} /></label>
          <label>Risk reason<textarea name="risk_reason" rows={3} /></label>
          <label>Deadline exception reason<textarea name="deadline_exception_reason" rows={3} placeholder="Required only if the planned delivery window exceeds 15 calendar days." /></label>
          <label>Calendar event ID<input name="calendar_event_id" /></label>
          <label>Owner notes<textarea name="owner_notes" rows={4} /></label>
          <label>Client notes<textarea name="client_notes" rows={3} /></label>

          <button type="submit">Create Client Ops record</button>
        </form>
      </details>

      <section className="client-ops-panel">
        <div className="client-ops-panel-title">
          <div>
            <p className="client-ops-kicker">SCHEDULE + DELIVERY</p>
            <h2>Project pipeline</h2>
          </div>
          <span>{projects.length} tracked</span>
        </div>

        {projects.length === 0 ? (
          <div className="client-ops-empty">
            <strong>No projects registered yet.</strong>
            <span>Once Codex closes a client, register the agreed scope here before work begins.</span>
          </div>
        ) : (
          <div className="project-stack">
            {projects.map((project) => {
              const owner = clientById.get(project.client_id);
              const projectItems = itemsByProject.get(project.id) || [];
              const remaining = daysUntil(project.target_delivery_date);
              const duration = durationDays(project.start_date, project.target_delivery_date);
              const completed = terminalStatuses.has(project.project_status);
              return (
                <details className={`project-card project-card--${project.risk_level}`} key={project.id} open={!completed && project.risk_level !== "normal"}>
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
                    </div>
                  </summary>

                  <div className="project-body">
                    <div className="project-context">
                      <article>
                        <h3>Client context</h3>
                        <p>{project.client_context || "No context recorded."}</p>
                        <div className="contact-line">
                          {owner?.phone ? <span>{owner.phone}</span> : null}
                          {owner?.email ? <span>{owner.email}</span> : null}
                          {owner?.website_url ? <a href={owner.website_url} target="_blank" rel="noreferrer">Website</a> : null}
                        </div>
                      </article>
                      <article>
                        <h3>Scope</h3>
                        <p>{project.scope_summary || "No scope summary recorded."}</p>
                        <div className="delivery-health">
                          <span>Effort {project.effort_points}/10</span>
                          <span>Priority {project.priority}/5</span>
                          <span>{duration === null ? "Window not set" : `${duration} day window`}</span>
                          <span>{remaining === null ? "No deadline" : remaining < 0 ? `${Math.abs(remaining)}d overdue` : `${remaining}d remaining`}</span>
                        </div>
                      </article>
                    </div>

                    <section className="checklist">
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
                          <option value="credential">Credential</option><option value="task">Task</option><option value="approval">Approval</option>
                        </select>
                        <select name="owner" defaultValue="vaeltx"><option value="vaeltx">VAELTX</option><option value="client">Client</option></select>
                        <input name="title" required placeholder="Add checklist item" />
                        <input name="due_date" type="date" />
                        <input name="details" placeholder="Optional details" />
                        <button type="submit">Add</button>
                      </form>
                    </section>

                    <form action={updateClientProject} className="project-edit">
                      <input type="hidden" name="project_id" value={project.id} />
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

                      <label>Client context<textarea name="client_context" rows={3} defaultValue={project.client_context || ""} /></label>
                      <label>Scope<textarea name="scope_summary" rows={3} defaultValue={project.scope_summary || ""} /></label>
                      <label>Hosting details<textarea name="hosting_details" rows={2} defaultValue={project.hosting_details || ""} /></label>
                      <label>Risk reason<textarea name="risk_reason" rows={2} defaultValue={project.risk_reason || ""} /></label>
                      <label>Deadline exception<textarea name="deadline_exception_reason" rows={2} defaultValue={project.deadline_exception_reason || ""} /></label>
                      <label>Calendar event ID<input name="calendar_event_id" defaultValue={project.calendar_event_id || ""} /></label>
                      <label>Owner notes<textarea name="owner_notes" rows={3} defaultValue={project.owner_notes || ""} /></label>
                      <button type="submit">Save project state</button>
                    </form>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section className="client-ops-rule">
        <strong>Source-of-truth rule</strong>
        <span>
          A client is not “won” because they replied. Record WON only after scope, price and payment structure are agreed. Record PAID / PROJECT START only when the required payment condition is actually satisfied.
        </span>
      </section>
    </main>
  );
}
