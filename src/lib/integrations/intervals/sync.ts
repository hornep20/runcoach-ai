import { getDefaultAthleteIdFromEnv, getIntervalsEnv } from "@/lib/env";
import { mappedActivityToScalarData } from "@/lib/integrations/intervals/activityScalars";
import {
  fetchActivitiesForWindow,
  iterateHistoryDateWindows,
} from "@/lib/integrations/intervals/client";
import { INTERVALS_PROVIDER } from "@/lib/integrations/intervals/constants";
import {
  mapIntervalsActivityJson,
  type MappedExternalActivity,
} from "@/lib/integrations/intervals/mapActivity";
import { prisma } from "@/lib/prisma";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SyncSummary {
  athleteId: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export async function resolveSyncAthleteId(
  explicitAthleteId?: string,
): Promise<string> {
  if (explicitAthleteId?.trim()) {
    return explicitAthleteId.trim();
  }

  const fromEnv = getDefaultAthleteIdFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  const first = await prisma.athlete.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!first) {
    throw new Error(
      "No Athlete found. Create an Athlete row (e.g. via Prisma Studio) or set RUNCOACH_DEFAULT_ATHLETE_ID.",
    );
  }

  return first.id;
}

const activityUpsertFields = (mapped: MappedExternalActivity) => ({
  ...mappedActivityToScalarData(mapped),
  rawPayload: mapped.rawPayload,
});

/**
 * Full-history backfill from Intervals.icu into ExternalActivity for one RunCoach athlete.
 */
export async function syncIntervalsActivities(
  athleteId: string,
): Promise<SyncSummary> {
  const env = getIntervalsEnv();

  const summary: SyncSummary = {
    athleteId,
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const { oldest, newest } of iterateHistoryDateWindows(90)) {
    let rows: unknown[];
    try {
      rows = await fetchActivitiesForWindow(env, oldest, newest);
    } catch {
      summary.errors++;
      await sleep(500);
      continue;
    }

    summary.fetched += rows.length;

    for (const row of rows) {
      const mapped = mapIntervalsActivityJson(row);
      if (!mapped) {
        summary.skipped++;
        continue;
      }

      try {
        const existing = await prisma.externalActivity.findUnique({
          where: {
            athleteId_provider_externalId: {
              athleteId,
              provider: INTERVALS_PROVIDER,
              externalId: mapped.externalId,
            },
          },
        });

        const fields = activityUpsertFields(mapped);

        await prisma.externalActivity.upsert({
          where: {
            athleteId_provider_externalId: {
              athleteId,
              provider: INTERVALS_PROVIDER,
              externalId: mapped.externalId,
            },
          },
          create: {
            athleteId,
            provider: mapped.provider,
            externalId: mapped.externalId,
            ...fields,
          },
          update: fields,
        });

        if (existing) {
          summary.updated++;
        } else {
          summary.created++;
        }
      } catch {
        summary.errors++;
      }
    }

    await sleep(200);
  }

  return summary;
}
