import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { getDashboardStats } from "@/lib/dashboard";
import { formatMiles } from "@/lib/distance";
import { prisma } from "@/lib/prisma";
import { calculateFatigueScore } from "@/lib/fatigue";

import { getAthleteCoachingContext } from "@/lib/coach/athleteContext";

// (same helper functions unchanged above)

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
  const fatigue = calculateFatigueScore(dash);

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
          `Fatigue score: ${fatigue.score}/10 (${fatigue.level})`,
          `Fatigue summary: ${fatigue.summary}`,
          "Fatigue drivers:",
          ...fatigue.factors.map((f) => `- ${f.label}: ${f.detail}`),
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
