# Release checklist

Nothing in this repository has been applied to the live Supabase project. Each step below
needs a human decision, and a backup before any migration runs.

## 1. Database (approval required)

For a project that has applied none of the new schema, paste
`supabase/apply_all_stages.sql` into the SQL editor once. It is all eight files below, merged
in filename order, wrapped in a single transaction — apply it as one unit and do not split it.
On a project that has already applied some migrations, do **not** run the whole bundle: the
first "already exists" aborts the transaction, so apply only the newer files, in order.

1. `202610250001_daily_loop.sql` — seasons, practices, milestones, events, legacy grants, RPCs.
2. `202610250002_backfill.sql` — converts existing profiles/nodes into a first season; preserves XP as a one-time grant and marks inferred dates.
3. `202610250003_weekly_review_and_edits.sql` — weekly reviews, plan editing, replacement, season history.
4. `202610250004_consent_and_quota.sql` — consent bookkeeping and the per-user daily generation quota.
5. `202610250005_personalization.sql` — saved personalization answers and their RPC.
6. `202610270001_target_dates.sql` — target date, leg length, scaled stages and milestones, accepted weekly detail.
7. `202610270002_safety.sql` — age bracket, conservative mode, goal category, pain handling, signup age trigger.
8. `202610280001_midweek_adaptation.sql` — owner-only `set_lighter_week` used by the mid-week offer.

`apply_all_stages.sql` is generated from the migration files, so it must not be edited by hand.
`tests/sql-bundle.test.mjs` fails when it drifts from the migrations, and applies the whole
bundle to an empty embedded Postgres (PGlite) to prove it runs, then confirms a second run
aborts without undoing the first. The rest of the suite runs every migration file in filename
order, covering backfill XP preservation, idempotent retry, denied direct XP writes, plan
versions, weekly adaptation, consent, quota, two-user isolation, target dates, signup age and
the mid-week lighter week.

Before applying:
- Take a database backup and record its location.
- Confirm the backfill on a staging copy: row counts in `completion_events`, sum of XP in
  `get_progress`, and that `profiles`/`nodes` are unchanged.
- Do **not** re-run the original `supabase/schema.sql` on production: it contains destructive
  legacy pillar cleanup.

Rollback notes are at the top of each migration. Keep new tables and history; never drop
them to roll back a client release.

### Verify after applying (read-only)

```sql
-- 1. Every existing account got exactly one active season.
select count(*) as accounts_without_active
from public.profiles p
where not exists (select 1 from public.seasons s where s.user_id = p.id and s.status = 'active');

-- 2. Legacy XP survived (compare against the backup's sum).
select (select coalesce(sum(xp), 0) from public.legacy_xp_grants) as granted,
       (select coalesce(sum(xp), 0) from public.profiles) as original;

-- 3. Migrated events match the completed legacy nodes, and inferred dates are labelled.
select source, date_inferred, count(*)
from public.completion_events group by 1, 2 order by 1, 2;

-- 4. Credit cannot be written by the app.
select has_column_privilege('authenticated', 'public.profiles', 'xp', 'update') as client_can_write_xp;
```

Each query above must return 0 / matching totals / `false` as labelled. If query 4 returns
true, stop and re-run the grant statements from `202610250001_daily_loop.sql`.

## 2. Edge Functions (approval required)

- `generate-tree`:
  - `supabase secrets set GEMINI_API_KEY=<key>` (the function defaults to `gemini-3.8-flash` and falls back to `gemini-3.6-flash` when a name is retired; set `GEMINI_MODEL` only to pin a different model)
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
- Confirm crisis resources for each launch region in `CRISIS_RESOURCES` (`src/lib/safety-rules.ts`),
  then run `npm run safety:sync` so the Edge Function copy matches. `npm run safety:check` fails otherwise.
- Set `EXPO_PUBLIC_SUPPORT_URL` and `EXPO_PUBLIC_PRIVACY_URL` in `.env` and in the EAS
  build environment. The app throws at start-up in development while either is missing or a
  placeholder (an `example.com`/`your-domain` URL), so a dead Settings link is caught before
  a build. Neither value may be a secret; both are public pages.
- Publish the privacy policy. `docs/PRIVACY_POLICY.md` is the draft to review and publish;
  `docs/PRIVACY_DATA.md` is the internal inventory it was written from.

## 5. Verification before submission

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run safety:check` (CI runs all four).
- Two-account RLS isolation: create two test accounts, add `TEST_A_EMAIL`, `TEST_A_PASSWORD`,
  `TEST_B_EMAIL`, `TEST_B_PASSWORD` to `.env`, then run `npm run test:rls`. It exits 0 with
  `NOT RUN` when the accounts are absent, so read the output rather than the exit code.
  Not run in this environment: no test accounts were available.
- Offline: complete a practice with the device offline, reopen the app, and confirm the
  entry syncs once and is not double-counted.
- Accessibility pass on the screens touched: labels, 44pt targets, large text, reduced
  motion.
- Rotate any key that was ever present in a client bundle, `.expo` logs or old builds.

## 6. Builds (EAS)

`eas.json` defines three profiles, each carrying the public `EXPO_PUBLIC_SUPABASE_*` values
so a cloud build is not missing its configuration. These are public by design (they ship in
the bundle); RLS is what protects data.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                 # links the project, writes extra.eas.projectId
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform all
```

`development` needs `expo-dev-client` (already installed) and never goes to a store. Use it
to test the recovery deep link, notifications and device behaviour that Expo Go cannot
reproduce. `preview` is a release-like `.apk` for stakeholders. `production` produces the
store binaries and is the only profile to submit with `eas submit`.

Before the first iOS build: an Apple Developer Program membership ($99/year) is required, and
`eas init` must be run while signed in. Google Play submission needs a $25 one-time
membership; internal `.apk` builds need neither.

## 7. Out of scope for this work

Billing and entitlements, EAS/signed builds and store listing, push notifications,
analytics, social features, HealthKit, and visual redesign. Those remain Stage 4/5.

## 8. TestFlight readiness: gaps found in eas.json

Read-only review of `eas.json` and `app.json`; nothing was built or submitted.

Present:
- A `production` profile that carries the public Supabase URL and publishable key.
- A `submit.production` block (currently empty).
- `app.json` has the iOS bundle identifier `app.vitalitytree.mobile`, build number `1`, and the
  `expo-notifications` config plugin (local notifications only, no remote push).

Missing before a TestFlight upload:
1. **Project link.** No `extra.eas.projectId` in `app.json`; run `eas init` while signed in to
   create/link the EAS project.
2. **Submit credentials.** `submit.production` has no iOS entry. It needs `appleId` (or an App
   Store Connect API key), `ascAppId` and `appleTeamId` before `eas submit --platform ios`.
3. **Build number.** `app.json` fixes `ios.buildNumber` at `"1"` and the production profile has
   no `autoIncrement`. A second TestFlight upload of the same number is rejected: set
   `"autoIncrement": true` on `build.production` (and the same for Android's `versionCode`).
4. **Version source.** No `cli.appVersionSource`; with a fixed build number the source is local
   and easy to forget. Remote versioning is the safer default once EAS is linked.
5. **Apple-side assets, not stored in the repo.** Apple Developer Program membership, an App
   Store Connect app record with the same bundle identifier, a distribution certificate and a
   provisioning profile (`eas credentials`), and an App Store Connect API key for a
   non-interactive submit.
6. **Export compliance.** No `ios.config.usesNonExemptEncryption` answer. The app only uses
   HTTPS, so setting it to `false` avoids answering the question on every build.
7. **Store metadata.** A live privacy policy URL (matching `PRIVACY_URL`), a support URL, an
   age rating and screenshots are required by TestFlight/App Store Connect and are not
   expressible in `eas.json`.
8. **Platform scope.** `eas build --profile production` builds every platform by default; a
   TestFlight build only needs `--platform ios`.
9. **EAS Update (optional).** No `channel` or `environment` is configured. Only needed if
   over-the-air updates are intended; adding it later requires another native build.

Not required for this app: an APNs key or `expo-notifications` push credentials, because all
reminders are scheduled locally on the device.
