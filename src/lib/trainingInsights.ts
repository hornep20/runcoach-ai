import type { DashboardStats } from "@/lib/dashboard";
import type { TrainingStatusTrendPoint } from "@/lib/trainingStatus";

export type TrainingInsight = {
  type: string;
  severity: "low" | "moderate" | "high";
  title: string;
  evidence: string;
  recommendation: string;
};

function pctChange(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((curr - prev) / prev) * 100;
}

export function generateTrainingInsights(
  trend: TrainingStatusTrendPoint[],
  stats: DashboardStats,
): TrainingInsight[] {
  const insights: TrainingInsight[] = [];

  const last = trend.at(-1);
  const sevenDaysAgo = trend.length >= 7 ? trend.at(-7) : null;
  if (last && sevenDaysAgo) {
    const fatigueDelta = last.fatigueScore - sevenDaysAgo.fatigueScore;
    if (fatigueDelta >= 2) {
      insights.push({
        type: "fatigue_rising_7d",
        severity: "high",
        title: "Fatigue has risen sharply this week",
        evidence: `Fatigue score rose ${fatigueDelta.toFixed(1)} points over 7 days (${sevenDaysAgo.fatigueScore.toFixed(1)} -> ${last.fatigueScore.toFixed(1)}).`,
        recommendation:
          "Keep volume steady and reduce workout intensity for 2-4 days; prioritize sleep and easy aerobic running.",
      });
    } else if (fatigueDelta >= 1) {
      insights.push({
        type: "fatigue_rising_7d",
        severity: "moderate",
        title: "Fatigue is trending up",
        evidence: `Fatigue score rose ${fatigueDelta.toFixed(1)} points over the last 7 days.`,
        recommendation:
          "Avoid adding extra intensity this week; keep easy days easy and monitor how the next long run feels.",
      });
    }

    const readinessDelta = last.readinessScore - sevenDaysAgo.readinessScore;
    if (readinessDelta <= -2) {
      insights.push({
        type: "readiness_dropping_7d",
        severity: "high",
        title: "Readiness has dropped significantly",
        evidence: `Readiness score fell ${Math.abs(readinessDelta).toFixed(1)} points over 7 days (${sevenDaysAgo.readinessScore.toFixed(1)} -> ${last.readinessScore.toFixed(1)}).`,
        recommendation:
          "Use a short deload: cut workout intensity and trim run volume until readiness stabilizes.",
      });
    } else if (readinessDelta <= -1) {
      insights.push({
        type: "readiness_dropping_7d",
        severity: "moderate",
        title: "Readiness is trending down",
        evidence: `Readiness score fell ${Math.abs(readinessDelta).toFixed(1)} points over the last week.`,
        recommendation:
          "Hold mileage where it is and focus on recovery quality before progressing the next block.",
      });
    }
  }

  const currentWeek = stats.weeklyTrend.at(-1);
  const previousWeek = stats.weeklyTrend.at(-2);
  if (currentWeek && previousWeek) {
    const deltaPct = pctChange(currentWeek.distanceMi, previousWeek.distanceMi);
    if (deltaPct != null && deltaPct >= 25) {
      insights.push({
        type: "weekly_mileage_jump",
        severity: "high",
        title: "Weekly mileage jumped vs last week",
        evidence: `Mileage increased ${deltaPct.toFixed(0)}% week-over-week (${previousWeek.distanceMi.toFixed(1)} -> ${currentWeek.distanceMi.toFixed(1)} mi).`,
        recommendation:
          "Do not add more load this week; keep the next 5-7 days mostly easy and avoid stacking hard sessions.",
      });
    } else if (deltaPct != null && deltaPct >= 15) {
      insights.push({
        type: "weekly_mileage_jump",
        severity: "moderate",
        title: "Weekly mileage is rising quickly",
        evidence: `Mileage increased ${deltaPct.toFixed(0)}% vs previous week.`,
        recommendation:
          "Use a conservative progression next week and keep one quality day only if legs feel fresh.",
      });
    }
  }

  const currentRolling = stats.rolling28Trend.at(-1);
  const twoWeeksAgoRolling = stats.rolling28Trend.at(-15);
  if (currentRolling && twoWeeksAgoRolling) {
    const loadDeltaPct = pctChange(currentRolling.trainingLoad, twoWeeksAgoRolling.trainingLoad);
    if (loadDeltaPct != null && loadDeltaPct >= 25) {
      insights.push({
        type: "rolling_load_spike",
        severity: "high",
        title: "Rolling 28-day load is spiking",
        evidence: `28-day load is up ${loadDeltaPct.toFixed(0)}% over ~2 weeks (${twoWeeksAgoRolling.trainingLoad.toFixed(1)} -> ${currentRolling.trainingLoad.toFixed(1)}).`,
        recommendation:
          "Back off intensity now and prioritize recovery to prevent accumulating excess fatigue.",
      });
    } else if (loadDeltaPct != null && loadDeltaPct >= 15) {
      insights.push({
        type: "rolling_load_spike",
        severity: "moderate",
        title: "Rolling 28-day load is climbing",
        evidence: `28-day load is up ${loadDeltaPct.toFixed(0)}% in about two weeks.`,
        recommendation:
          "Treat the next week as a consolidation week before adding more stress.",
      });
    }
  }

  const currentLongRun = stats.longRunProgression.at(-1);
  const previousLongRun = stats.longRunProgression.at(-2);
  if (currentLongRun && previousLongRun && previousLongRun.distanceMi > 0) {
    const longRunDelta = currentLongRun.distanceMi - previousLongRun.distanceMi;
    if (longRunDelta >= 3) {
      insights.push({
        type: "long_run_jump",
        severity: "high",
        title: "Long run jump is aggressive",
        evidence: `Longest run increased by ${longRunDelta.toFixed(1)} mi week-over-week (${previousLongRun.distanceMi.toFixed(1)} -> ${currentLongRun.distanceMi.toFixed(1)} mi).`,
        recommendation:
          "Keep the next long run flat or slightly lower, and avoid adding extra intensity around it.",
      });
    } else if (longRunDelta >= 1.5) {
      insights.push({
        type: "long_run_jump",
        severity: "moderate",
        title: "Long run increased notably",
        evidence: `Longest run increased by ${longRunDelta.toFixed(1)} mi from last week.`,
        recommendation:
          "Support the next long run with easy mileage and avoid back-to-back hard days.",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: "no_major_risk",
      severity: "low",
      title: "No major risk trend detected",
      evidence:
        "Recent fatigue, readiness, mileage, and load trends do not show a strong spike or drop signal.",
      recommendation:
        "Keep building gradually with consistent easy mileage and one to two purposeful quality sessions per week.",
    });
  }

  return insights;
}

// Future extension:
// An optional LLM polishing pass can rewrite these deterministic insights into more natural tone,
// but this rules engine should remain the source of truth for explainability and testability.

