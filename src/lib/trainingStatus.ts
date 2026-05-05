import type { DashboardStats } from "@/lib/dashboard";
import { resolveAthleteIdForRead } from "@/lib/athleteRead";
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

function startOfTodayUtc(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
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
      factors: status.fatigue.factors,
    },
    create: {
      athleteId,
      date: today,
      fatigueScore: status.fatigue.score,
      fatigueLevel: status.fatigue.level,
      readinessScore: status.readiness.score,
      readinessLevel: status.readiness.level,
      summary: status.fatigue.summary,
      factors: status.fatigue.factors,
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
