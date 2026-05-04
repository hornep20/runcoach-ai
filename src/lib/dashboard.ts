import { formatDurationFromSeconds, metersToMiles } from "@/lib/distance";
import { formatPaceMinSec } from "@/lib/pace";
import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";
import { whereImportedRunSportTypes } from "@/lib/runSports";

const RUN_SELECT = {
  distanceM: true,
  durationSeconds: true,
  avgHr: true,
  maxHr: true,
  avgCadence: true,
  maxCadence: true,
  elevationGainM: true,
  calories: true,
  icuTrainingLoad: true,
  icuIntensity: true,
  icuAverageWatts: true,
  icuWeightedAvgWatts: true,
  paceSecPerKm: true,
} as const;

type RunRow = {
  distanceM: number | null;
  durationSeconds: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgCadence: number | null;
  maxCadence: number | null;
  elevationGainM: number | null;
  calories: number | null;
  icuTrainingLoad: number | null;
  icuIntensity: number | null;
  icuAverageWatts: number | null;
  icuWeightedAvgWatts: number | null;
  paceSecPerKm: number | null;
};

/** Prefer average watts; Intervals often fills weighted when average is absent. */
function wattsForAggregation(r: RunRow): number | null {
  return r.icuAverageWatts ?? r.icuWeightedAvgWatts;
}

export interface RunPeriodStats {
  runCount: number;
  distanceMi: number;
  movingTimeLabel: string;
  /** Overall pace across period: total moving time / total distance */
  pacePerMiLabel: string;
  avgHr: string;
  maxHr: string;
  avgCadence: string;
  maxCadence: string;
  elevationFt: string;
  calories: string;
  trainingLoad: string;
  avgIntensity: string;
  avgWatts: string;
}

function emptyStats(): RunPeriodStats {
  return {
    runCount: 0,
    distanceMi: 0,
    movingTimeLabel: "—",
    pacePerMiLabel: "—",
    avgHr: "—",
    maxHr: "—",
    avgCadence: "—",
    maxCadence: "—",
    elevationFt: "—",
    calories: "—",
    trainingLoad: "—",
    avgIntensity: "—",
    avgWatts: "—",
  };
}

function aggregateRuns(rows: RunRow[]): RunPeriodStats {
  if (rows.length === 0) {
    return emptyStats();
  }

  let totalDistM = 0;
  let totalMovingSec = 0;
  let weightedHr = 0;
  let hrWeight = 0;
  let weightedCad = 0;
  let cadWeight = 0;
  let weightedWatts = 0;
  let wattsWeight = 0;
  let weightedIntensity = 0;
  let intensityWeight = 0;
  let maxHrPeak: number | null = null;
  let maxCadPeak: number | null = null;
  let totalElM = 0;
  let totalCal = 0;
  let totalLoad = 0;

  for (const r of rows) {
    const d = r.distanceM ?? 0;
    const t = r.durationSeconds ?? 0;
    totalDistM += d;
    totalMovingSec += t;

    if (r.avgHr != null && t > 0) {
      weightedHr += r.avgHr * t;
      hrWeight += t;
    }
    if (r.avgCadence != null && t > 0) {
      weightedCad += r.avgCadence * t;
      cadWeight += t;
    }
    const watts = wattsForAggregation(r);
    if (watts != null && t > 0) {
      weightedWatts += watts * t;
      wattsWeight += t;
    }
    if (r.icuIntensity != null && t > 0) {
      weightedIntensity += r.icuIntensity * t;
      intensityWeight += t;
    }
    if (r.maxHr != null) {
      maxHrPeak = maxHrPeak == null ? r.maxHr : Math.max(maxHrPeak, r.maxHr);
    }
    if (r.maxCadence != null) {
      maxCadPeak =
        maxCadPeak == null ? r.maxCadence : Math.max(maxCadPeak, r.maxCadence);
    }
    if (r.elevationGainM != null) {
      totalElM += r.elevationGainM;
    }
    if (r.calories != null) {
      totalCal += r.calories;
    }
    if (r.icuTrainingLoad != null) {
      totalLoad += r.icuTrainingLoad;
    }
  }

  const distMi = metersToMiles(totalDistM);
  const paceSecPerMi =
    distMi > 1e-6 && totalMovingSec > 0 ? totalMovingSec / distMi : null;

  const avgHr = hrWeight > 0 ? weightedHr / hrWeight : null;
  const avgCad = cadWeight > 0 ? weightedCad / cadWeight : null;
  const avgWatts = wattsWeight > 0 ? weightedWatts / wattsWeight : null;
  const avgIntensity =
    intensityWeight > 0 ? weightedIntensity / intensityWeight : null;

  return {
    runCount: rows.length,
    distanceMi: distMi,
    movingTimeLabel: formatDurationFromSeconds(totalMovingSec),
    pacePerMiLabel: paceSecPerMi != null ? `${formatPaceMinSec(paceSecPerMi)} /mi` : "—",
    avgHr: avgHr != null ? `${avgHr.toFixed(0)} bpm` : "—",
    maxHr: maxHrPeak != null ? `${maxHrPeak} bpm` : "—",
    avgCadence: avgCad != null ? `${avgCad.toFixed(0)} spm` : "—",
    maxCadence: maxCadPeak != null ? `${Math.round(maxCadPeak)} spm` : "—",
    elevationFt:
      totalElM > 0 ? `${Math.round(totalElM * 3.28084).toLocaleString()} ft` : "—",
    calories: totalCal > 0 ? `${Math.round(totalCal).toLocaleString()}` : "—",
    trainingLoad: totalLoad > 0 ? `${Math.round(totalLoad * 10) / 10}` : "—",
    avgIntensity:
      avgIntensity != null ? `${Math.round(avgIntensity * 10) / 10}%` : "—",
    avgWatts: avgWatts != null ? `${Math.round(avgWatts)} W` : "—",
  };
}

export interface DashboardStats {
  athleteId: string | null;
  allTime: RunPeriodStats;
  last28: RunPeriodStats;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const athleteId = await resolveAthleteIdForRead();

  if (!athleteId) {
    return {
      athleteId: null,
      allTime: emptyStats(),
      last28: emptyStats(),
    };
  }

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const runWhere = {
    athleteId,
    ...whereImportedRunSportTypes(),
  };

  const [allRuns, recentRuns] = await Promise.all([
    prisma.externalActivity.findMany({
      where: runWhere,
      select: RUN_SELECT,
    }),
    prisma.externalActivity.findMany({
      where: {
        ...runWhere,
        startTime: { gte: fourWeeksAgo },
      },
      select: RUN_SELECT,
    }),
  ]);

  return {
    athleteId,
    allTime: aggregateRuns(allRuns),
    last28: aggregateRuns(recentRuns),
  };
}
