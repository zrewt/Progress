-- Seasons created per week. A first season is the onboarding proxy; later seasons are
-- people continuing or changing goals, so they are reported separately instead of
-- inflating onboarding.
--
-- Plan source is included because a week of plans written on the device means the model
-- was unavailable or consent was off, which changes what "onboarded" means for that week.
-- Read-only. Run as the project owner in the Supabase SQL editor.

with ranked as (
  select
    s.user_id,
    s.created_at,
    s.plan_source,
    row_number() over (partition by s.user_id order by s.created_at) as season_number,
    exists (
      select 1 from public.plan_versions v
      where v.season_id = s.id and v.snapshot->>'source' = 'migrated'
    ) as backfilled
  from public.seasons s
)
select
  date_trunc('week', created_at)::date as week_start,
  count(*) filter (where not backfilled) as seasons_created,
  count(*) filter (where not backfilled and season_number = 1) as first_seasons,
  count(*) filter (where not backfilled and season_number > 1) as later_seasons,
  count(*) filter (where not backfilled and plan_source = 'ai') as ai_plans,
  count(*) filter (where not backfilled and plan_source = 'local') as local_plans,
  count(*) filter (where backfilled) as excluded_backfilled
from ranked
group by 1
order by 1 desc;
