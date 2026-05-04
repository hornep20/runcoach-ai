import { NextResponse } from "next/server";

import { buildFullCoachContextBlock } from "@/lib/coach/fullContext";
import { chatCoachWithTools, embedText } from "@/lib/coach/openai";
import { buildCoachSystemPrompt } from "@/lib/coach/prompts";
import { retrieveCoachChunks } from "@/lib/coach/retrieve";
import { getOpenAIApiKey } from "@/lib/env";
import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";

const MAX_MESSAGES = 24;
const MAX_CONTENT_LEN = 8000;
const MAX_BRIEF_LEN = 12_000;
const MAX_TITLE_LEN = 120;
const DEFAULT_BASE_WEEKS = 8;

function isRole(r: unknown): r is "user" | "assistant" {
  return r === "user" || r === "assistant";
}

function parseMessages(body: unknown): { role: "user" | "assistant"; content: string }[] | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    return null;
  }
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") {
      return null;
    }
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (!isRole(role) || typeof content !== "string") {
      return null;
    }
    if (content.length > MAX_CONTENT_LEN) {
      return null;
    }
    out.push({ role, content: content.trim() });
  }
  if (!out.some((m) => m.role === "user")) {
    return null;
  }
  return out;
}

function parseTrainingPlanId(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const v = (body as { trainingPlanId?: unknown }).trainingPlanId;
  if (v === null || v === undefined || v === "") {
    return null;
  }
  if (typeof v !== "string" || v.length > 80) {
    return null;
  }
  return v.trim();
}

function parseConversationId(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const v = (body as { conversationId?: unknown }).conversationId;
  if (v === null || v === undefined || v === "") {
    return null;
  }
  if (typeof v !== "string" || v.length > 80) {
    return null;
  }
  return v.trim();
}

function parseDefaultBaseWeeks(body: unknown, fallback: number): number {
  if (!body || typeof body !== "object") {
    return fallback;
  }
  const v = (body as { defaultBaseWeeks?: unknown }).defaultBaseWeeks;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return fallback;
  }
  const n = Math.round(v);
  return Math.min(20, Math.max(4, n));
}

function parseDefaultDistanceUnit(body: unknown, fallback: "mi" | "km"): "mi" | "km" {
  if (!body || typeof body !== "object") {
    return fallback;
  }
  const v = (body as { defaultDistanceUnit?: unknown }).defaultDistanceUnit;
  if (typeof v !== "string") {
    return fallback;
  }
  const s = v.trim().toLowerCase();
  return s === "km" ? "km" : "mi";
}

type BriefParse = { kind: "omit" } | { kind: "invalid" } | { kind: "set"; value: string };

function parseCoachingBrief(body: unknown): BriefParse {
  if (!body || typeof body !== "object") {
    return { kind: "omit" };
  }
  if (!("coachingBrief" in body)) {
    return { kind: "omit" };
  }
  const v = (body as { coachingBrief?: unknown }).coachingBrief;
  if (v === null || v === undefined) {
    return { kind: "set", value: "" };
  }
  if (typeof v !== "string") {
    return { kind: "invalid" };
  }
  if (v.length > MAX_BRIEF_LEN) {
    return { kind: "invalid" };
  }
  return { kind: "set", value: v };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    getOpenAIApiKey();
  } catch {
    return NextResponse.json(
      { error: "Server missing OPENAI_API_KEY" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = parseMessages(body);
  if (!messages) {
    return NextResponse.json(
      {
        error:
          "Expected { messages: { role: 'user'|'assistant', content: string }[], trainingPlanId?: string, coachingBrief?: string }.",
      },
      { status: 400 },
    );
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content) {
    return NextResponse.json({ error: "Missing user message" }, { status: 400 });
  }

  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return NextResponse.json(
      { error: "No athlete configured. Set RUNCOACH_DEFAULT_ATHLETE_ID or create an Athlete." },
      { status: 400 },
    );
  }

  const trainingPlanId = parseTrainingPlanId(body);
  if (trainingPlanId) {
    const ok = await prisma.trainingPlan.findFirst({
      where: { id: trainingPlanId, athleteId },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json({ error: "Invalid trainingPlanId for this athlete" }, { status: 400 });
    }
  }

  const briefParsed = parseCoachingBrief(body);
  if (briefParsed.kind === "invalid") {
    return NextResponse.json({ error: "Invalid coachingBrief" }, { status: 400 });
  }
  if (briefParsed.kind === "set") {
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { coachingBrief: briefParsed.value.length > 0 ? briefParsed.value : null },
    });
  }

  const athletePrefs = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      coachingBrief: true,
      defaultBaseWeeks: true,
      defaultDistanceUnit: true,
    },
  });

  const coachingBriefForContext =
    briefParsed.kind === "set"
      ? briefParsed.value
      : athletePrefs?.coachingBrief ?? "";

  const incomingConversationId = parseConversationId(body);
  const defaultBaseWeeks = parseDefaultBaseWeeks(
    body,
    athletePrefs?.defaultBaseWeeks ?? DEFAULT_BASE_WEEKS,
  );
  const defaultDistanceUnit = parseDefaultDistanceUnit(
    body,
    athletePrefs?.defaultDistanceUnit === "km" ? "km" : "mi",
  );
  let conversationId: string;
  if (incomingConversationId) {
    const conversation = await prisma.coachConversation.findFirst({
      where: { id: incomingConversationId, athleteId },
      select: { id: true },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Invalid conversationId for this athlete" }, { status: 400 });
    }
    conversationId = conversation.id;
  } else {
    const title = lastUser.content.slice(0, MAX_TITLE_LEN).trim();
    const created = await prisma.coachConversation.create({
      data: {
        athleteId,
        title: title.length > 0 ? title : "Coach chat",
      },
      select: { id: true },
    });
    conversationId = created.id;
  }

  try {
    const queryEmbedding = await embedText(lastUser.content);
    const chunks = await retrieveCoachChunks(queryEmbedding);
    const athleteBlock = await buildFullCoachContextBlock({
      trainingPlanId,
      coachingBrief: coachingBriefForContext,
      defaultBaseWeeks,
      defaultDistanceUnit,
    });
    const systemContent = buildCoachSystemPrompt(chunks, athleteBlock);

    const fullMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const { reply, workoutsCreated, basePlansCreated } = await chatCoachWithTools(fullMessages, {
      trainingPlanId,
      athleteId,
      defaultBaseWeeks,
      defaultDistanceUnit,
    });

    await prisma.$transaction([
      prisma.coachMessage.create({
        data: {
          conversationId,
          role: "user",
          content: lastUser.content,
        },
      }),
      prisma.coachMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: reply,
        },
      }),
      prisma.coachConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ reply, workoutsCreated, basePlansCreated, conversationId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Coach request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
