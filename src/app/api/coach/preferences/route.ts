import { NextResponse } from "next/server";

import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function clampWeeks(n: number): number {
  return Math.min(20, Math.max(4, Math.round(n)));
}

export async function GET(): Promise<NextResponse> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return NextResponse.json({ defaultBaseWeeks: 8, defaultDistanceUnit: "mi" });
  }
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { defaultBaseWeeks: true, defaultDistanceUnit: true },
  });
  return NextResponse.json({
    defaultBaseWeeks: athlete?.defaultBaseWeeks ?? 8,
    defaultDistanceUnit:
      athlete?.defaultDistanceUnit === "km" ? "km" : "mi",
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return NextResponse.json(
      { error: "No athlete configured. Set RUNCOACH_DEFAULT_ATHLETE_ID or create an Athlete." },
      { status: 400 },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const rawWeeks =
    typeof body === "object" && body && "defaultBaseWeeks" in body
      ? (body as { defaultBaseWeeks?: unknown }).defaultBaseWeeks
      : undefined;
  const defaultBaseWeeks =
    typeof rawWeeks === "number" && Number.isFinite(rawWeeks)
      ? clampWeeks(rawWeeks)
      : 8;

  const rawUnit =
    typeof body === "object" && body && "defaultDistanceUnit" in body
      ? (body as { defaultDistanceUnit?: unknown }).defaultDistanceUnit
      : undefined;
  const defaultDistanceUnit =
    typeof rawUnit === "string" && rawUnit.toLowerCase() === "km" ? "km" : "mi";

  const updated = await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      defaultBaseWeeks,
      defaultDistanceUnit,
    },
    select: {
      defaultBaseWeeks: true,
      defaultDistanceUnit: true,
    },
  });

  return NextResponse.json(updated);
}

