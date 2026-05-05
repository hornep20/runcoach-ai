# RunCoach AI

RunCoach AI is a full-stack running analytics and coaching platform that transforms raw training data into explainable fatigue, readiness, and coaching insights.

Built with Next.js, TypeScript, Prisma, and PostgreSQL.

---

## 🚀 Features

### 📊 Training Dashboard
- 28-day training summary (mileage, pace, load, frequency)
- Weekly mileage trends
- Rolling 28-day training load
- Long run progression tracking
- Recent runs table (distance, pace, HR, load)

---

### 🧠 Fatigue & Readiness Modeling
- Explainable fatigue score (1–10)
- Readiness score derived from fatigue
- Fatigue modeled as:
  - Base training stress from rolling load
  - Adjustments from spikes (mileage, long runs, frequency)
- Transparent scoring with factor breakdowns

---

### 📈 Historical Trend Tracking
- Daily persisted fatigue and readiness snapshots
- Time-series trend chart
- Hover insights (distance, load, run count, time)
- True historical tracking (not derived estimates)

---

### 💡 Training Insights Engine
- Deterministic rule-based coaching insights
- Detects:
  - Fatigue trends (rising / falling)
  - Readiness changes
  - Mileage spikes
  - Load increases
  - Long run progression risks
- Outputs structured:
  - title
  - evidence
  - recommendation

---

### 🤖 AI Coach (RAG)
- Chat-based coaching assistant
- Uses:
  - athlete training data
  - recent runs + stats
  - uploaded PDFs (training plans)
  - indexed docs from `/docs`
- Retrieval-Augmented Generation (RAG) system
- Structured prompts + tool calling

---

### 🔄 Data Pipeline
- Syncs activities from Intervals.icu (COROS-compatible)
- Stores activities in PostgreSQL
- Supports:
  - full backfill
  - detailed activity fetch
- Enables time-series analytics and feature engineering

---

## 🧱 Architecture Overview

```
Intervals API → ExternalActivity (DB)
               ↓
        Feature Engineering
               ↓
   Fatigue / Readiness Model
               ↓
 TrainingStatusSnapshot (time-series)
               ↓
 Dashboard + Insights + AI Coach
```

---

## 🛠️ Setup

1. Copy environment file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Run database migrations:

```bash
npx prisma migrate dev
npx prisma generate
```

4. Start the app:

```bash
npm run dev
```

---

## 🔄 Intervals.icu Sync

1. Create an athlete in DB or set:

```
RUNCOACH_DEFAULT_ATHLETE_ID
```

2. Add to `.env`:

```
INTERVALS_ICU_API_KEY
SYNC_SECRET_TOKEN
```

3. Run sync:

```bash
curl -X POST http://localhost:3000/api/sync/intervals \
  -H "Content-Type: application/json" \
  -H "X-Sync-Secret: YOUR_SYNC_SECRET_TOKEN"
```

---

## 🤖 AI Coach Setup

1. Add API key:

```
OPENAI_API_KEY=...
```

2. Index knowledge base:

```bash
npm run seed:coach-knowledge
```

3. Open:

```
/coach
```

---

## 📦 Key Models

- `ExternalActivity` → raw training data
- `TrainingStatusSnapshot` → daily fatigue/readiness
- `CoachKnowledgeChunk` → RAG embeddings
- `Athlete` → user context

---

## 🎯 What This Project Demonstrates

This project showcases:

- Full-stack application development (Next.js + TypeScript)
- PostgreSQL data modeling with Prisma
- External API ingestion and normalization
- Time-series analytics and feature engineering
- Explainable scoring systems (fatigue/readiness)
- Persistent derived metrics (daily snapshots)
- Deterministic insight generation
- RAG-based AI system integration
- Data + AI product design

---

## 🔮 Future Improvements

- LLM polishing layer for coaching tone
- Smoothed trend lines (moving averages)
- Performance-based fatigue signals (pace vs HR)
- Automated background jobs for snapshot persistence
- Multi-athlete support + auth

---

## 📚 Learn More

- Next.js: https://nextjs.org/docs
- Intervals API: https://intervals.icu/api-docs.html
