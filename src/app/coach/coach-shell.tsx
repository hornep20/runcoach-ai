"use client";

import { useCallback, useEffect, useState } from "react";

import { CoachChat } from "./coach-chat";

export interface TrainingPlanOption {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
}

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

export function CoachShell(props: {
  plans: TrainingPlanOption[];
  initialCoachingBrief: string;
  initialDefaultBaseWeeks: number;
  initialDefaultDistanceUnit: "mi" | "km";
  initialConversationId: string | null;
  initialTurns: CoachTurn[];
}) {
  const [trainingPlanId, setTrainingPlanId] = useState(
    () => props.plans[0]?.id ?? "",
  );
  const [coachingBrief, setCoachingBrief] = useState(props.initialCoachingBrief);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [defaultBaseWeeks, setDefaultBaseWeeks] = useState(
    props.initialDefaultBaseWeeks,
  );
  const [defaultDistanceUnit, setDefaultDistanceUnit] = useState<"mi" | "km">(
    props.initialDefaultDistanceUnit,
  );

  useEffect(() => {
    const t = setTimeout(() => {
      void fetch("/api/coach/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultBaseWeeks,
          defaultDistanceUnit,
        }),
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [defaultBaseWeeks, defaultDistanceUnit]);

  const onUpload = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }
    setUploadMsg(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/coach/documents", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        chunks?: number;
        filename?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setUploadMsg(
        `Indexed “${data.filename ?? file.name}” (${data.chunks ?? "?"} chunks). The coach can now quote it.`,
      );
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const onCreateDraftPlan = useCallback(async () => {
    setUploadMsg(null);
    setCreatingPlan(true);
    try {
      const res = await fetch("/api/training-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Coach Draft Plan",
          type: "MARATHON_16_WEEK",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      window.location.reload();
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "Could not create draft plan");
    } finally {
      setCreatingPlan(false);
    }
  }, []);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="coach-plan" className="text-xs font-medium text-zinc-500">
            Calendar target (planned workouts)
          </label>
          <select
            id="coach-plan"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
            value={trainingPlanId}
            onChange={(e) => setTrainingPlanId(e.target.value)}
          >
            {props.plans.length === 0 ? (
              <option value="">No training plans — create one in the database first</option>
            ) : (
              props.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type}) · {p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)}
                </option>
              ))
            )}
          </select>
          <p className="text-xs text-zinc-500">
            The coach can add future workouts to this plan when you ask. Pick the plan that should
            receive new rows (e.g. your marathon block).
          </p>
          {props.plans.length === 0 ? (
            <button
              type="button"
              disabled={creatingPlan}
              className="mt-1 w-fit rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              onClick={() => void onCreateDraftPlan()}
            >
              {creatingPlan ? "Creating..." : "Create draft plan for calendar"}
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="coach-pdf" className="text-xs font-medium text-zinc-500">
            Upload plan PDF (text extracted and embedded for RAG)
          </label>
          <input
            id="coach-pdf"
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            className="text-sm text-zinc-800 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-300"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void onUpload(f);
            }}
          />
          {uploadMsg ? (
            <p
              className={`text-xs ${uploadMsg.includes("Indexed") ? "text-emerald-700" : "text-red-600"}`}
            >
              {uploadMsg}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="coach-brief" className="text-xs font-medium text-zinc-500">
          Your plan strategy (saved when you send a chat message)
        </label>
        <textarea
          id="coach-brief"
          className="min-h-[100px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          placeholder='e.g. "16-week marathon plan X is my race goal. For the first 8–10 weeks I want to follow slower plan Y for aerobic base, then switch to plan X from week 9."'
          value={coachingBrief}
          onChange={(e) => setCoachingBrief(e.target.value)}
        />
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="coach-default-weeks" className="text-xs font-medium text-zinc-500">
            Base plan default length
          </label>
          <input
            id="coach-default-weeks"
            type="number"
            min={4}
            max={20}
            value={defaultBaseWeeks}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isFinite(n)) return;
              setDefaultBaseWeeks(Math.min(20, Math.max(4, n)));
            }}
            className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
          />
          <p className="text-xs text-zinc-500">
            Used when the chat creates a new base plan unless you explicitly request another duration.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="coach-default-units" className="text-xs font-medium text-zinc-500">
            Base plan default distance units
          </label>
          <select
            id="coach-default-units"
            value={defaultDistanceUnit}
            onChange={(e) => setDefaultDistanceUnit(e.target.value === "km" ? "km" : "mi")}
            className="w-40 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
          >
            <option value="mi">Miles</option>
            <option value="km">Kilometers</option>
          </select>
          <p className="text-xs text-zinc-500">
            Distances are converted to stored km under the hood.
          </p>
        </div>
      </div>

      <CoachChat
        trainingPlanId={trainingPlanId}
        coachingBrief={coachingBrief}
        defaultBaseWeeks={defaultBaseWeeks}
        defaultDistanceUnit={defaultDistanceUnit}
        initialConversationId={props.initialConversationId}
        initialTurns={props.initialTurns}
      />
    </div>
  );
}
