import { formatMiles } from "@/lib/distance";
import { getDashboardStats } from "@/lib/dashboard";
import { calculateTrainingStatusScore } from "@/lib/fatigue";

function getScoreColors(level: string) {
  switch (level) {
    case "low":
      return {
        bar: "bg-green-500",
        badge: "bg-green-50 text-green-700 border-green-200",
      };
    case "moderate":
      return {
        bar: "bg-yellow-500",
        badge: "bg-yellow-50 text-yellow-700 border-yellow-200",
      };
    case "good":
      return {
        bar: "bg-emerald-500",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "elevated":
      return {
        bar: "bg-orange-500",
        badge: "bg-orange-50 text-orange-700 border-orange-200",
      };
    case "high":
      return {
        bar: "bg-red-500",
        badge: "bg-red-50 text-red-700 border-red-200",
      };
    default:
      return {
        bar: "bg-zinc-900",
        badge: "bg-zinc-100 text-zinc-700 border-zinc-200",
      };
  }
}

function Stat({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-zinc-500">{helper}</p> : null}
    </div>
  );
}

function ScoreCard({ label, score, level, summary }: { label: string; score: number; level: string; summary: string }) {
  const pct = Math.max(0, Math.min(100, score * 10));
  const colors = getScoreColors(level);

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${level === "high" ? "ring-1 ring-red-200" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900">
            {score.toFixed(1)}
            <span className="text-base font-medium text-zinc-400">/10</span>
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${colors.badge}`}>
          {level}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-3 text-sm leading-5 text-zinc-600">{summary}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const trainingStatus = calculateTrainingStatusScore(stats);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-2">
        <ScoreCard
          label="Fatigue"
          score={trainingStatus.fatigue.score}
          level={trainingStatus.fatigue.level}
          summary={trainingStatus.fatigue.summary}
        />
        <ScoreCard
          label="Readiness"
          score={trainingStatus.readiness.score}
          level={trainingStatus.readiness.level}
          summary={trainingStatus.readiness.summary}
        />
      </section>
    </div>
  );
}
