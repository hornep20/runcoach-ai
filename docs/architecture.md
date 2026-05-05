# RunCoach AI Architecture

This repo is set up as a full-stack AI training platform, not a notebook-only data science project.

## Product goal

RunCoach AI helps an endurance athlete turn real training data, structured marathon plans, uploaded coaching materials, and an LLM coach into clear daily training decisions.

## High-level system

```text
COROS -> Intervals.icu -> Next.js API route -> PostgreSQL/Prisma
                                      |
                                      v
                              Analytics layer
                                      |
                                      v
Next.js dashboard + calendar + plan builders + AI coach
                                      |
                                      v
OpenAI chat + embeddings + RAG over training docs, uploaded PDFs, athlete history, and planned workouts
```

## Core layers

### 1. App layer

- Next.js App Router
- TypeScript
- Tailwind CSS
- Server components for dashboard pages
- API routes for sync, coach chat, upload, and plan generation

### 2. Data layer

Primary database: PostgreSQL through Prisma.

Core entities:

- `Athlete`
- `ExternalActivity`
- `TrainingPlan`
- `Workout`
- `CoachConversation`
- `CoachMessage`
- `CoachUploadedDocument`
- `CoachKnowledgeChunk`

The current schema stores embeddings as `Float[]` for portability. For a larger production corpus, migrate `CoachKnowledgeChunk.embedding` to `pgvector` and add an approximate nearest neighbor index.

### 3. Sync layer

Intervals.icu is the first production data source because COROS can flow into Intervals.icu.

Minimum sync flow:

1. Store one `Athlete` row.
2. Set Intervals API credentials in `.env`.
3. Call `/api/sync/intervals` for activity list backfill.
4. Call `/api/sync/intervals/details` to enrich activities with detail payloads.

### 4. Analytics layer

Current analytics should focus on practical coaching features before complex ML:

- 7-day, 28-day, and all-time mileage
- Long-run progression
- Training load trend
- Pace trend
- HR and cadence trend
- Recent workout adherence
- Planned vs completed workouts

After the basics are reliable, add predictive models:

- Marathon finish-time estimate
- Fatigue or readiness score
- Injury-risk flags based on ramp rate, long-run percentage, and intensity distribution

### 5. RAG and AI coach layer

Knowledge sources:

- Markdown files in `docs/`
- Uploaded training-plan PDFs
- Recent imported activities
- Upcoming planned workouts
- Athlete coaching brief

Retrieval flow:

1. Convert docs/PDF text into chunks.
2. Embed chunks.
3. Retrieve chunks relevant to the user question.
4. Add live athlete context from the database.
5. Ask the model to produce grounded coaching advice.
6. Optionally allow tool calls that create planned workouts.

## Recommended production milestones

### Milestone 1: Local app is reliable

- App boots locally with seeded athlete data.
- Prisma migration works from a clean database.
- Dashboard handles empty state and imported data.
- Calendar shows planned workouts.

### Milestone 2: Data ingestion works end-to-end

- Intervals activity list sync works.
- Detail sync backfills richer activity payloads.
- Duplicate syncs upsert instead of duplicating rows.
- Sync results are summarized in the API response.

### Milestone 3: Resume-worthy analytics

- Add charts for weekly mileage, training load, pace, HR, and long-run progression.
- Add planned vs completed comparison.
- Add computed readiness/fatigue signals.

### Milestone 4: RAG coach v1

- Seed docs into `CoachKnowledgeChunk`.
- Upload and embed a PDF training plan.
- Coach cites which knowledge sources influenced the answer.
- Coach uses athlete data and upcoming workouts in the prompt.

### Milestone 5: Adaptive plan generation

- Generate base-building blocks.
- Generate 16-week marathon plans.
- Generate strength and mobility sessions that complement run load.
- Allow the coach to modify the plan with clear confirmation.

## Resume positioning

This project should be described as an end-to-end AI analytics product:

> Built a full-stack AI running coach using Next.js, TypeScript, PostgreSQL, Prisma, OpenAI, and RAG to sync real endurance training data, analyze training load and performance trends, and generate personalized marathon guidance from structured plans and athlete history.
