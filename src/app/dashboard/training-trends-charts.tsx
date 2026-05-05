"use client";

import { useMemo } from "react";

import type {
  LongRunProgressionPoint,
  RollingRunTrend,
  WeeklyRunTrend,
} from "@/lib/dashboard";

type LinePoint = {
  label: string;
  value: number;
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
      {message}
    </div>
  );
}

function LineChart({
  title,
  color,
  yLabel,
  points,
}: {
  title: string;
  color: string;
  yLabel: string;
  points: LinePoint[];
}) {
  const dims = useMemo(() => {
    const W = 900;
    const H = 250;
    const top = 16;
    const bottom = 28;
    const left = 16;
    const right = 16;
    const innerW = W - left - right;
    const innerH = H - top - bottom;
    const maxValue = Math.max(1, ...points.map((p) => p.value));
    const x = (i: number) =>
      left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (value: number) => top + (1 - value / maxValue) * innerH;
    const line = points.map((p, i) => `${x(i)},${y(Math.max(0, p.value))}`).join(" ");
    const labelEvery = Math.max(1, Math.floor(points.length / 8));
    return { W, H, left, right, x, y, line, labelEvery, maxValue };
  }, [points]);

  if (!points.length) {
    return <EmptyChart message={`No ${title.toLowerCase()} data yet.`} />;
  }

  return (
    <div className="rounded-xl bg-zinc-50 p-4">
      <div className="mb-3 text-sm font-medium text-zinc-700">{title}</div>
      <div className="h-60 w-full">
        <svg viewBox={`0 0 ${dims.W} ${dims.H}`} className="h-full w-full">
          {[0.2, 0.4, 0.6, 0.8, 1].map((pct) => {
            const value = dims.maxValue * pct;
            return (
              <g key={pct}>
                <line
                  x1={dims.left}
                  x2={dims.W - dims.right}
                  y1={dims.y(value)}
                  y2={dims.y(value)}
                  stroke="#e4e4e7"
                  strokeWidth="1"
                />
                <text
                  x={dims.left + 2}
                  y={dims.y(value) - 3}
                  fontSize="10"
                  fill="#71717a"
                >
                  {value.toFixed(0)}
                </text>
              </g>
            );
          })}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            points={dims.line}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <g key={`${p.label}-${i}`}>
              <circle cx={dims.x(i)} cy={dims.y(p.value)} r={2.8} fill={color} />
              {i % dims.labelEvery === 0 || i === points.length - 1 ? (
                <text
                  x={dims.x(i)}
                  y={dims.H - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#71717a"
                >
                  {p.label}
                </text>
              ) : null}
            </g>
          ))}
          <text x={dims.left} y={12} fontSize="10" fill="#71717a">
            {yLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}

export function TrainingTrendsCharts({
  weeklyTrend,
  rolling28Trend,
  longRunProgression,
}: {
  weeklyTrend: WeeklyRunTrend[];
  rolling28Trend: RollingRunTrend[];
  longRunProgression: LongRunProgressionPoint[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LineChart
        title="Weekly mileage"
        color="#2563eb"
        yLabel="Miles"
        points={weeklyTrend.map((w) => ({ label: w.label, value: w.distanceMi }))}
      />
      <LineChart
        title="Rolling 28-day load"
        color="#7c3aed"
        yLabel="Load"
        points={rolling28Trend.map((r) => ({ label: r.label, value: r.trainingLoad }))}
      />
      <div className="md:col-span-2">
        <LineChart
          title="Long run progression"
          color="#ea580c"
          yLabel="Miles"
          points={longRunProgression.map((l) => ({ label: l.label, value: l.distanceMi }))}
        />
      </div>
    </div>
  );
}

