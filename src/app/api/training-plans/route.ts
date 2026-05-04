import { NextResponse } from "next/server";

import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";
import { PlanType } from "@/generated/prisma/enums";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return NextResponse.json({ plans: [] });
  }

  const rows = await prisma.trainingPlan.findMany({
    where: { athleteId },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      startDate: true,
      endDate: true,
    },
  });

  return NextResponse.json({
    plans: rows.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
    })),
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

  const nameRaw =
    typeof body === "object" && body && "name" in body && typeof (body as { name?: unknown }).name === "string"
      ? (body as { name: string }).name.trim()
      : "";
  const name = nameRaw.length > 0 ? nameRaw.slice(0, 120) : "Coach Draft Plan";

  const typeRaw =
    typeof body === "object" && body && "type" in body && typeof (body as { type?: unknown }).type === "string"
      ? (body as { type: string }).type
      : PlanType.MARATHON_16_WEEK;
  const type =
    typeRaw === PlanType.BASE_BUILDING || typeRaw === PlanType.MARATHON_16_WEEK
      ? typeRaw
      : PlanType.MARATHON_16_WEEK;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + (type === PlanType.MARATHON_16_WEEK ? 16 * 7 - 1 : 10 * 7 - 1));

  const created = await prisma.trainingPlan.create({
    data: {
      athleteId,
      name,
      type,
      startDate: today,
      endDate: end,
    },
    select: {
      id: true,
      name: true,
      type: true,
      startDate: true,
      endDate: true,
    },
  });

  return NextResponse.json({
    plan: {
      id: created.id,
      name: created.name,
      type: created.type,
      startDate: created.startDate.toISOString(),
      endDate: created.endDate.toISOString(),
    },
  });
}
