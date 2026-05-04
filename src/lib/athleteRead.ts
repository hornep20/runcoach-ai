import { getDefaultAthleteIdFromEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/** Same resolution as sync for listing imported data in UI (no throw). */
export async function resolveAthleteIdForRead(): Promise<string | null> {
  const fromEnv = getDefaultAthleteIdFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  const first = await prisma.athlete.findFirst({
    orderBy: { createdAt: "asc" },
  });

  return first?.id ?? null;
}
