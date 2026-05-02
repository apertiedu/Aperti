import { useMemo } from "react";

interface HeatmapDay {
  date: string;
  value: number; // 0=no data, 1=absent, 2=partial, 3=present
  present: number;
  absent: number;
}

interface AttendanceHeatmapProps {
  data: HeatmapDay[];
  weeks?: number;
}

const VALUE_COLORS = [
  "bg-muted/40 hover:bg-muted",           // 0 - no data
  "bg-red-300 hover:bg-red-400",           // 1 - absent
  "bg-amber-300 hover:bg-amber-400",       // 2 - partial
  "bg-emerald-400 hover:bg-emerald-500",   // 3 - present
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AttendanceHeatmap({ data, weeks = 26 }: AttendanceHeatmapProps) {
  const grid = useMemo(() => {
    const dataMap = new Map(data.map(d => [d.date, d]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Go back 'weeks' weeks from this Sunday
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (today.getDay()) - (weeks - 1) * 7);

    const columns: { month: string; monthStart: boolean; days: (HeatmapDay & { label: string } | null)[] }[] = [];
    let monthTrack = -1;

    for (let w = 0; w < weeks; w++) {
      const days: (HeatmapDay & { label: string } | null)[] = [];
      let showMonth = false;
      let monthLabel = "";

      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + w * 7 + d);
        if (date > today) { days.push(null); continue; }

        const dateStr = date.toISOString().split("T")[0];
        const entry = dataMap.get(dateStr);
        const month = date.getMonth();
        if (month !== monthTrack && d === 0) { showMonth = true; monthLabel = MONTH_NAMES[month]; monthTrack = month; }

        days.push({
          date: dateStr,
          value: entry?.value ?? 0,
          present: entry?.present ?? 0,
          absent: entry?.absent ?? 0,
          label: date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
        });
      }
      columns.push({ month: monthLabel, monthStart: showMonth, days });
    }
    return columns;
  }, [data, weeks]);

  const totalPresent = data.reduce((s, d) => s + d.present, 0);
  const totalAbsent = data.reduce((s, d) => s + d.absent, 0);
  const total = totalPresent + totalAbsent;
  const rate = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground text-sm">{rate}% attendance</span>
          <span>{totalPresent} present · {totalAbsent} absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {VALUE_COLORS.map((cls, i) => <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />)}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-[3px]" style={{ minWidth: "fit-content" }}>
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] pr-1">
            <div className="h-4" />
            {DAY_LABELS.map((d, i) => (
              <div key={d} className={`h-3 text-[9px] text-muted-foreground leading-3 ${i % 2 === 0 ? "" : "opacity-0"}`}>{d}</div>
            ))}
          </div>

          {grid.map((col, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              <div className="h-4 flex items-center">
                {col.monthStart && <span className="text-[9px] text-muted-foreground whitespace-nowrap">{col.month}</span>}
              </div>
              {col.days.map((day, di) => (
                day === null ? (
                  <div key={di} className="w-3 h-3 rounded-sm bg-transparent" />
                ) : (
                  <div
                    key={di}
                    className={`w-3 h-3 rounded-sm transition-colors cursor-default ${VALUE_COLORS[day.value]}`}
                    title={`${day.label}: ${day.value === 0 ? "No data" : day.value === 3 ? `${day.present} present` : day.value === 1 ? `${day.absent} absent` : `${day.present} present, ${day.absent} absent`}`}
                  />
                )
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
