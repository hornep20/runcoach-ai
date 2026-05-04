import { PlanType } from "@/generated/prisma/enums";
import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";

function humanizeWorkoutType(raw: string): string {
  return raw
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function parseDetails(description: string | null): string[] {
  if (!description) return [];
  return description
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const dynamic = "force-dynamic";

export default async function BaseBuildingPlanPage() {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Base-Building Plan</h1>
        <p className="mt-2 text-zinc-600">
          No athlete context yet. Set <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">RUNCOACH_DEFAULT_ATHLETE_ID</code> or create an Athlete.
        </p>
      </section>
    );
  }

  const plan = await prisma.trainingPlan.findFirst({
    where: {
      athleteId,
      type: PlanType.BASE_BUILDING,
    },
    orderBy: { createdAt: "desc" },
    include: {
      workouts: {
        orderBy: { date: "asc" },
      },
    },
  });

  if (!plan) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Base-Building Plan</h1>
        <p className="mt-2 text-zinc-600">
          No base-building plan yet. In <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">/coach</code>, ask:
          <span className="ml-1 rounded bg-zinc-100 px-1 py-0.5 text-xs">Create me an 8-10 week base-building plan and add it.</span>
        </p>
      </section>
    );
  }

  const startMs = plan.startDate.getTime();
  const weeks = new Map<number, typeof plan.workouts>();
  for (const w of plan.workouts) {
    const days = Math.max(0, Math.floor((w.date.getTime() - startMs) / (24 * 60 * 60 * 1000)));
    const weekNum = Math.floor(days / 7) + 1;
    const arr = weeks.get(weekNum) ?? [];
    arr.push(w);
    weeks.set(weekNum, arr);
  }
  const orderedWeeks = [...weeks.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Base-Building Plan</h1>
        <p className="mt-2 text-zinc-600">
          {plan.name} · {plan.startDate.toISOString().slice(0, 10)} to {plan.endDate.toISOString().slice(0, 10)} · {plan.workouts.length} workout{plan.workouts.length === 1 ? "" : "s"}
        </p>
      </section>

      {orderedWeeks.length === 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm text-sm text-zinc-600">
          This base plan exists but has no workouts yet.
        </section>
      ) : (
        orderedWeeks.map(([week, items]) => (
          <section
            key={week}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-zinc-900">Week {week}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {items.length} workout{items.length === 1 ? "" : "s"} ·{" "}
              {Math.round(
                items.reduce((acc, w) => acc + (w.distanceKm ?? 0), 0) * 10,
              ) / 10}{" "}
              km total
            </p>
            <div className="mt-4 space-y-3">
              {items.map((w) => (
                <div
                  key={w.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
                >
                  <p className="font-medium text-zinc-900">
                    {w.date.toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    — {w.title}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {humanizeWorkoutType(w.type)}
                    {w.distanceKm != null ? ` · ${Math.round(w.distanceKm * 10) / 10} km` : ""}
                    {w.distanceKm != null
                      ? ` (${Math.round((w.distanceKm / 1.609344) * 10) / 10} mi)`
                      : ""}
                    {w.durationMin != null ? ` · ${w.durationMin} min` : ""}
                  </p>
                  {parseDetails(w.description).length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                      {parseDetails(w.description).map((line, idx) => (
                        <li key={`${w.id}-${idx}`}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-500">No additional details.</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
