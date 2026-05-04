import type { Prisma } from "@/generated/prisma/client";

import { INTERVALS_PROVIDER } from "@/lib/integrations/intervals/constants";

export interface MappedExternalActivity {
  provider: typeof INTERVALS_PROVIDER;
  externalId: string;
  startTime: Date;
  title: string;
  sportType: string | null;
  durationSeconds: number | null;
  elapsedSeconds: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgSpeed: number | null;
  maxSpeed: number | null;
  avgCadence: number | null;
  maxCadence: number | null;
  calories: number | null;
  icuTrainingLoad: number | null;
  icuIntensity: number | null;
  icuFtp: number | null;
  icuWeightedAvgWatts: number | null;
  icuAverageWatts: number | null;
  paceSecPerKm: number | null;
  source: string | null;
  trainer: boolean | null;
  /** Omitted when absent so Prisma create/update accepts the shape */
  zoneTimes?: Prisma.InputJsonValue;
  rawPayload: Prisma.InputJsonValue;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function int(v: unknown): number | null {
  const n = num(v);
  if (n === null) return null;
  return Math.round(n);
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function paceSecPerKmFromActivity(
  distanceM: number | null,
  movingSec: number | null,
  avgSpeed: number | null,
): number | null {
  if (distanceM != null && movingSec != null && distanceM > 0 && movingSec > 0) {
    return movingSec / (distanceM / 1000);
  }
  if (avgSpeed != null && avgSpeed > 0) {
    return 1000 / avgSpeed;
  }
  return null;
}

function zoneTimesJson(raw: unknown): Prisma.InputJsonValue | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "object" || typeof raw === "string" || typeof raw === "number") {
    return raw as Prisma.InputJsonValue;
  }
  return undefined;
}

/**
 * Map one Intervals.icu activity JSON object into our persistence shape.
 * Field names follow the public Activity schema (see Intervals API docs).
 */
export function mapIntervalsActivityJson(raw: unknown): MappedExternalActivity | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const idRaw = o.id;
  const externalId =
    typeof idRaw === "number"
      ? String(idRaw)
      : typeof idRaw === "string"
        ? idRaw
        : null;
  if (!externalId) return null;

  const startLocal = str(o.start_date_local);
  if (!startLocal) return null;
  const startTime = new Date(startLocal);
  if (Number.isNaN(startTime.getTime())) return null;

  const title = str(o.name) ?? "Activity";
  const sportType = str(o.type);

  const distanceM = num(o.distance);
  const moving = int(o.moving_time);
  const avgSpeed = num(o.average_speed);
  const zoneTimes = zoneTimesJson(o.icu_zone_times);

  return {
    provider: INTERVALS_PROVIDER,
    externalId,
    startTime,
    title,
    sportType,
    durationSeconds: moving,
    elapsedSeconds: int(o.elapsed_time),
    distanceM,
    elevationGainM: num(o.total_elevation_gain),
    avgHr: int(o.average_heartrate),
    maxHr: int(o.max_heartrate),
    avgSpeed,
    maxSpeed: num(o.max_speed),
    avgCadence: num(o.average_cadence),
    maxCadence: num(o.max_cadence),
    calories: num(o.calories),
    icuTrainingLoad: num(o.icu_training_load),
    icuIntensity: num(o.icu_intensity),
    icuFtp: num(o.icu_ftp),
    icuWeightedAvgWatts: num(o.icu_weighted_avg_watts),
    icuAverageWatts: num(o.icu_average_watts),
    paceSecPerKm: paceSecPerKmFromActivity(distanceM, moving, avgSpeed),
    source: str(o.source),
    trainer: bool(o.trainer),
    ...(zoneTimes != null ? { zoneTimes } : {}),
    rawPayload: o as Prisma.InputJsonValue,
  };
}
