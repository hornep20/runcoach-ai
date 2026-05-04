"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CalendarFilterOption } from "@/lib/calendar";

interface CalendarToolbarProps {
  filterOptions: CalendarFilterOption[];
}

export function CalendarToolbar({ filterOptions }: CalendarToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = searchParams.get("filter") ?? "all";
  const units = searchParams.get("units") === "mi" ? "mi" : "km";

  function navigateWith(next: URLSearchParams) {
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="calendar-filter" className="text-xs font-medium text-zinc-500">
          Workout type
        </label>
        <select
          id="calendar-filter"
          className="min-w-[200px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
          value={filterOptions.some((o) => o.value === filter) ? filter : "all"}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            const v = e.target.value;
            if (v === "all") {
              params.delete("filter");
            } else {
              params.set("filter", v);
            }
            navigateWith(params);
          }}
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="calendar-units" className="text-xs font-medium text-zinc-500">
          Distance
        </label>
        <select
          id="calendar-units"
          className="min-w-[140px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
          value={units}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            const v = e.target.value;
            if (v === "km") {
              params.delete("units");
            } else {
              params.set("units", v);
            }
            navigateWith(params);
          }}
        >
          <option value="km">Kilometers</option>
          <option value="mi">Miles</option>
        </select>
      </div>
    </div>
  );
}
