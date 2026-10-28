import { test } from "node:test";
import assert from "node:assert/strict";
import { nextReminder, validReminderTime, zonedReminder } from "../src/lib/reminder-plan";
import type { DailySnapshot } from "../src/lib/daily-types";
const snapshot = { profile: { timezone: "America/New_York" }, seasons: [{ id: "s", status: "active", started_on: "2026-03-01", ends_on: "2026-03-30", season_length_days: 29 }], practices: [{ id: "p", season_id: "s", active: true, role: "primary", title: "Opening scene", full_variant: { title: "Opening scene", minutes: 5, steps: ["Write the garden scene."] }, easy_variant: { title: "One sentence", minutes: 2, steps: ["Write one garden sentence."] } }], events: [], practiceWeeks: [] } as unknown as DailySnapshot;
test("reminders validate time and keep local wall time across daylight saving", () => {
 assert.equal(validReminderTime("23:59"),true); assert.equal(validReminderTime("24:00"),false);
 assert.equal(zonedReminder("2026-03-07","08:00","America/New_York")?.toISOString(),"2026-03-07T13:00:00.000Z");
 assert.equal(zonedReminder("2026-03-08","08:00","America/New_York")?.toISOString(),"2026-03-08T12:00:00.000Z");
 assert.equal(zonedReminder("2026-03-08","02:30","America/New_York"),null);
});
test("only one known practice is scheduled; completed today moves to tomorrow; leg end stops", () => {
 const now=new Date("2026-03-07T10:00:00Z");
 assert.equal(nextReminder(snapshot,"08:00",now)?.date,"2026-03-07");
 assert.equal(nextReminder(snapshot,"08:00",now)?.title,"Opening scene");
 assert.equal(nextReminder({...snapshot,seasons:snapshot.seasons.map(s=>({...s,progression_paused:true}))},"08:00",now)?.title,"One sentence");
 const done={...snapshot,events:[{season_id:"s",local_date:"2026-03-07",kind:"easy",undone_at:null}]} as DailySnapshot;
 assert.equal(nextReminder(done,"08:00",now)?.date,"2026-03-08");
 assert.equal(nextReminder(snapshot,"08:00",new Date("2026-03-30T10:00:00Z")),null);
});
