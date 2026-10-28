-- Return on day 2 and day 7: a counted practice exactly one day and six days after the
-- first season's start date (so day 1 is the start date itself).
--
-- Completion events measure logged practice, not app opens. Only accounts whose
-- window has fully elapsed are in the denominator. Backfilled legacy accounts are
-- excluded; see README.md.
--
-- Read-only. Run as the project owner in the Supabase SQL editor.

with anchored as (
  select s.user_id, min(s.started_on) as started_on
  from public.seasons s
  where not exists (
    select 1 from public.plan_versions v
    where v.season_id = s.id and v.snapshot->>'source' = 'migrated'
  )
  group by s.user_id
),
activity as (
  select
    a.user_id,
    a.started_on,
    coalesce(bool_or(e.local_date = a.started_on + 1), false) as returned_day2,
    coalesce(bool_or(e.local_date = a.started_on + 6), false) as returned_day7
  from anchored a
  left join public.completion_events e
    on e.user_id = a.user_id
   and e.kind in ('full', 'easy')
   and e.undone_at is null
   and e.source <> 'migrated'
   and e.local_date between a.started_on and a.started_on + 6
  group by a.user_id, a.started_on
)
select
  count(*) filter (where started_on <= current_date - 1) as eligible_day2,
  count(*) filter (where started_on <= current_date - 1 and returned_day2) as returned_day2,
  round(
    100.0 * count(*) filter (where started_on <= current_date - 1 and returned_day2)
    / nullif(count(*) filter (where started_on <= current_date - 1), 0),
    1
  ) as day2_rate_pct,
  count(*) filter (where started_on <= current_date - 6) as eligible_day7,
  count(*) filter (where started_on <= current_date - 6 and returned_day7) as returned_day7,
  round(
    100.0 * count(*) filter (where started_on <= current_date - 6 and returned_day7)
    / nullif(count(*) filter (where started_on <= current_date - 6), 0),
    1
  ) as day7_rate_pct
from activity;
