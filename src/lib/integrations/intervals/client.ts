import type { IntervalsEnv } from "@/lib/env";
import {
  HISTORY_START,
  INTERVALS_LIST_LIMIT,
} from "@/lib/integrations/intervals/constants";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function basicAuthHeader(apiKey: string): string {
  const pair = `API_KEY:${apiKey}`;
  if (typeof Buffer !== "undefined") {
    return `Basic ${Buffer.from(pair, "utf8").toString("base64")}`;
  }
  return `Basic ${btoa(pair)}`;
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYmd(ymd: string): Date {
  const [y, m, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function addDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return formatYmd(d);
}

function daysBetweenOldestNewest(oldest: string, newest: string): number {
  const a = parseYmd(oldest).getTime();
  const b = parseYmd(newest).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

async function fetchActivitiesOnce(
  env: IntervalsEnv,
  oldest: string,
  newest: string,
): Promise<unknown[]> {
  const url = new URL(
    `${env.baseUrl.replace(/\/$/, "")}/api/v1/athlete/${encodeURIComponent(env.intervalsAthleteId)}/activities`,
  );
  url.searchParams.set("oldest", oldest);
  url.searchParams.set("newest", newest);
  url.searchParams.set("limit", String(INTERVALS_LIST_LIMIT));

  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: basicAuthHeader(env.apiKey),
        },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (res.status === 429) {
        const ra = res.headers.get("retry-after");
        const waitMs = ra ? Math.min(60_000, Math.max(1000, parseInt(ra, 10) * 1000)) : 2 ** attempt * 500;
        await sleep(waitMs);
        continue;
      }

      if (res.status >= 500 && attempt < maxAttempts - 1) {
        await sleep(2 ** attempt * 300);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Intervals.icu HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const body: unknown = await res.json();
      if (!Array.isArray(body)) {
        throw new Error("Intervals.icu activities response was not a JSON array");
      }
      return body;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === maxAttempts - 1) throw err;
      await sleep(2 ** attempt * 300);
    }
  }

  return [];
}

/**
 * Full activity document: `GET /api/v1/activity/{id}` (optionally with detected intervals).
 */
export async function fetchActivityDetail(
  env: IntervalsEnv,
  intervalsActivityId: string,
  options?: { includeIntervals?: boolean },
): Promise<unknown> {
  const url = new URL(
    `${env.baseUrl.replace(/\/$/, "")}/api/v1/activity/${encodeURIComponent(intervalsActivityId)}`,
  );
  if (options?.includeIntervals !== false) {
    url.searchParams.set("intervals", "true");
  }

  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: basicAuthHeader(env.apiKey),
        },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (res.status === 404) {
        return null;
      }

      if (res.status === 429) {
        const ra = res.headers.get("retry-after");
        const waitMs = ra ? Math.min(60_000, Math.max(1000, parseInt(ra, 10) * 1000)) : 2 ** attempt * 500;
        await sleep(waitMs);
        continue;
      }

      if (res.status >= 500 && attempt < maxAttempts - 1) {
        await sleep(2 ** attempt * 300);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Intervals.icu activity HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      return (await res.json()) as unknown;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === maxAttempts - 1) throw err;
      await sleep(2 ** attempt * 300);
    }
  }

  return null;
}

/**
 * Fetch all activities in [oldest, newest] (inclusive calendar days).
 * If the API returns `limit` rows, the window is bisected so we do not miss activities.
 */
export async function fetchActivitiesForWindow(
  env: IntervalsEnv,
  oldest: string,
  newest: string,
): Promise<unknown[]> {
  const batch = await fetchActivitiesOnce(env, oldest, newest);
  if (batch.length < INTERVALS_LIST_LIMIT) {
    return batch;
  }

  if (oldest === newest) {
    return batch;
  }

  const spanDays = daysBetweenOldestNewest(oldest, newest);
  if (spanDays <= 1) {
    return batch;
  }

  const midOffset = Math.floor(spanDays / 2);
  const leftNewest = addDays(oldest, midOffset);
  const rightOldest = addDays(leftNewest, 1);

  const [left, right] = await Promise.all([
    fetchActivitiesForWindow(env, oldest, leftNewest),
    fetchActivitiesForWindow(env, rightOldest, newest),
  ]);

  return [...left, ...right];
}

export function* iterateHistoryDateWindows(
  chunkDays = 90,
): Generator<{ oldest: string; newest: string }> {
  const end = new Date();
  let cursor = parseYmd(HISTORY_START);

  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);
    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }

    yield {
      oldest: formatYmd(cursor),
      newest: formatYmd(chunkEnd),
    };

    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}
