import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDistanceKm, parseDistanceUnits } from "@/lib/distance";
import { getPlannedWorkoutForViewer } from "@/lib/calendar";

function buildBackHref(filter: string, units: string): string {
  const q = new URLSearchParams();
  if (filter !== "all") {
    q.set("filter", filter);
  }
  if (units === "mi") {
    q.set("units", "mi");
  }
  const qs = q.toString();
  return qs ? `/calendar?${qs}` : "/calendar";
}

function humanizeWorkoutType(raw: string): string {
  return raw
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default async function PlannedWorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ units?: string; filter?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const units = parseDistanceUnits(sp.units);
  const filter = sp.filter?.trim() || "all";
  const backHref = buildBackHref(filter, units);

  const workout = await getPlannedWorkoutForViewer(id);
  if (!workout) {
    notFound();
  }

  const dist = formatDistanceKm(workout.distanceKm ?? undefined, units) || "—";
  const dateStr = workout.date.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
        >
          ← Back to calendar
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Planned workout
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {workout.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {dateStr} · {humanizeWorkoutType(workout.type)}
        </p>
        <p className="mt-1 text-sm text-zinc-600">Plan: {workout.trainingPlan.name}</p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Details</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 pb-3">
            <dt className="text-zinc-500">Distance ({units})</dt>
            <dd className="font-medium tabular-nums text-zinc-900">{dist}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 pb-3">
            <dt className="text-zinc-500">Duration</dt>
            <dd className="font-medium text-zinc-900">
              {workout.durationMin != null ? `${workout.durationMin} min` : "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-zinc-500">Description</dt>
            <dd className="text-zinc-900">
              {workout.description?.trim() ? workout.description : "—"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
