# Privacy and data

Vitality Tree stores what it needs to show one person their own progress. There is no
advertising, no analytics SDK, and no selling of data.

## What is collected

| Data | Why | Where |
| --- | --- | --- |
| Email and password | Sign-in. Passwords are hashed by the auth provider and never visible to the app. | Supabase Auth |
| Display name (optional) | Greeting on the dashboard. | `profiles.display_name` |
| Identity, goal, blocker, time budget | Builds and explains the plan. | `seasons`, `profiles.blocker` |
| Time zone | Turns a moment into the right local day for streaks and reviews. | `profiles.timezone` |
| Practices and plan text | What the plan promised, kept so a relaunch shows the same plan. | `seasons`, `practices`, `plan_versions` |
| Practice events: full/easy/skip/rest, time, effort 1–5 (optional), note up to 280 characters | Progress, streaks, milestones, weekly reviews, undo. | `completion_events` |
| Weekly review difficulty and note (optional) | Adapts the next week. | `weekly_reviews` |
| AI consent version and time | Proves permission was given before any AI call. | `profiles.ai_consent_version/at` |
| Daily generation counter | Stops runaway model spend. | `generation_usage` |
| Legacy XP grant | Preserves progress earned before seasons existed. | `legacy_xp_grants` |

Notes are free text. The app warns that anything typed may be sensitive and never asks for
medical details. Do not ask users for health records, and do not add analytics without
updating this document and the consent screen.

## AI

- Only the goal text, identity, time budget and blocker are sent, and only after the user
  accepts the consent screen. Consent version and time are stored.
- Emails, phone numbers and @handles are removed automatically before sending. This is
  redaction, not anonymisation; the rest of the text is sent as written.
- The server forwards the text to Google Gemini. Keys live in Supabase secrets and are
  never in the app bundle.
- Declining consent does not remove any feature: the same curated plan library builds the
  plan on the device. Consent can be withdrawn in settings at any time, which stops all
  further AI calls.

## Storage and retention

- Data lives in the project's Supabase Postgres database, protected by row-level security
  that only allows the owner to read their own rows. Reward and progress writes go through
  functions; the client cannot edit XP, streaks or events directly.
- History is kept for as long as the account exists. Nothing is silently expired; a user
  can archive a season, which retains it in their history.
- Migrated legacy rows (`profiles`, `nodes`) are retained read-only for rollback and are
  not shown as separate history.

## Deletion

- Settings → Delete my account asks for confirmation, then calls the `delete-account`
  Edge Function. It verifies the caller's token and deletes the auth user; every table
  cascades from `auth.users`, including seasons, practices, milestones, events, reviews,
  plan versions, legacy grants, consent fields and quota rows.
- Deletion is immediate and cannot be undone. There is no soft-delete or backup copy
  inside the app. Project-level database backups follow the Supabase plan's retention and
  are outside the app's control; document the chosen retention before release.

## Support and privacy links

`src/lib/config.ts` holds the support and privacy URLs. They are placeholders and must be
replaced with real pages before release.
