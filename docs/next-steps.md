# RunCoach AI — Next Steps (High Impact)

This is not an empty repo. You already have:

- Next.js app shell
- Prisma schema
- Intervals sync pipeline
- Dashboard page
- AI coach + RAG scaffolding

The goal now is to make this **resume-elite**.

## Phase 1: Make current features real (1–2 weeks)

### Dashboard upgrades

- Add charts (weekly mileage, training load, pace trend)
- Add rolling averages (7-day, 28-day)
- Add long-run progression chart
- Add PR detection (fastest mile, 5k, etc.)

### Calendar

- Render `Workout` rows on a calendar UI
- Show completed vs planned runs
- Highlight missed workouts

## Phase 2: AI coach that actually feels intelligent (2–3 weeks)

### RAG improvements

- Show sources used in responses (docs vs uploaded PDFs vs history)
- Weight recent activity more heavily in retrieval
- Add conversation memory beyond a single request

### Coaching context

Inject into prompt:

- Last 7 and 28 day mileage
- Upcoming workouts
- Recent fatigue indicators
- Athlete goal (from `coachingBrief`)

## Phase 3: Adaptive planning (this is the differentiator)

### Plan generator

- Base-building generator (progressive mileage)
- 16-week marathon plan generator

### Plan adjustment

- Detect missed workouts
- Adjust next week automatically
- Add recovery weeks based on load

## Phase 4: Data science layer (what gets interviews)

Add real modeling, not toy ML:

- Marathon time prediction (based on pace + volume)
- Fatigue score (load, ramp rate, intensity)
- Injury risk heuristics (weekly mileage increase, long-run %)

## Phase 5: Production polish

- Background job for daily sync
- Loading states and error handling
- Basic logging
- Deployment (Vercel + managed Postgres)

## Phase 6: Resume differentiation (optional but powerful)

- Add agent-based coaching (planner + advisor roles)
- Add pgvector and similarity search at scale
- Add multi-user support

## What to build next (in order)

1. Dashboard charts (highest ROI)
2. Calendar UI
3. RAG response quality improvements
4. Plan generation
5. Prediction models

If you stop after step 3, you already have a strong project.

If you get to step 5, this becomes a top-tier portfolio piece.
