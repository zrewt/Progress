import type { DailySnapshot, Practice, Season, Variant } from "../daily-types";
import { addDays, daysBetween, isCounted } from "../progression";
import { rungFor } from "./week";
import type { WeeklyDraft } from "../../../supabase/functions/generate-tree/plan-validation";

/** Accepted detail is append-only. If none exists, continue the last approved practice, explicitly labelled by the UI. */
export function detailFor(snapshot: DailySnapshot, season: Season, practice: Practice, week: number) {
  if (!season.season_length_days) return { practice, continuation: false };
  const detail = (snapshot.practiceWeeks ?? []).filter(d => d.season_id === season.id && d.practice_id === practice.id && d.effective_week <= week).sort((a, b) => b.effective_week - a.effective_week)[0];
  if (detail) return { practice: { ...practice, title: detail.title, why: detail.why, full_variant: detail.full_variant, easy_variant: detail.easy_variant }, continuation: detail.effective_week < week };
  const detailedWeek = Math.min(2, week);
  return { practice: { ...practice, title: rungFor(practice.full_variant, detailedWeek).title, full_variant: rungFor(practice.full_variant, detailedWeek), easy_variant: rungFor(practice.easy_variant, detailedWeek) }, continuation: week > 2 };
}

export function checkpointWeek(season: Season, today: string): number | null {
  if (today >= season.ends_on || today < addDays(season.started_on, 7)) return null;
  return Math.floor(daysBetween(season.started_on, today) / 7) + 1;
}

export function paceLine(snapshot: DailySnapshot, season: Season, today: string): string {
  const remaining = Math.max(0, daysBetween(today, season.ends_on));
  const stage = season.stages?.find(s => today >= s.start && today < s.end);
  const start = addDays(today, -6) < season.started_on ? season.started_on : addDays(today, -6);
  const elapsed = Math.max(1, Math.min(7, daysBetween(start, today) + 1));
  const done = new Set(snapshot.events.filter(e => e.season_id === season.id && isCounted(e) && e.local_date >= start && e.local_date <= today).map(e => e.local_date)).size;
  const pace = today >= season.ends_on ? "Time to review this leg" : done >= Math.ceil(elapsed * 0.75) ? "On pace with your practice" : "There is room for a smaller next step";
  return `${remaining} days left${stage ? ` · ${stage.title}` : ""} · ${pace}`;
}

export function localWeeklyAlternative(practices: Practice[], week: number, version: number): WeeklyDraft {
  const small = (variant: Variant) => ({ title: variant.title, minutes: Math.min(2, variant.minutes), steps: [...variant.steps] });
  return { effective_week: week, expected_version: version, source: "local", practices: practices.map(p => ({ practice_id: p.id, title: p.easy_variant.title, why: "Continue the approved easy practice at a smaller daily size.", full_variant: small(p.easy_variant), easy_variant: small(p.easy_variant) })) };
}
