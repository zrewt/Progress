# Testing in Expo Go (iPhone, Windows laptop)

Everything needed for these tests is bundled in Expo Go, so no Apple Developer
membership, no Mac and no cloud build is required. Two things cannot be tested
here and are marked **[needs a real build]**.

## 0. Before you start

```powershell
npm run typecheck        # expect: no output, exit 0
npm run lint             # expect: exit 0
npm test                 # expect: 46 pass, 0 fail
npm run safety:check     # expect: exit 0 (client and Edge Function rules identical)
npm run db:check         # expect: 8 lines "ok", "protected", exit 0
```

`db:check` says "anonymous access denied as expected" for every table. That is the
correct answer, not a failure: the script has no user session, so RLS refuses it,
which proves the table exists and is protected.

## 1. Start the app

```powershell
npx expo start --go
```

`--go` forces Expo Go; without it the CLI may wait for a dev build you do not have.
Point the iPhone **Camera** app at the QR code and tap the banner.

If the phone cannot reach the laptop (Windows firewall, or phone on cellular):

```powershell
npx expo start --go --tunnel
```

Keep the terminal open. Press `r` to reload, `j` to open the debugger.

## 2. Sign in

1. Create an account with a real address you can open (needed for the reset email later).
2. Sign out from the gear icon → Sign out, then sign back in. Both must work.

**Expect:** a wrong password shows a plain message, never a raw server error.

## 3. Onboarding

1. Pick an identity, type a goal ("run a 5k without walking"), pick a blocker, choose 5 minutes.
2. The consent screen appears before any plan is drafted.
3. **Decline** AI the first time round.

**Expect:** a complete plan (one daily practice, three optional weekly ones) is built
on the device, with a preview before you commit. Nothing hangs, nothing calls the
network.

4. Relaunch the app. The goal, blocker, branch labels and plan summary must be
   exactly what you chose — not generic defaults.

## 4. The daily loop

| Step | Expect |
| --- | --- |
| Tap **Begin today's practice** | Instructions, a start-timer button, an "easier version" toggle |
| Run the timer, background the app, return | Elapsed time is truthful (it is computed from a timestamp, not a counter) |
| Record the full practice | Comes back to Today; card reads "Today is recorded." |
| Tap **Undo** in the 10-second toast | The entry disappears and the tree steps back |
| Complete again, this time the easier version | Counts fully: "You showed up gently today." No XP penalty anywhere |
| Try to record the same practice twice in one day | Refused, politely. Only one counted entry per practice per day |
| Tap **Skip** → pick a reason chip | Recorded as skipped in "Last seven days" |
| Tap **Rest day** | Streak is preserved, not broken |
| Tap a weekly practice under "Also available this week" | Opens the same sheet; recording it is allowed |
| Inside the sheet, choose a replacement practice | Title changes everywhere, history is kept |
| **Edit goal or time** | New plan version; past recordings survive |
| **Finish this season** | Summary shows days practiced and tree state; archives; offers to continue |

## 5. Offline and retry (the important one)

1. Turn on **Airplane mode**.
2. Complete a practice.
   **Expect:** "1 saved on this device, waiting to sync" — not a scary error.
3. Tap **Refresh** with airplane mode still on.
   **Expect:** a load-failure screen with **Try again** and **Sign out**, and no
   silent overwrite of your data.
4. Turn Airplane mode off, reopen the app.
   **Expect:** "Everything is saved" within a few seconds.

Then confirm in the Supabase SQL editor that it counted **once**, not twice:

```sql
select client_event_id, count(*)
from public.completion_events
where user_id = '<your test user uuid>'
group by client_event_id having count(*) > 1;
-- expect 0 rows
```

## 6. Settings

Gear icon, top right. Check each line:

- **Time zone** — if it differs from the device, "Use this device (…)" appears and saves.
- **AI suggestions** — turning it off must stop any server call; turning it on again records consent.
- **Support / Privacy policy** — these open `example.com` placeholders right now. **Expected
  until you fill in `SUPPORT_URL` and `PRIVACY_URL` in `src/lib/config.ts`.**
- **Sign out** — returns to the auth screen.
- **Delete my account** — do this **last**, on a throwaway account. Confirmation copy is
  explicit, then the app signs out. Verify in Supabase → Authentication → Users that the
  user is gone, and that its seasons/practices/events are gone too.

**[needs a real build]** Password reset end to end: the email link uses
`vitalitytree://reset-password`, which Expo Go cannot open. Requesting the email works;
following it does not.

## 7. States that need time to pass

Two features only appear after days, so force them on a **test account** from the SQL
editor (never on real data). Replace `<uuid>` with your test user's id.

Welcome back after a gap (shows the softening card instead of a scolding one):

```sql
update public.seasons set started_on = started_on - interval '4 days' where user_id = '<uuid>';
update public.completion_events
   set local_date = local_date - 4, occurred_at = occurred_at - interval '4 days'
 where user_id = '<uuid>';
```

Weekly review (appears once a week has finished):

```sql
update public.seasons set started_on = started_on - interval '7 days' where user_id = '<uuid>';
```

Reload with `r`. The review asks for difficulty 1–5 and an optional note, then proposes
lighter / same / harder **and changes nothing until you confirm**.

To undo the shift, run the same statements with `+ interval`.

## 8. Look and feel

- Rotate to landscape; text must not clip.
- iOS Settings → Display & Text Size → Larger Text; nothing should overlap.
- Reduce Motion on; celebrations must not rely on animation.
- VoiceOver on: every button and the tree nodes speak a real label, and tap targets feel
  at least 44pt.

## Known pre-release gaps (not bugs to chase)

- `SUPPORT_URL` and `PRIVACY_URL` are placeholders; the privacy policy still has to be published.
- Crisis resources are US-only and marked `NEEDS REVIEW` in `src/lib/safety-rules.ts`.
- No reminders or push notifications yet.
- Password reset and any native-only behaviour need an EAS build and an Apple Developer
  membership ($99/year).
