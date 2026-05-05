import { formatMiles } from "@/lib/distance";
import { getDashboardStats } from "@/lib/dashboard";
import { calculateTrainingStatusScore } from "@/lib/fatigue";
import { generateTrainingInsights } from "@/lib/trainingInsights";
import {
  backfillTrainingStatusHistory,
  getDailyRunHoverStats,
  getTrainingStatusTrend,
  persistTrainingStatus,
} from "@/lib/trainingStatus";
import { RecentRuns } from "./recent-runs";
import { TrainingInsights } from "./training-insights";
import { TrainingTrendsCharts } from "./training-trends-charts";
import { TrainingStatusTrendCharts } from "./training-status-trend-charts";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  await backfillTrainingStatusHistory();
  const stats = await getDashboardStats();
  await persistTrainingStatus(stats);
  const trend = await getTrainingStatusTrend(10_000);
  const firstDate = trend[0]?.date;
  const lastDate = trend[trend.length - 1]?.date;
  const runStatsByDate =
    firstDate && lastDate
      ? await getDailyRunHoverStats(firstDate, lastDate)
      : {};
  const trainingStatus = calculateTrainingStatusScore(stats);
  const insights = generateTrainingInsights(trend, stats);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Running Dashboard</h1>
        <p className="mt-2 text-zinc-600">Imported activity trends, load metrics, and fatigue/readiness signal.</p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Last 28 Days</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Runs" value={String(stats.last28.runCount)} />
          <Stat label="Distance" value={formatMiles(stats.last28.distanceMi, 1)} />
          <Stat label="Moving time" value={stats.last28.movingTimeLabel} />
          <Stat label="Avg pace" value={stats.last28.pacePerMiLabel} />
          <Stat label="Avg HR" value={stats.last28.avgHr} />
          <Stat label="Training load" value={stats.last28.trainingLoad} />
        </div>
      </section>

      <Panel
        title="Training status"
        description="Heuristic score from your recent mileage/load progression."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat
            label={`Fatigue (${trainingStatus.fatigue.level})`}
            value={`${trainingStatus.fatigue.score.toFixed(1)} / 10`}
          />
          <Stat
            label={`Readiness (${trainingStatus.readiness.level})`}
            value={`${trainingStatus.readiness.score.toFixed(1)} / 10`}
          />
        </div>
      </Panel>

      <Panel
        title="AI Training Insights"
        description="Plain-English coaching takeaways from your fatigue, readiness, mileage, and load trends."
      >
        <TrainingInsights insights={insights} />
      </Panel>

      <Panel
        title="Fatigue and readiness trend"
        description="Historical daily status values."
      >
        <TrainingStatusTrendCharts data={trend} runStatsByDate={runStatsByDate} />
      </Panel>

      <Panel
        title="Training trends"
        description="Weekly mileage, rolling 28-day load, and long-run progression."
      >
        <TrainingTrendsCharts
          weeklyTrend={stats.weeklyTrend}
          rolling28Trend={stats.rolling28Trend}
          longRunProgression={stats.longRunProgression}
        />
      </Panel>

      <Panel title="Recent runs" description="Most recent imported runs and key metrics.">
        <RecentRuns runs={stats.recentRuns} />
      </Panel>
    </div>
  );
}
