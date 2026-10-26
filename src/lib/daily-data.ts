import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyPlan, DailySnapshot, EventInput, CompletionEvent, Progress, Season } from "./daily-types";

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
    const [profile, seasons, practices, milestones, events] = await Promise.all([
      this.sb.from("profiles").select("id,display_name,timezone,blocker,ai_consent_version,ai_consent_at").eq("id", userId).maybeSingle(),
      this.sb.from("seasons").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      this.sb.from("practices").select("*").eq("user_id", userId).order("sort_order"),
      this.sb.from("milestones").select("*").eq("user_id", userId),
      this.sb.from("completion_events").select("*").eq("user_id", userId).order("occurred_at", { ascending: false }),
    ]);
    if ([profile, seasons, practices, milestones, events].some((r) => r.error)) throw new Error("We couldn’t load your journal. Nothing has been overwritten. Please try again.");
    const list = seasons.data as Season[];
    const season = list.find((s) => s.status === "active") ?? list[0];
    return { profile: profile.data, seasons: list, practices: practices.data ?? [], milestones: milestones.data ?? [], events: events.data ?? [], progress: season ? await this.rpc<Progress>("get_progress", { p_season_id: season.id }) : null };
  }
  start(plan: DailyPlan, timezone: string, name?: string) { return this.rpc<string>("start_next_season", { p_plan: plan, p_timezone: timezone, p_display_name: name ?? null, p_previous_status: "completed" }); }
  record(input: EventInput) {
    const args = { p_season_id: input.season_id, p_practice_id: input.practice_id, p_kind: input.kind, p_client_event_id: input.client_event_id, p_occurred_at: input.occurred_at, p_note: input.note ?? null };
    return this.rpc<{ event: CompletionEvent; progress: Progress; credited: boolean }>(input.kind === "rest" || input.kind === "skipped" ? "record_skip_or_rest" : "complete_practice", input.kind === "rest" || input.kind === "skipped" ? args : { ...args, p_minutes_actual: input.minutes_actual ?? null, p_effort: input.effort ?? null });
  }
  undo(eventId: string) { return this.rpc<Progress>("undo_completion", { p_event_id: eventId }); }
}
