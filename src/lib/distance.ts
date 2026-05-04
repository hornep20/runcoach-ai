export type DistanceUnits = "km" | "mi";

const KM_PER_MI = 1.609344;

/** Statute miles from meters */
export function metersToMiles(m: number): number {
  return m / 1609.344;
}

export function formatMiles(mi: number, digits = 1): string {
  return `${mi.toFixed(digits)} mi`;
}

/** Total moving time as compact hours + minutes */
export function formatDurationFromSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

export function parseDistanceUnits(raw: string | string[] | undefined): DistanceUnits {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "mi" ? "mi" : "km";
}

/** Format stored kilometers for display in km or miles */
export function formatDistanceKm(distanceKm: number | undefined, units: DistanceUnits): string {
  if (distanceKm == null || Number.isNaN(distanceKm)) {
    return "";
  }
  if (units === "mi") {
    const mi = distanceKm / KM_PER_MI;
    return `${Math.round(mi * 10) / 10} mi`;
  }
  return `${Math.round(distanceKm * 100) / 100} km`;
}
