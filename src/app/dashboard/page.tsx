import { formatMiles } from "@/lib/distance";
import { getDashboardStats } from "@/lib/dashboard";

function Stat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-zinc-500">{helper}</p> : null}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
      {message}
    </div>
  );
}

function WeeklyMileageChart({
  data,
}: {
  data: Awaited<ReturnType<typeof getDashboardStats>>["weeklyTrend"];
}) {
  const maxDistance = Math.max(...data.map((d) => d.distanceMi), 1);

  if (data.length === 0) {
    return <EmptyChart message="Sync activities to populate weekly mileage." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex h-56 items-end gap-2 rounded-xl bg-zinc-50 p-4">
        {data.map((week) => {
          const height = Math.max((week.distanceMi / maxDistance) * 100, week.distanceMi > 0 ? 8 : 2);
          return (
            <div key={week.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-44 w-full items-end justify-center">
                <div
                  className="w-full max-w-8 rounded-t-md bg-zinc-900 transition-all"
                  style={{ height: `${height}%` }}
                  title={`${week.distanceMi} mi, ${week.runCount} runs`}
                />
              </div>
              <span className="truncate text-[10px] text-zinc-500">{week.label}</span>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Peak week" value={`${maxDistance.toFixed(1)} mi`} />
        <Stat
          label="Current week"
          value={`${(data.at(-1)?.distanceMi ?? 0).toFixed(1)} mi`}
        />
        <Stat
          label="Avg weekly load"
          value={`${Math.round(data.reduce((sum, w) => sum + w.trainingLoad, 0) / Math.max(data.length, 1))}`}
        />
      </div>
    </div>
  );
}

function RollingLoadChart({
  data,
}: {
  data: Awaited<ReturnType<typeof getDashboardStats>>["rolling28Trend"];
}) {
  const maxLoad = Math.max(...data.map((d) => d.trainingLoad), 1);
  const sampled = data.filter((_, index) => index % 3 === 0 || index === data.length - 1);

  if (data.length === 0) {
    return <EmptyChart message="Sync activities to populate rolling training load." />;
  }

  return (
    <div className="rounded-xl bg-zinc-50 p-4">
      <div className="flex h-56 items-end gap-1">
        {sampled.map((day) => {
          const height = Math.max((day.trainingLoad / maxLoad) * 100, day.trainingLoad > 0 ? 8 : 2);
          return (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-44 w-full items-end justify-center">
                <div
                  className="w-full max-w-4 rounded-t bg-zinc-700"
                  style={{ height: `${height}%` }}
                  title={`${day.label}: ${day.trainingLoad} load, ${day.distanceMi} mi`}
                />
              </div>
              <span className="hidden truncate text-[10px] text-zinc-500 sm:block">{day.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Stat
          label="Current 28-day load"
          value={`${data.at(-1)?.trainingLoad ?? 0}`}
          helper="Rolling sum from recent activities"
        />
        <Stat
          label="Current 28-day mileage"
          value={`${(data.at(-1)?.distanceMi ?? 0).toFixed(1)} mi`}
          helper="Useful for ramp-rate coaching"
        />
      </div>
    </div>
  );
}

function LongRunProgression({
  data,
}: {
  data: Awaited<ReturnType<typeof getDashboardStats>>["longRunProgression"];
}) {
  const maxDistance = Math.max(...data.map((d) => d.distanceMi), 1);

  if (data.length === 0) {
    return <EmptyChart message="Sync activities to populate long run progression." />;
  }

  return (
    <div className="space-y-3">
      {data.map((week) => {
        const width = Math.max((week.distanceMi / maxDistance) * 100, week.distanceMi > 0 ? 8 : 2);
        return (
          <div key={week.weekStart} className="grid grid-cols-[4.5rem_1fr_4rem] items-center gap-3 text-sm">
            <span className="text-zinc-500">{week.label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-zinc-900" style={{ width: `${width}%` }} />
            </div>
            <span className="text-right font-medium tabular-nums text-zinc-900">
              {week.distanceMi.toFixed(1)} mi
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 bg-zinc-950 px-6 py-8 text-white sm:px-8">
          <p className="text-sm font-medium text-zinc-300">RunCoach AI analytics</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Running Dashboard
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
            Imported Intervals.icu runs transformed into mileage, load, pace, long-run progression,
            and recent activity signals for AI coaching and marathon planning.
          </p>
        </div>
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
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Last 28 days" value={formatMiles(stats.last28.distanceMi, 1)} helper="Mileage" />
            <Stat label="Runs" value={String(stats.last28.runCount)} helper="Last 28 days" />
            <Stat label="Avg pace" value={stats.last28.pacePerMiLabel} helper="Moving time / distance" />
            <Stat label="Training load" value={stats.last28.trainingLoad} helper="Last 28 days" />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Panel
              title="Weekly mileage"
              description="Last 12 weeks of run volume. This is the first signal for consistency and ramp rate."
            >
              <WeeklyMileageChart data={stats.weeklyTrend} />
            </Panel>

            <Panel
              title="Rolling 28-day load"
              description="Rolling load and mileage trend for fatigue, readiness, and training-cycle context."
            >
              <RollingLoadChart data={stats.rolling28Trend} />
            </Panel>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <Panel
              title="Long run progression"
              description="Longest run from each week, useful for marathon readiness and durability tracking."
            >
              <LongRunProgression data={stats.longRunProgression} />
            </Panel>

            <Panel
              title="Recent runs"
              description="Most recent imported runs with distance, pace, heart rate, and training load."
            >
              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Run</th>
                      <th className="px-4 py-3 font-medium">Distance</th>
                      <th className="px-4 py-3 font-medium">Pace</th>
                      <th className="px-4 py-3 font-medium">HR</th>
                      <th className="px-4 py-3 font-medium">Load</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {stats.recentRuns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                          No imported runs yet.
                        </td>
                      </tr>
                    ) : (
                      stats.recentRuns.map((run) => (
                        <tr key={`${run.date}-${run.title}`} className="bg-white">
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{run.date}</td>
                          <td className="max-w-56 truncate px-4 py-3 font-medium text-zinc-900">
                            {run.title}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                            {run.distanceMi.toFixed(1)} mi
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">{run.paceLabel}</td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">{run.avgHr}</td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">{run.trainingLoad}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">All-time summary</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Runs" value={String(stats.allTime.runCount)} />
              <Stat label="Distance" value={formatMiles(stats.allTime.distanceMi, 1)} />
              <Stat label="Moving time" value={stats.allTime.movingTimeLabel} />
              <Stat label="Avg pace" value={stats.allTime.pacePerMiLabel} />
              <Stat label="Avg heart rate" value={stats.allTime.avgHr} />
              <Stat label="Max heart rate" value={stats.allTime.maxHr} />
              <Stat label="Elevation gain" value={stats.allTime.elevationFt} />
              <Stat label="Avg power" value={stats.allTime.avgWatts} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
