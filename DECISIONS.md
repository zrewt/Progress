# Implementation decisions

## Stage 1

1. Season dates are local calendar dates; ends_on is exclusive (started_on + 30). Events retain their derived local_date permanently. Timezone changes affect new events, not history. UTC is the explicit migration default because the original app never saved a timezone; users can change it later.
2. Migrated completions count as practiced days but earn no new XP. A single immutable legacy grant preserves the original profile XP exactly, including when it differs from completed-node count. New completions earn 10 XP; easy and full are equal. Old profile/node tables remain intact and read-only.
3. Missing historical metadata is labeled as unavailable, with local provenance. No attempt is made to claim old AI consent or recover an unsaved blocker. Missing completion timestamps use the original season start and are labeled as inferred; original rows remain available for review.
4. Streaks span seasons. A rest-only day preserves an existing streak but does not start one; at most two rest-only days in the trailing seven dates qualify. Completion days always qualify, including a day also marked rest. Rest awards no XP or milestone days. Today may still be unfinished: current streak remains visible if the latest qualifying date is yesterday.
5. Milestone unlocks are derived, not sticky stored awards; undo may remove a threshold. Supporting practices stay optional. One active season per user; archive preserves history and lifetime XP.
6. All client writes use owner-checking RPCs. Existing reward columns are retained solely for rollback/backfill, never updated by the new client. PostgreSQL configuration mirrors src/lib/progression.ts, verified by tests; the server is authoritative.
7. Stage branches intentionally require new migrations. A missing schema is an explicit retryable load error, never an empty-account signal and never a reason to overwrite a legacy tree. No production migration or deployment is performed.
8. Node's test runner via tsx and an embedded PostgreSQL (PGlite) are local development tools, not app/native runtime dependencies. They do not verify Supabase gateway/JWT integration or real-device behavior.
