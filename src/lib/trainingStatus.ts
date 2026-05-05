import type { DashboardStats } from "@/lib/dashboard";
import type { Prisma } from "@/generated/prisma/client";
import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { getDashboardStatsForDate } from "@/lib/dashboard";
import { metersToMiles } from "@/lib/distance";
import { calculateTrainingStatusScore } from "@/lib/fatigue";
import { prisma } from "@/lib/prisma";

export type TrainingStatusTrendPoint = {
  date: string;
  label: string;
  fatigueScore: number;
  fatigueLevel: string;
  readinessScore: number;
  readinessLevel: string;
};

export type DailyRunHoverStat = {
  runCount: number;
  distanceMi: number;
  movingMinutes: number;
  trainingLoad: number;
};

function startOfTodayUtc(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export async function persistTrainingStatus(stats: DashboardStats): Promise<void> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId || !stats.athleteId) return;

  const today = startOfTodayUtc();
  const status = calculateTrainingStatusScore(stats);
  const factorsJson = status.fatigue.factors as unknown as Prisma.InputJsonValue;

  await prisma.trainingStatusSnapshot.upsert({
    where: {
      athleteId_date: {
        athleteId,
        date: today,
      },
    },
    update: {
      fatigueScore: status.fatigue.score,
      fatigueLevel: status.fatigue.level,
      readinessScore: status.readiness.score,
      readinessLevel: status.readiness.level,
      summary: status.fatigue.summary,
      factors: factorsJson,
    },
    create: {
      athleteId,
      date: today,
      fatigueScore: status.fatigue.score,
      fatigueLevel: status.fatigue.level,
      readinessScore: status.readiness.score,
      readinessLevel: status.readiness.level,
      summary: status.fatigue.summary,
      factors: factorsJson,
    },
  });
}

export async function getTrainingStatusTrend(limit = 60): Promise<TrainingStatusTrendPoint[]> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) return [];

  const rows = await prisma.trainingStatusSnapshot.findMany({
    where: { athleteId },
    orderBy: { date: "asc" },
    take: limit,
    select: {
      date: true,
      fatigueScore: true,
      fatigueLevel: true,
      readinessScore: true,
      readinessLevel: true,
    },
  });

  return rows.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    label: formatShortDate(row.date),
    fatigueScore: row.fatigueScore,
    fatigueLevel: row.fatigueLevel,
    readinessScore: row.readinessScore,
    readinessLevel: row.readinessLevel,
  }));
}

/**
 * Backfill historical daily snapshots from 28 days after first imported run up to today.
 */
export async function backfillTrainingStatusHistory(): Promise<void> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) return;

  const firstRun = await prisma.externalActivity.findFirst({
    where: { athleteId },
    orderBy: { startTime: "asc" },
    select: { startTime: true },
  });
  if (!firstRun) return;

  const firstRunDay = new Date(firstRun.startTime);
  firstRunDay.setUTCHours(0, 0, 0, 0);
  const startDay = addDays(firstRunDay, 28);
  const today = startOfTodayUtc();
  if (startDay > today) return;

  const existing = await prisma.trainingStatusSnapshot.findMany({
    where: {
      athleteId,
      date: { gte: startDay, lte: today },
    },
    select: { date: true },
  });
  const existingKeys = new Set(existing.map((r) => isoDateKey(r.date)));

  for (let day = new Date(startDay); day <= today; day = addDays(day, 1)) {
    const key = isoDateKey(day);
    if (existingKeys.has(key)) continue;

    const stats = await getDashboardStatsForDate(day, athleteId);
    const status = calculateTrainingStatusScore(stats);
    const factorsJson = status.fatigue.factors as unknown as Prisma.InputJsonValue;

    await prisma.trainingStatusSnapshot.create({
      data: {
        athleteId,
        date: new Date(day),
        fatigueScore: status.fatigue.score,
        fatigueLevel: status.fatigue.level,
        readinessScore: status.readiness.score,
        readinessLevel: status.readiness.level,
        summary: status.fatigue.summary,
        factors: factorsJson,
      },
    });
  }
}

export async function getDailyRunHoverStats(
  startDateIso: string,
  endDateIso: string,
): Promise<Record<string, DailyRunHoverStat>> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) return {};

  const start = new Date(`${startDateIso}T00:00:00.000Z`);
  const endExclusive = new Date(`${endDateIso}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const rows = await prisma.externalActivity.findMany({
    where: {
      athleteId,
      startTime: { gte: start, lt: endExclusive },
    },
    select: {
      startTime: true,
      distanceM: true,
      durationSeconds: true,
      icuTrainingLoad: true,
    },
  });

  const out: Record<string, DailyRunHoverStat> = {};
  for (const r of rows) {
    const key = r.startTime.toISOString().slice(0, 10);
    const curr =
      out[key] ??
      ({
        runCount: 0,
        distanceMi: 0,
        movingMinutes: 0,
        trainingLoad: 0,
      } satisfies DailyRunHoverStat);
    curr.runCount += 1;
    curr.distanceMi += metersToMiles(r.distanceM ?? 0);
    curr.movingMinutes += (r.durationSeconds ?? 0) / 60;
    curr.trainingLoad += r.icuTrainingLoad ?? 0;
    out[key] = curr;
  }

  for (const key of Object.keys(out)) {
    out[key].distanceMi = Math.round(out[key].distanceMi * 10) / 10;
    out[key].movingMinutes = Math.round(out[key].movingMinutes);
    out[key].trainingLoad = Math.round(out[key].trainingLoad * 10) / 10;
  }
  return out;
}
