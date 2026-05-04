/**
 * Server-only environment helpers. Validates required vars at call time for sync routes.
 */

const intervalsBaseUrlDefault = "https://intervals.icu";

export interface IntervalsEnv {
  apiKey: string;
  /** Intervals athlete id in path, or "0" for the authenticated user */
  intervalsAthleteId: string;
  baseUrl: string;
}

export function getIntervalsEnv(): IntervalsEnv {
  const apiKey = process.env.INTERVALS_ICU_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing INTERVALS_ICU_API_KEY");
  }

  const intervalsAthleteId =
    process.env.INTERVALS_ICU_ATHLETE_ID?.trim() || "0";

  const baseUrl =
    process.env.INTERVALS_ICU_BASE_URL?.trim() || intervalsBaseUrlDefault;

  return { apiKey, intervalsAthleteId, baseUrl };
}

/** Secret required on POST /api/sync/intervals (header X-Sync-Secret) */
export function getSyncSecret(): string {
  const secret = process.env.SYNC_SECRET_TOKEN?.trim();
  if (!secret) {
    throw new Error("Missing SYNC_SECRET_TOKEN");
  }
  return secret;
}

/**
 * Default athlete row in our DB to attach imported activities to.
 * Set to a Prisma Athlete `id`, or leave unset to use the first athlete in DB.
 */
export function getDefaultAthleteIdFromEnv(): string | undefined {
  const id = process.env.RUNCOACH_DEFAULT_ATHLETE_ID?.trim();
  return id || undefined;
}

export function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return key;
}

/** Chat model for `/api/coach/chat` (default `gpt-4o-mini`). */
export function getOpenAIChatModel(): string {
  return process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
}
