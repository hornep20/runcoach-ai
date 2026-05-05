import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { getDashboardStats } from "@/lib/dashboard";
import { formatMiles } from "@/lib/distance";
import { prisma } from "@/lib/prisma";
import { calculateFatigueScore } from "@/lib/fatigue";

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
        w.distanceKm != null ? `${Math.round(w.distanceKm * 10) / 10} km planned` : "—";
      const dur = w.durationMin != null ? `${w.durationMin} min` : "—";
      return `- ${d} · ${w.type} · ${w.title} · ${dist} · ${dur}`;
    })
    .join("\n");
}

function formatWeeklyDashboardSignals(
  weekly: { label: string; runCount: number; distanceMi: number; trainingLoad: number }[],
): string {
  if (weekly.length < 2) return "Weekly trend: not enough data.";
  const current = weekly[weekly.length - 1];
  const prev = weekly[weekly.length - 2];
  const distanceDelta = current.distanceMi - prev.distanceMi;
  const loadDelta = current.trainingLoad - prev.trainingLoad;
  return `Weekly trend (${prev.label} -> ${current.label}): runs ${prev.runCount} -> ${current.runCount}, distance ${prev.distanceMi.toFixed(1)} -> ${current.distanceMi.toFixed(1)} mi (${distanceDelta >= 0 ? "+" : ""}${distanceDelta.toFixed(1)}), load ${prev.trainingLoad.toFixed(1)} -> ${current.trainingLoad.toFixed(1)} (${loadDelta >= 0 ? "+" : ""}${loadDelta.toFixed(1)}).`;
}

function formatRollingDashboardSignals(
  rolling: { label: string; distanceMi: number; trainingLoad: number }[],
): string {
  if (rolling.length < 15) return "Rolling 28-day trend: not enough data.";
  const current = rolling[rolling.length - 1];
  const twoWeeksAgo = rolling[rolling.length - 15];
  const distDelta = current.distanceMi - twoWeeksAgo.distanceMi;
  const loadDelta = current.trainingLoad - twoWeeksAgo.trainingLoad;
  return `Rolling 28-day trend (${twoWeeksAgo.label} -> ${current.label}): distance ${twoWeeksAgo.distanceMi.toFixed(1)} -> ${current.distanceMi.toFixed(1)} mi (${distDelta >= 0 ? "+" : ""}${distDelta.toFixed(1)}), load ${twoWeeksAgo.trainingLoad.toFixed(1)} -> ${current.trainingLoad.toFixed(1)} (${loadDelta >= 0 ? "+" : ""}${loadDelta.toFixed(1)}).`;
}

function formatLongRunSignals(
  points: { label: string; distanceMi: number; title: string }[],
): string {
  const lastTwo = points.filter((p) => p.distanceMi > 0).slice(-2);
  if (lastTwo.length === 0) return "Long run progression: no long runs found.";
  if (lastTwo.length === 1) {
    return `Latest long run (${lastTwo[0].label}): ${lastTwo[0].distanceMi.toFixed(1)} mi (${lastTwo[0].title}).`;
  }
  const prev = lastTwo[0];
  const current = lastTwo[1];
  const delta = current.distanceMi - prev.distanceMi;
  return `Long run progression: ${prev.distanceMi.toFixed(1)} mi (${prev.label}) -> ${current.distanceMi.toFixed(1)} mi (${current.label}), delta ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} mi.`;
}

function formatRecentRuns(
  runs: { date: string; title: string; distanceMi: number; paceLabel: string; trainingLoad: string }[],
): string {
  if (runs.length === 0) return "Recent runs: none.";
  const top = runs.slice(0, 5);
  return [
    "Most recent runs:",
    ...top.map(
      (r) => `- ${r.date} · ${r.title} · ${r.distanceMi.toFixed(1)} mi · ${r.paceLabel} · load ${r.trainingLoad}`,
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
