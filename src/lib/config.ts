/**
 * User-facing configuration. Placeholders are clearly marked and must be filled
 * before release; never put a secret here.
 */
export const APP_VERSION = "1.0.0";

/** Date bounds apply to each new planning leg, not the ultimate goal. */
export const MIN_LEG_DAYS = 14;
export const MAX_LEG_DAYS = 112;

/** Bump when the consent wording changes; stored with the acceptance time. */
export const AI_CONSENT_VERSION = "2026-10-ai-3";

/** Set to true when the Supabase project requires email confirmation. */
export const EMAIL_VERIFICATION_REQUIRED = false;

/** Separate permission for sending optional chapter reflections to the AI. */
export const CHAPTER_REFLECTION_CONSENT_VERSION = "2026-10-chapter-1";

/** Public pages shown in Settings. Both are set in .env; never put a secret here. */
const PLACEHOLDER_HOST = "https://example.com/";
export const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim() || `${PLACEHOLDER_HOST}vitality-tree/support`;
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || `${PLACEHOLDER_HOST}vitality-tree/privacy`;

export function isPlaceholderUrl(url: string) {
  const lowered = url.trim().toLowerCase();
  return (
    !/^https:\/\//.test(lowered) ||
    lowered.startsWith(PLACEHOLDER_HOST) ||
    lowered.includes("your-domain.") ||
    lowered.includes(".example/")
  );
}

export function missingLinkNames(support: string, privacy: string) {
  return [
    isPlaceholderUrl(support) ? "EXPO_PUBLIC_SUPPORT_URL" : null,
    isPlaceholderUrl(privacy) ? "EXPO_PUBLIC_PRIVACY_URL" : null,
  ].filter((name): name is string => Boolean(name));
}

/**
 * Links that still need a real page. Development only warns about these, and
 * Settings shows them as coming soon instead of opening a dead URL, so the app
 * runs without published pages. The release checklist still requires both
 * values before a store build.
 */
export function missingLinkConfig() {
  return missingLinkNames(SUPPORT_URL, PRIVACY_URL);
}

/** Deep link used for password recovery; matches the app scheme. */
export const RESET_REDIRECT = "vitalitytree://reset-password";

export const AI_CONSENT_COPY = {
  title: "Before we draft your plan",
  sent: [
    "Your goal, in your own words",
    "The identity you chose",
    "Your target date, planning checkpoint and daily time budget",
    "What usually gets in the way and any optional answers you provide",
    "Your goal safety category and conservative-mode flag, when relevant; not your age bracket or exercise-screening answer",
    "Practice titles, a short progress summary and review note when available",
    "The current practice, days remaining, completed days, effort and your feedback when you request a weekly change",
    "With separate permission at a chapter review: what went well, what felt difficult, what to change, and whether the goal still fits",
  ],
  notSent: ["Your account name", "Your account email", "Individual completion notes"],
  detail:
    "These details go to our server and Google Gemini to draft questions and suggestions. Optional answers are saved with your season; you can change or remove them in settings. Existing plan text may still reflect them. Avoid sensitive health details. Emails, phone numbers and @handles are removed before sending, but this is not full anonymisation.",
  alternative:
    "You can decline and still get a complete plan built on this device, using the same curated practices. You can change this later in settings.",
} as const;
