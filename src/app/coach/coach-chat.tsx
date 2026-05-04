"use client";

import { useCallback, useState } from "react";

type ChatTurn = { role: "user" | "assistant"; content: string };
const MAX_MESSAGES = 24;

export function CoachChat(props: {
  trainingPlanId: string;
  coachingBrief: string;
  defaultBaseWeeks: number;
  defaultDistanceUnit: "mi" | "km";
  initialConversationId: string | null;
  initialTurns: ChatTurn[];
}) {
  const {
    trainingPlanId,
    coachingBrief,
    defaultBaseWeeks,
    defaultDistanceUnit,
    initialConversationId,
    initialTurns,
  } = props;
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) {
      return;
    }
    setError(null);
    setLoading(true);
    setInput("");
    const nextHistory: ChatTurn[] = [...turns, { role: "user", content: text }];
    const requestHistory = nextHistory.slice(-MAX_MESSAGES);
    setTurns(nextHistory);

    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestHistory,
          trainingPlanId: trainingPlanId.trim() || undefined,
          coachingBrief,
          defaultBaseWeeks,
          defaultDistanceUnit,
          conversationId: conversationId ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        workoutsCreated?: number;
        basePlansCreated?: number;
        conversationId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (!data.reply) {
        throw new Error("Empty reply");
      }
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
      let reply = data.reply;
      if (data.workoutsCreated && data.workoutsCreated > 0) {
        reply += `\n\n_(Added ${data.workoutsCreated} planned workout(s) to your selected training plan.)_`;
      }
      if (data.basePlansCreated && data.basePlansCreated > 0) {
        reply += `\n\n_(Created ${data.basePlansCreated} base-building plan. Open the Base Plan page to review.)_`;
      }
      setTurns((h) => [...h, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setError(msg);
      setTurns((h) => h.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [
    input,
    loading,
    turns,
    trainingPlanId,
    coachingBrief,
    defaultBaseWeeks,
    defaultDistanceUnit,
    conversationId,
  ]);

  return (
    <div className="space-y-4">
      <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        {turns.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Ask how to blend plans, adjust paces from your stats, or request next week&apos;s
            workouts on the calendar. Upload a PDF above so answers can reference it.
          </p>
        ) : (
          turns.map((t, i) => (
            <div
              key={`${i}-${t.role}`}
              className={
                t.role === "user"
                  ? "ml-8 rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
                  : "mr-8 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
              }
            >
              <p className="text-xs font-medium uppercase text-zinc-400">
                {t.role === "user" ? "You" : "Coach"}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{t.content}</p>
            </div>
          ))
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {conversationId ? "Conversation is saved automatically." : "New conversation will be saved on first message."}
        </p>
        <button
          type="button"
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          disabled={loading}
          onClick={() => {
            setConversationId(null);
            setTurns([]);
            setError(null);
            setInput("");
          }}
        >
          New chat
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <textarea
          className="min-h-[88px] flex-1 resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          placeholder="e.g. Draft the next 7 days of easy runs using my base plan, then add them to the calendar."
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || !input.trim()}
          onClick={() => void send()}
        >
          {loading ? "Thinking…" : "Send"}
        </button>
      </div>
    </div>
  );
}
