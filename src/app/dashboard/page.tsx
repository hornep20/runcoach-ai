import { formatMiles } from "@/lib/distance";
import { getDashboardStats } from "@/lib/dashboard";
import { calculateTrainingStatusScore } from "@/lib/fatigue";
import { persistTrainingStatus, getTrainingStatusTrend } from "@/lib/trainingStatus";

// keep all existing helper components unchanged above...

function TrainingStatusTrendChart({ data }: { data: any[] }) {
  if (!data.length) {
    return <EmptyChart message="No historical fatigue data yet." />;
  }

  return (
    <div className="rounded-xl bg-zinc-50 p-4">
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Fatigue
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Readiness
        </span>
      </div>

      <div className="flex h-56 items-end gap-1">
        {data.map((d) => (
          <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-44 w-full items-end justify-center gap-0.5">
              <div
                className="w-full max-w-2 rounded-t bg-red-500"
                style={{ height: `${d.fatigueScore * 10}%` }}
                title={`${d.label}: fatigue ${d.fatigueScore}/10`}
              />
              <div
                className="w-full max-w-2 rounded-t bg-emerald-500"
                style={{ height: `${d.readinessScore * 10}%` }}
                title={`${d.label}: readiness ${d.readinessScore}/10`}
              />
            </div>
            <span className="hidden truncate text-[10px] text-zinc-500 sm:block">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  await persistTrainingStatus(stats);

  const trend = await getTrainingStatusTrend();

  const trainingStatus = calculateTrainingStatusScore(stats);

  return (
    <div className="space-y-6">
      {/* keep existing header + stats + cards unchanged */}

      <Panel
        title="Fatigue and readiness trend"
        description="Real historical scores based on your actual training load and mileage."
      >
        <TrainingStatusTrendChart data={trend} />
      </Panel>

      {/* rest of dashboard unchanged */}
    </div>
  );
}
