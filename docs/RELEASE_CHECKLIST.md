# Release checklist

Nothing in this repository has been applied to the live Supabase project. Each step below
needs a human decision, and a backup before any migration runs.

## 1. Database (approval required)

Apply in order, newest last, from `supabase/migrations/`:

1. `202610250001_daily_loop.sql` — seasons, practices, milestones, events, legacy grants, RPCs.
2. `202610250002_backfill.sql` — converts existing profiles/nodes into a first season; preserves XP as a one-time grant and marks inferred dates.
3. `202610250003_weekly_review_and_edits.sql` — weekly reviews, plan editing, replacement, season history.
4. `202610250004_consent_and_quota.sql` — consent bookkeeping and the per-user daily generation quota.

Before applying:
- Take a database backup and record its location.
- Confirm the backfill on a staging copy: row counts in `completion_events`, sum of XP in
  `get_progress`, and that `profiles`/`nodes` are unchanged.
- Do **not** re-run the original `supabase/schema.sql` on production: it contains destructive
  legacy pillar cleanup.

Rollback notes are at the top of each migration. Keep new tables and history; never drop
them to roll back a client release.

## 2. Edge Functions (approval required)

- `generate-tree`:
  - `supabase secrets set GEMINI_API_KEY=<key> GEMINI_MODEL=gemini-2.5-flash`
  - `supabase functions deploy generate-tree`
- `delete-account`:
  - `supabase secrets set SERVICE_ROLE_KEY=<service role key>`
  - `supabase functions deploy delete-account`
  - The function verifies the caller's token and refuses unconfirmed requests.
- After deploying either function, run one signed-in request and confirm a generic error
  (not raw upstream detail) on failure.

## 3. Auth configuration

- Set the password-recovery redirect to `vitalitytree://reset-password` in the Supabase
  auth settings, and keep `app.json` scheme `vitalitytree`.
- Decide whether email confirmation is required:
  - The app reads `EMAIL_VERIFICATION_REQUIRED` in `src/lib/config.ts`.
  - Set it to `true` only if the Supabase project requires confirmation; the sign-up copy
    and messages already handle both cases.
  - Record the decision in `DECISIONS.md`.
- Test recovery end to end on a device: request → email → deep link → new password → sign in.

## 4. Content and legal (needs review)

- Domain review of the sleep and nutrition themes (`docs/CONTENT_REVIEW.md`).
- Confirm crisis resources for each launch region in `CRISIS_RESOURCES`.
- Replace `SUPPORT_URL` and `PRIVACY_URL` placeholders in `src/lib/config.ts`.
- Publish the privacy policy, using `docs/PRIVACY_DATA.md` as the source.

## 5. Verification before submission

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run safety:check` (CI runs all four).
- Two-account RLS isolation: create two test accounts, set
  `TEST_USER_A_EMAIL/PASSWORD` and `TEST_USER_B_EMAIL/PASSWORD`, then exercise the app and
  confirm neither account can read the other's seasons, events or reviews. Not run in this
  environment: no test accounts were available.
- Offline: complete a practice with the device offline, reopen the app, and confirm the
  entry syncs once and is not double-counted.
- Accessibility pass on the screens touched: labels, 44pt targets, large text, reduced
  motion.
- Rotate any key that was ever present in a client bundle, `.expo` logs or old builds.

## 6. Out of scope for this work

Billing and entitlements, EAS/signed builds and store listing, push notifications,
analytics, social features, HealthKit, and visual redesign. Those remain Stage 4/5.
