# Vitality Tree — App Store & Premium Product Readiness

Audit date: October 25, 2026

## Verdict

**A substantial, visually coherent MVP—not yet a release-ready or subscription-ready product.** Keep the Expo/React Native app, Supabase backend, tree metaphor, and low-pressure tone. Do not rewrite the stack. The most important missing piece is a sustainable daily behavior loop, followed by dependable persistence and account/privacy essentials.

The product should promise: **One meaningful goal, one doable next action, and visible proof of progress—with a plan that adapts when life gets in the way.** AI should help deliver that promise, not be the product's entire value proposition.

## 1. What is actually built

| Area | Existing implementation | Important boundary |
| --- | --- | --- |
| Mobile foundation | Expo SDK 57, React Native 0.86, React 19, strict TypeScript; iOS, Android and web entry point | No verified signed release build or TestFlight run in this audit |
| Visual identity | Dark botanical field-journal theme, shared colors/type/controls, custom SVG tree, motion and completion haptics | Native accessibility, perceived performance and all screen sizes remain unverified |
| Accounts | Supabase email/password sign-up/sign-in/sign-out; persisted session and foreground token refresh | No password recovery, account deletion, email-change or settings experience |
| Goal onboarding | Creator/Athlete/Scholar/Builder identity; suggested/custom goal; blocker; 5/15/30-minute budget; plan preview | Requires an account before users can experience the value; only first-season creation exists |
| Plan generation | Supabase Edge Function calls Gemini; deterministic local fallback; normalization and limited content checks | Personalization is largely initial generation, not ongoing adaptation |
| Tree progression | Four branches (Body/Mind/Craft/Connection), four tiers per branch, unlocks, 50 XP per completion, levels | Exactly 16 one-time completions; no logged repetitions |
| Practice sheet | Instructions, goal reminder, completion action, low-energy two-minute toggle | No actual timer or session record; completing a seed still completes the entire milestone |
| Progress display | Season day, saved streak, action totals, branch progress, seven-day summary | Weekly summary is a count of completed nodes, not a reflection/adaptation workflow |
| Persistence | Supabase profiles/nodes tables; owner-scoped RLS definitions; cascading deletion relationships | Separate nontransactional writes; no season history, completion-event history, offline queue or conflict handling |
| App identity/assets | Bundle/package ID `app.vitalitytree.mobile`, URL scheme, icon/splash assets | Signing, App Store Connect state and bundle-ID ownership were not verified |
| Historical work | Earlier Next.js implementation in `legacy-web/`; existing screenshots | Not the active app; do not maintain two competing implementations |

Main implementation references:
- [App entry/state switch](App.tsx)
- [State, authentication and persistence](src/lib/game-context.tsx)
- [Tree/progress rules](src/lib/tree.ts)
- [Plan engine and AI client](src/lib/gemini.ts)
- [Safety helpers](src/lib/safety.ts)
- [Dashboard](src/components/Dashboard.tsx)
- [Practice sheet](src/components/NodeModal.tsx)
- [Database schema and RLS](supabase/schema.sql)
- [AI Edge Function](supabase/functions/generate-tree/index.ts)
- [App configuration](app.json)

## 2. Checks actually performed

### Passed / observed

- `npm run typecheck`: passed, including a rerun after lint-tool bootstrap.
- `npm run db:check`: profiles/nodes table-column checks passed against the configured project. This is a schema/reachability check, **not proof of two-user data isolation or correct save transactions**.
- Web production export: passed to `.expo/audit-web`.
- Standalone iOS production JavaScript/Hermes export: passed on retry to `.expo/audit-ios`, producing a 4.7 MB `.hbc` bundle. This is not a signed iOS app binary or device test.
- Current web app served successfully and was opened at a 390 × 844 viewport. Signed-out form rendered, invalid-email submission displayed validation, and no horizontal page overflow was detected at that viewport.
- Live auth settings endpoint was reachable; email sign-up is enabled and email auto-confirm is enabled. Decide deliberately whether to require verification; if so, implement and test confirmation/resend/deep-link handling.
- Live unauthenticated GET to `generate-tree` returned 401. This is evidence of gateway protection on that request, **not a complete authorization/rate-limit audit of generation POSTs**.
- Logic probes exercised the actual TypeScript helpers: all 16 nodes can be exhausted, ordinary evening-food goals pass, and several safety/pacing defects below were reproduced.
- Google API-key-shaped-string scan of the newly exported web output and existing `dist` found no matches. This is a narrow static scan, not a comprehensive secret audit.
- App icon is a 1024 × 1024 RGB PNG. Asset appearance/rights and final store screenshots still need review.

### Failed / limited

- Active app lint: **40 errors and 4 warnings** with Expo's default configuration, across `src` plus `App.tsx`. Most errors concern animation ref usage and state-in-effect rules. These are lint findings, not 40 independently demonstrated runtime failures. Fix appropriately; do not suppress them simply to get a green check.
- Expo Doctor: **20/21 checks passed**; installed Expo `57.0.30` is behind expected patch `~57.0.31`.
- `npm audit --omit=dev`: **8 findings: 5 high, 3 moderate**, primarily in Expo's tooling dependency chain. Investigate exposure and compatible updates; these counts do not prove the shipped native app is exploitable. Do not apply the suggested SDK downgrade or `npm audit fix --force` blindly.
- Initial all-platform export did not finish successfully; logs show a Windows Hermes compiler failure during iOS bytecode generation, exit `3221225794`. A subsequent standalone iOS export **passed without source changes**. The initial failure's cause is not established; the successful retry verifies iOS bundling, not signing, installation or native runtime behavior. A signed EAS build remains a release gate.
- Browser screenshot capture could not obtain composited frames, so this audit does not claim a fresh screenshot-based visual inspection of the running app.
- No automated test suite or CI workflow was found. Diagnostic probes are not a substitute for regression tests.
- No account credentials were supplied: full signed-in onboarding/completion/relaunch, two-account isolation, purchase flows and live AI generation were **not** tested end-to-end. No user accounts or progress were created/changed for this audit.
- No Git repository metadata is present in this checkout. Establish version control and a recoverable backup before schema or release work. Remote history cannot be inferred from this folder.

Audit tooling note: running Expo lint automatically bootstrapped previously absent ESLint dependencies, a lint script and `eslint.config.js`, updating `package.json` and `package-lock.json`. No application feature code, backend schema, remote function deployment or user data was modified. Generated logs/build artifacts are under the already-ignored `.expo/` directory.

## 3. Highest-priority product and correctness gaps

### A. The core loop runs out after 16 taps

`completeNodeInTree()` permanently completes one node and unlocks the next. After 16 valid completions, `nextBestNode()` returns null and total earned XP is 800. Users can complete all of them on the same day. Completed practices can be read, but cannot log another repetition. The dashboard suggests beginning with a new focus, but provides no working next-season/edit-goal action.

Consequences:
- A nominal 30-day app can run out of progression on day one.
- The current model cannot record 30 days of the same useful habit.
- Streaks and weekly counts stop representing behavior once milestones are exhausted.
- There is not yet a defensible ongoing subscription benefit.

**Build:** separate repeatable practices and daily completion events from longer-term milestones. Make the tree grow from sustained practice, not merely opening the next checklist item. Support season completion, archive and next season without erasing lifetime history.

### B. Saves can leave XP and tree status inconsistent

`saveTree()` upserts the profile first, then all nodes in another request. If the second write fails, the database can contain awarded XP without the corresponding completed practice. Multiple devices or concurrent stale saves can overwrite progress. The client controls its own XP/streak values under the current RLS policy; owner isolation is not authoritative validation.

**Build:** authenticated, atomic, idempotent server-side completion operations, server-derived rewards and unlocks, unique completion constraints and an explicit pending/synced/error state. Test partial failure, duplicate retry and concurrent devices. Do not solve this by broadly trusting client fields.

### C. Personalization is not fully persisted

The onboarding `blocker` exists in in-memory profile state but is absent from `profilePayload()`, `profileFromRow()` and the SQL schema. On reload it is lost; subsequent regeneration defaults to consistency. The generated summary, branch focus labels, safety note and AI/fallback provenance are also not persisted as plan metadata. A previously AI-generated plan can be labeled a seed plan after reopening.

**Build:** persist the complete plan/profile metadata with versions. Reload must preserve what the user selected and what the app promised.

### D. Time-budget and low-energy promises are not faithful

- A 5-minute budget changes duration labels, but titles/instructions can still prescribe 10 or 20 minutes. The fallback includes a `Twenty-Minute Deep Craft Session` with `5 min` displayed.
- Four starting seeds sum to 8 minutes. The app needs to make clear that the daily total is a selected action budget, not four mandatory daily branches.
- `twoMinuteSeedVersion()` keeps the original first instruction. A first step of `Run for twenty minutes` survives the two-minute transformation.
- Seed mode is only local UI state; the saved completion cannot tell a full session from its easier alternative.

**Build:** generate internally consistent variants with their own steps, record the chosen variant and actual session, and enforce a total daily workload. Keep the low-energy option generous; do not penalize showing up.

### E. Safety is both overbroad and incomplete

- `quit cocaine` and `stop self-harm` are blocked by keyword matching despite being recovery-oriented inputs.
- Client sleep/substance rules differ from server rules. In an isolated local handler probe, `never sleep`, `sleep 2 hours`, and `use cocaine` passed server input validation and reached the missing-key stage.
- The output sanitizer allowed a constructed action saying `Eat 100 calories per day`.
- Conversely, safe text saying `Do not ignore pain` is treated as unsafe because the phrase `ignore pain` is matched without context.
- Normal evening-food goals currently pass; retain that improvement.
- The nutrition fallback uses kitchen-closed/food-avoidance cues and physiological claims. It needs careful, nonjudgmental wording: genuine hunger is not failure, normal meals and individual circumstances matter, and the app is not medical treatment.

**Build:** shared, tested intent-aware rules; safe recovery handling and geographically appropriate support resources; server-side output validation and content reporting; domain-reviewed habit templates; bounded AI behavior. Do not claim the current regexes provide medical/safety verification.

### F. Several supported goals get weak fallback plans

The fallback detects themes but only supplies dedicated nutrition and running/strength branches; other themes largely share a general plan. A `Sleep and recover better` probe produced a craft seed of `Three-Sentence Ugly Draft`. Language/study/coding detection is sensitive to keyword ordering and exact word forms.

**Build:** a small, excellent library of goal-specific plans for the initial audience. Ask about baseline and constraints where necessary. Make every suggested action plausibly advance the chosen outcome, and allow replace/edit/skip with a reason. A four-domain philosophy should not force unrelated busywork.

### G. Error/offline/account lifecycle handling needs hardening

- No offline progress cache/queue: session persistence is not offline habit support.
- Initial session/profile loading lacks robust retry/finally/cancellation protection. The hydration promise is cached by user ID, which can prevent a failed load from being retried during that session.
- A nodes read error can still lead into generation/upsert because an empty loaded array is treated as a missing tree. Distinguish a failed read from genuinely absent data before writing.
- In-flight hydration/save results must not restore another user's state after sign-out/account switches.
- Streak is a saved number; the UI does not automatically expire it after missed days. Local-day, travel and daylight-saving rules need explicit tests. Season day uses elapsed 24-hour periods rather than a defined calendar-day policy.
- `Synced to Supabase` is static copy, not actual sync status.
- No password recovery, retry-load surface, or account/settings screen.

## 4. What would make it genuinely useful and premium

### Initial audience and promise

Start with people who repeatedly make ambitious plans and then lose momentum. Keep the four identities as personalization if useful, but sell one concrete outcome: **turn an important goal into a routine you can actually keep**. Do not market an all-purpose AI life coach until the core domains are demonstrably good.

### The daily experience to build

1. **Today:** one clear recommended action and an optional easier version; show why it matters. One main commitment, not four obligations.
2. **Do:** concise instructions and an optional timer that survives backgrounding correctly; allow doing the activity outside the app.
3. **Record:** log full/seed/skipped/rest, optional effort and a short note or outcome. Undo mistakes without corrupting totals.
4. **Grow:** meaningful tree changes tied to accumulated practice, with a fast, satisfying acknowledgment.
5. **Adjust:** a short weekly reflection that actually changes next week's load based on difficulty and adherence.
6. **Continue:** keep useful habits after 30 days, celebrate the season, archive it and start another without losing proof of past work.

### Suggested free-versus-premium split (product proposal, not implemented)

| Core/free experience | Potential premium value |
| --- | --- |
| One active goal; excellent daily practice loop | Richer adaptive planning and curated multi-week programs |
| Basic tree, reminders and recent progress | Deeper trends, personalized weekly reviews and long-term insights |
| Editing, low-energy mode and reasonable offline logging | More concurrent goals when users demonstrate they want them |
| Account controls, safety, reliable saves and access to personal data | Expanded season/garden presentation and customization |

Do not gate reliability, privacy controls or basic habit usefulness behind payment. A paid-upfront or one-time-unlock app is also viable if ongoing adaptive value is not ready; a subscription needs real recurring benefit. Validate willingness to pay before setting a price. Meter AI generations and measure cost per active/paying user before promising unlimited AI.

### UX polish that matters

- Replace developer-facing copy such as `Key Hidden`, `Supabase` and `Server AI` with plain-language product status. Put honest AI disclosure where users make the choice.
- Introduce value before requiring account creation where practical; do not add a fabricated guest-sync system merely to avoid onboarding friction.
- Make Today immediately usable on a small phone, without scrolling through an essay. Keep the tree visible and emotionally rewarding on mobile, not just desktop.
- Add optional reminders with quiet hours and easy controls, after the user experiences a first win.
- Add accessible field labels, large-text layouts, VoiceOver focus/announcements, adequate hit targets and reduced-motion behavior. Existing accessibility roles are a useful start, not a completed audit.
- Add real loading/error/empty/completed-season states and empathetic return-after-absence copy.
- Keep nutrition/exercise advice within a conservative wellness scope and remove unsupported outcome guarantees.

**Not needed for v1:** public social feed, chat with strangers, HealthKit, Apple Watch, a full AI chatbot, complex multiplayer, or dozens of simultaneous goals. Each adds cost, moderation or privacy burden before proving the basic habit loop.

## 5. App Store launch gates

These are current official-source requirements plus release practices—not a guarantee of approval.

### Accounts, privacy and AI

- [ ] In-app initiation of account deletion, with clear confirmation and deletion of associated personal data. Current SQL cascades help but no deletion endpoint/UI exists.
- [ ] Public privacy policy and accessible in-app link; accurate App Privacy disclosures covering Supabase, goal content and third-party AI. Decide retention/deletion and data-use policies before writing claims.
- [ ] Clear disclosure of what personal data is sent to Google/Gemini and explicit permission **before** that sharing. Offer the existing local seed engine as a meaningful alternative when AI is declined. Regex removal of email/phone/handles is not full anonymization.
- [ ] Working support/contact route and Support URL.
- [ ] Password reset and appropriate confirmation/deep-link flow. These are practical account-completeness needs, not a claim that Apple specifically mandates a password-reset button for every app.
- [ ] Review native session storage and local-cache protections for the intended sensitivity. AsyncStorage session persistence should not be described as encrypted storage.
- [ ] Check privacy manifests/required-reason API declarations and third-party SDK compliance in the actual native build. Do not add tracking permission unless the app actually does tracking that requires it.
- [ ] Age-rating questionnaire and age-appropriate content/marketing. Avoid implying medical diagnosis/treatment. Decide audience and territories deliberately.

Apple says account-creating apps must permit account-deletion initiation in-app. Its AI privacy clarification requires clear disclosure and explicit permission before sharing personal data with third-party AI.

### If launching paid digital features

- [ ] Choose paid download, one-time unlock or subscription based on actual value delivered.
- [ ] For in-app digital purchases, implement Apple's IAP route as the general baseline; regional exceptions/payment-link rules must be assessed separately for target storefronts.
- [ ] Accurate paywall: benefits, price, duration, renewal/trial terms, Terms of Use and Privacy Policy.
- [ ] Purchase restoration and easy subscription management; persistent, verified entitlement state rather than a local `isPremium` toggle.
- [ ] Test purchase, cancellation, renewal, refund/revocation, billing retry/grace, reinstall and account/device changes using sandbox/TestFlight.
- [ ] Explain that deleting an app account does not itself cancel Apple subscription billing; do not make cancellation an unnecessary obstacle to account deletion.

Premium billing is not required to launch a free app, but is required before charging through a premium in-app feature flow. Vendor selection has intentionally not been made in this audit.

### Binary, operations and listing

- [ ] Establish Git history/backup for this checkout.
- [ ] Resolve compatible dependency patches and lint findings; add a reproducible CI install/typecheck/lint/test/build gate.
- [ ] Add EAS project/build configuration and separate development/preview/production environments. No `eas.json` or EAS project linkage is present in the inspected app config.
- [ ] Verify Apple Developer/App Store Connect access, bundle-ID availability, signing, app record, agreements/tax/banking if selling.
- [ ] Build a signed production binary with the required Xcode/iOS SDK. Since April 28, 2026, Apple requires Xcode 26+ and iOS 26 SDK+ for upload; this does not mean the app must require iOS 26 as its minimum OS.
- [ ] Test actual iPhones, interruption/backgrounding, weak/offline networks and relaunch. `supportsTablet: true` currently advertises iPad support: validate and polish it before shipping.
- [ ] Provide reviewer credentials or suitable full demo access and live backend services.
- [ ] Final app icon, accurate app-in-use screenshots for supported devices, name/subtitle/description/keywords/category, support/privacy URLs and export-compliance answers. Existing project screenshots are not proof of compliant final store assets.
- [ ] TestFlight cohort, crash/error visibility, privacy-conscious product measurement, support triage and rollback/recovery procedures.

### Backend/AI hardening before public use

- Validate authenticated generation requests in a deployment-appropriate way; the gateway's observed unauthenticated 401 is only one check.
- Add per-user generation quotas, request/output size limits, timeouts, controlled retries, rate-limit responses and cost budgets.
- Treat goal text as untrusted data; bound prompt-injection effects and validate the full response on the server.
- Keep generated plans versioned, including fallback/model provenance, without retaining unnecessary personal prompt text in logs.
- The Edge Function currently parses and returns model JSON without a server-side schema/content validator, and sends raw upstream error detail back to callers.
- Validate configured model availability instead of assuming each hard-coded fallback model exists or is appropriate.
- Align client/server safety behavior and handle model refusal honestly rather than describing any repaired response as verified AI output.
- Remove obsolete public Gemini environment configuration. Expo logs show a variable named `EXPO_PUBLIC_GEMINI_API_KEY` still being loaded; the active client does not reference it. The name alone is not proof of a leaked key. If a real key ever shipped in an older client, rotate it. Never put values in audit reports.
- Convert the hand-run SQL into versioned migrations with rollback/data-recovery planning. Review destructive legacy cleanup before applying it to production.
- Prove two-account isolation with authenticated tests, including all future completion, season, review and entitlement tables.

## 6. Build order and acceptance criteria

| Stage | Work | Done when |
| --- | --- | --- |
| **1 — Durable daily loop** | Separate seasons, repeatable practices, milestones, daily plans and completion events; atomic completion; correct metadata persistence | A user can log the same practice across 30 days, retries cannot duplicate credit, partial saves cannot split XP/tree state, and relaunch preserves their blocker and plan |
| **2 — A useful day/week/month** | Today action, faithful seed/full variants, edit/replace/skip/rest, reminders, weekly reflection, outcome tracking and next season | A missed day gives a gentle return path; selected work fits the total time budget; a weekly review can alter the plan; the user can continue beyond the first season |
| **3 — Trust and release foundation** | Settings/account recovery/deletion, privacy/support/AI permission, server validation/quotas, offline queue, tests and dependency/lint repairs | No lost completion during an airplane-mode/reconnect test; two-user isolation passes; deletion removes associated data; no AI call occurs before permission; checks are reproducible |
| **4 — Premium experience** | Choose monetization; implement billing, entitlements, restoration and clear upgrade value; polish native UX/accessibility | Sandbox purchase lifecycle works across reinstall/devices; paid benefits are recurring and useful; cancel/refund changes access correctly; core free use remains honest |
| **5 — TestFlight to release** | Signed iOS build, device QA, real-user trial, listing/support/review materials | Target users can use it for a complete multi-week cycle; release gates pass on actual hardware; product/review metadata accurately matches shipped behavior |

Stages overlap: privacy/security and data architecture must influence the daily loop from the start. Do not bolt them on after collecting real beta-user data. Avoid a calendar estimate until stage 1 is scoped; this is several substantive product/reliability milestones, not a final UI-polish weekend.

### Minimum regression coverage

- Repeated practice completion, unlock thresholds, undo, season rollover and archived history.
- Duplicate retries, concurrent completions, partial failures, offline reconciliation and account switching during requests.
- Streak expiration, timezone changes, daylight saving and midnight/background transitions.
- All supported goals, budgets and blockers; coherent two-minute instructions; recovery/unsafe/ambiguous inputs; malformed AI output and model refusal.
- Sign-up/sign-in, confirmation if enabled, password reset, expired session and account deletion.
- Consent declined/accepted/withdrawn and no unauthorized AI sharing.
- Two-user RLS isolation and premium entitlement enforcement.
- Purchase restore/renewal/refund/revocation and accessibility smoke tests on real devices.

### Evidence to collect before calling it premium

Use an opt-in, privacy-conscious measurement plan. Do not send raw goals or private notes as analytics properties.

Track: time to first useful action; onboarding-to-first-completion; return on day 7/day 30; repeated practice days; seed-mode usage; skips and replacements; users reporting that the action helped their real goal; sync failures; AI failure/fallback rate; cost per active/paying user; and purchase/restore success if monetized.

A small real-user cohort should prove that people return because the app helps them act—not just because onboarding and the tree look appealing. Set launch targets deliberately rather than presenting arbitrary retention percentages as universal benchmarks.

## 7. Official sources

Checked for this audit; policies and storefront-specific terms should be rechecked immediately before submission.

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): completeness, safety, payments, privacy, support and metadata.
- [Apple account-deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/).
- [Apple clarification on third-party AI sharing and explicit permission](https://developer.apple.com/news/?id=ey6d8onl).
- [Apple upload SDK requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a).
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).
- [Apple subscription guidance](https://developer.apple.com/app-store/subscriptions/).
- [Apple age-rating setup](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/).
- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/).
- [Expo EAS Build setup](https://docs.expo.dev/build/setup/).
- [Expo iOS submission](https://docs.expo.dev/submit/ios/).

## Bottom line

Keep the identity, stack and visual metaphor. First build **repeatable daily practice with trustworthy history**, then **adaptation and continuity**, then **a premium offer that genuinely adds ongoing value**. App Store compliance and signed-device testing are separate gates; neither a successful web export nor attractive screens mean the mobile product is ready to sell.
