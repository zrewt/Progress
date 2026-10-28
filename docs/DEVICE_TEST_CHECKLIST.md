# Manual device checklist

Run on a real phone with a development build (`npx expo run:ios|android`, or an EAS
`development` build). Expo Go cannot test notifications. Record the phone, OS version and
build number at the top, and mark every row PASS, FAIL or BLOCKED.

Build under test: ____________  Phone / OS: ____________  Date: ____________

## 1. Signup and age

- [ ] Create an account with a new email. Expected: either you are signed in, or the app
      says to confirm your email, depending on the project setting.
- [ ] Try to create an account choosing **under 13**. Expected: a kind message, no account
      created, no error screen.
- [ ] Create a 13–17 account and start a physical goal. Expected: a note recommending a
      trusted adult and a gentler plan; no extreme progression.
- [ ] Sign out and back in. Expected: the same season and tree, no duplicate season.
- [ ] Reject a wrong password. Expected: one calm sentence, no raw provider error.

## 2. Onboarding and the promise

- [ ] Declare AI consent when asked. Expected: the sheet lists goal, target date, budget,
      blocker, optional answers, safety category and weekly inputs.
- [ ] Type a goal in your own words. Expected: free text, no preset category picker.
- [ ] Choose a date 10 days away. Expected: the earliest valid date is suggested kindly,
      and the plan is not created for the invalid date.
- [ ] Choose a date 6 months away. Expected: an offer to plan the first 112 days as a leg
      with a checkpoint; declining returns to the date choice; accepting keeps the real
      target date.
- [ ] Choose a date 30 days away. Expected: 4 stages, a reality check of comfortable,
      stretch or very tight with one sentence, and no blocking.
- [ ] Decline AI. Expected: a clearly labelled on-device plan, never presented as AI.
- [ ] Turn airplane mode on and generate. Expected: an explicit retry or labelled starter
      plan, in separate choices.

## 3. Plan preview and start

- [ ] Preview shows the first action, the later-week step and the plan source.
- [ ] Start the season. Expected: Today shows the chosen practice, days left, current stage
      and a plain pace line.
- [ ] Settings → plan source. Expected: matches what the preview said.

## 4. Reminders (native build only)

- [ ] After the preview, choose a time. Expected: a one-sentence explanation, then the
      system permission prompt.
- [ ] Deny permission. Expected: the app explains the denied state and offers a link to
      system settings; it does not keep asking.
- [ ] Allow, then background the app. Expected: one notification naming the actual practice
      at the chosen time.
- [ ] Record that practice before the reminder time. Expected: no notification for the day;
      the next one is scheduled.
- [ ] Change the time in Settings. Expected: the old schedule is replaced.
- [ ] Turn reminders off. Expected: all scheduled notifications are cancelled.

## 5. Daily use

- [ ] Record the full practice with effort and a note. Expected: Today says it is recorded,
      the tree grows, the streak updates.
- [ ] Undo it. Expected: the entry is reversed for the same local day; growth returns.
- [ ] Record the easier version. Expected: counts the same as the full version.
- [ ] Skip with a reason, then rest on another day. Expected: no growth, no streak break for
      rest, calm copy.
- [ ] Skip two days in a row. Expected: the Today card offers the easier version; the button
      opens the practice with it preselected; "Not now" dismisses it.
- [ ] Rate three practices hard or very hard in one week. Expected: the offer to make the
      next week lighter appears; accepting it makes the easier version offered first.

## 6. Pain and safety

- [ ] Tap "Something hurt". Expected: no growth, a short message to rest and to see a
      professional if it continues, and the next practice is the easy version.
- [ ] Try a high-risk goal (for example climbing a big mountain). Expected: preparation only,
      with a clear note to get qualified instruction, no route or technique advice.
- [ ] Start a physical goal and answer the screening question "yes". Expected: a doctor-first
      message, with the choice to continue gently or go back.
- [ ] Type a self-harm related goal. Expected: crisis resources, no plan, kind wording.

## 7. Offline and sync

- [ ] With airplane mode on, record a practice. Expected: the sheet closes and the dashboard
      says it is saved on this device and will sync; never "everything is saved".
- [ ] Reopen the app with the network back. Expected: one sync, one event, no double count.
- [ ] Record the same practice again after sync. Expected: no duplicate credit.
- [ ] Force-quit while offline, reopen. Expected: the queued entry is still waiting.

## 8. Weekly checkpoint

- [ ] Complete a week. Expected: a review asks how it felt, shows the proposed week next to
      the current one, and applies nothing until accepted.
- [ ] Reject the proposed week. Expected: the approved practice continues; no outline text is
      shown as a practice.
- [ ] With AI consent withdrawn, open the review. Expected: no AI request, a local labelled
      alternative and a retry.

## 9. Consent withdrawal

- [ ] Settings → withdraw AI consent. Expected: confirmation, reminders cancelled, later plan
      edits use the local path only.
- [ ] Record a practice after withdrawal. Expected: works normally; no model request.

## 10. Account deletion

- [ ] Settings → Delete my account, confirm twice. Expected: account and journal deleted,
      signed out, no stale data on relaunch.
- [ ] Sign up again with the same email. Expected: a genuinely new, empty account.
- [ ] After deletion, confirm no reminder can arrive. Expected: none scheduled.

## 11. Release hygiene

- [ ] Support and privacy links open real pages (not `example.com`).
- [ ] Version shown in Settings matches the build.
- [ ] Large text and screen reader: Today, Settings, practice sheet remain usable.
- [ ] No secret or key appears in the app bundle or Metro logs.
