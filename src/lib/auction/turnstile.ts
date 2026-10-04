import { z } from "zod";
export const captchaTokenSchema = z.string().min(10).max(2048);
export type ChallengeAction = "setup" | "bid";
export function validChallengeResult(
  result: { success?: boolean; hostname?: string; action?: string },
  hostname: string,
  action: ChallengeAction,
) {
  return (
    result.success === true &&
    result.hostname === hostname &&
    result.action === action
  );
}
