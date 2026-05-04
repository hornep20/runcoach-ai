import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { prisma } from "@/lib/prisma";

import { CoachShell, type CoachTurn, type TrainingPlanOption } from "./coach-shell";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const athleteId = await resolveAthleteIdForRead();

  let plans: TrainingPlanOption[] = [];
  let initialCoachingBrief = "";
  let initialConversationId: string | null = null;
  let initialTurns: CoachTurn[] = [];
  let initialDefaultBaseWeeks = 8;
  let initialDefaultDistanceUnit: "mi" | "km" = "mi";

  if (athleteId) {
    const [planRows, athlete, latestConversation] = await Promise.all([
      prisma.trainingPlan.findMany({
        where: { athleteId },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          startDate: true,
          endDate: true,
        },
      }),
      prisma.athlete.findUnique({
        where: { id: athleteId },
        select: {
          coachingBrief: true,
          defaultBaseWeeks: true,
          defaultDistanceUnit: true,
        },
      }),
      prisma.coachConversation.findFirst({
        where: { athleteId },
        orderBy: { updatedAt: "desc" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: { role: true, content: true },
          },
        },
      }),
    ]);

    plans = planRows.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
    }));
    initialCoachingBrief = athlete?.coachingBrief ?? "";
    initialDefaultBaseWeeks = athlete?.defaultBaseWeeks ?? 8;
    initialDefaultDistanceUnit =
      athlete?.defaultDistanceUnit === "km" ? "km" : "mi";
    if (latestConversation) {
      initialConversationId = latestConversation.id;
      initialTurns = latestConversation.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">AI Coach</h1>
      <p className="mt-2 text-zinc-600">
        Retrieval-augmented answers from <code className="rounded bg-zinc-100 px-1 text-xs">docs/</code>{" "}
        markdown, <strong>PDFs you upload here</strong>, and your latest imported runs. The snapshot
        includes <strong>last 28 days stats</strong> and <strong>upcoming planned workouts</strong> for
        the plan you select. Ask for suggestions, then request additions to the calendar — the coach
        can create planned workouts on the selected plan when you confirm.
      </p>
      <CoachShell
        plans={plans}
        initialCoachingBrief={initialCoachingBrief}
        initialDefaultBaseWeeks={initialDefaultBaseWeeks}
        initialDefaultDistanceUnit={initialDefaultDistanceUnit}
        initialConversationId={initialConversationId}
        initialTurns={initialTurns}
      />
    </section>
  );
}
