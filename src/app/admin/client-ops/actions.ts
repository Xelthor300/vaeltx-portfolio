"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin, db } from "@/lib/auction/server";

const projectStatus = z.enum([
  "scheduled",
  "waiting_client",
  "ready",
  "in_progress",
  "client_review",
  "changes",
  "ready_to_deliver",
  "delivered",
  "on_hold",
  "cancelled",
]);

const salesStage = z.enum([
  "prospect",
  "responded",
  "discovery",
  "scope_defined",
  "offer_presented",
  "negotiating",
  "agreed",
  "payment_pending",
  "paid_project_start",
  "won",
  "lost",
]);

const hostingMode = z.enum(["undecided", "vaeltx_managed", "client_hosting", "handoff"]);
const paymentPlan = z.enum(["undecided", "50_50", "full_completion", "full_upfront", "custom"]);
const riskLevel = z.enum(["normal", "watch", "at_risk", "blocked"]);
const preferredChannel = z.enum(["sms", "rcs", "email", "whatsapp", "phone", "other"]);

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(form: FormData, key: string) {
  const value = textValue(form, key);
  return value || null;
}

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function amount(value: string) {
  if (!value) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("Invalid project amount.");
  return Math.round(number * 100) / 100;
}

function int(value: string, fallback: number, min: number, max: number) {
  const number = Number(value || fallback);
  if (!Number.isInteger(number) || number < min || number > max) return fallback;
  return number;
}

function daysBetween(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const a = new Date(`${start}T12:00:00Z`).getTime();
  const b = new Date(`${end}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function derivedPaymentStatus(
  quoted: number,
  paid: number,
  plan: z.infer<typeof paymentPlan>,
) {
  if (quoted <= 0) return "unquoted";
  if (paid <= 0) return "unpaid";
  if (paid >= quoted) return "paid";
  if (plan === "50_50" && paid >= quoted / 2) return "deposit_paid";
  return "partially_paid";
}

async function findOrCreateClient(form: FormData) {
  const businessName = z.string().min(1).max(180).parse(textValue(form, "business_name"));
  const email = nullable(form, "email");
  const phone = nullable(form, "phone");
  const client = db();

  let existing: { id: string } | null = null;
  if (email) {
    const result = await client.from("va_clients").select("id").eq("email", email).limit(1).maybeSingle();
    existing = result.data;
  }
  if (!existing && phone) {
    const result = await client.from("va_clients").select("id").eq("phone", phone).limit(1).maybeSingle();
    existing = result.data;
  }

  const payload = {
    business_name: businessName,
    contact_name: nullable(form, "contact_name"),
    email,
    phone,
    country_code: nullable(form, "country_code"),
    region: nullable(form, "region"),
    timezone: nullable(form, "timezone"),
    website_url: nullable(form, "website_url"),
    preferred_channel: preferredChannel.parse(textValue(form, "preferred_channel") || "sms"),
    source: nullable(form, "source"),
    communication_profile: {
      tone: nullable(form, "communication_tone"),
      notes: nullable(form, "communication_notes"),
    },
    notes: nullable(form, "client_notes"),
  };

  if (existing) {
    const updated = await client.from("va_clients").update(payload).eq("id", existing.id).select("id").single();
    if (updated.error || !updated.data) throw new Error("Could not update client.");
    return updated.data.id as string;
  }

  const inserted = await client.from("va_clients").insert(payload).select("id").single();
  if (inserted.error || !inserted.data) throw new Error("Could not create client.");
  return inserted.data.id as string;
}

export async function createClientProject(form: FormData) {
  await admin();

  const clientId = await findOrCreateClient(form);
  const quoted = amount(textValue(form, "quoted_amount"));
  const paid = amount(textValue(form, "amount_paid"));
  if (quoted > 0 && paid > quoted) throw new Error("Amount paid cannot exceed the quoted amount.");

  const plan = paymentPlan.parse(textValue(form, "payment_plan") || "undecided");
  const startDate = nullable(form, "start_date");
  const targetDate = nullable(form, "target_delivery_date");
  const deadlineException = nullable(form, "deadline_exception_reason");
  const deliveryDays = daysBetween(startDate, targetDate);
  if (deliveryDays !== null && deliveryDays > 15 && !deadlineException)
    throw new Error("Delivery windows over 15 days require an exception reason.");
  if (deliveryDays !== null && deliveryDays < 0) throw new Error("Delivery date must be after the start date.");

  const projectName = z.string().min(1).max(180).parse(textValue(form, "project_name"));
  const deliverables = lines(textValue(form, "deliverables"));
  const requirements = lines(textValue(form, "client_requirements"));
  const assetsMissing = lines(textValue(form, "assets_missing"));

  const result = await db()
    .from("va_projects")
    .insert({
      client_id: clientId,
      project_name: projectName,
      sales_stage: salesStage.parse(textValue(form, "sales_stage") || "agreed"),
      project_status: projectStatus.parse(textValue(form, "project_status") || "scheduled"),
      priority: int(textValue(form, "priority"), 3, 1, 5),
      effort_points: int(textValue(form, "effort_points"), 3, 1, 10),
      scope_summary: nullable(form, "scope_summary"),
      client_context: nullable(form, "client_context"),
      deliverables,
      client_requirements: requirements,
      assets_missing: assetsMissing,
      hosting_mode: hostingMode.parse(textValue(form, "hosting_mode") || "undecided"),
      hosting_details: nullable(form, "hosting_details"),
      currency: (textValue(form, "currency") || "USD").toUpperCase(),
      quoted_amount: quoted,
      amount_paid: paid,
      payment_plan: plan,
      payment_status: derivedPaymentStatus(quoted, paid, plan),
      agreed_at: nullable(form, "agreed_at"),
      ready_at: nullable(form, "ready_at"),
      start_date: startDate,
      target_delivery_date: targetDate,
      client_deadline: nullable(form, "client_deadline"),
      deadline_exception_reason: deadlineException,
      risk_level: riskLevel.parse(textValue(form, "risk_level") || "normal"),
      risk_reason: nullable(form, "risk_reason"),
      calendar_event_id: nullable(form, "calendar_event_id"),
      next_action: nullable(form, "next_action"),
      next_action_at: nullable(form, "next_action_at"),
      owner_notes: nullable(form, "owner_notes"),
    })
    .select("id")
    .single();

  if (result.error || !result.data) throw new Error("Could not create project.");
  const projectId = result.data.id as string;

  const items = [
    ...deliverables.map((title, index) => ({
      project_id: projectId,
      item_type: "deliverable",
      title,
      owner: "vaeltx",
      status: "pending",
      required: true,
      sort_order: index,
    })),
    ...assetsMissing.map((title, index) => ({
      project_id: projectId,
      item_type: "asset",
      title,
      owner: "client",
      status: "pending",
      required: true,
      sort_order: index,
    })),
  ];
  if (items.length) {
    const itemResult = await db().from("va_project_items").insert(items);
    if (itemResult.error) throw new Error("Project created, but checklist items could not be saved.");
  }

  await db().from("va_project_activity").insert({
    project_id: projectId,
    event_type: "project_created",
    summary: `Project created in Client Ops: ${projectName}`,
    actor: "vaeltx-owner",
    metadata: { quoted_amount: quoted, amount_paid: paid, payment_plan: plan },
  });

  revalidatePath("/admin/client-ops");
}

export async function updateClientProject(form: FormData) {
  await admin();

  const id = z.string().uuid().parse(textValue(form, "project_id"));
  const quoted = amount(textValue(form, "quoted_amount"));
  const paid = amount(textValue(form, "amount_paid"));
  if (quoted > 0 && paid > quoted) throw new Error("Amount paid cannot exceed the quoted amount.");
  const plan = paymentPlan.parse(textValue(form, "payment_plan") || "undecided");
  const startDate = nullable(form, "start_date");
  const targetDate = nullable(form, "target_delivery_date");
  const deadlineException = nullable(form, "deadline_exception_reason");
  const deliveryDays = daysBetween(startDate, targetDate);
  if (deliveryDays !== null && deliveryDays > 15 && !deadlineException)
    throw new Error("Delivery windows over 15 days require an exception reason.");
  if (deliveryDays !== null && deliveryDays < 0) throw new Error("Delivery date must be after the start date.");

  const payload = {
    sales_stage: salesStage.parse(textValue(form, "sales_stage")),
    project_status: projectStatus.parse(textValue(form, "project_status")),
    priority: int(textValue(form, "priority"), 3, 1, 5),
    effort_points: int(textValue(form, "effort_points"), 3, 1, 10),
    scope_summary: nullable(form, "scope_summary"),
    client_context: nullable(form, "client_context"),
    hosting_mode: hostingMode.parse(textValue(form, "hosting_mode")),
    hosting_details: nullable(form, "hosting_details"),
    currency: (textValue(form, "currency") || "USD").toUpperCase(),
    quoted_amount: quoted,
    amount_paid: paid,
    payment_plan: plan,
    payment_status: derivedPaymentStatus(quoted, paid, plan),
    ready_at: nullable(form, "ready_at"),
    start_date: startDate,
    target_delivery_date: targetDate,
    client_deadline: nullable(form, "client_deadline"),
    deadline_exception_reason: deadlineException,
    risk_level: riskLevel.parse(textValue(form, "risk_level")),
    risk_reason: nullable(form, "risk_reason"),
    calendar_event_id: nullable(form, "calendar_event_id"),
    next_action: nullable(form, "next_action"),
    next_action_at: nullable(form, "next_action_at"),
    owner_notes: nullable(form, "owner_notes"),
  };

  const result = await db().from("va_projects").update(payload).eq("id", id);
  if (result.error) throw new Error("Could not update project.");

  await db().from("va_project_activity").insert({
    project_id: id,
    event_type: "project_updated",
    summary: "Project operations record updated.",
    actor: "vaeltx-owner",
    metadata: {
      project_status: payload.project_status,
      sales_stage: payload.sales_stage,
      payment_status: payload.payment_status,
      amount_paid: paid,
      target_delivery_date: targetDate,
      risk_level: payload.risk_level,
    },
  });

  revalidatePath("/admin/client-ops");
}

export async function addProjectItem(form: FormData) {
  await admin();

  const projectId = z.string().uuid().parse(textValue(form, "project_id"));
  const itemType = z.enum(["deliverable", "asset", "credential", "task", "approval"]).parse(textValue(form, "item_type"));
  const owner = z.enum(["vaeltx", "client"]).parse(textValue(form, "owner"));
  const title = z.string().min(1).max(240).parse(textValue(form, "title"));

  const result = await db().from("va_project_items").insert({
    project_id: projectId,
    item_type: itemType,
    title,
    details: nullable(form, "details"),
    owner,
    status: "pending",
    required: true,
    due_date: nullable(form, "due_date"),
  });
  if (result.error) throw new Error("Could not add project item.");

  await db().from("va_project_activity").insert({
    project_id: projectId,
    event_type: "item_added",
    summary: `${itemType}: ${title}`,
    actor: "vaeltx-owner",
  });

  revalidatePath("/admin/client-ops");
}

export async function setProjectItemStatus(form: FormData) {
  await admin();

  const itemId = z.string().uuid().parse(textValue(form, "item_id"));
  const projectId = z.string().uuid().parse(textValue(form, "project_id"));
  const status = z
    .enum(["pending", "received", "in_progress", "done", "approved", "blocked", "not_needed"])
    .parse(textValue(form, "status"));

  const result = await db().from("va_project_items").update({ status }).eq("id", itemId);
  if (result.error) throw new Error("Could not update project item.");

  await db().from("va_project_activity").insert({
    project_id: projectId,
    event_type: "item_status",
    summary: `Checklist item moved to ${status}.`,
    actor: "vaeltx-owner",
    metadata: { item_id: itemId, status },
  });

  revalidatePath("/admin/client-ops");
}
