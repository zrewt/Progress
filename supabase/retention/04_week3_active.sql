-- Still active in week 3: among accounts whose first twenty-one days have fully elapsed,
-- how many logged a counted practice during days 15-21. Excluding accounts without enough
-- elapsed time avoids counting a young account as churned.
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
week3 as (
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
   and e.local_date between a.started_on + 14 and a.started_on + 20
  group by a.user_id, a.started_on
)
select
  count(*) filter (where started_on <= current_date - 20) as eligible_accounts,
  count(*) filter (where started_on <= current_date - 20 and counted_days > 0) as active_in_week3,
  round(
    100.0 * count(*) filter (where started_on <= current_date - 20 and counted_days > 0)
    / nullif(count(*) filter (where started_on <= current_date - 20), 0),
    1
  ) as week3_active_pct
from week3;
