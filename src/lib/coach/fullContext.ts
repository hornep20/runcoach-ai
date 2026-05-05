import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { getDashboardStats } from "@/lib/dashboard";
import { formatMiles } from "@/lib/distance";
import { prisma } from "@/lib/prisma";

import { getAthleteCoachingContext } from "@/lib/coach/athleteContext";

function formatUpcoming(
  rows: {
    date: Date;
    title: string;
    type: string;
    distanceKm: number | null;
    durationMin: number | null;
  }[],
): string {
  if (rows.length === 0) {
    return "No upcoming planned workouts in this window.";
  }
  return rows
    .map((w) => {
      const d = w.date.toISOString().slice(0, 10);
      const dist =
        w.distanceKm != null ? `${Math.round(w.distanceKm * 10) / 10} km planned` : "-";
      const dur = w.durationMin != null ? `${w.durationMin} min` : "-";
      return `- ${d} · ${w.type} · ${w.title} · ${dist} · ${dur}`;
    })
    .join("\n");
}

function trendDirection(values: number[]): "up" | "down" | "flat" | "insufficient" {
  const nonZero = values.filter((v) => Number.isFinite(v));
  if (nonZero.length < 4) return "insufficient";
  const midpoint = Math.floor(nonZero.length / 2);
  const first = nonZero.slice(0, midpoint);
  const second = nonZero.slice(midpoint);
  const firstAvg = first.reduce((sum, v) => sum + v, 0) / first.length;
  const secondAvg = second.reduce((sum, v) => sum + v, 0) / second.length;
  if (firstAvg <= 0 && secondAvg <= 0) return "flat";
  const pctChange = firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 1;
  if (pctChange > 0.08) return "up";
  if (pctChange < -0.08) return "down";
  return "flat";
}

function formatWeeklyDashboardSignals(
  weeklyTrend: Awaited<ReturnType<typeof getDashboardStats>>["weeklyTrend"],
): string {
  if (weeklyTrend.length === 0) {
    return "Weekly trend: no imported run data available.";
  }

  const last4 = weeklyTrend.slice(-4);
  const prior4 = weeklyTrend.slice(-8, -4);
  const currentWeek = weeklyTrend.at(-1);
  const previousWeek = weeklyTrend.at(-2);
  const peakWeek = weeklyTrend.reduce((best, week) =>
    week.distanceMi > best.distanceMi ? week : best,
  weeklyTrend[0]);
  const last4Mileage = last4.reduce((sum, week) => sum + week.distanceMi, 0);
  const prior4Mileage = prior4.reduce((sum, week) => sum + week.distanceMi, 0);
  const currentVsPrevious =
    currentWeek && previousWeek && previousWeek.distanceMi > 0
      ? ((currentWeek.distanceMi - previousWeek.distanceMi) / previousWeek.distanceMi) * 100
      : null;
  const trend = trendDirection(weeklyTrend.map((w) => w.distanceMi));

  return [
    "Weekly mileage/load trend (last 12 weeks):",
    `Current week: ${currentWeek ? `${currentWeek.distanceMi.toFixed(1)} mi, ${currentWeek.runCount} runs, load ${currentWeek.trainingLoad}` : "n/a"}`,
    `Previous week: ${previousWeek ? `${previousWeek.distanceMi.toFixed(1)} mi, ${previousWeek.runCount} runs, load ${previousWeek.trainingLoad}` : "n/a"}`,
    `Current vs previous week: ${currentVsPrevious == null ? "n/a" : `${currentVsPrevious.toFixed(0)}%`}`,
    `Last 4 weeks total: ${last4Mileage.toFixed(1)} mi`,
    `Prior 4 weeks total: ${prior4Mileage.toFixed(1)} mi`,
    `Peak week in window: ${peakWeek.label} · ${peakWeek.distanceMi.toFixed(1)} mi · load ${peakWeek.trainingLoad}`,
    `Mileage direction across window: ${trend}`,
    "Weekly points:",
    ...weeklyTrend.map(
      (w) => `- ${w.weekStart}: ${w.distanceMi.toFixed(1)} mi · ${w.runCount} runs · load ${w.trainingLoad} · ${w.movingHours}h`,
    ),
  ].join("\n");
}

function formatRollingDashboardSignals(
  rolling28Trend: Awaited<ReturnType<typeof getDashboardStats>>["rolling28Trend"],
): string {
  if (rolling28Trend.length === 0) {
    return "Rolling 28-day trend: no imported run data available.";
  }

  const current = rolling28Trend.at(-1);
  const sevenDaysAgo = rolling28Trend.at(-8);
  const fourteenDaysAgo = rolling28Trend.at(-15);
  const peakLoad = rolling28Trend.reduce((best, day) =>
    day.trainingLoad > best.trainingLoad ? day : best,
  rolling28Trend[0]);
  const loadDirection = trendDirection(rolling28Trend.map((d) => d.trainingLoad));
  const mileageDirection = trendDirection(rolling28Trend.map((d) => d.distanceMi));

  return [
    "Rolling 28-day dashboard signal:",
    `Current rolling mileage/load: ${current ? `${current.distanceMi.toFixed(1)} mi · load ${current.trainingLoad}` : "n/a"}`,
    `7 days ago: ${sevenDaysAgo ? `${sevenDaysAgo.distanceMi.toFixed(1)} mi · load ${sevenDaysAgo.trainingLoad}` : "n/a"}`,
    `14 days ago: ${fourteenDaysAgo ? `${fourteenDaysAgo.distanceMi.toFixed(1)} mi · load ${fourteenDaysAgo.trainingLoad}` : "n/a"}`,
    `Peak rolling load in window: ${peakLoad.label} · load ${peakLoad.trainingLoad} · ${peakLoad.distanceMi.toFixed(1)} mi`,
    `Rolling load direction: ${loadDirection}`,
    `Rolling mileage direction: ${mileageDirection}`,
  ].join("\n");
}

function formatLongRunSignals(
  longRunProgression: Awaited<ReturnType<typeof getDashboardStats>>["longRunProgression"],
): string {
  if (longRunProgression.length === 0) {
    return "Long-run progression: no imported run data available.";
  }

  const current = longRunProgression.at(-1);
  const previous = longRunProgression.at(-2);
  const longest = longRunProgression.reduce((best, week) =>
    week.distanceMi > best.distanceMi ? week : best,
  longRunProgression[0]);
  const recentAverage =
    longRunProgression.slice(-4).reduce((sum, week) => sum + week.distanceMi, 0) /
    Math.max(longRunProgression.slice(-4).length, 1);

  return [
    "Long-run progression signal:",
    `Current week long run: ${current ? `${current.distanceMi.toFixed(1)} mi · ${current.title}` : "n/a"}`,
    `Previous week long run: ${previous ? `${previous.distanceMi.toFixed(1)} mi · ${previous.title}` : "n/a"}`,
    `Longest run in 12-week window: ${longest.distanceMi.toFixed(1)} mi · ${longest.label} · ${longest.title}`,
    `Average weekly long run over last 4 weeks: ${recentAverage.toFixed(1)} mi`,
    "Long-run points:",
    ...longRunProgression.map(
      (w) => `- ${w.weekStart}: ${w.distanceMi.toFixed(1)} mi · ${w.title}`,
    ),
  ].join("\n");
}

function formatRecentRuns(
  recentRuns: Awaited<ReturnType<typeof getDashboardStats>>["recentRuns"],
): string {
  if (recentRuns.length === 0) {
    return "Recent runs: none imported.";
  }

  return [
    "Recent imported runs:",
    ...recentRuns.map(
      (r) => `- ${r.date}: ${r.title} · ${r.distanceMi.toFixed(1)} mi · ${r.paceLabel} · HR ${r.avgHr} · load ${r.trainingLoad}`,
    ),
  ].join("\n");
}

export async function buildFullCoachContextBlock(options: {
  trainingPlanId: string | null;
  coachingBrief: string | null;
  defaultBaseWeeks: number;
  defaultDistanceUnit: "mi" | "km";
}): Promise<string> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return "No athlete configured.";
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { coachingBrief: true },
  });

  const briefFromDb = athlete?.coachingBrief?.trim() ?? "";
  const briefFromRequest = options.coachingBrief?.trim() ?? "";
  const brief = briefFromRequest.length > 0 ? briefFromRequest : briefFromDb;

  const importsBlock = await getAthleteCoachingContext();
  const dash = await getDashboardStats();
  const last28 = dash.last28;

  const statsBlock =
    dash.athleteId == null
      ? "No dashboard stats (no athlete)."
      : [
          "Imported runs — last 28 days (dashboard summary):",
          `Runs: ${last28.runCount}`,
          `Distance: ${formatMiles(last28.distanceMi, 1)}`,
          `Moving time: ${last28.movingTimeLabel}`,
          `Avg pace: ${last28.pacePerMiLabel}`,
          `Avg HR: ${last28.avgHr} · Max HR (peak): ${last28.maxHr}`,
          `Avg cadence: ${last28.avgCadence} · Max cadence (peak): ${last28.maxCadence}`,
          `Elevation: ${last28.elevationFt} · Calories: ${last28.calories}`,
          `Training load (sum): ${last28.trainingLoad} · Avg intensity: ${last28.avgIntensity} · Avg power: ${last28.avgWatts}`,
          "",
          formatWeeklyDashboardSignals(dash.weeklyTrend),
          "",
          formatRollingDashboardSignals(dash.rolling28Trend),
          "",
          formatLongRunSignals(dash.longRunProgression),
          "",
          formatRecentRuns(dash.recentRuns),
        ].join("\n");

  let upcomingBlock = "";
  if (options.trainingPlanId) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 28);

    const plan = await prisma.trainingPlan.findFirst({
      where: { id: options.trainingPlanId, athleteId },
      select: { name: true, type: true, startDate: true, endDate: true },
    });

    const rows = await prisma.workout.findMany({
      where: {
        trainingPlanId: options.trainingPlanId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
      take: 40,
      select: {
        date: true,
        title: true,
        type: true,
        distanceKm: true,
        durationMin: true,
      },
    });

    const header = plan
      ? `Upcoming planned workouts (next ~4 weeks) for plan "${plan.name}" (${plan.type}, ${plan.startDate.toISOString().slice(0, 10)} to ${plan.endDate.toISOString().slice(0, 10)}):`
      : "Upcoming planned workouts (selected plan):";

    upcomingBlock = `${header}\n${formatUpcoming(rows)}`;
  } else {
    upcomingBlock =
      "No training plan selected for calendar writes. When the athlete picks a plan in the coach UI, you can add workouts with the create_planned_workouts tool.";
  }

  const briefBlock =
    brief.length > 0
      ? `Athlete plan / intent (edit in coach page, sent with messages):\n${brief}`
      : "Athlete plan / intent: (empty — encourage them to describe their approach, e.g. first 8–10 weeks slower base plan then switch to marathon plan.)";

  const planLine = options.trainingPlanId
    ? `Selected training plan id for calendar tool: ${options.trainingPlanId}`
    : "Selected training plan id: (none)";

  return [
    `Coach defaults from UI: base-building plans default to ${options.defaultBaseWeeks} weeks and ${options.defaultDistanceUnit === "mi" ? "miles" : "kilometers"} unless athlete message overrides.`,
    "",
    planLine,
    "",
    briefBlock,
    "",
    statsBlock,
    "",
    importsBlock,
    "",
    upcomingBlock,
  ].join("\n");
}
