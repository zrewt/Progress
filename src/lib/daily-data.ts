import type { WeeklyDraft } from "../../supabase/functions/generate-tree/plan-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonalizationAnswer } from "./types";
import type { DailyPlan, DailySnapshot, EventInput, CompletionEvent, Progress, Season, SeasonHistoryEntry, WeeklyReview, PracticeDraft } from "./daily-types";

export class AccountScope {
  private revision = 0;
  private user: string | null = null;
  switch(user: string | null) { this.user = user; this.revision += 1; return this.token(); }
  token() { return { user: this.user, revision: this.revision }; }
  isCurrent(token: ReturnType<AccountScope["token"]>) { return token.user === this.user && token.revision === this.revision; }
}
export class DailyData {
  constructor(private sb: SupabaseClient) {}
  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(name, args);
    if (error) throw new Error("Your changes could not be confirmed. Check your connection and try again.");
    return data as T;
  }
  async load(userId: string): Promise<DailySnapshot> {
    // Never substitute [] for a failed read, generate a plan, or write during hydration.
    const [profile, seasons, practices, milestones, events, reviews, practiceWeeks] = await Promise.all([
      this.sb.from("profiles").select("id,display_name,timezone,blocker,ai_consent_version,ai_consent_at").eq("id", userId).maybeSingle(),
      this.sb.from("seasons").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      this.sb.from("practices").select("*").eq("user_id", userId).order("sort_order"),
      this.sb.from("milestones").select("*").eq("user_id", userId),
      this.sb.from("completion_events").select("*").eq("user_id", userId).order("occurred_at", { ascending: false }),
      this.sb.from("weekly_reviews").select("*").eq("user_id", userId).order("week_start"),
      this.sb.from("practice_weeks").select("*").eq("user_id", userId).order("effective_week"),
    ]);
    if ([profile, seasons, practices, milestones, events, reviews, practiceWeeks].some((r) => r.error)) throw new Error("We couldn’t load your journal. Nothing has been overwritten. Please try again.");
    const list = seasons.data as Season[];
    const season = list.find((s) => s.status === "active") ?? list[0];
    return {
      profile: profile.data,
      practiceWeeks: practiceWeeks.data ?? [],
      seasons: list,
      practices: practices.data ?? [],
      milestones: milestones.data ?? [],
      events: events.data ?? [],
      reviews: (reviews.data ?? []) as WeeklyReview[],
      progress: season ? await this.rpc<Progress>("get_progress", { p_season_id: season.id }) : null,
    };
  }
  start(plan: DailyPlan, timezone: string, name?: string) {
    return this.rpc<string>("start_next_season", { p_plan: plan, p_timezone: timezone, p_display_name: name ?? null, p_previous_status: "completed" });
  }
  record(input: EventInput) {
    const args = { p_season_id: input.season_id, p_practice_id: input.practice_id, p_kind: input.kind, p_client_event_id: input.client_event_id, p_occurred_at: input.occurred_at, p_note: input.note ?? null };
    return this.rpc<{ event: CompletionEvent; progress: Progress; credited: boolean }>(input.kind === "rest" || input.kind === "skipped" ? "record_skip_or_rest" : "complete_practice", input.kind === "rest" || input.kind === "skipped" ? args : { ...args, p_minutes_actual: input.minutes_actual ?? null, p_effort: input.effort ?? null });
  }
  undo(eventId: string) { return this.rpc<Progress>("undo_completion", { p_event_id: eventId }); }
  editPlan(seasonId: string, plan: DailyPlan) { return this.rpc<number>("update_plan", { p_season_id: seasonId, p_plan: plan }); }
  replacePractice(seasonId: string, practiceId: string, practice: PracticeDraft) {
    return this.rpc<string>("replace_practice", { p_season_id: seasonId, p_practice_id: practiceId, p_practice: practice });
  }
  review(seasonId: string, weekStart: string, difficulty: number, note: string | null, apply: boolean) {
    return this.rpc<{ review: WeeklyReview; adherence: number; decision: string }>("submit_weekly_review", {
      p_season_id: seasonId, p_week_start: weekStart, p_difficulty: difficulty, p_note: note, p_apply: apply,
    });
  }
  acceptWeek(seasonId: string, draft: WeeklyDraft) { return this.rpc<number>("accept_practice_week", { p_season_id: seasonId, p_draft: draft }); }
  endSeason(seasonId: string, status: "completed" | "archived") { return this.rpc<null>("end_season", { p_season_id: seasonId, p_status: status }); }
  history() { return this.rpc<SeasonHistoryEntry[]>("season_history", {}); }
  recordConsent(version: string) { return this.rpc<null>("record_ai_consent", { p_version: version }); }
  withdrawConsent() { return this.rpc<null>("withdraw_ai_consent", {}); }
  setTimezone(timezone: string, name?: string | null) { return this.rpc<null>("update_preferences", { p_timezone: timezone, p_display_name: name ?? null }); }
  setPersonalizationContext(seasonId: string, context: PersonalizationAnswer[]) { return this.rpc<null>("set_personalization_context", { p_season_id: seasonId, p_context: context }); }
}
