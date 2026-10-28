-- Onboarding completed, as a labelled proxy: the first season created per account.
--
-- The app creates a season only after onboarding finishes and the plan preview is
-- approved (start_next_season). A person who abandons onboarding is invisible here.
-- Backfilled legacy accounts are excluded; see README.md.
--
-- Read-only. Run as the project owner in the Supabase SQL editor.

with anchored as (
  select s.user_id, min(s.created_at) as first_created_at
  from public.seasons s
  where not exists (
    select 1 from public.plan_versions v
    where v.season_id = s.id and v.snapshot->>'source' = 'migrated'
  )
  group by s.user_id
)
select
  date_trunc('week', first_created_at)::date as week_start,
  count(*) as accounts_onboarded
from anchored
group by 1
order by 1;
