# Database and architecture

The application uses Next.js App Router under `src/app`, reusable UI under `src/components`, and shared server business logic under `src/lib`. Keep feature-specific actions in `src/app/actions` and validation in `src/lib/validations`. The future Android client should call authenticated route handlers backed by the same server-side business logic; server actions alone are not a mobile API. Add folders when a feature needs them.

## Setup

Install with `bun install`. Copy `.env.example` to `.env` and supply a Neon pooled `DATABASE_URL` and direct `DIRECT_URL` (both with SSL). Do not commit credentials. The Prisma CLI and seed prefer the direct URL; application connections should use the pooled URL. Run `bun run db:generate`, `bunx prisma migrate deploy`, then `bun run db:seed`. For new development changes use `bun run db:migrate`; review generated SQL, especially the custom indexes and checks in the initial migration. Build generates the client automatically. Prisma 7.10 uses `prisma.config.ts` and the PostgreSQL driver adapter.

## Relationships and decisions

Better Auth's User owns accounts and login sessions. A user owns subjects, focus settings, goals, study sessions, plants, achievements and distraction settings. A study session has at most one reward, keyed by session ID. Each reward can contribute time to a plant; plant growth is cumulative. Species and achievements are shared reference data. XP can be summed from rewards; levels and streaks should be calculated by versioned business rules. A personal garden is the user's plant collection, so it does not need a separate table. Study history remains if a subject is deleted; goals for a deleted subject are removed. User deletion cascades to private data.

Rooms have one owner, memberships, hashed invitation tokens, shared sessions and room plants. Membership and achievement composite keys prevent duplicates. The owner is represented separately from membership; room creation must insert both atomically. Presence and real-time transport are not implemented; persisted focus status is not proof of current connectivity. Design the room event and collaborative reward model when Phase 7 chooses a deployment-compatible real-time service.

PostgreSQL stores instants as `timestamptz`. Settings store an IANA timezone; daily and weekly reporting must calculate local boundaries with a timezone-aware library, including daylight-saving transitions. Schedule weekdays are ISO 1–7 and times are minutes after local midnight; split overnight schedules into two entries. Website entries are configuration for a future extension and do not block browsing by themselves.

## Invariants for later phases

The migration adds a partial unique index for one active or paused study session per user and a unique reward per session. Complete sessions, insert the reward, increment plant growth and award achievements in one transaction; use conditional updates/version checks and retry conflicts. Validate elapsed time against server-recorded timestamps, paused intervals and limits; no browser can prove attention. The schema stores elapsed seconds and resume timestamps, not a full pause audit. A stopped session receives no automatic reward. Server-side authorization must check ownership for every query and mutation, including subject/session/plant ownership across references. The database foreign keys do not enforce all cross-user ownership or room permissions. Never trust a client-supplied user ID. Validate IANA timezones, hostname normalization, target limits, invite permissions and room membership server-side. Store invitation token hashes only and atomically enforce usage limits. Auth configuration must be verified against Better Auth's generated schema in Phase 2.

The SQL migration has not been applied until a database is configured. Database authorization, concurrent updates, migrations and seeds require integration tests against a disposable PostgreSQL database; static schema validation cannot substitute for them.
