import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  need: z.enum(["New website", "Redesign", "Landing page", "UX/UI system", "Ecommerce", "Implementation support", "Not sure yet"]),
  detail: z.string().trim().min(12).max(4000),
  site: z.union([z.literal(""), z.string().url().max(2048)]).optional().default(""),
  timing: z.string().trim().max(240).optional().default(""),
  website: z.string().max(0).optional().default(""),
});

export type ContactInput = z.infer<typeof contactSchema>;

export function contactFieldErrors(error: z.ZodError) {
  const labels: Record<string, string> = {
    name: "Enter your name so the reply can be addressed.",
    email: "Enter an email address I can reply to.",
    need: "Choose the kind of help you have in mind.",
    detail: "A sentence or two is enough — what needs to change?",
    site: "Enter a complete website URL, including https://, or leave it blank.",
  };
  return Object.fromEntries(error.issues.map(issue => [String(issue.path[0]), labels[String(issue.path[0])] ?? "Check this field and try again."]));
}
