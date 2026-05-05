import type { DashboardStats } from "@/lib/dashboard";

export type FatigueLevel = "low" | "moderate" | "elevated" | "high";
export type ReadinessLevel = "low" | "moderate" | "good" | "high";

export interface FatigueFactor {
  label: string;
  points: number;
  detail: string;
}

export interface FatigueScore {
  score: number;
  level: FatigueLevel;
  summary: string;
  factors: FatigueFactor[];
}

export interface ReadinessScore {
  score: number;
  level: ReadinessLevel;
  summary: string;
}

export interface TrainingStatusScore {
  fatigue: FatigueScore;
  readiness: ReadinessScore;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function levelFromScore(score: number): FatigueLevel {
  if (score >= 8) return "high";
  if (score >= 6) return "elevated";
  if (score >= 3.5) return "moderate";
  return "low";
}

function readinessLevelFromScore(score: number): ReadinessLevel {
  if (score >= 8) return "high";
  if (score >= 6) return "good";
  if (score >= 4) return "moderate";
  return "low";
}

function summaryFromLevel(level: FatigueLevel): string {
  switch (level) {
    case "high":
      return "High fatigue risk. Prioritize recovery, reduce intensity, and avoid stacking another hard session.";
    case "elevated":
      return "Elevated fatigue risk. Keep training controlled and be careful with intensity or long-run increases.";
    case "moderate":
      return "Moderate fatigue. Training appears manageable, but keep the next workout honest and repeatable.";
    case "low":
      return "Low fatigue signal from available data. Normal training progression looks reasonable if you feel good.";
  }
}

function readinessSummaryFromLevel(level: ReadinessLevel): string {
  switch (level) {
    case "high":
      return "High readiness. The data supports normal progression if subjective feel is good.";
    case "good":
      return "Good readiness. Training can continue, but avoid unnecessary spikes.";
    case "moderate":
      return "Moderate readiness. Keep the next session controlled and prioritize consistency.";
    case "low":
      return "Low readiness. Recovery or reduced intensity should be prioritized.";
  }
}

export function calculateFatigueScore(stats: DashboardStats): FatigueScore {
  const factors: FatigueFactor[] = [];
  const weekly = stats.weeklyTrend;
  const rolling = stats.rolling28Trend;
  const longRuns = stats.longRunProgression;
  const currentWeek = weekly.at(-1);
  const previousWeek = weekly.at(-2);
  const currentRolling = rolling.at(-1);
  const twoWeeksAgoRolling = rolling.at(-15);
  const currentLongRun = longRuns.at(-1);
  const previousLongRun = longRuns.at(-2);

  if (stats.last28.runCount === 0) {
    return {
      score: 2,
      level: "low",
      summary: "No recent imported runs. Fatigue score is low-confidence until activity data is synced.",
      factors: [
        {
          label: "Missing recent data",
          points: 2,
          detail: "No imported runs were found in the last 28 days.",
        },
      ],
    };
  }

  if (currentWeek && previousWeek) {
    const change = pctChange(currentWeek.distanceMi, previousWeek.distanceMi);
    if (change != null) {
      if (change >= 40) {
        factors.push({
          label: "Weekly mileage spike",
          points: 2.5,
          detail: `Current week mileage is up ${change.toFixed(0)}% vs last week.`,
        });
      } else if (change >= 25) {
        factors.push({
          label: "Weekly mileage jump",
          points: 1.75,
          detail: `Current week mileage is up ${change.toFixed(0)}% vs last week.`,
        });
      } else if (change <= -35) {
        factors.push({
          label: "Recent training drop",
          points: 0.75,
          detail: `Current week mileage is down ${Math.abs(change).toFixed(0)}% vs last week. Re-entry should be controlled.`,
        });
      }
    }
  }

  if (currentRolling && twoWeeksAgoRolling) {
    const loadChange = pctChange(currentRolling.trainingLoad, twoWeeksAgoRolling.trainingLoad);
    if (loadChange != null) {
      if (loadChange >= 35) {
        factors.push({
          label: "Rolling load spike",
          points: 2.5,
          detail: `Rolling 28-day load is up ${loadChange.toFixed(0)}% over roughly two weeks.`,
        });
      } else if (loadChange >= 20) {
        factors.push({
          label: "Rolling load increase",
          points: 1.5,
          detail: `Rolling 28-day load is up ${loadChange.toFixed(0)}% over roughly two weeks.`,
        });
      }
    }

    if (currentRolling.trainingLoad >= 900) {
      factors.push({
        label: "High absolute load",
        points: 2,
        detail: `Current rolling load is ${currentRolling.trainingLoad}, which is a high workload signal.`,
      });
    } else if (currentRolling.trainingLoad >= 600) {
      factors.push({
        label: "Moderate-high absolute load",
        points: 1,
        detail: `Current rolling load is ${currentRolling.trainingLoad}.`,
      });
    }
  }

  if (currentLongRun && previousLongRun && previousLongRun.distanceMi > 0) {
    const jump = currentLongRun.distanceMi - previousLongRun.distanceMi;
    if (jump >= 4) {
      factors.push({
        label: "Long-run jump",
        points: 2,
        detail: `Long run increased by ${jump.toFixed(1)} miles vs previous week.`,
      });
    } else if (jump >= 2.5) {
      factors.push({
        label: "Long-run progression stress",
        points: 1,
        detail: `Long run increased by ${jump.toFixed(1)} miles vs previous week.`,
      });
    }
  }

  const recentRunCount = stats.last28.runCount;
  if (recentRunCount >= 24) {
    factors.push({
      label: "High run frequency",
      points: 1.5,
      detail: `${recentRunCount} runs imported in the last 28 days.`,
    });
  } else if (recentRunCount >= 18) {
    factors.push({
      label: "Consistent run frequency",
      points: 0.75,
      detail: `${recentRunCount} runs imported in the last 28 days.`,
    });
  }

  if (factors.length === 0) {
    factors.push({
      label: "No major fatigue drivers detected",
      points: 1,
      detail: "Mileage, load, long-run progression, and run frequency do not show a major spike from available data.",
    });
  }

  const rawScore = factors.reduce((sum, factor) => sum + factor.points, 0);
  const score = Math.round(clamp(rawScore, 1, 10) * 10) / 10;
  const level = levelFromScore(score);

  return {
    score,
    level,
    summary: summaryFromLevel(level),
    factors,
  };
}

export function calculateReadinessScore(fatigue: FatigueScore): ReadinessScore {
  const score = Math.round(clamp(11 - fatigue.score, 1, 10) * 10) / 10;
  const level = readinessLevelFromScore(score);
  return {
    score,
    level,
    summary: readinessSummaryFromLevel(level),
  };
}

export function calculateTrainingStatusScore(stats: DashboardStats): TrainingStatusScore {
  const fatigue = calculateFatigueScore(stats);
  return {
    fatigue,
    readiness: calculateReadinessScore(fatigue),
  };
}
