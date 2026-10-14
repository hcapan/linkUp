# Cisco SE LinkUP

Mentor–mentee matching for the Cisco SE community — a working demo of the
"SE Mentorship: Intake Profile & Architecture Taxonomy v5" specification and its
concept mockup. The spec itself is internal and not part of this repository; the
taxonomy and scoring rules it defines live in `packages/core`.

- **Web UI** (Next.js + shadcn/ui, light/dark): profile intake, find a mentor,
  top-3 matches with full scoring rationale, approvals, mentorship lifecycle,
  mentor directory, program/team dashboard.
- **100-point matching engine** (spec §5) as a pure, unit-tested TypeScript package.
- **Webex bot** in WebSocket mode — no public URL, webhook or ngrok needed.
- **No login (demo)**: pick any persona in the top bar; create new people freely.

## Quick start

Prerequisites: Node 22+, pnpm 10, Podman (with `podman compose`).

```bash
pnpm bootstrap    # install, build packages, start Postgres, migrate, seed 300 SEs
pnpm dev          # API on :4100, web on :5050
```

Open http://localhost:5050 → **Choose a demo persona** (top right).

| Persona (suggested in the switcher) | What to try |
|---|---|
| Program admin — Morgan Ellis (`mellis`) | Program dashboard, every mentorship, edit anyone |
| SE manager | Team dashboard and their direct reports' mentorships |
| Mentor with a request to approve | My mentorships → Approve / Decline |
| Mentee in an active mentorship | Mentorship journey, score rationale |
| New Associate SE | Find a mentor → top 3 → Request mentorship |

API docs (Swagger): http://127.0.0.1:4100/docs

### Useful commands

```bash
pnpm db:seed --fresh                 # regenerate demo data (persona ids change)
pnpm db:seed --fresh --count=10000   # scale test with 10k SEs
pnpm db:reset                        # drop schema, migrate, seed
pnpm test                            # matching-engine unit tests
pnpm typecheck
pnpm dev:bot                         # Webex bot (needs WEBEX_BOT_TOKEN)
```

Ports: web **5050** (5000 is taken by macOS AirPlay Receiver), API **4100**
(bound to 127.0.0.1), Postgres **5434**.

## Architecture

```
apps/web      Next.js 16 · shadcn/ui · Tailwind 4 — server components call the API
apps/api      NestJS 12 — profiles, matching, mentorship lifecycle, dashboard, bot outbox
apps/bot      Webex bot (webex-node-bot-framework, WebSocket mode)
packages/core taxonomy v5, zod schemas, 100-point engine (pure, no I/O)
packages/db   Drizzle schema + migrations (PostgreSQL + pgvector), demo seed
packages/embeddings  on-device MiniLM embeddings (transformers.js), hash fallback
```

```
Browser ──► Next.js (server actions, persona cookie)
                │  x-linkup-user
                ▼
             NestJS API ──► PostgreSQL + pgvector
                │                ▲
                │ outbox_events  │
                ▼                │
            Webex bot ◄──────────┘   (polls outbox; WebSocket to Webex)
```

### Data model (why PostgreSQL)

10,000 mostly-static profiles is a small workload; the data is relational
(person ↔ ratings ↔ taxonomy ↔ requests ↔ mentorships) and the dashboard needs
SQL. pgvector keeps bio embeddings in the same database.

- `taxonomy_items` mirrors `packages/core/src/taxonomy.ts`; every coded column
  references it. A v6 spec change = edit that file + `pnpm db:seed --taxonomy-only`.
- `people` — one profile per person (mentor, mentee or both), bio embedding.
- `person_skills` (L1–L3 per subcategory) and `person_tags(kind, code)` for all
  multi-selects — new questions add rows, not columns.
- `mentorship_requests` + `match_results` — immutable snapshots with the full
  score breakdown and algorithm version.
- `mentorships` — PENDING → ACTIVE (6 months) → COMPLETED, or DECLINED/CANCELLED.
  A partial unique index allows one open pairing per mentee/mentor.
- `outbox_events` — domain events delivered asynchronously (Webex today).

Scale notes: the mentor pool for a match is one SQL query with pgvector
similarity, scored in memory. Measured locally with `--count=10000`
(11,117 people, 5,440 mentors): match request ~0.47 s end-to-end (incl. goal
embedding), program dashboard ~90 ms, directory filters 10–30 ms. The API is
stateless and scales horizontally; next steps if needed are caching the mentor
pool and an HNSW index on `bio_embedding`.

### Matching rules (spec §5 + decisions made for the demo)

`TOTAL = S_tech 35 + S_biz 25 + S_stakeholder 20 + S_format 20 − penalties` —
see the in-app page **How matching works** or `packages/core/src/scoring.ts`.

- Role & architecture: graduated (same-arch Specialist 15; Portfolio with L2+ 10, L1 5; other-arch Specialist 0; for a Portfolio target: Portfolio 15, Specialist 5).
- Subcategory gap averaged across the mentee's 1–3 targets.
- Empty mentee preference = satisfied ("no constraint").
- Stakeholder disciplines are shown and used as a tie-breaker only (not scored).
- Same pod = same direct manager or a manager/report pair (−15). Timezone gap uses real IANA zones with DST (−10 above 4h).
- Top 3 always shown; ≥70 labelled Strong, otherwise Partial.

## Webex bot

1. Create a bot at https://developer.webex.com/my-apps → *Create a Bot*.
2. Put the token in `.env`: `WEBEX_BOT_TOKEN=…`
3. `pnpm dev:bot`
4. In Webex, message the bot: `link mellis` (attach your real Webex account to a
   demo persona), then `find mentor`.

Commands: `help`, `find mentor`, `my mentorships`, `link <cec-id>`, `whoami`.
The bot sends the mentee growth card, returns the top-3 matches card, delivers
approval cards to mentors and creates a 1:1 space on approval (only for people
who linked a real Webex account — seed people use `@example.com`).

### Why no ngrok

The bot opens an **outbound WebSocket** to Webex (the same mechanism the Webex
desktop app uses), so messages and card submissions arrive without any inbound
port. Constraints: run **one** bot instance in this mode. For production, switch
to webhooks behind a stable HTTPS endpoint (framework `webhookUrl` +
`webhookSecret`) — the handlers stay the same.

Other options if WebSockets were blocked: a small cloud function that receives
webhooks and writes to a queue the local worker pulls from; or a shared dev VM
with a real HTTPS URL. Public relays (smee.io etc.) are not recommended for
confidential data.

## Hosted demo (Cloudflare)

Web on Workers (OpenNext), API in a Cloudflare Container, Postgres on Neon,
behind Cloudflare Access. Step by step: [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

```bash
pnpm cf:login && pnpm cf:deploy:api && pnpm cf:secret:db && pnpm cf:deploy:web
```

## Known demo limits

- No authentication; `x-linkup-user` is trusted. Swap `ViewerGuard` for SSO/OIDC.
- Certifications are self-declared (Certmetrics later). Outlook/Graph booking not implemented.
- Directory/Workday import is a seed script; an import adapter can call `saveProfile()`.
- The Webex bot could not be exercised end-to-end without a bot token.
