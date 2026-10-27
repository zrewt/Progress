/**
 * Why a plan came from the on-device library instead of the model.
 *
 * The client used to fall back silently, which made "is this actually using
 * AI?" impossible to answer from the app. This is deliberately dependency-free
 * so it can be tested without a Supabase client or a device.
 */
export type FallbackReason = "off" | "unavailable" | "limit" | "rejected";

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_BAD_GATEWAY = 502;

export function fallbackReason(error: unknown, allowAi: boolean): FallbackReason {
  if (!allowAi) return "off";
  const status = (error as { context?: { status?: number } } | null | undefined)?.context?.status;
  if (status === HTTP_TOO_MANY_REQUESTS) return "limit";
  // The function answers 502 only after it rejected the model's draft itself.
  if (status === HTTP_BAD_GATEWAY) return "rejected";
  return "unavailable";
}
