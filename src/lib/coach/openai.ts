import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

import { getOpenAIApiKey, getOpenAIChatModel } from "@/lib/env";
import {
  COACH_EMBEDDING_DIMENSIONS,
  COACH_EMBEDDING_MODEL,
} from "@/lib/coach/constants";
import {
  CREATE_BASE_BUILDING_PLAN_TOOL,
  CREATE_PLANNED_WORKOUTS_TOOL,
  executeCreateBaseBuildingPlanTool,
  executeCreatePlannedWorkoutsTool,
} from "@/lib/coach/workoutTool";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: getOpenAIApiKey() });
  }
  return client;
}

export async function embedText(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const res = await openai.embeddings.create({
    model: COACH_EMBEDDING_MODEL,
    input: text,
    dimensions: COACH_EMBEDDING_DIMENSIONS,
  });
  const v = res.data[0]?.embedding;
  if (!v || v.length !== COACH_EMBEDDING_DIMENSIONS) {
    throw new Error("Unexpected embedding shape from OpenAI");
  }
  return v;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const openai = getOpenAIClient();
  const res = await openai.embeddings.create({
    model: COACH_EMBEDDING_MODEL,
    input: texts,
    dimensions: COACH_EMBEDDING_DIMENSIONS,
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => {
      if (!d.embedding || d.embedding.length !== COACH_EMBEDDING_DIMENSIONS) {
        throw new Error("Unexpected embedding shape from OpenAI");
      }
      return d.embedding;
    });
}

export async function chatCompletionJson(messages: ChatCompletionMessageParam[]): Promise<string> {
  const openai = getOpenAIClient();
  const model = getOpenAIChatModel();
  const res = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.4,
  });
  const text = res.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Empty completion from OpenAI");
  }
  return text;
}

export async function chatCoachWithTools(
  messages: ChatCompletionMessageParam[],
  ctx: {
    trainingPlanId: string | null;
    athleteId: string;
    defaultBaseWeeks: number;
    defaultDistanceUnit: "mi" | "km";
  },
): Promise<{ reply: string; workoutsCreated: number; basePlansCreated: number }> {
  const openai = getOpenAIClient();
  const model = getOpenAIChatModel();
  const tools: ChatCompletionTool[] = [
    CREATE_PLANNED_WORKOUTS_TOOL,
    CREATE_BASE_BUILDING_PLAN_TOOL,
  ];
  const conv: ChatCompletionMessageParam[] = [...messages];
  let workoutsCreated = 0;
  let basePlansCreated = 0;

  for (let round = 0; round < 8; round++) {
    const res = await openai.chat.completions.create({
      model,
      messages: conv,
      tools,
      tool_choice: "auto",
      temperature: 0.35,
    });

    const msg = res.choices[0]?.message;
    if (!msg) {
      throw new Error("Empty completion from OpenAI");
    }

    if (msg.tool_calls?.length) {
      conv.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") {
          continue;
        }
        if (tc.function.name === "create_planned_workouts") {
          let args: unknown = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}") as unknown;
          } catch {
            args = {};
          }
          const result = await executeCreatePlannedWorkoutsTool(
            ctx.trainingPlanId,
            ctx.athleteId,
            args,
          );
          workoutsCreated += result.created;
          const toolMsg: ChatCompletionToolMessageParam = {
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
          conv.push(toolMsg);
        } else if (tc.function.name === "create_base_building_plan") {
          let args: unknown = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}") as unknown;
          } catch {
            args = {};
          }
          if (args && typeof args === "object") {
            const obj = args as Record<string, unknown>;
            if (typeof obj.weeks !== "number" || !Number.isFinite(obj.weeks)) {
              obj.weeks = ctx.defaultBaseWeeks;
            }
            if (typeof obj.distanceUnit !== "string") {
              obj.distanceUnit = ctx.defaultDistanceUnit;
            }
            args = obj;
          }
          const result = await executeCreateBaseBuildingPlanTool(
            ctx.athleteId,
            args,
          );
          if (result.ok) {
            basePlansCreated += 1;
          }
          workoutsCreated += result.createdWorkouts;
          const toolMsg: ChatCompletionToolMessageParam = {
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
          conv.push(toolMsg);
        }
      }
      continue;
    }

    const text = msg.content?.trim();
    if (!text) {
      throw new Error("Empty assistant reply");
    }
    return { reply: text, workoutsCreated, basePlansCreated };
  }

  throw new Error("Too many tool-calling rounds");
}
