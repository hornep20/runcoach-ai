import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";

/** Short plain-text summary of recent imports for the coach prompt. */
export async function getAthleteCoachingContext(): Promise<string> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return "No athlete is configured (set RUNCOACH_DEFAULT_ATHLETE_ID or create an Athlete).";
  }

  const rows = await prisma.externalActivity.findMany({
    where: { athleteId },
    orderBy: { startTime: "desc" },
    take: 8,
    select: {
      title: true,
      startTime: true,
      sportType: true,
      distanceM: true,
      durationSeconds: true,
    },
  });

  if (rows.length === 0) {
    return "No imported activities yet. Suggest running Intervals.icu sync when relevant.";
  }

  const lines = rows.map((r) => {
    const date = r.startTime.toISOString().slice(0, 10);
    const km =
      r.distanceM != null ? `${Math.round((r.distanceM / 1000) * 10) / 10} km` : "—";
    const dur =
      r.durationSeconds != null
        ? `${Math.round(r.durationSeconds / 60)} min`
        : "—";
    const sport = r.sportType ?? "activity";
    return `- ${date} · ${sport} · ${r.title} · ${km} · ${dur}`;
  });

  return ["Recent imported activities (newest first):", ...lines].join("\n");
}
