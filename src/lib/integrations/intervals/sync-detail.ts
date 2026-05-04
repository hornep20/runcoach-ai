import type { Prisma } from "@/generated/prisma/client";

import { getIntervalsEnv } from "@/lib/env";
import { mappedActivityToScalarData } from "@/lib/integrations/intervals/activityScalars";
import {
  INTERVALS_DETAIL_REQUEST_DELAY_MS,
  INTERVALS_DETAIL_SYNC_DEFAULT_LIMIT,
  INTERVALS_PROVIDER,
} from "@/lib/integrations/intervals/constants";
import { fetchActivityDetail } from "@/lib/integrations/intervals/client";
import { mapIntervalsActivityJson } from "@/lib/integrations/intervals/mapActivity";
import { prisma } from "@/lib/prisma";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DetailSyncSummary {
  athleteId: string;
  examined: number;
  updated: number;
  notFound: number;
  errors: number;
}

export interface DetailSyncOptions {
  /** Max rows to process this run (capped at 20_000) */
  limit?: number;
  /** Re-fetch even when `detailFetchedAt` is already set */
  force?: boolean;
  /**
   * When true (default), requests `?intervals=true` for interval structure in the payload.
   * Set false for smaller responses if you only need scalar fields.
   */
  includeIntervals?: boolean;
}

/**
 * Phase 2: for each stored Intervals activity, fetch `GET /api/v1/activity/{id}`,
 * refresh scalar columns from the richer document, and store the full JSON in `detailPayload`.
 * Does not replace `rawPayload` from the list sync.
 */
export async function syncIntervalsActivityDetails(
  athleteId: string,
  options: DetailSyncOptions = {},
): Promise<DetailSyncSummary> {
  const env = getIntervalsEnv();
  const force = options.force ?? false;
  const includeIntervals = options.includeIntervals !== false;
  const limit = Math.min(
    options.limit ?? INTERVALS_DETAIL_SYNC_DEFAULT_LIMIT,
    20_000,
  );

  const summary: DetailSyncSummary = {
    athleteId,
    examined: 0,
    updated: 0,
    notFound: 0,
    errors: 0,
  };

  const rows = await prisma.externalActivity.findMany({
    where: {
      athleteId,
      provider: INTERVALS_PROVIDER,
      ...(force ? {} : { detailFetchedAt: null }),
    },
    orderBy: { startTime: "desc" },
    take: limit,
    select: { id: true, externalId: true },
  });

  for (const row of rows) {
    summary.examined++;
    try {
      const detail = await fetchActivityDetail(env, row.externalId, {
        includeIntervals,
      });
      if (detail === null) {
        summary.notFound++;
        continue;
      }

      const mapped = mapIntervalsActivityJson(detail);
      if (!mapped) {
        summary.errors++;
        continue;
      }
      if (mapped.externalId !== row.externalId) {
        summary.errors++;
        continue;
      }

      const scalars = mappedActivityToScalarData(mapped);

      await prisma.externalActivity.update({
        where: { id: row.id },
        data: {
          ...scalars,
          detailPayload: detail as Prisma.InputJsonValue,
          detailFetchedAt: new Date(),
        },
      });
      summary.updated++;
    } catch {
      summary.errors++;
    }

    await sleep(INTERVALS_DETAIL_REQUEST_DELAY_MS);
  }

  return summary;
}
