import { NextResponse } from "next/server";

import { buildFullCoachContextBlock } from "@/lib/coach/fullContext";
import { chatCoachWithTools, embedText } from "@/lib/coach/openai";
import { buildCoachSystemPrompt } from "@/lib/coach/prompts";
import { retrieveCoachChunks } from "@/lib/coach/retrieve";
import { getOpenAIApiKey } from "@/lib/env";
import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";
import { buildCoachAgentDirective } from "@/lib/coach/agentRouter";

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
          "Expected { messages: { role: 'user'|'assistant', content: string }[] }.",
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
      { error: "No athlete configured." },
      { status: 400 },
    );
  }

  try {
    const queryEmbedding = await embedText(lastUser.content);
    const chunks = await retrieveCoachChunks(queryEmbedding);

    const athleteBlock = await buildFullCoachContextBlock({
      trainingPlanId: null,
      coachingBrief: null,
      defaultBaseWeeks: DEFAULT_BASE_WEEKS,
      defaultDistanceUnit: "mi",
    });

    const agentDirective = await buildCoachAgentDirective(lastUser.content);

    const systemContent = buildCoachSystemPrompt(
      chunks,
      `${agentDirective}\n\n${athleteBlock}`,
    );

    const fullMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const { reply } = await chatCoachWithTools(fullMessages, {
      trainingPlanId: null,
      athleteId,
      defaultBaseWeeks: DEFAULT_BASE_WEEKS,
      defaultDistanceUnit: "mi",
    });

    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Coach request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
