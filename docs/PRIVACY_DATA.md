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
| Weekly review difficulty and note (optional) | Helps propose an adaptation for the next week. | `weekly_reviews` |
| Optional personalization questions and answers | Inform the current season and later suggestions. | `seasons.personalization_context`, initially also in `plan_versions.snapshot` |
| AI consent version and time | Proves permission was given before any AI call. | `profiles.ai_consent_version/at` |
| Daily generation counter | Stops runaway model spend. | `generation_usage` |
| Legacy XP grant | Preserves progress earned before seasons existed. | `legacy_xp_grants` |

Notes are free text. The app warns that anything typed may be sensitive and never asks for
medical details. Do not ask users for health records, and do not add analytics without
updating this document and the consent screen.

## AI

- With consent, the goal, identity, time budget and blocker are sent. When a previous
  season has activity, a small progress summary, practice titles and the latest review
  note may also be sent. Individual completion notes are not sent.
- With consent, optional personalization answers are sent when drafting or revising a plan,
  or proposing a weekly practice change. A weekly proposal also sends the current practice,
  the review note and the number of practiced days. Users should avoid sensitive health information.
- Emails, phone numbers and @handles are removed automatically before sending free text.
  This is redaction, not anonymisation; other details may still identify a person.
- The server forwards the text to Google Gemini. Keys live in Supabase secrets and are
  never in the app bundle.
- Declining or withdrawing consent prevents further AI requests; a curated starter plan
  can be built on the device instead. It is not as personalized as an AI plan.

## Storage and retention

- Data lives in the project's Supabase Postgres database, protected by row-level security
  that only allows the owner to read their own rows. Reward and progress writes go through
  functions; the client cannot edit XP, streaks or events directly.
- History is kept for as long as the account exists. Nothing is silently expired; a user
  can archive a season, which retains it in their history.
- Settings can change or remove the current season's saved answers. This also removes the
  original answer fields from that season's plan-version snapshots. Existing plan text,
  practice text or review notes may still reflect details previously supplied; editing
  answers alone does not rewrite or delete those records.
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
