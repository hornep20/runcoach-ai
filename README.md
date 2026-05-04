# RunCoach AI

Marathon coaching web app (Next.js + TypeScript + Prisma + PostgreSQL). See [docs/project-brief.md](docs/project-brief.md) for product scope.

## Setup

1. Copy [`.env.example`](.env.example) to `.env` and fill in values.
2. Install dependencies: `npm install`
3. Apply database schema: `npx prisma migrate dev`
4. Run the app: `npm run dev`

## Intervals.icu sync (COROS and other sources)

COROS data typically flows into Intervals.icu first. RunCoach imports **completed activities** from the Intervals API into `ExternalActivity` rows.

1. Create an **Athlete** in the database (e.g. Prisma Studio) or set `RUNCOACH_DEFAULT_ATHLETE_ID` to an existing Athlete `id`.
2. In Intervals.icu → **Settings** → **Developer Settings**, create an **API key**.
3. Set in `.env`:
   - `INTERVALS_ICU_API_KEY`
   - `SYNC_SECRET_TOKEN` (any long random string you choose)
   - Optional: `INTERVALS_ICU_ATHLETE_ID` (default `0` = athlete for that API key)

Trigger a full backfill (can take a while):

```bash
curl -X POST http://localhost:3000/api/sync/intervals ^
  -H "Content-Type: application/json" ^
  -H "X-Sync-Secret: YOUR_SYNC_SECRET_TOKEN" ^
  -d "{}"
```

Optional body to target a specific DB athlete:

```json
{ "athleteId": "clxxxxxxxx" }
```

### Phase 2: full activity documents

After the list backfill, you can fetch **`GET /api/v1/activity/{id}`** for each stored row to refresh scalar fields from the richer payload and save the full JSON in `detailPayload` (the list response stays in `rawPayload`). This is slow (one HTTP call per activity, with a short delay between requests).

```bash
curl -X POST http://localhost:3000/api/sync/intervals/details ^
  -H "Content-Type: application/json" ^
  -H "X-Sync-Secret: YOUR_SYNC_SECRET_TOKEN" ^
  -d "{}"
```

Optional JSON body:

- `athleteId` — same as list sync
- `limit` — max activities to process this run (default 5000, hard cap 20000)
- `force` — when `true`, re-fetch even if `detailFetchedAt` is already set
- `includeIntervals` — when `false`, omit `?intervals=true` for a smaller response

Then open **Calendar** and **Dashboard** to see imported runs.

## AI coach (RAG)

1. Set **`OPENAI_API_KEY`** in `.env` (see [`.env.example`](.env.example)).
2. Apply migrations (`npx prisma migrate dev`) so **`CoachKnowledgeChunk`**, **`CoachUploadedDocument`**, and **`Athlete.coachingBrief`** exist.
3. Index markdown under **`docs/`** (embeddings stored as PostgreSQL **`double precision[]`** — no `pgvector` required for typical sizes):

```bash
npm run seed:coach-knowledge
```

4. Open **`/coach`**:
   - **Plan strategy** — textarea saved to the athlete row when you send a message (e.g. blending an 8–10 week base block with a 16-week marathon plan).
   - **PDF** — upload a text-based plan PDF; it is chunked, embedded, and searchable like `docs/`.
   - **Calendar target** — choose a **`TrainingPlan`**; the coach can call **`create_planned_workouts`** to insert **`Workout`** rows on that plan when you ask (e.g. “add next week’s easy runs”).
5. **`POST /api/coach/chat`** — RAG on your latest user message plus a richer snapshot: last 28-day imported-run stats, recent activities, upcoming planned workouts for the selected plan, and your coaching brief.

Optional: **`OPENAI_CHAT_MODEL`** (default `gpt-4o-mini`).

**`GET /api/training-plans`** — JSON list of plans for the resolved athlete (for scripts or future UI).

## Scripts

- `npm run verify:intervals-map` — validates activity JSON mapping against the checked-in fixture (no network).
- `npm run seed:coach-knowledge` — chunks `docs/**/*.md`, embeds via OpenAI, fills `CoachKnowledgeChunk` (requires `OPENAI_API_KEY` and network).

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Intervals.icu API](https://intervals.icu/api-docs.html)
