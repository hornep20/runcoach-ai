import { Suspense } from "react";
import Link from "next/link";

import { getCalendarFilterOptions, getCalendarItems } from "@/lib/calendar";
import type { CalendarItem } from "@/lib/calendar";
import type { DistanceUnits } from "@/lib/distance";
import { formatDistanceKm, parseDistanceUnits } from "@/lib/distance";

import { CalendarToolbar } from "./calendar-toolbar";

function calendarDetailHref(
  item: CalendarItem,
  filter: string,
  units: DistanceUnits,
): string {
  const q = new URLSearchParams();
  if (filter !== "all") {
    q.set("filter", filter);
  }
  if (units === "mi") {
    q.set("units", "mi");
  }
  const qs = q.toString();
  const suffix = qs ? `?${qs}` : "";

  if (item.kind === "imported") {
    const rawId = item.id.replace(/^imported:/, "");
    return `/calendar/activity/${encodeURIComponent(rawId)}${suffix}`;
  }

  const rawId = item.id.replace(/^planned:/, "");
  return `/calendar/workout/${encodeURIComponent(rawId)}${suffix}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; units?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.filter?.trim() || "all";
  const units = parseDistanceUnits(sp.units);

  const [items, filterOptions] = await Promise.all([
    getCalendarItems(80, { filterKey: filter }),
    getCalendarFilterOptions(),
  ]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Training Calendar</h1>
        <p className="mt-2 text-zinc-600">
          Planned workouts and activities imported from Intervals.icu (COROS and other sources
          synced there). Click any row for full stats (imported runs) or plan details (planned
          workouts). Run a sync from{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">POST /api/sync/intervals</code>{" "}
          with header <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">X-Sync-Secret</code>.
        </p>
        <div className="mt-4">
          <Suspense fallback={<div className="h-14 animate-pulse rounded-lg bg-zinc-100" />}>
            <CalendarToolbar filterOptions={filterOptions} />
          </Suspense>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-600">
            {filter === "all"
              ? "No items yet. Create an Athlete, connect Intervals.icu in `.env`, and trigger sync."
              : "No items match this filter. Try “All types” or another workout type."}
          </p>
        ) : (
          <ul className="list-none space-y-3 p-0">
            {items.map((item) => {
              const dist = formatDistanceKm(item.distanceKm, units);
              const href = calendarDetailHref(item, filter, units);
              return (
                <li key={item.id}>
                  <Link
                    href={href}
                    aria-label={`Open details: ${item.title}, ${item.date}`}
                    className="block rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm transition-colors hover:border-zinc-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                  >
                    <p className="font-medium text-zinc-900">
                      {item.date} — {item.title}
                      <span className="ml-2 font-normal text-zinc-500">
                        {item.kind === "imported" ? "(imported)" : "(planned)"}
                      </span>
                    </p>
                    <p className="text-zinc-600">
                      {item.subtitle}
                      {dist ? ` | ${dist}` : ""}
                      {item.durationMin != null ? ` | ${item.durationMin} min` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
