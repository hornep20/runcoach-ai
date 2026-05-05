import { formatDurationFromSeconds, metersToMiles } from "@/lib/distance";
import { formatPaceMinSec } from "@/lib/pace";
import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";
import { whereImportedRunSportTypes } from "@/lib/runSports";

const RUN_SELECT = {
  startTime: true,
  title: true,
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
  startTime: Date;
  title: string;
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

export interface WeeklyRunTrend {
  weekStart: string;
  label: string;
  runCount: number;
  distanceMi: number;
  trainingLoad: number;
  movingHours: number;
}

export interface RollingRunTrend {
  date: string;
  label: string;
  distanceMi: number;
  trainingLoad: number;
}

export interface LongRunProgressionPoint {
  weekStart: string;
  label: string;
  distanceMi: number;
  title: string;
}

export interface RecentRunSummary {
  date: string;
  title: string;
  distanceMi: number;
  durationLabel: string;
  paceLabel: string;
  avgHr: string;
  trainingLoad: string;
}

function emptyStats(): RunPeriodStats {
  return {
    runCount: 0,
    distanceMi: 0,
    movingTimeLabel: "-",
    pacePerMiLabel: "-",
    avgHr: "-",
    maxHr: "-",
    avgCadence: "-",
    maxCadence: "-",
    elevationFt: "-",
    calories: "-",
    trainingLoad: "-",
    avgIntensity: "-",
    avgWatts: "-",
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
    pacePerMiLabel: paceSecPerMi != null ? `${formatPaceMinSec(paceSecPerMi)} /mi` : "-",
    avgHr: avgHr != null ? `${avgHr.toFixed(0)} bpm` : "-",
    maxHr: maxHrPeak != null ? `${maxHrPeak} bpm` : "-",
    avgCadence: avgCad != null ? `${avgCad.toFixed(0)} spm` : "-",
    maxCadence: maxCadPeak != null ? `${Math.round(maxCadPeak)} spm` : "-",
    elevationFt:
      totalElM > 0 ? `${Math.round(totalElM * 3.28084).toLocaleString()} ft` : "-",
    calories: totalCal > 0 ? `${Math.round(totalCal).toLocaleString()}` : "-",
    trainingLoad: totalLoad > 0 ? `${Math.round(totalLoad * 10) / 10}` : "-",
    avgIntensity:
      avgIntensity != null ? `${Math.round(avgIntensity * 10) / 10}%` : "-",
    avgWatts: avgWatts != null ? `${Math.round(avgWatts)} W` : "-",
  };
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shortDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function buildWeeklyTrend(rows: RunRow[], weeks = 12): WeeklyRunTrend[] {
  const thisWeek = startOfWeek(new Date());
  const firstWeek = addDays(thisWeek, -7 * (weeks - 1));
  const buckets = new Map<string, WeeklyRunTrend>();

  for (let i = 0; i < weeks; i += 1) {
    const weekStart = addDays(firstWeek, i * 7);
    const key = dateKey(weekStart);
    buckets.set(key, {
      weekStart: key,
      label: shortDateLabel(weekStart),
      runCount: 0,
      distanceMi: 0,
      trainingLoad: 0,
      movingHours: 0,
    });
  }

  for (const r of rows) {
    const weekStart = startOfWeek(r.startTime);
    const key = dateKey(weekStart);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.runCount += 1;
    bucket.distanceMi += metersToMiles(r.distanceM ?? 0);
    bucket.trainingLoad += r.icuTrainingLoad ?? 0;
    bucket.movingHours += (r.durationSeconds ?? 0) / 3600;
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    distanceMi: Math.round(bucket.distanceMi * 10) / 10,
    trainingLoad: Math.round(bucket.trainingLoad * 10) / 10,
    movingHours: Math.round(bucket.movingHours * 10) / 10,
  }));
}

function buildRollingTrend(rows: RunRow[], days = 42): RollingRunTrend[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = addDays(today, -(days - 1));

  const rowsByDay = new Map<string, RunRow[]>();
  for (const r of rows) {
    const key = dateKey(r.startTime);
    const dayRows = rowsByDay.get(key) ?? [];
    dayRows.push(r);
    rowsByDay.set(key, dayRows);
  }

  const result: RollingRunTrend[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDays(firstDay, i);
    const windowStart = addDays(day, -27);
    const windowRows = rows.filter(
      (r) => r.startTime >= windowStart && r.startTime <= addDays(day, 1),
    );
    const distanceMi = windowRows.reduce(
      (sum, r) => sum + metersToMiles(r.distanceM ?? 0),
      0,
    );
    const trainingLoad = windowRows.reduce(
      (sum, r) => sum + (r.icuTrainingLoad ?? 0),
      0,
    );
    result.push({
      date: dateKey(day),
      label: shortDateLabel(day),
      distanceMi: Math.round(distanceMi * 10) / 10,
      trainingLoad: Math.round(trainingLoad * 10) / 10,
    });
  }

  return result;
}

function buildLongRunProgression(rows: RunRow[], weeks = 12): LongRunProgressionPoint[] {
  const weekly = new Map<string, LongRunProgressionPoint>();
  const thisWeek = startOfWeek(new Date());
  const firstWeek = addDays(thisWeek, -7 * (weeks - 1));

  for (let i = 0; i < weeks; i += 1) {
    const weekStart = addDays(firstWeek, i * 7);
    const key = dateKey(weekStart);
    weekly.set(key, {
      weekStart: key,
      label: shortDateLabel(weekStart),
      distanceMi: 0,
      title: "No run",
    });
  }

  for (const r of rows) {
    const weekStart = startOfWeek(r.startTime);
    const key = dateKey(weekStart);
    const existing = weekly.get(key);
    if (!existing) continue;
    const distanceMi = metersToMiles(r.distanceM ?? 0);
    if (distanceMi > existing.distanceMi) {
      weekly.set(key, {
        ...existing,
        distanceMi: Math.round(distanceMi * 10) / 10,
        title: r.title,
      });
    }
  }

  return [...weekly.values()];
}

function summarizeRecentRuns(rows: RunRow[], limit = 8): RecentRunSummary[] {
  return rows.slice(0, limit).map((r) => {
    const distanceMi = metersToMiles(r.distanceM ?? 0);
    const durationSeconds = r.durationSeconds ?? 0;
    const paceSecPerMi = distanceMi > 0 ? durationSeconds / distanceMi : null;

    return {
      date: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(r.startTime),
      title: r.title,
      distanceMi: Math.round(distanceMi * 10) / 10,
      durationLabel: formatDurationFromSeconds(durationSeconds),
      paceLabel: paceSecPerMi != null ? `${formatPaceMinSec(paceSecPerMi)} /mi` : "-",
      avgHr: r.avgHr != null ? `${r.avgHr} bpm` : "-",
      trainingLoad:
        r.icuTrainingLoad != null ? `${Math.round(r.icuTrainingLoad * 10) / 10}` : "-",
    };
  });
}

export interface DashboardStats {
  athleteId: string | null;
  allTime: RunPeriodStats;
  last28: RunPeriodStats;
  weeklyTrend: WeeklyRunTrend[];
  rolling28Trend: RollingRunTrend[];
  longRunProgression: LongRunProgressionPoint[];
  recentRuns: RecentRunSummary[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const athleteId = await resolveAthleteIdForRead();

  if (!athleteId) {
    return {
      athleteId: null,
      allTime: emptyStats(),
      last28: emptyStats(),
      weeklyTrend: [],
      rolling28Trend: [],
      longRunProgression: [],
      recentRuns: [],
    };
  }

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const twelveWeeksAgo = startOfWeek(new Date());
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 7 * 11);

  const rollingWindowStart = new Date();
  rollingWindowStart.setDate(rollingWindowStart.getDate() - 70);

  const runWhere = {
    athleteId,
    ...whereImportedRunSportTypes(),
  };

  const [allRuns, recentRuns, chartRuns] = await Promise.all([
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
    prisma.externalActivity.findMany({
      where: {
        ...runWhere,
        startTime: { gte: rollingWindowStart },
      },
      select: RUN_SELECT,
      orderBy: { startTime: "desc" },
    }),
  ]);

  const sortedChartRuns = [...chartRuns].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );

  return {
    athleteId,
    allTime: aggregateRuns(allRuns),
    last28: aggregateRuns(recentRuns),
    weeklyTrend: buildWeeklyTrend(sortedChartRuns),
    rolling28Trend: buildRollingTrend(sortedChartRuns),
    longRunProgression: buildLongRunProgression(sortedChartRuns),
    recentRuns: summarizeRecentRuns(chartRuns),
  };
}
