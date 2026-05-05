import { getDashboardStats } from "@/lib/dashboard";

export type CoachAgentMode =
  | "training_analysis"
  | "plan_builder"
  | "plan_adjustment"
  | "recovery_risk"
  | "strength_mobility"
  | "race_strategy"
  | "general_coach";

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function classifyCoachAgentMode(message: string): CoachAgentMode {
  const text = message.toLowerCase();

  if (
    includesAny(text, [
      "injury",
      "hurt",
      "pain",
      "sore",
      "fatigue",
      "tired",
      "overtraining",
      "overtrain",
      "recovery",
      "rest day",
      "should i rest",
    ])
  ) {
    return "recovery_risk";
  }

  if (
    includesAny(text, [
      "adjust",
      "modify",
      "change my plan",
      "missed",
      "skipped",
      "move workout",
      "reschedule",
      "make up",
    ])
  ) {
    return "plan_adjustment";
  }

  if (
    includesAny(text, [
      "create a plan",
      "build a plan",
      "generate a plan",
      "base building",
      "base-building",
      "marathon plan",
      "training plan",
      "16 week",
      "16-week",
    ])
  ) {
    return "plan_builder";
  }

  if (
    includesAny(text, [
      "strength",
      "mobility",
      "lift",
      "lifting",
      "gym",
      "core",
      "stretch",
      "prehab",
    ])
  ) {
    return "strength_mobility";
  }

  if (
    includesAny(text, [
      "race",
      "marathon",
      "pace group",
      "strategy",
      "goal pace",
      "fuel",
      "carb",
      "gel",
      "taper",
    ])
  ) {
    return "race_strategy";
  }

  if (
    includesAny(text, [
      "how am i doing",
      "on track",
      "analyze",
      "dashboard",
      "trend",
      "load",
      "mileage",
      "long run",
      "fitness",
      "readiness",
    ])
  ) {
    return "training_analysis";
  }

  return "general_coach";
}

function formatAgentName(mode: CoachAgentMode): string {
  switch (mode) {
    case "training_analysis":
      return "Training Analyst Agent";
    case "plan_builder":
      return "Plan Builder Agent";
    case "plan_adjustment":
      return "Plan Adjustment Agent";
    case "recovery_risk":
      return "Recovery and Risk Agent";
    case "strength_mobility":
      return "Strength and Mobility Agent";
    case "race_strategy":
      return "Race Strategy Agent";
    case "general_coach":
      return "General Coach Agent";
  }
}

function modeInstructions(mode: CoachAgentMode): string[] {
  switch (mode) {
    case "training_analysis":
      return [
        "Lead with the dashboard signals: weekly mileage, rolling 28-day load, long-run progression, and recent runs.",
        "Explain whether the athlete is building, maintaining, declining, or spiking.",
        "Give one practical training decision for the next 3-7 days.",
      ];
    case "plan_builder":
      return [
        "Build from current fitness, not idealized goal mileage.",
        "Use conservative progression unless the athlete explicitly asks for aggressive training and the data supports it.",
        "If the athlete clearly asks to create a plan, use the plan creation tool. Otherwise describe the structure first.",
      ];
    case "plan_adjustment":
      return [
        "Prioritize preserving the long run and total weekly consistency.",
        "Do not stack hard sessions to make up missed work.",
        "If a selected plan id exists and the user asks to change calendar workouts, use the workout creation tool carefully.",
      ];
    case "recovery_risk":
      return [
        "Start with risk flags before performance advice.",
        "If there is pain, sharp symptoms, or worsening symptoms, recommend backing off and considering a qualified medical professional.",
        "Use rolling load, recent run stress, and long-run jumps to decide whether to reduce intensity, hold volume, or rest.",
      ];
    case "strength_mobility":
      return [
        "Complement the run plan instead of compromising key runs.",
        "Keep hard lower-body strength away from quality run sessions when possible.",
        "Prefer short, repeatable strength and mobility work during higher run-load weeks.",
      ];
    case "race_strategy":
      return [
        "Use recent mileage, long-run progression, and pace data to keep race advice realistic.",
        "Give pacing, fueling, and execution guidance only when supported by the available context.",
        "For marathon pacing, prioritize repeatability and controlled effort early.",
      ];
    case "general_coach":
      return [
        "Answer directly, but still check whether dashboard signals change the recommendation.",
        "Ask at most one clarifying question if the answer depends on missing context.",
      ];
  }
}

function buildRiskFlags(stats: Awaited<ReturnType<typeof getDashboardStats>>): string[] {
  const flags: string[] = [];
  const weekly = stats.weeklyTrend;
  const longRuns = stats.longRunProgression;
  const currentWeek = weekly.at(-1);
  const previousWeek = weekly.at(-2);
  const currentLongRun = longRuns.at(-1);
  const previousLongRun = longRuns.at(-2);

  if (currentWeek && previousWeek && previousWeek.distanceMi > 0) {
    const changePct = ((currentWeek.distanceMi - previousWeek.distanceMi) / previousWeek.distanceMi) * 100;
    if (changePct >= 25) {
      flags.push(`Weekly mileage is up ${changePct.toFixed(0)}% vs previous week; be cautious adding intensity.`);
    }
    if (changePct <= -25) {
      flags.push(`Weekly mileage is down ${Math.abs(changePct).toFixed(0)}% vs previous week; rebuild consistency before chasing workouts.`);
    }
  }

  if (currentLongRun && previousLongRun && previousLongRun.distanceMi > 0) {
    const changeMi = currentLongRun.distanceMi - previousLongRun.distanceMi;
    if (changeMi >= 3) {
      flags.push(`Long run jumped by ${changeMi.toFixed(1)} mi vs previous week; avoid stacking another hard stressor.`);
    }
  }

  const rolling = stats.rolling28Trend;
  const currentRolling = rolling.at(-1);
  const twoWeeksAgo = rolling.at(-15);
  if (currentRolling && twoWeeksAgo && twoWeeksAgo.trainingLoad > 0) {
    const loadChangePct =
      ((currentRolling.trainingLoad - twoWeeksAgo.trainingLoad) / twoWeeksAgo.trainingLoad) * 100;
    if (loadChangePct >= 20) {
      flags.push(`Rolling 28-day load is up ${loadChangePct.toFixed(0)}% over ~2 weeks; watch fatigue.`);
    }
  }

  if (stats.last28.runCount === 0) {
    flags.push("No runs imported in the last 28 days; recommendations should be conservative until data is synced.");
  }

  return flags;
}

export async function buildCoachAgentDirective(userMessage: string): Promise<string> {
  const mode = classifyCoachAgentMode(userMessage);
  const stats = await getDashboardStats();
  const flags = buildRiskFlags(stats);

  return [
    "## Active coach agent",
    `Mode: ${formatAgentName(mode)} (${mode})`,
    "",
    "Agent priorities:",
    ...modeInstructions(mode).map((instruction) => `- ${instruction}`),
    "",
    "Current risk flags from dashboard data:",
    ...(flags.length > 0 ? flags.map((flag) => `- ${flag}`) : ["- No major dashboard risk flags detected from available data."]),
    "",
    "Agent behavior:",
    "- Stay in this role for the current reply unless the user clearly asks for something else.",
    "- Make the final answer feel like one integrated coach, not a committee of agents.",
    "- Use the active agent mode to decide what to emphasize and what to ignore.",
  ].join("\n");
}
