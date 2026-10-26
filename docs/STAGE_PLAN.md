# Vitality Tree staged implementation

Baseline: `a8a4509` (`baseline-before-premium`). Audit performed against the active Expo application, all files under `src/`, `App.tsx`, app/config files, schema, and generation function. The Next.js archive is not an application route or a second implementation to maintain.

## Current database

`profiles`: id UUID PK/FK auth.users cascade; display_name, identity, goal, time_budget text; level integer default 1, xp/streak integers default 0; last_completed_date date; season_started_at/created_at/updated_at timestamptz default now. Profile update trigger touches updated_at.

`nodes`: composite PK (user_id UUID FK auth.users cascade, node_id text); pillar in body/mind/craft/connection; tier 0–3; title text; duration/description nullable text; instructions JSONB default []; status locked/active/completed default locked; completed_at nullable timestamptz. user_id index.

Both tables have owner `FOR ALL` RLS policies. Rewards and unlocks are client writable. Existing schema contains destructive legacy-pillar cleanup: **do not rerun it on production as a migration**.

## Current screens and routes

No router. `App.tsx` switches SetupRequired → LoadingScreen → AuthScreen → Onboarding → Dashboard using GameProvider. Dashboard opens NodeModal as a native modal and renders TopBar/SkillTree; Celebration overlays completion feedback. Auth has sign-in/sign-up tabs only. Onboarding has identity, goal/blocker, budget, preview. Scheme `vitalitytree` exists but no recovery handler. All design primitives are in src/components; src/theme.ts is the design source.

## Findings verified and corrections

- A–G in APP_STORE_READINESS.md match current active code: 16 finite nodes, split profile/node writes, absent metadata, inconsistent variants, split regex safety, weak themes, unsafe read-error regeneration and unguarded account-switch requests.
- Evening-food requests already pass the current regex; retain that, do not undo it.
- Profiles/nodes alone cannot reconstruct missing blocker/summary/focus/provenance. Migration must explicitly label unknown historical metadata, never claim it recovered it.
- The repository/backup audit paragraph is now obsolete: Git and the verified baseline exist. Lint tooling is already committed and must not be removed.
- No local Docker, psql, or Supabase CLI was found. Embedded PostgreSQL tests will be attempted. They cannot prove live JWT gateway behavior or native device behavior.
- The old schema deletes legacy nodes. New migrations must preserve old tables and reject ambiguous backfill instead of silently discarding progress.
- Existing XP already includes completed-node rewards. Backfill must not add event rewards on top of that balance.

## Stage 1 — stage-1-daily-loop

Add versioned migrations under supabase/migrations for seasons, practices, milestones, events, grants, RPC-only progress writes, full plan snapshots and conservative backfill. Add src/lib/progression.ts, daily types/data layer and local SQL/logic tests. Replace profile/node upserts in src/lib/game-context.tsx. Adapt App.tsx load/error states and the tree adapter only as needed. Retain original tables read-only for rollback. Commit audit first, then tested Stage 1 implementation; push without merging.

## Stage 2 — stage-2-useful-day (from Stage 1)

Add src/lib/plans with ten deterministic themes, bounded full/easy variants, plan alternatives; update gemini/onboarding preview, Dashboard/NodeModal/SkillTree/TopBar/Celebration for repeatable Today/history/undo, plan edit/replace, absence return, review and season archive/continuation. Add weekly_reviews migration/RPC, adaptation helpers/tests and docs/CONTENT_REVIEW.md. Preserve theme and shared controls; no router, redesign, notifications or billing.

## Stage 3 — stage-3-trust-release (from Stage 2)

Add settings/consent/recovery screens, auth/deep-link configuration, deletion Edge Function, canonical shared safety/plan validators, generation quota migration, hardened generate-tree, per-user offline queue/cache, foreground/connectivity synchronization and actual sync states. Fix lint causes in touched and existing active screens/animations; SDK-compatible patch/dependency review; test script and GitHub Actions. Add RLS two-account script, DECISIONS.md, docs/PRIVACY_DATA.md, docs/RELEASE_CHECKLIST.md. Do not deploy or mutate remote data.

## Verification and approval gates

Use Node tests for deterministic rules and embedded PostgreSQL for migration/backfill/RLS/RPC transactions if available. Run strict typecheck, unchanged lint rules, automated tests, web bundle and user-facing DOM checks where possible. Test account switch guards, retries/duplicates, timezone/DST, undo, archive, variants, adaptations, queue replay and consent. Document native/email/live-RLS limitations honestly.

No migration, Edge Function deployment, live writes or main merge is authorized. A change requiring an Expo-Go-incompatible native module or an untestable lossy backfill requires explicit approval. Stages 2/3 can proceed against local/mock storage while live database approval is pending. Final report must distinguish implemented code, locally tested behavior, and production approval/manual setup still needed.
