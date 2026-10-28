# Retention queries (not applied)

These files are read-only analysis, not migrations. They create nothing, change nothing, and
must never be reachable by an app client: run them by hand in the Supabase **SQL editor** while
signed in as the project owner (the `postgres` role). Do not wrap them in an RPC, a view, or a
scheduled job exposed through PostgREST, and do not add them to `supabase/migrations/`.

## Running

1. Open Dashboard → SQL Editor → New query.
2. Paste one file at a time and run it.
3. Save or copy the result. Numbers are aggregates only; no email, goal text or note is returned.

They need the service/owner role because they read every account's rows at once. Row-level
security would otherwise limit the result to whichever account the SQL editor is acting as.

## Definitions used by every file

- **Cohort anchor**: each account's earliest `seasons.started_on`, the local date the first plan
  began.
- **New-app cohort**: accounts whose seasons are not backfilled migrations. A backfilled season
  has a `plan_versions` row with `snapshot->>'source' = 'migrated'`; those accounts experienced
  the old app, so they are excluded from onboarding and return rates rather than counted as
  new users who did not return.
- **Counted practice**: a `completion_events` row with `kind` in (`full`, `easy`), not undone,
  and not `source = 'migrated'`. Skips and rest days never count. Completion events measure
  logged practice, **not app opens**; a person can open the app without practising.
- **Onboarding completed**: a **labelled proxy**. It is counted as the first season created for
  an account, because the app only calls `start_next_season` after onboarding finishes and the
  plan preview is approved. It cannot see a person who started onboarding and stopped.
- **Eligibility**: an account is only included in a window when that whole window has elapsed,
  computed from `current_date` in UTC. Accounts younger than the window are excluded instead of
  being counted as churned.

Day numbering is "days after the first `started_on` date", so day 2 means the next calendar day
after the plan started (a practice on `started_on` itself is day 1). Week 1 is days 1–7 after
the start; week 3 is days 15–21.

## Files

| File | Measures |
| --- | --- |
| `01_onboarding_completion.sql` | First seasons created per week — labelled onboarding proxy. |
| `02_day2_and_day7_return.sql` | Share of eligible accounts that logged a counted practice on day 2 and on day 7. |
| `03_week1_completion.sql` | Share that logged at least one counted practice in week 1, plus the average number of counted days. |
| `04_week3_active.sql` | Share still logging a counted practice in week 3. |
| `05_seasons_per_week.sql` | Seasons created per week, split into first seasons and later seasons, with plan source. |

## Cautions

- Time zones: `started_on` and `completion_events.local_date` are the person's local calendar
  dates, while `current_date` here is UTC. Eligibility can therefore be one day conservative
  near the boundary. That is preferable to including an account whose window has not finished.
- Small samples: with few users per week, one person changes the percentage a lot. Report counts
  next to every rate.
- These queries are for learning, not for enforcement. Do not use them to email, pressure or
  rank individual people.
