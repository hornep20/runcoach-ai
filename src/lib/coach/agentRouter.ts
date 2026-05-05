import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { getDashboardStats } from "@/lib/dashboard";
import { chatCompletionJson } from "@/lib/coach/openai";

export type CoachAgentMode =
  | "training_analysis"
  | "plan_builder"
  | "plan_adjustment"
  | "recovery_risk"
  | "strength_mobility"
  | "race_strategy"
  | "general_coach";

const COACH_AGENT_MODES: CoachAgentMode[] = [
  "training_analysis",
  "plan_builder",
  "plan_adjustment",
  "recovery_risk",
  "strength_mobility",
  "race_strategy",
  "general_coach",
];

type CoachAgentClassification = {
  mode: CoachAgentMode;
  confidence: number;
  reason: string;
  source: "llm" | "fallback";
};

function isCoachAgentMode(value: unknown): value is CoachAgentMode {
  return typeof value === "string" && COACH_AGENT_MODES.includes(value as CoachAgentMode);
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function classifyCoachAgentModeFallback(message: string): CoachAgentClassification {
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
    return {
      mode: "recovery_risk",
      confidence: 0.82,
      reason: "Detected recovery, fatigue, pain, or injury language.",
      source: "fallback",
    };
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
    return {
      mode: "plan_adjustment",
      confidence: 0.82,
      reason: "Detected missed workout, rescheduling, or plan-adjustment language.",
      source: "fallback",
    };
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
    return {
      mode: "plan_builder",
      confidence: 0.82,
      reason: "Detected request to build or generate a training plan.",
      source: "fallback",
    };
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
    return {
      mode: "strength_mobility",
      confidence: 0.78,
      reason: "Detected strength, mobility, lifting, or prehab language.",
      source: "fallback",
    };
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
    return {
      mode: "race_strategy",
      confidence: 0.78,
      reason: "Detected race execution, fueling, taper, or pacing language.",
      source: "fallback",
    };
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
    return {
      mode: "training_analysis",
      confidence: 0.78,
      reason: "Detected request to analyze training data or dashboard trends.",
      source: "fallback",
    };
  }

  return {
    mode: "general_coach",
    confidence: 0.55,
    reason: "No specialized mode clearly matched; using general coaching behavior.",
    source: "fallback",
  };
}

async function classifyCoachAgentModeWithLlm(
  message: string,
): Promise<CoachAgentClassification> {
  const fallback = classifyCoachAgentModeFallback(message);
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `Classify the user's running coach request into exactly one agent mode.

Return strict JSON only with this schema:
{"mode":"training_analysis|plan_builder|plan_adjustment|recovery_risk|strength_mobility|race_strategy|general_coach","confidence":0.0,"reason":"brief reason"}

Mode definitions:
- training_analysis: analyze dashboard data, trends, readiness, fitness, mileage, load, long-run progression, or recent runs.
- plan_builder: create or design a new base-building, marathon, or training plan.
- plan_adjustment: adjust, reschedule, recover from, or modify an existing plan or missed workouts.
- recovery_risk: fatigue, soreness, pain, injury, rest, overtraining, or whether to back off.
- strength_mobility: lifting, strength, mobility, core, prehab, supplemental workouts.
- race_strategy: pacing, fueling, taper, race execution, goal time, marathon strategy.
- general_coach: simple questions or requests that do not require a specialized mode.

Prefer recovery_risk when there is pain, injury, or fatigue. Prefer plan_adjustment when the user missed workouts or asks what to change. Prefer training_analysis when they ask how they are doing or if they are on track.`,
    },
    {
      role: "user",
      content: message.slice(0, 2000),
    },
  ];

  try {
    const raw = await chatCompletionJson(messages);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mode = parsed.mode;
    if (!isCoachAgentMode(mode)) {
      return fallback;
    }
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim().length > 0
        ? parsed.reason.trim().slice(0, 240)
        : fallback.reason;
    const confidence = clampConfidence(parsed.confidence);

    return {
      mode,
      confidence,
      reason,
      source: "llm",
    };
  } catch {
    return fallback;
  }
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
        "Include a clear week structure: key run types, long-run progression, and where cutback weeks occur.",
        "Favor mostly easy running with limited intensity; avoid stacking hard sessions close together.",
        "State assumptions explicitly when key inputs are missing (goal race date, availability, injury constraints, preferred long-run day).",
        "If the athlete clearly asks to create a plan, use the plan creation tool. Otherwise describe the structure first.",
      ];
    case "plan_adjustment":
      return [
        "Prioritize preserving the long run and total weekly consistency.",
        "Do not stack hard sessions to make up missed work.",
        "If the user asks to change calendar workouts, use the workout creation tool carefully with small batches.",
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
  const classification = await classifyCoachAgentModeWithLlm(userMessage);
  const stats = await getDashboardStats();
  const flags = buildRiskFlags(stats);

  return [
    "## Active coach agent",
    `Mode: ${formatAgentName(classification.mode)} (${classification.mode})`,
    `Classifier: ${classification.source} · confidence ${classification.confidence.toFixed(2)}`,
    `Classifier reason: ${classification.reason}`,
    "",
    "Agent priorities:",
    ...modeInstructions(classification.mode).map((instruction) => `- ${instruction}`),
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
