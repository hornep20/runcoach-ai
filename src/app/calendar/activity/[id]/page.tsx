import Link from "next/link";
import { notFound } from "next/navigation";

import {
  formatDurationFromSeconds,
  formatDistanceKm,
  parseDistanceUnits,
} from "@/lib/distance";
import { getImportedActivityForViewer } from "@/lib/calendar";
import { formatPaceMinSec } from "@/lib/pace";

const KM_PER_MI = 1.609344;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function numStr(n: number | null | undefined, opts?: { suffix?: string; digits?: number }): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }
  const digits = opts?.digits ?? 0;
  const s = digits === 0 ? String(Math.round(n)) : n.toFixed(digits);
  return `${s}${opts?.suffix ?? ""}`;
}

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

export default async function ImportedActivityPage({
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

  const activity = await getImportedActivityForViewer(id);
  if (!activity) {
    notFound();
  }

  const distanceKm =
    activity.distanceM != null ? activity.distanceM / 1000 : undefined;
  const distLabel = formatDistanceKm(distanceKm, units) || "—";

  const paceKm =
    activity.paceSecPerKm != null && activity.paceSecPerKm > 0
      ? `${formatPaceMinSec(activity.paceSecPerKm)} /km`
      : "—";
  const paceMi =
    activity.paceSecPerKm != null && activity.paceSecPerKm > 0
      ? `${formatPaceMinSec(activity.paceSecPerKm * KM_PER_MI)} /mi`
      : "—";

  const moving = formatDurationFromSeconds(activity.durationSeconds ?? 0);
  const elapsed =
    activity.elapsedSeconds != null && activity.elapsedSeconds > 0
      ? formatDurationFromSeconds(activity.elapsedSeconds)
      : "—";

  const elevM = numStr(activity.elevationGainM, { suffix: " m", digits: 0 });
  const elevFt =
    activity.elevationGainM != null && activity.elevationGainM > 0
      ? `${Math.round(activity.elevationGainM * 3.28084).toLocaleString()} ft`
      : "—";

  const avgSpeed =
    activity.avgSpeed != null && activity.avgSpeed > 0
      ? `${activity.avgSpeed.toFixed(2)} m/s`
      : "—";
  const maxSpeed =
    activity.maxSpeed != null && activity.maxSpeed > 0
      ? `${activity.maxSpeed.toFixed(2)} m/s`
      : "—";

  const wattsAvg = numStr(activity.icuAverageWatts, { suffix: " W", digits: 0 });
  const wattsW = numStr(activity.icuWeightedAvgWatts, { suffix: " W", digits: 0 });
  const ftp = numStr(activity.icuFtp, { suffix: " W", digits: 0 });

  const zoneLabel = activity.zoneTimes == null ? "—" : "Yes";

  const detailSynced =
    activity.detailFetchedAt != null
      ? activity.detailFetchedAt.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not yet (run detail sync for full JSON)";

  const when = activity.startTime.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

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
          Imported activity
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {activity.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {when}
          {activity.sportType ? ` · ${activity.sportType}` : ""}
        </p>
        {activity.source ? (
          <p className="mt-1 text-xs text-zinc-500">Source: {activity.source}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Distance & pace</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label={`Distance (${units})`} value={distLabel} />
          <Stat label="Pace (/km)" value={paceKm} />
          <Stat label="Pace (/mi)" value={paceMi} />
          <Stat label="Moving time" value={moving} />
          <Stat label="Elapsed time" value={elapsed} />
          <Stat label="Trainer" value={activity.trainer == null ? "—" : activity.trainer ? "Yes" : "No"} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Heart rate & cadence</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Avg heart rate" value={numStr(activity.avgHr, { suffix: " bpm" })} />
          <Stat label="Max heart rate" value={numStr(activity.maxHr, { suffix: " bpm" })} />
          <Stat label="Avg cadence" value={numStr(activity.avgCadence, { suffix: " spm", digits: 0 })} />
          <Stat label="Max cadence" value={numStr(activity.maxCadence, { suffix: " spm", digits: 0 })} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Elevation & speed</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Elevation (m)" value={elevM} />
          <Stat label="Elevation (ft)" value={elevFt} />
          <Stat label="Avg speed" value={avgSpeed} />
          <Stat label="Max speed" value={maxSpeed} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Load & power</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Calories" value={numStr(activity.calories, { digits: 0 })} />
          <Stat label="Training load" value={numStr(activity.icuTrainingLoad, { digits: 1 })} />
          <Stat label="Intensity" value={numStr(activity.icuIntensity, { digits: 1 })} />
          <Stat label="FTP (activity)" value={ftp} />
          <Stat label="Avg power" value={wattsAvg} />
          <Stat label="Weighted avg power" value={wattsW} />
          <Stat label="Zone times" value={zoneLabel} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Sync</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stat label="Detail payload fetched" value={detailSynced} />
          <Stat label="External ID" value={activity.externalId} />
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          List sync stores a summary row; POST{" "}
          <code className="rounded bg-zinc-100 px-1">/api/sync/intervals/details</code> fills{" "}
          <code className="rounded bg-zinc-100 px-1">detailPayload</code> for the full Intervals
          document.
        </p>
      </section>
    </div>
  );
}
