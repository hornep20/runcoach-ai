import { formatMiles } from "@/lib/distance";
import { getDashboardStats } from "@/lib/dashboard";

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Running Dashboard</h1>
        <p className="mt-2 text-zinc-600">
          Imported runs from Intervals.icu (including Run, Trail, Virtual, Track, Treadmill).
          Distances in miles; pace is overall moving time divided by total distance. Heart rate,
          cadence, intensity, and power are weighted by moving time where data exists. Power uses
          average watts when present, otherwise weighted average watts from Intervals. Re-run list
          sync and optional detail sync to backfill fields on older activities.
        </p>
      </section>

      {!stats.athleteId ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Imported runs</h2>
          <p className="mt-2 text-sm text-zinc-600">
            No athlete context yet. Add an Athlete in the database or set{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">RUNCOACH_DEFAULT_ATHLETE_ID</code>
            .
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">All-time</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Runs" value={String(stats.allTime.runCount)} />
              <Stat label="Distance" value={formatMiles(stats.allTime.distanceMi, 1)} />
              <Stat label="Moving time" value={stats.allTime.movingTimeLabel} />
              <Stat label="Avg pace" value={stats.allTime.pacePerMiLabel} />
              <Stat label="Avg heart rate" value={stats.allTime.avgHr} />
              <Stat label="Max heart rate (peak)" value={stats.allTime.maxHr} />
              <Stat label="Avg cadence" value={stats.allTime.avgCadence} />
              <Stat label="Max cadence (peak)" value={stats.allTime.maxCadence} />
              <Stat label="Elevation gain" value={stats.allTime.elevationFt} />
              <Stat label="Calories (estimated)" value={stats.allTime.calories} />
              <Stat label="Training load (sum)" value={stats.allTime.trainingLoad} />
              <Stat label="Avg intensity (where recorded)" value={stats.allTime.avgIntensity} />
              <Stat label="Avg power (where recorded)" value={stats.allTime.avgWatts} />
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Last 28 days</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Runs" value={String(stats.last28.runCount)} />
              <Stat label="Distance" value={formatMiles(stats.last28.distanceMi, 1)} />
              <Stat label="Moving time" value={stats.last28.movingTimeLabel} />
              <Stat label="Avg pace" value={stats.last28.pacePerMiLabel} />
              <Stat label="Avg heart rate" value={stats.last28.avgHr} />
              <Stat label="Max heart rate (peak)" value={stats.last28.maxHr} />
              <Stat label="Avg cadence" value={stats.last28.avgCadence} />
              <Stat label="Max cadence (peak)" value={stats.last28.maxCadence} />
              <Stat label="Elevation gain" value={stats.last28.elevationFt} />
              <Stat label="Calories (estimated)" value={stats.last28.calories} />
              <Stat label="Training load (sum)" value={stats.last28.trainingLoad} />
              <Stat label="Avg intensity (where recorded)" value={stats.last28.avgIntensity} />
              <Stat label="Avg power (where recorded)" value={stats.last28.avgWatts} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
