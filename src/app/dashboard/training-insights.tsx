import type { TrainingInsight } from "@/lib/trainingInsights";

function severityStyles(
  severity: TrainingInsight["severity"],
): { badge: string; card: string } {
  if (severity === "high") {
    return {
      badge: "bg-red-100 text-red-700 border-red-200",
      card: "border-red-200 bg-red-50/40",
    };
  }
  if (severity === "moderate") {
    return {
      badge: "bg-amber-100 text-amber-800 border-amber-200",
      card: "border-amber-200 bg-amber-50/40",
    };
  }
  return {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    card: "border-emerald-200 bg-emerald-50/40",
  };
}

export function TrainingInsights({ insights }: { insights: TrainingInsight[] }) {
  return (
    <div className="grid gap-3">
      {insights.map((insight, idx) => {
        const styles = severityStyles(insight.severity);
        return (
          <article
            key={`${insight.type}-${idx}`}
            className={`rounded-xl border p-4 shadow-sm ${styles.card}`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">{insight.title}</h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${styles.badge}`}
              >
                {insight.severity}
              </span>
            </div>
            <p className="text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Evidence:</span> {insight.evidence}
            </p>
            <p className="mt-1 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Recommendation:</span>{" "}
              {insight.recommendation}
            </p>
          </article>
        );
      })}
    </div>
  );
}

