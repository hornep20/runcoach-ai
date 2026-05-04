/** Format seconds per mile or per km as m:ss */
export function formatPaceMinSec(secPerUnit: number | null | undefined): string {
  if (secPerUnit == null || !Number.isFinite(secPerUnit) || secPerUnit <= 0) {
    return "—";
  }
  const totalSec = Math.round(secPerUnit);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
