# Content review before release

Two themes carry health-adjacent wording and are marked `NEEDS DOMAIN REVIEW` in code
(`src/lib/plans/themes-a.ts`). A clinician or registered practitioner should read them
before the app ships. Nothing here is medical advice, and the plan never sets a weight,
calorie or sleep target.

## Sleep (`sleep` theme)

- Titles and steps cover a wind-down routine, dimming lights, putting the phone out of
  reach, parking tomorrow's thoughts and saying goodnight.
- Check: nothing implies that less sleep is better, and nothing suggests a fixed number
  of hours for every person.
- Open question: should the app name a support resource for persistent insomnia? Right
  now it does not, to avoid implying treatment.

## Food and evening habits (`nutrition` theme)

- Wording is deliberately non-restrictive: ordinary meals, sitting down to eat, noticing
  fullness, keeping the kitchen ready, sharing a meal.
- No calories, weights, fasting, "cutting" food, or replacing meals. Hunger is described
  as information, not failure.
- Check: "let the rest wait" and "notice when you have had enough" could read as
  restriction to someone with a history of disordered eating. A reviewer should confirm
  the phrasing or soften it.
- The theme is not offered as treatment and says so in the plan safety note.

## Safety copy (reviewed in Stage 3)

- Declines for starvation, extreme calorie numbers, sleep deprivation, steroids and hard
  drugs must stay kind and non-shaming.
- Recovery goals (quitting a substance, stopping self-harm) must take the supportive
  path, not the error path. Crisis resources live in one config file and are marked
  **NEEDS REVIEW** for region accuracy.
- Output validation must reject generated actions such as "Eat 100 calories per day".

## Tone checklist used for every theme

- One daily practice, three optional weekly practices.
- No shame language, no "discipline", no streak threats.
- Every practice has a two-minute version that counts equally.
- Steps never prescribe more minutes than the chosen daily budget.
