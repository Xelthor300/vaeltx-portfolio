import type { ContactInput } from "./contact";

export function createInquiryEmail(brief: ContactInput) {
  return {
    from: "VAELTX <onboarding@resend.dev>",
    to: ["vaeltxn@gmail.com"],
    replyTo: brief.email,
    subject: `New VAELTX project inquiry / ${brief.name.replace(/[\r\n]+/g, " ")}`,
    text: [
      "New VAELTX project inquiry", "",
      `Name: ${brief.name}`, `Email: ${brief.email}`, `Help requested: ${brief.need}`,
      `Current site: ${brief.site || "Not provided"}`, `Timing: ${brief.timing || "Not provided"}`,
      "", "What needs to change:", brief.detail,
    ].join("\n"),
  };
}
