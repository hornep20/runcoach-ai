"use client";

import type { RecentRunSummary } from "@/lib/dashboard";

export function RecentRuns({ runs }: { runs: RecentRunSummary[] }) {
  if (!runs.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
        No recent runs yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Distance</th>
            <th className="px-3 py-2">Pace</th>
            <th className="px-3 py-2">HR</th>
            <th className="px-3 py-2">Load</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, idx) => (
            <tr key={`${run.date}-${run.title}-${idx}`} className="border-b border-zinc-200 last:border-b-0">
              <td className="px-3 py-2 text-zinc-700">{run.date}</td>
              <td className="px-3 py-2 text-zinc-900">{run.title || "Run"}</td>
              <td className="px-3 py-2 text-zinc-700">{run.distanceMi.toFixed(1)} mi</td>
              <td className="px-3 py-2 text-zinc-700">{run.paceLabel}</td>
              <td className="px-3 py-2 text-zinc-700">{run.avgHr}</td>
              <td className="px-3 py-2 text-zinc-700">{run.trainingLoad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

