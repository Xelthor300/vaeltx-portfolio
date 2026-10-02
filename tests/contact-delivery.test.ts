import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { POST } from "../src/app/api/contact/route";
import { contactNeeds } from "../src/lib/contact-options";
import { contactFieldErrors, contactSchema } from "../src/lib/contact";
import { createInquiryEmail } from "../src/lib/contact-delivery";

const origin = "https://vaeltx-portfolio.vercel.app";
const valid = { name: "VAELTX Test", email: "visitor@example.com", need: "New website", detail: "A real description of the change needed.", site: "https://example.com", timing: "When scope is clear", website: "" };
const request = (body: unknown = valid, key: string = randomUUID(), ip = "unit-ip", requestOrigin: string | null = origin) => new Request(`${origin}/api/contact`, {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": key, "x-forwarded-for": ip, ...(requestOrigin ? { origin: requestOrigin } : {}) },
  body: JSON.stringify(body),
});
function resetState() {
  for (const field of ["vaeltxContactReceipts", "vaeltxContactPending", "vaeltxContactRate"]) (Reflect.get(globalThis, field) as Map<string, unknown> | undefined)?.clear();
}

test("contact schema and message contract cover all options without frontend/backend drift", () => {
  for (const need of contactNeeds) assert.equal(contactSchema.safeParse({ ...valid, need }).success, true);
  const empty = contactSchema.safeParse({ ...valid, need: "" });
  assert.equal(empty.success, false);
  if (!empty.success) assert.equal(contactFieldErrors(empty.error).need, "Choose the kind of help you have in mind.");
  const email = createInquiryEmail(contactSchema.parse(valid));
  assert.deepEqual(email.to, ["vaeltxn@gmail.com"]);
  assert.equal(email.replyTo, valid.email);
  assert.equal(email.from, "VAELTX <onboarding@resend.dev>");
  assert.equal(email.subject, `New VAELTX project inquiry / ${valid.name}`);
  for (const label of ["Name:", "Email:", "Help requested:", "Current site:", "Timing:", "What needs to change:"]) assert.ok(email.text.includes(label));
});

test("contact route validates requests, sends through Resend and protects retries", async t => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalMode = process.env.NODE_ENV;
  process.env.RESEND_API_KEY = "re_unit_test_placeholder_not_a_credential";
  Reflect.set(process.env, "NODE_ENV", "production");
  let sends = 0;
  let provider: (input: string | URL | Request, options?: RequestInit) => Promise<Response> = async () => Response.json({ id: "unit-test-receipt" });
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    sends++;
    return provider(input, options);
  };
  try {
    await t.test("invalid selection, email, detail, URL and honeypot never reach provider", async () => {
      resetState(); const before = sends;
      for (const body of [{ ...valid, need: "" }, { ...valid, need: "unknown" }, { ...valid, email: "invalid" }, { ...valid, detail: "short" }, { ...valid, site: "not-a-url" }, { ...valid, website: "filled-by-bot" }]) {
        const result = await POST(request(body));
        assert.equal(result.status, 400); assert.equal((await result.json()).ok, false);
      }
      assert.equal(sends, before);
    });
    await t.test("missing or foreign origin, invalid key and oversized data are rejected", async () => {
      resetState(); const before = sends;
      assert.equal((await POST(request(valid, randomUUID(), "unit-ip", null))).status, 403);
      assert.equal((await POST(request(valid, randomUUID(), "unit-ip", "https://other.example"))).status, 403);
      assert.equal((await POST(request(valid, "invalid-key"))).status, 400);
      assert.equal((await POST(request({ ...valid, detail: "x".repeat(25_000) }))).status, 413);
      assert.equal(sends, before);
    });
    await t.test("missing configuration is a truthful recoverable 503", async () => {
      resetState(); delete process.env.RESEND_API_KEY;
      const result = await POST(request()); assert.equal(result.status, 503);
      assert.equal((await result.json()).ok, false);
      process.env.RESEND_API_KEY = "re_unit_test_placeholder_not_a_credential";
    });
    await t.test("all seven valid options use fixed recipient, Reply-To, timeout and provider idempotency", async () => {
      resetState();
      for (const need of contactNeeds) {
        const key = randomUUID();
        provider = async (_input, options) => {
          const headers = new Headers(options?.headers);
          assert.equal(headers.get("idempotency-key"), `vaeltx-brief/${key}`);
          assert.ok(options?.signal);
          const body = JSON.parse(String(options?.body));
          assert.deepEqual(body.to, ["vaeltxn@gmail.com"]);
          assert.equal(body.reply_to, valid.email);
          assert.ok(body.text.includes(`Help requested: ${need}`));
          return Response.json({ id: `test-${need}` });
        };
        const result = await POST(request({ ...valid, need }, key, `ip-${need}`));
        assert.equal(result.status, 200); assert.equal((await result.json()).ok, true);
      }
    });
    await t.test("repeated and simultaneous requests send only once; changed payload cannot reuse key", async () => {
      resetState(); const before = sends; const key = randomUUID();
      provider = async () => { await new Promise(resolve => setTimeout(resolve, 20)); return Response.json({ id: "one-receipt" }); };
      const responses = await Promise.all([POST(request(valid, key)), POST(request(valid, key))]);
      for (const response of responses) assert.equal(response.status, 200);
      assert.equal((await POST(request(valid, key))).status, 200);
      assert.equal(sends, before + 1);
      assert.equal((await POST(request({ ...valid, need: "Redesign" }, key))).status, 409);
      assert.equal(sends, before + 1);
    });
    await t.test("provider rejection, missing receipt and aborted request never produce success; retry remains possible", async () => {
      for (const mode of ["reject", "missing-id", "timeout"]) {
        resetState(); const key = randomUUID();
        provider = async () => {
          if (mode === "timeout") throw new DOMException("Timed out", "TimeoutError");
          if (mode === "missing-id") return Response.json({});
          return Response.json({ name: "validation_error", message: "Provider rejected request", statusCode: 403 }, { status: 403 });
        };
        const failure = await POST(request(valid, key)); assert.equal(failure.status, 502);
        const body = await failure.json(); assert.equal(body.ok, false); assert.ok(body.message.includes("answers are still here"));
        provider = async () => Response.json({ id: "retry-receipt" });
        assert.equal((await POST(request(valid, key))).status, 200);
      }
    });
    await t.test("four distinct attempts are rate limited while an accepted retry remains available", async () => {
      resetState(); const before = sends; const firstKey = randomUUID();
      provider = async () => Response.json({ id: "rate-test" });
      assert.equal((await POST(request(valid, firstKey))).status, 200);
      assert.equal((await POST(request(valid))).status, 200);
      assert.equal((await POST(request(valid))).status, 200);
      assert.equal((await POST(request(valid))).status, 429);
      assert.equal((await POST(request(valid, firstKey))).status, 200);
      assert.equal(sends, before + 3);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
    if (originalMode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Reflect.set(process.env, "NODE_ENV", originalMode);
    resetState();
  }
});
