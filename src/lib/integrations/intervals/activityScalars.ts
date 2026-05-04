import type { MappedExternalActivity } from "@/lib/integrations/intervals/mapActivity";

/**
 * Columns derived from Intervals activity JSON (list or detail) excluding identity, provider, and raw list payload.
 */
export function mappedActivityToScalarData(mapped: MappedExternalActivity) {
  return {
    startTime: mapped.startTime,
    title: mapped.title,
    sportType: mapped.sportType,
    durationSeconds: mapped.durationSeconds,
    elapsedSeconds: mapped.elapsedSeconds,
    distanceM: mapped.distanceM,
    elevationGainM: mapped.elevationGainM,
    avgHr: mapped.avgHr,
    maxHr: mapped.maxHr,
    avgSpeed: mapped.avgSpeed,
    maxSpeed: mapped.maxSpeed,
    avgCadence: mapped.avgCadence,
    maxCadence: mapped.maxCadence,
    calories: mapped.calories,
    icuTrainingLoad: mapped.icuTrainingLoad,
    icuIntensity: mapped.icuIntensity,
    icuFtp: mapped.icuFtp,
    icuWeightedAvgWatts: mapped.icuWeightedAvgWatts,
    icuAverageWatts: mapped.icuAverageWatts,
    paceSecPerKm: mapped.paceSecPerKm,
    source: mapped.source,
    trainer: mapped.trainer,
    ...(mapped.zoneTimes !== undefined ? { zoneTimes: mapped.zoneTimes } : {}),
  };
}
