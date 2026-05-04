import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getSyncSecret } from "@/lib/env";
import {
  resolveSyncAthleteId,
  syncIntervalsActivities,
} from "@/lib/integrations/intervals/sync";

export const runtime = "nodejs";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request): Promise<NextResponse> {
  let expectedSecret: string;
  try {
    expectedSecret = getSyncSecret();
  } catch {
    return NextResponse.json(
      { error: "Server missing SYNC_SECRET_TOKEN" },
      { status: 500 },
    );
  }

  const provided = request.headers.get("x-sync-secret");
  if (!provided) {
    return unauthorized();
  }
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expectedSecret, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return unauthorized();
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.length > 0) {
      body = JSON.parse(text) as unknown;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const athleteIdFromBody =
    typeof body === "object" &&
    body !== null &&
    "athleteId" in body &&
    typeof (body as { athleteId?: unknown }).athleteId === "string"
      ? (body as { athleteId: string }).athleteId
      : undefined;

  let athleteId: string;
  try {
    athleteId = await resolveSyncAthleteId(athleteIdFromBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Athlete resolution failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const summary = await syncIntervalsActivities(athleteId);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
