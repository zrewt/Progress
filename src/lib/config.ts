/**
 * User-facing configuration. Placeholders are clearly marked and must be filled
 * before release; never put a secret here.
 */
export const APP_VERSION = "1.0.0";

/** Bump when the consent wording changes; stored with the acceptance time. */
export const AI_CONSENT_VERSION = "2026-10-ai-1";

/** Set to true when the Supabase project requires email confirmation. */
export const EMAIL_VERIFICATION_REQUIRED = false;

export const SUPPORT_URL = "https://example.com/vitality-tree/support"; // TODO: replace before release
export const PRIVACY_URL = "https://example.com/vitality-tree/privacy"; // TODO: replace before release

/** Deep link used for password recovery; matches the app scheme. */
export const RESET_REDIRECT = "vitalitytree://reset-password";

export const AI_CONSENT_COPY = {
  title: "Before we draft your plan",
  sent: [
    "Your goal, in your own words",
    "The identity you chose",
    "Your daily time budget",
    "What usually gets in the way",
  ],
  notSent: ["Your name", "Your email", "Your progress and history"],
  detail:
    "These four things go to our server and then to Google Gemini to draft suggestions. Emails, phone numbers and @handles are removed automatically first, but that is not full anonymisation — anything else you type is sent as written.",
  alternative:
    "You can decline and still get a complete plan built on this device, using the same curated practices. You can change this later in settings.",
} as const;
