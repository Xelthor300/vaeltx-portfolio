import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { AuctionError } from "./server";
import { smtpPasswordReady, type MailTransport } from "./delivery-policy";

export type MailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};
export function emailTransport() {
  const kind = (process.env.AUCTION_EMAIL_TRANSPORT || "resend").trim();
  const missing = ["AUCTION_EMAIL_FROM", "AUCTION_ADMIN_EMAIL"].filter(
    (key) => !process.env[key]?.trim(),
  );
  if (missing.length)
    throw new AuctionError(
      `Email configuration missing: ${missing.join(", ")}.`,
      503,
      "configuration_pending",
    );
  if (kind === "smtp") {
    const {
      AUCTION_SMTP_HOST: host,
      AUCTION_SMTP_USER: user,
      AUCTION_SMTP_PASSWORD: password,
    } = process.env;
    const port = Number(process.env.AUCTION_SMTP_PORT || 465);
    if (
      !host ||
      !user ||
      !password ||
      !smtpPasswordReady(password, host) ||
      ![465, 587].includes(port)
    )
      throw new AuctionError("SMTP credentials are not configured.", 503);
    const mailer = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user, pass: password.replace(/\s/g, "") },
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      dnsTimeout: 10000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    return {
      kind: "smtp" as MailTransport,
      verify: async () => {
        await mailer.verify();
      },
      send: async (message: MailMessage, id: string) => {
        // One recipient per outbox row; never CC/BCC the private owner address.
        const messageId = `<va-outbox-${id}@${user.split("@")[1]}>`;
        const result = await mailer.sendMail({ ...message, messageId });
        if (
          !result.accepted?.some(
            (r) => String(r).toLowerCase() === message.to.toLowerCase(),
          )
        )
          throw new Error("SMTP acceptance receipt missing.");
        return result.messageId;
      },
    };
  }
  if (kind !== "resend" || !process.env.AUCTION_RESEND_API_KEY)
    throw new AuctionError(
      "Email transport or provider credential is not configured.",
      503,
      "configuration_pending",
    );
  const resend = new Resend(process.env.AUCTION_RESEND_API_KEY);
  return {
    kind: "resend" as MailTransport,
    verify: async () => {},
    send: async (message: MailMessage, id: string) => {
      const result = await resend.emails.send(message, {
        idempotencyKey: `va-outbox:${id}`,
      });
      if (result.error || !result.data?.id)
        throw new Error("Provider rejected delivery.");
      return result.data.id;
    },
  };
}
