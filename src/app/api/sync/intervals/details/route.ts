import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getSyncSecret } from "@/lib/env";
import {
  resolveSyncAthleteId,
} from "@/lib/integrations/intervals/sync";
import { syncIntervalsActivityDetails } from "@/lib/integrations/intervals/sync-detail";

export const runtime = "nodejs";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function parseBodyBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  return undefined;
}

function parseBodyNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
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

  const o = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const athleteIdFromBody =
    typeof o.athleteId === "string" ? o.athleteId : undefined;
  const limit = parseBodyNumber(o.limit);
  const force = parseBodyBool(o.force);
  const includeIntervals = parseBodyBool(o.includeIntervals);

  let athleteId: string;
  try {
    athleteId = await resolveSyncAthleteId(athleteIdFromBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Athlete resolution failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const summary = await syncIntervalsActivityDetails(athleteId, {
      limit,
      force,
      includeIntervals:
        includeIntervals === undefined ? undefined : includeIntervals,
    });
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Detail sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
