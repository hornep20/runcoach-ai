export const INTERVALS_PROVIDER = "intervals_icu" as const;

/** Max activities per request; bisect date range if response hits this cap */
export const INTERVALS_LIST_LIMIT = 200;

export const HISTORY_START = "2005-01-01";

/** Delay between per-activity detail fetches (rate limit courtesy) */
export const INTERVALS_DETAIL_REQUEST_DELAY_MS = 200;

/** Default max activities processed in one detail-sync invocation */
export const INTERVALS_DETAIL_SYNC_DEFAULT_LIMIT = 5000;
