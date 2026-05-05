"use client";

import { useCallback, useEffect, useState } from "react";

import { CoachChat } from "./coach-chat";

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

export function CoachShell(props: {
  initialCoachingBrief: string;
  initialDefaultBaseWeeks: number;
  initialDefaultDistanceUnit: "mi" | "km";
  initialConversationId: string | null;
  initialTurns: CoachTurn[];
}) {
  const [coachingBrief, setCoachingBrief] = useState(props.initialCoachingBrief);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
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
        coachingBrief={coachingBrief}
        defaultBaseWeeks={defaultBaseWeeks}
        defaultDistanceUnit={defaultDistanceUnit}
        initialConversationId={props.initialConversationId}
        initialTurns={props.initialTurns}
      />
    </div>
  );
}
