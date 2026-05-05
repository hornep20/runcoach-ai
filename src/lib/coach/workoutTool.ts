import { PlanType, WorkoutType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const WORKOUT_TYPES = Object.values(WorkoutType) as WorkoutType[];

function isWorkoutType(s: string): s is WorkoutType {
  return (WORKOUT_TYPES as string[]).includes(s);
}

function parseYmdUtcNoon(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) {
    return null;
  }
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

const KM_PER_MI = 1.609344;
const DEFAULT_BASE_WEEKS = 8;
const MAX_BASE_WEEKS = 20;

export interface CreateWorkoutItemInput {
  date: string;
  title: string;
  type: string;
  distanceKm?: number;
  durationMin?: number;
  description?: string;
}

export interface CreateWorkoutsToolResult {
  ok: boolean;
  created: number;
  skipped: number;
  errors: string[];
}

export interface CreateBasePlanToolResult {
  ok: boolean;
  trainingPlanId: string | null;
  trainingPlanName: string | null;
  createdWorkouts: number;
  skipped: number;
  errors: string[];
}

function composeDescription(o: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  const description =
    typeof o.description === "string" && o.description.trim().length > 0
      ? o.description.trim()
      : "";
  if (description) parts.push(description);

  const focus =
    typeof o.focus === "string" && o.focus.trim().length > 0 ? o.focus.trim() : "";
  if (focus) parts.push(`Focus: ${focus}`);

  const targetPace =
    typeof o.targetPace === "string" && o.targetPace.trim().length > 0
      ? o.targetPace.trim()
      : "";
  if (targetPace) parts.push(`Target pace: ${targetPace}`);

  const warmup =
    typeof o.warmup === "string" && o.warmup.trim().length > 0 ? o.warmup.trim() : "";
  if (warmup) parts.push(`Warm-up: ${warmup}`);

  const cooldown =
    typeof o.cooldown === "string" && o.cooldown.trim().length > 0
      ? o.cooldown.trim()
      : "";
  if (cooldown) parts.push(`Cooldown: ${cooldown}`);

  const notes =
    typeof o.notes === "string" && o.notes.trim().length > 0 ? o.notes.trim() : "";
  if (notes) parts.push(`Notes: ${notes}`);

  if (parts.length === 0) return undefined;
  return parts.join("\n").slice(0, 4000);
}

export async function executeCreatePlannedWorkoutsTool(
  trainingPlanId: string | null,
  athleteId: string,
  rawArgs: unknown,
): Promise<CreateWorkoutsToolResult> {
  const errors: string[] = [];
  if (!rawArgs || typeof rawArgs !== "object") {
    return { ok: false, created: 0, skipped: 0, errors: ["Invalid tool arguments"] };
  }
  const workouts = (rawArgs as { workouts?: unknown }).workouts;
  if (!Array.isArray(workouts) || workouts.length === 0) {
    return { ok: false, created: 0, skipped: 0, errors: ["Missing workouts array"] };
  }
  if (workouts.length > 21) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      errors: ["Too many workouts in one call (max 21). Split across multiple tool calls."],
    };
  }

  let effectiveTrainingPlanId = trainingPlanId;
  if (effectiveTrainingPlanId) {
    const plan = await prisma.trainingPlan.findFirst({
      where: { id: effectiveTrainingPlanId, athleteId },
      select: { id: true },
    });
    if (!plan) {
      return {
        ok: false,
        created: 0,
        skipped: 0,
        errors: ["Training plan not found for this athlete."],
      };
    }
  } else {
    const parsedDates = workouts
      .map((w) => {
        if (!w || typeof w !== "object") return null;
        const d = (w as Record<string, unknown>).date;
        return typeof d === "string" ? parseYmdUtcNoon(d) : null;
      })
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime());
    const startDate = parsedDates[0] ?? new Date();
    const endDate = parsedDates[parsedDates.length - 1] ?? startDate;
    const createdPlan = await prisma.trainingPlan.create({
      data: {
        athleteId,
        name: `AI Coach Calendar Plan (${startDate.toISOString().slice(0, 10)})`,
        type: PlanType.MARATHON_16_WEEK,
        startDate,
        endDate,
      },
      select: { id: true },
    });
    effectiveTrainingPlanId = createdPlan.id;
    errors.push("No plan selected, so the coach auto-created a new calendar plan.");
  }
  if (!effectiveTrainingPlanId) {
    return { ok: false, created: 0, skipped: 0, errors: ["Could not resolve target training plan."] };
  }

  let created = 0;
  let skipped = 0;

  for (const w of workouts) {
    if (!w || typeof w !== "object") {
      skipped++;
      errors.push("Skipped invalid workout entry");
      continue;
    }
    const o = w as Record<string, unknown>;
    const dateStr = typeof o.date === "string" ? o.date : "";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const typeStr = typeof o.type === "string" ? o.type.trim() : "";
    const date = parseYmdUtcNoon(dateStr);
    if (!date || !title || !isWorkoutType(typeStr)) {
      skipped++;
      errors.push(`Skipped invalid row: ${JSON.stringify({ date: dateStr, title, type: typeStr })}`);
      continue;
    }

    const distanceKm =
      typeof o.distanceKm === "number" && Number.isFinite(o.distanceKm) ? o.distanceKm : undefined;
    const durationMin =
      typeof o.durationMin === "number" && Number.isFinite(o.durationMin)
        ? Math.round(o.durationMin)
        : undefined;
    const description = composeDescription(o);

    try {
      await prisma.workout.create({
        data: {
          trainingPlanId: effectiveTrainingPlanId,
          date,
          title: title.slice(0, 200),
          type: typeStr,
          distanceKm,
          durationMin,
          description,
        },
      });
      created++;
    } catch (e) {
      skipped++;
      errors.push(e instanceof Error ? e.message : "create failed");
    }
  }

  return {
    ok: created > 0,
    created,
    skipped,
    errors: errors.slice(0, 8),
  };
}

export async function executeCreateBaseBuildingPlanTool(
  athleteId: string,
  rawArgs: unknown,
): Promise<CreateBasePlanToolResult> {
  const errors: string[] = [];
  if (!rawArgs || typeof rawArgs !== "object") {
    return {
      ok: false,
      trainingPlanId: null,
      trainingPlanName: null,
      createdWorkouts: 0,
      skipped: 0,
      errors: ["Invalid tool arguments"],
    };
  }

  const o = rawArgs as Record<string, unknown>;
  const nameRaw = typeof o.name === "string" ? o.name.trim() : "";
  const name = nameRaw.length > 0 ? nameRaw.slice(0, 120) : "AI Base Building Plan";
  const startDateStr = typeof o.startDate === "string" ? o.startDate : "";
  const startDate = parseYmdUtcNoon(startDateStr);
  const workouts = Array.isArray(o.workouts) ? o.workouts : null;
  const weeksRaw =
    typeof o.weeks === "number" && Number.isFinite(o.weeks)
      ? Math.round(o.weeks)
      : DEFAULT_BASE_WEEKS;
  const weeks = Math.min(MAX_BASE_WEEKS, Math.max(4, weeksRaw));
  const distanceUnitRaw =
    typeof o.distanceUnit === "string" ? o.distanceUnit.trim().toLowerCase() : "mi";
  const distanceUnit: "mi" | "km" =
    distanceUnitRaw === "km" || distanceUnitRaw === "kilometers" ? "km" : "mi";

  if (!startDate) {
    return {
      ok: false,
      trainingPlanId: null,
      trainingPlanName: null,
      createdWorkouts: 0,
      skipped: 0,
      errors: ["startDate must be YYYY-MM-DD"],
    };
  }
  if (!workouts || workouts.length === 0) {
    return {
      ok: false,
      trainingPlanId: null,
      trainingPlanName: null,
      createdWorkouts: 0,
      skipped: 0,
      errors: ["Missing workouts array"],
    };
  }
  if (workouts.length > 120) {
    return {
      ok: false,
      trainingPlanId: null,
      trainingPlanName: null,
      createdWorkouts: 0,
      skipped: 0,
      errors: ["Too many workouts in one call (max 120)."],
    };
  }

  let latestDate = new Date(startDate);
  const maxAllowedDate = new Date(startDate);
  maxAllowedDate.setUTCDate(maxAllowedDate.getUTCDate() + weeks * 7 - 1);
  let createdWorkouts = 0;
  let skipped = 0;

  const createdPlan = await prisma.trainingPlan.create({
    data: {
      athleteId,
      name,
      type: PlanType.BASE_BUILDING,
      startDate,
      endDate: startDate,
    },
    select: { id: true, name: true },
  });

  for (const w of workouts) {
    if (!w || typeof w !== "object") {
      skipped++;
      errors.push("Skipped invalid workout entry");
      continue;
    }
    const row = w as Record<string, unknown>;
    const dateStr = typeof row.date === "string" ? row.date : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const typeStr = typeof row.type === "string" ? row.type.trim() : "";
    const date = parseYmdUtcNoon(dateStr);
    if (!date || !title || !isWorkoutType(typeStr)) {
      skipped++;
      errors.push(`Skipped invalid row: ${JSON.stringify({ date: dateStr, title, type: typeStr })}`);
      continue;
    }
    if (date < startDate || date > maxAllowedDate) {
      skipped++;
      errors.push(
        `Skipped ${title}: date ${date.toISOString().slice(0, 10)} is outside ${weeks}-week window.`,
      );
      continue;
    }
    const rawDistanceKm =
      typeof row.distanceKm === "number" && Number.isFinite(row.distanceKm)
        ? row.distanceKm
        : typeof row.distanceMi === "number" && Number.isFinite(row.distanceMi)
          ? row.distanceMi * KM_PER_MI
          : undefined;
    const distanceKm =
      rawDistanceKm != null && distanceUnit === "mi" && typeof row.distanceKm === "number"
        ? rawDistanceKm * KM_PER_MI
        : rawDistanceKm;
    const durationMin =
      typeof row.durationMin === "number" && Number.isFinite(row.durationMin)
        ? Math.round(row.durationMin)
        : undefined;
    const description = composeDescription(row);
    try {
      await prisma.workout.create({
        data: {
          trainingPlanId: createdPlan.id,
          date,
          title: title.slice(0, 200),
          type: typeStr,
          distanceKm,
          durationMin,
          description,
        },
      });
      createdWorkouts++;
      if (date > latestDate) {
        latestDate = date;
      }
    } catch (e) {
      skipped++;
      errors.push(e instanceof Error ? e.message : "create failed");
    }
  }

  await prisma.trainingPlan.update({
    where: { id: createdPlan.id },
    data: { endDate: latestDate },
  });

  return {
    ok: createdWorkouts > 0,
    trainingPlanId: createdPlan.id,
    trainingPlanName: createdPlan.name,
    createdWorkouts,
    skipped,
    errors: errors.slice(0, 10),
  };
}

export const CREATE_PLANNED_WORKOUTS_TOOL = {
  type: "function" as const,
  function: {
    name: "create_planned_workouts",
    description:
      "Create future planned workouts on the athlete's calendar. " +
      "If no target plan is provided, a new draft plan is auto-created and workouts are written there. " +
      "Only call after the athlete agrees or asks you to add workouts. Use WorkoutType enum values exactly. " +
      "Dates must be YYYY-MM-DD (UTC calendar day; stored at noon UTC). Prefer a small batch (e.g. one week).",
    parameters: {
      type: "object",
      properties: {
        workouts: {
          type: "array",
          maxItems: 21,
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "YYYY-MM-DD" },
              title: { type: "string" },
              type: {
                type: "string",
                enum: [...WORKOUT_TYPES],
              },
              distanceKm: { type: "number" },
              durationMin: { type: "integer" },
              description: { type: "string" },
              focus: { type: "string" },
              targetPace: { type: "string" },
              warmup: { type: "string" },
              cooldown: { type: "string" },
              notes: { type: "string" },
            },
            required: ["date", "title", "type"],
          },
        },
      },
      required: ["workouts"],
    },
  },
};

export const CREATE_BASE_BUILDING_PLAN_TOOL = {
  type: "function" as const,
  function: {
    name: "create_base_building_plan",
    description:
      "Create a new BASE_BUILDING training plan for the athlete and populate it with workouts. " +
      "Use this when they ask to generate a full base plan from chat. " +
      "Default to 8 weeks and miles unless the athlete explicitly asks otherwise. " +
      "Provide startDate and workouts. Dates are YYYY-MM-DD.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Plan display name" },
        startDate: { type: "string", description: "YYYY-MM-DD plan start date" },
        weeks: { type: "integer", description: "Plan length in weeks (default 8)" },
        distanceUnit: {
          type: "string",
          enum: ["mi", "km"],
          description: "Unit used by distance fields. Default mi.",
        },
        workouts: {
          type: "array",
          maxItems: 120,
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "YYYY-MM-DD" },
              title: { type: "string" },
              type: {
                type: "string",
                enum: [...WORKOUT_TYPES],
              },
              distanceKm: { type: "number" },
              distanceMi: { type: "number" },
              durationMin: { type: "integer" },
              description: { type: "string" },
              focus: { type: "string" },
              targetPace: { type: "string" },
              warmup: { type: "string" },
              cooldown: { type: "string" },
              notes: { type: "string" },
            },
            required: ["date", "title", "type"],
          },
        },
      },
      required: ["startDate", "workouts"],
    },
  },
};
