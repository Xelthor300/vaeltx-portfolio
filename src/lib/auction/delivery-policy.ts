export type MailTransport = "resend" | "smtp";
export function smtpPasswordReady(
  password: string | undefined,
  host: string | undefined,
) {
  if (!password || /TU_CONTRASEÑA|YOUR_APP_PASSWORD|CHANGE_ME/i.test(password))
    return false;
  return (
    host !== "smtp.gmail.com" ||
    /^[A-Za-z0-9]{16}$/.test(password.replace(/\s/g, ""))
  );
}
export type DeliveryRecord = {
  id: string;
  first_attempt_at: string;
  delivery_transport?: MailTransport | null;
  smtp_attempt_started_at?: string | null;
};
export function smtpDefinitelyRejected(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { responseCode?: number; command?: string };
  return (
    (typeof e.responseCode === "number" &&
      e.responseCode >= 400 &&
      e.responseCode <= 599) ||
    ["CONN", "AUTH", "EHLO", "HELO", "MAIL FROM", "RCPT TO"].includes(
      e.command || "",
    )
  );
}
export async function dispatchDelivery(
  record: DeliveryRecord,
  transport: MailTransport,
  effects: {
    now: number;
    beginSMTP: () => Promise<void>;
    send: () => Promise<string>;
    sent: (receipt: string) => Promise<void>;
    failed: (review: boolean, reason: string) => Promise<void>;
  },
) {
  if (record.delivery_transport && record.delivery_transport !== transport) {
    await effects.failed(
      true,
      "Transport changed; reconcile previous delivery before sending.",
    );
    return;
  }
  if (transport === "smtp" && record.smtp_attempt_started_at) {
    await effects.failed(
      true,
      "Previous SMTP attempt has no durable receipt; reconcile before resending.",
    );
    return;
  }
  if (
    transport === "resend" &&
    effects.now - Date.parse(record.first_attempt_at) > 23 * 3600_000
  ) {
    await effects.failed(
      true,
      "Provider idempotency window elapsed; reconcile before resending.",
    );
    return;
  }
  let accepted = false;
  try {
    if (transport === "smtp") await effects.beginSMTP();
    const receipt = await effects.send();
    accepted = true;
    await effects.sent(receipt);
  } catch (error) {
    const review =
      transport === "smtp" && (accepted || !smtpDefinitelyRejected(error));
    await effects.failed(
      review,
      review
        ? "SMTP delivery or receipt is uncertain; manual reconciliation required, no automatic resend."
        : "Provider rejected delivery or receipt persistence failed; retry with the same message identity.",
    );
  }
}
