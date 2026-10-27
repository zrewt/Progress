/**
 * Why a plan came from the on-device library instead of the model.
 *
 * The client used to fall back silently, which made "is this actually using
 * AI?" impossible to answer from the app. This is deliberately dependency-free
 * so it can be tested without a Supabase client or a device.
 */
export type FallbackReason =
  | "off"
  | "consent"
  | "limit"
  | "rejected"
  | "setup"
  | "unavailable";

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_BAD_GATEWAY = 502;

/**
 * Why the on-device library wrote the plan.
 *
 * The function's own `code` is trusted before the HTTP status, because "no key
 * configured", "no consent on the account" and "the model was unreachable" are
 * three different problems with three different fixes, and they all used to
 * arrive as one line saying the AI could not be reached.
 */
export function fallbackReason(
  error: unknown,
  allowAi: boolean,
  code?: string | null,
): FallbackReason {
  if (!allowAi) return "off";
  if (code === "consent") return "consent";
  if (code === "quota") return "limit";
  if (code === "rejected") return "rejected";
  if (code === "no_key") return "setup";
  const status = (error as { context?: { status?: number } } | null | undefined)?.context?.status;
  if (status === HTTP_TOO_MANY_REQUESTS) return "limit";
  // The function answers 502 only after it rejected the model's draft itself.
  if (status === HTTP_BAD_GATEWAY) return "rejected";
  return "unavailable";
}
