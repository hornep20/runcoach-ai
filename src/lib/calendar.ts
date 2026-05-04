import type { ExternalActivity, Workout as PrismaWorkout } from "@/generated/prisma/client";
import { WorkoutType } from "@/generated/prisma/enums";
import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";

type WorkoutTypeEnum = (typeof WorkoutType)[keyof typeof WorkoutType];

const WORKOUT_TYPES = Object.values(WorkoutType) as WorkoutTypeEnum[];

export type CalendarItemKind = "planned" | "imported";

export interface CalendarItem {
  kind: CalendarItemKind;
  id: string;
  date: string;
  title: string;
  subtitle: string;
  distanceKm?: number;
  durationMin?: number;
}

export interface CalendarFilterOption {
  value: string;
  label: string;
}

export interface GetCalendarItemsOptions {
  /** From URL: `all`, `p:EASY_RUN`, `s:Run`, etc. */
  filterKey?: string | null;
}

function isWorkoutType(value: string): value is WorkoutTypeEnum {
  return (WORKOUT_TYPES as string[]).includes(value);
}

function humanizeWorkoutType(type: WorkoutTypeEnum): string {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function toCalendarPlanned(workout: PrismaWorkout): CalendarItem {
  return {
    kind: "planned",
    id: `planned:${workout.id}`,
    date: workout.date.toISOString().slice(0, 10),
    title: workout.title,
    subtitle: workout.type.toLowerCase().replace(/_/g, "-"),
    distanceKm: workout.distanceKm ?? undefined,
    durationMin: workout.durationMin ?? undefined,
  };
}

function toCalendarImported(activity: ExternalActivity): CalendarItem {
  const durationMin =
    activity.durationSeconds != null
      ? Math.round(activity.durationSeconds / 60)
      : undefined;
  const distanceKm =
    activity.distanceM != null ? Math.round((activity.distanceM / 1000) * 100) / 100 : undefined;

  return {
    kind: "imported",
    id: `imported:${activity.id}`,
    date: activity.startTime.toISOString().slice(0, 10),
    title: activity.title,
    subtitle: activity.sportType ?? "activity",
    distanceKm,
    durationMin,
  };
}

function parseFilterMode(filterKey: string | null | undefined):
  | { mode: "all" }
  | { mode: "planned"; type: WorkoutTypeEnum }
  | { mode: "sport"; sport: string } {
  const key = (filterKey ?? "all").trim();
  if (key === "" || key === "all") {
    return { mode: "all" };
  }
  if (key.startsWith("p:")) {
    const raw = key.slice(2);
    if (isWorkoutType(raw)) {
      return { mode: "planned", type: raw };
    }
    return { mode: "all" };
  }
  if (key.startsWith("s:")) {
    try {
      const sport = decodeURIComponent(key.slice(2));
      if (sport.length > 0) {
        return { mode: "sport", sport };
      }
    } catch {
      return { mode: "all" };
    }
  }
  return { mode: "all" };
}

export async function getCalendarFilterOptions(): Promise<CalendarFilterOption[]> {
  const opts: CalendarFilterOption[] = [{ value: "all", label: "All types" }];

  for (const t of WORKOUT_TYPES) {
    opts.push({
      value: `p:${t}`,
      label: `Planned · ${humanizeWorkoutType(t)}`,
    });
  }

  const athleteId = await resolveAthleteIdForRead();
  if (athleteId) {
    const sports = await prisma.externalActivity.findMany({
      where: { athleteId, sportType: { not: null } },
      distinct: ["sportType"],
      select: { sportType: true },
      orderBy: { sportType: "asc" },
    });

    const seen = new Set<string>();
    for (const row of sports) {
      const s = row.sportType;
      if (!s || seen.has(s)) continue;
      seen.add(s);
      opts.push({
        value: `s:${s}`,
        label: `Imported · ${s}`,
      });
    }
  }

  return opts;
}

export async function getCalendarItems(
  limit = 60,
  options: GetCalendarItemsOptions = {},
): Promise<CalendarItem[]> {
  const athleteId = await resolveAthleteIdForRead();
  const take = Math.min(Math.max(limit, 1), 200);
  const parsed = parseFilterMode(options.filterKey);

  try {
    let planned: PrismaWorkout[] = [];
    let imported: ExternalActivity[] = [];

    if (parsed.mode === "all") {
      [planned, imported] = await Promise.all([
        prisma.workout.findMany({
          orderBy: { date: "desc" },
          take: take,
        }),
        athleteId
          ? prisma.externalActivity.findMany({
              where: { athleteId },
              orderBy: { startTime: "desc" },
              take: take,
            })
          : [],
      ]);
    } else if (parsed.mode === "planned") {
      planned = await prisma.workout.findMany({
        where: { type: parsed.type },
        orderBy: { date: "desc" },
        take: take,
      });
    } else if (parsed.mode === "sport") {
      if (!athleteId) {
        return [];
      }
      imported = await prisma.externalActivity.findMany({
        where: {
          athleteId,
          sportType: { equals: parsed.sport, mode: "insensitive" },
        },
        orderBy: { startTime: "desc" },
        take: take,
      });
    }

    const merged = [
      ...planned.map(toCalendarPlanned),
      ...imported.map(toCalendarImported),
    ];

    merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return merged.slice(0, limit);
  } catch {
    return [];
  }
}

/** Single imported activity for the resolved athlete (calendar detail). */
export async function getImportedActivityForViewer(
  activityId: string,
): Promise<ExternalActivity | null> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return null;
  }

  return prisma.externalActivity.findFirst({
    where: { id: activityId, athleteId },
  });
}

type WorkoutWithPlanName = PrismaWorkout & {
  trainingPlan: { name: string };
};

/** Single planned workout belonging to the resolved athlete (calendar detail). */
export async function getPlannedWorkoutForViewer(
  workoutId: string,
): Promise<WorkoutWithPlanName | null> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return null;
  }

  return prisma.workout.findFirst({
    where: {
      id: workoutId,
      trainingPlan: { athleteId },
    },
    include: { trainingPlan: { select: { name: true } } },
  });
}
