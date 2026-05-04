import type { Prisma } from "@/generated/prisma/client";

/**
 * Intervals.icu sport `type` values we treat as running for dashboards and run-specific stats.
 */
export const IMPORTED_RUN_SPORT_TYPES = [
  "Run",
  "VirtualRun",
  "TrailRun",
  "TrackRun",
  "Treadmill",
] as const;

/**
 * Match imported runs regardless of `sportType` casing (PostgreSQL default string compare is case-sensitive).
 */
export function whereImportedRunSportTypes(): Prisma.ExternalActivityWhereInput {
  return {
    OR: IMPORTED_RUN_SPORT_TYPES.map((sport) => ({
      sportType: { equals: sport, mode: "insensitive" },
    })),
  };
}
