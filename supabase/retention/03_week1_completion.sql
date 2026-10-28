-- Week 1 completion: among accounts whose first seven days have fully elapsed, how many
-- logged at least one counted practice (full or easy) in days 1-7, and how many days on
-- average. Only accounts whose window has fully elapsed are counted.
--
-- Backfilled legacy accounts are excluded; see README.md.
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
first_week as (
  select
    a.user_id,
    a.started_on,
    count(distinct e.local_date) as counted_days
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
  count(*) filter (where started_on <= current_date - 6) as eligible_accounts,
  count(*) filter (where started_on <= current_date - 6 and counted_days > 0) as completed_any_week1,
  round(
    100.0 * count(*) filter (where started_on <= current_date - 6 and counted_days > 0)
    / nullif(count(*) filter (where started_on <= current_date - 6), 0),
    1
  ) as week1_completion_pct,
  round(avg(counted_days) filter (where started_on <= current_date - 6), 1) as avg_counted_days
from first_week;
