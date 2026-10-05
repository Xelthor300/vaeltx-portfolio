export const VERIFICATION_COOLDOWN_SECONDS = 60;
export function maskEmail(email: string) {
  const [local,domain] = email.trim().split("@");
  if (!domain) return "your email address";
  return `${local.slice(0,1)}•••@${domain}`;
}
export const verificationGuidance = {
  title: "CHECK YOUR EMAIL",
  folders: "If it does not arrive within a few minutes, check Spam, Junk and Promotions.",
  delivery: "If the VAELTX email appears in Spam or Junk, open it and select Not spam. This can help your email provider recognize future VAELTX messages as expected.",
  types: "Important messages include outbid alerts, winner notification, payment deadline reminders, payment confirmation and onboarding availability.",
  contacts: "You can add vaeltxn@gmail.com to your contacts. In Gmail, move an expected message from Promotions to Primary if you want it easier to notice. These actions do not guarantee Inbox or Primary delivery.",
};
