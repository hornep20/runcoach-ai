"use client";

import { useMemo, useState } from "react";

type TrendPoint = {
  date: string;
  label: string;
  fatigueScore: number;
  readinessScore: number;
};

type DayRunStat = {
  runCount: number;
  distanceMi: number;
  movingMinutes: number;
  trainingLoad: number;
};

function LineScoreChart({
  title,
  color,
  data,
  scoreKey,
  runStatsByDate,
}: {
  title: string;
  color: string;
  data: TrendPoint[];
  scoreKey: "fatigueScore" | "readinessScore";
  runStatsByDate: Record<string, DayRunStat>;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const dims = useMemo(() => {
    const W = 900;
    const H = 250;
    const top = 16;
    const bottom = 28;
    const left = 16;
    const right = 16;
    const innerW = W - left - right;
    const innerH = H - top - bottom;
    const x = (i: number) =>
      left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (score: number) => top + ((10 - score) / 10) * innerH;
    const line = data
      .map((d, i) => `${x(i)},${y(Math.max(0, Math.min(10, d[scoreKey])))}`)
      .join(" ");
    const labelEvery = Math.max(1, Math.floor(data.length / 8));
    return { W, H, top, bottom, left, right, innerW, innerH, x, y, line, labelEvery };
  }, [data, scoreKey]);

  if (!data.length) return null;

  const hovered = hoveredIndex == null ? null : data[hoveredIndex];
  const hoveredStats = hovered ? runStatsByDate[hovered.date] : null;
  const hoverLeftPct =
    hoveredIndex == null ? 0 : (dims.x(hoveredIndex) / dims.W) * 100;

  return (
    <div className="rounded-xl bg-zinc-50 p-4">
      <div className="mb-3 text-sm font-medium text-zinc-700">{title}</div>
      <div className="relative h-60 w-full">
        <svg viewBox={`0 0 ${dims.W} ${dims.H}`} className="h-full w-full">
          {[2, 4, 6, 8, 10].map((t) => (
            <line
              key={t}
              x1={dims.left}
              x2={dims.W - dims.right}
              y1={dims.y(t)}
              y2={dims.y(t)}
              stroke="#e4e4e7"
              strokeWidth="1"
            />
          ))}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            points={dims.line}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {data.map((d, i) => (
            <g key={`${d.date}-${scoreKey}`}>
              <circle
                cx={dims.x(i)}
                cy={dims.y(d[scoreKey])}
                r={hoveredIndex === i ? 4.5 : 2.8}
                fill={color}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex((cur) => (cur === i ? null : cur))}
              />
              {i % dims.labelEvery === 0 || i === data.length - 1 ? (
                <text
                  x={dims.x(i)}
                  y={dims.H - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#71717a"
                >
                  {d.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 -translate-x-1/2 rounded-md border border-zinc-300 bg-white p-2 text-xs text-zinc-700 shadow-md"
            style={{ left: `${Math.max(8, Math.min(92, hoverLeftPct))}%` }}
          >
            <p className="font-semibold text-zinc-900">
              {hovered.label} ({hovered.date})
            </p>
            <p>
              {scoreKey === "fatigueScore" ? "Fatigue" : "Readiness"}:{" "}
              {hovered[scoreKey].toFixed(1)} / 10
            </p>
            <p>Runs: {hoveredStats?.runCount ?? 0}</p>
            <p>Distance: {(hoveredStats?.distanceMi ?? 0).toFixed(1)} mi</p>
            <p>Moving time: {hoveredStats?.movingMinutes ?? 0} min</p>
            <p>Training load: {(hoveredStats?.trainingLoad ?? 0).toFixed(1)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TrainingStatusTrendCharts({
  data,
  runStatsByDate,
}: {
  data: TrendPoint[];
  runStatsByDate: Record<string, DayRunStat>;
}) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
        No historical fatigue data yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Fatigue
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Readiness
        </span>
        <span className="inline-flex items-center gap-2 text-zinc-500">
          Hover points for that day&apos;s run stats
        </span>
      </div>
      <LineScoreChart
        title="Fatigue trend"
        color="#ef4444"
        data={data}
        scoreKey="fatigueScore"
        runStatsByDate={runStatsByDate}
      />
      <LineScoreChart
        title="Readiness trend"
        color="#10b981"
        data={data}
        scoreKey="readinessScore"
        runStatsByDate={runStatsByDate}
      />
    </div>
  );
}

