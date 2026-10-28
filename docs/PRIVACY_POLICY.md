# Vitality Tree privacy policy

> **DRAFT — needs review.** This describes what the code actually stores today. It is
> not legal advice and has not been reviewed by a lawyer. Replace the bracketed
> placeholders (controller name, contact, jurisdiction) and have it reviewed before it is
> published at `PRIVACY_URL`.

Last updated: [date to be set at publication]

## The short version

Vitality Tree helps you plan a goal toward a date you choose. It stores the account, goal
and progress needed to do that. It has no advertising, no analytics SDK and no tracking,
and it does not sell data. Text you type may be sent to Google Gemini to draft a plan or a
weekly suggestion, but only after you agree, and you can withdraw that agreement at any
time.

## Who is responsible

[Controller name], [address], [contact email]. You can reach support through the link in
Settings.

## What is stored, and why

**Account.** Email address and password. The password is hashed by our authentication
provider (Supabase Auth); the app never sees it. An optional display name is stored for the
greeting.

**Your goal and dates.** The goal exactly as you typed it, the target date you chose, the
number of days in the current planning leg, your identity answer, what usually gets in the
way, and your daily time budget. These build the plan and the pace line.

**AI agreement.** The version of the consent wording you accepted and when you accepted
it. Withdrawing clears it.

**Personalisation answers.** The questions shown in onboarding and the answers you chose or
typed, stored with the season so later edits and weekly suggestions can use them. You can
inspect, change or remove them in Settings. Removing them does not rewrite plan text that
was already written from them.

**Plan and practices.** The stages, practice titles, steps, the easier versions, the
advisory reality check and the plan version history.

**Progress.** For each practice you record: full, easier, skipped or rest, the local date,
the minutes, an optional effort rating (1–5) and an optional note up to 280 characters. Also
weekly review answers: difficulty and an optional note. These drive streaks, milestones, the
tree and the weekly adaptation.

**Safety fields.** An age bracket you choose (13–17 or 18 and over; under 13 cannot create an
account), a conservative-mode flag, and a goal category (ordinary, physical, high-risk). For
physical goals, one yes/no screening answer is used in the moment and is **not** stored; only
the conservative-mode flag can be. These are used to make plans gentler. They are not a
medical assessment. **Your age bracket is self-declared and cannot be verified by the app.**

**On your device only.** A queue of practices you recorded while offline (until they sync),
your chosen reminder time, and the notifications scheduled on your phone. Deleting the app
removes these; they are not in the database.

**Not collected.** No contacts, no location, no advertising identifier, no analytics events,
no health records, no payment data. The app has no third-party tracking SDK.

## AI drafting and weekly suggestions

When you agree, the app sends these to its server and then to Google Gemini:

- your goal, identity answer, target date, planning checkpoint and daily time budget;
- what usually gets in the way, and the optional personalisation answers you gave;
- your goal safety category and conservative-mode flag (not your age bracket and not your
  screening answer);
- for a weekly suggestion: the current practice, days remaining, completed days, effort and
  the review note; for a first plan, practice titles and a short progress summary.

Emails, phone numbers and @handles are removed before sending. That is redaction, not full
anonymisation: remaining details can still identify you. Do not type health details you
would not want processed. The model produces suggestions only; the app validates and limits
what it can contain, and a plan built on the device is available without AI.

If you decline or withdraw, no further AI requests are made. Existing plan text is not
deleted, and you keep the full app with an on-device plan.

## Notifications

Reminders are local notifications scheduled by your phone, at most one a day, naming the
day's practice. They are scheduled only after you choose a time and allow notifications.
You can change or turn them off in Settings or in system settings. Reminders are cancelled
on sign-out, consent withdrawal and account deletion.

## Storage, security and retention

Data is stored in our Supabase Postgres database. Row-level security restricts each account
to its own rows, and progress is written through server functions so the app cannot award
itself XP or edit history directly. Data is kept while the account exists. Archived seasons
remain in your history.

## Deletion

Settings → Delete my account deletes the authentication account and, by cascade, the
profile, seasons, practices, milestones, events, reviews, plan versions, consent fields and
quota records. It cannot be undone. Device-only data (offline queue, reminder time) is
cleared on that device. Infrastructure backups follow Supabase's plan retention and are not
controlled by the app; [state the chosen retention before publication].

## Children

Under 13 cannot create an account. For 13–17 the app uses a gentler progression and suggests
a trusted adult for physical goals. Because age is self-declared, these are safeguards, not
age verification. [Add the parental-consent position for your jurisdiction before
publication.]

## Changes and contact

Material changes will be shown in the app before they take effect. Questions:
[contact], or the support link in Settings.
