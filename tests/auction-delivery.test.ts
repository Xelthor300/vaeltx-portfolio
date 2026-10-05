import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dispatchDelivery,
  smtpDefinitelyRejected,
  smtpPasswordReady,
  type DeliveryRecord,
} from "../src/lib/auction/delivery-policy";
import {
  captchaTokenSchema,
  validChallengeResult,
} from "../src/lib/auction/turnstile";

const now = Date.now();
test("Gmail requires an actual application password and rejects placeholders or a normal OTP", () => {
  assert.equal(
    smtpPasswordReady("TU_CONTRASEÑA_DE_APLICACION", "smtp.gmail.com"),
    false,
  );
  assert.equal(smtpPasswordReady("123456", "smtp.gmail.com"), false);
  assert.equal(smtpPasswordReady(undefined, "smtp.gmail.com"), false);
  assert.equal(
    smtpPasswordReady("abcd efgh ijkl mnop", "smtp.gmail.com"),
    true,
  );
});
const record: DeliveryRecord = {
  id: "qa-message",
  first_attempt_at: new Date(now).toISOString(),
};
function fixture(
  overrides: Partial<Parameters<typeof dispatchDelivery>[2]> = {},
) {
  const calls: string[] = [];
  const effects = {
    now,
    beginSMTP: async () => {
      calls.push("persist-start");
    },
    send: async () => {
      calls.push("network-send");
      return "provider-receipt";
    },
    sent: async (receipt: string) => {
      calls.push("persist-receipt:" + receipt);
    },
    failed: async (review: boolean) => {
      calls.push(review ? "manual-review" : "retry");
    },
    ...overrides,
  };
  return { calls, effects };
}
test("SMTP persists the attempted-send marker before touching the network and records acceptance", async () => {
  const f = fixture();
  await dispatchDelivery(record, "smtp", f.effects);
  assert.deepEqual(f.calls, [
    "persist-start",
    "network-send",
    "persist-receipt:provider-receipt",
  ]);
});
test("SMTP accepted message with failed receipt persistence is held, never automatically resent", async () => {
  const f = fixture({
    sent: async () => {
      throw new Error("database unavailable");
    },
  });
  await dispatchDelivery(record, "smtp", f.effects);
  assert.deepEqual(f.calls, ["persist-start", "network-send", "manual-review"]);
  const retry = fixture();
  await dispatchDelivery(
    { ...record, smtp_attempt_started_at: new Date(now).toISOString() },
    "smtp",
    retry.effects,
  );
  assert.deepEqual(retry.calls, ["manual-review"]);
});
test("SMTP disconnect during DATA or after unknown acceptance is held for reconciliation", async () => {
  const f = fixture({
    send: async () => {
      throw { code: "ETIMEDOUT", command: "DATA" };
    },
  });
  await dispatchDelivery(record, "smtp", f.effects);
  assert.deepEqual(f.calls, ["persist-start", "manual-review"]);
});
test("An explicit SMTP rejection may retry; a failure to persist the starting marker never sends", async () => {
  const rejected = fixture({
    send: async () => {
      throw { responseCode: 451, command: "DATA" };
    },
  });
  await dispatchDelivery(record, "smtp", rejected.effects);
  assert.deepEqual(rejected.calls, ["persist-start", "retry"]);
  const missingMarker = fixture({
    beginSMTP: async () => {
      throw new Error("write failed");
    },
  });
  await dispatchDelivery(record, "smtp", missingMarker.effects);
  assert.deepEqual(missingMarker.calls, ["manual-review"]);
  assert.equal(
    smtpDefinitelyRejected({ command: "AUTH", code: "EAUTH" }),
    true,
  );
  assert.equal(
    smtpDefinitelyRejected({ command: "DATA", code: "ECONNECTION" }),
    false,
  );
});
test("Transport migration cannot resend an unresolved message through a different provider", async () => {
  const f = fixture();
  await dispatchDelivery(
    { ...record, delivery_transport: "smtp" },
    "resend",
    f.effects,
  );
  assert.deepEqual(f.calls, ["manual-review"]);
});
test("Resend retries within its idempotency window and holds receipts beyond it", async () => {
  const failure = fixture({
    sent: async () => {
      throw new Error("write lost");
    },
  });
  await dispatchDelivery(record, "resend", failure.effects);
  assert.deepEqual(failure.calls, ["network-send", "retry"]);
  const stale = fixture();
  await dispatchDelivery(
    {
      ...record,
      first_attempt_at: new Date(now - 24 * 3600_000).toISOString(),
    },
    "resend",
    stale.effects,
  );
  assert.deepEqual(stale.calls, ["manual-review"]);
});
test("Turnstile requires actual success, exact hostname, expected action, and bounded token input", () => {
  const r = {
    success: true,
    hostname: "vaeltx-portfolio.vercel.app",
    action: "setup",
  };
  assert.equal(validChallengeResult(r, r.hostname, "setup"), true);
  for (const invalid of [
    { ...r, success: false },
    { ...r, hostname: "attacker.example" },
    { ...r, action: "signin" },
  ])
    assert.equal(validChallengeResult(invalid, r.hostname, "setup"), false);
  assert.equal(captchaTokenSchema.safeParse("x".repeat(2049)).success, false);
  assert.equal(captchaTokenSchema.safeParse("").success, false);
});
