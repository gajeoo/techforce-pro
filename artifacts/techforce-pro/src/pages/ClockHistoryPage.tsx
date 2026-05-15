import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeHoursWorked,
  getMyClockHistory,
  groupByDate,
  seedClockHistoryIfNeeded,
  type ClockEntry,
} from "@/lib/clockHistory";

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDuration(ms: number) {
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function pairDuration(entries: ClockEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let lastIn: ClockEntry | null = null;
  let totalMs = 0;
  for (const e of sorted) {
    if (e.type === "in")  { lastIn = e; }
    else if (e.type === "out" && lastIn) {
      totalMs += new Date(e.timestamp).getTime() - new Date(lastIn.timestamp).getTime();
      lastIn = null;
    }
  }
  if (lastIn) totalMs += Date.now() - new Date(lastIn.timestamp).getTime();
  return fmtDuration(totalMs);
}

function isoDateRange(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─── Weekly grouping ───────────────────────────────────────────────────────

function getMondayKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const daysToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + daysToMon);
  return monday.toISOString().slice(0, 10);
}

function getWeekLabel(mondayKey: string): string {
  const monday = new Date(mondayKey + "T00:00:00");
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const year = monday.getFullYear();
  const nowYear = new Date().getFullYear();
  return year === nowYear
    ? `${fmt(monday)} – ${fmt(sunday)}`
    : `${fmt(monday)} – ${fmt(sunday)}, ${year}`;
}

// ─── Component ────────────────────────────────────────────────────────────

export function ClockHistoryPage() {
  const { user } = useAuth();
  const userId   = user?.id ?? "";
  const userName = user?.name ?? "User";

  const [history, setHistory] = useState<ClockEntry[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("all");

  useEffect(() => {
    seedClockHistoryIfNeeded();
    setHistory(getMyClockHistory(userId));
  }, [userId]);

  // ── Stats ──────────────────────────────────────────────────────────────
  const thisWeekCutoff  = isoDateRange(7);
  const thisMonthCutoff = isoDateRange(30);

  const thisWeek  = history.filter(e => e.timestamp.slice(0, 10) >= thisWeekCutoff);
  const thisMonth = history.filter(e => e.timestamp.slice(0, 10) >= thisMonthCutoff);

  const weekHours  = computeHoursWorked(thisWeek);
  const monthHours = computeHoursWorked(thisMonth);
  const weekDays   = new Set(thisWeek.map(e => e.timestamp.slice(0, 10))).size;
  const monthDays  = new Set(thisMonth.map(e => e.timestamp.slice(0, 10))).size;

  // ── Build week list ────────────────────────────────────────────────────
  const allWeekKeys = [...new Set(history.map(e => getMondayKey(e.timestamp.slice(0, 10))))].sort((a, b) => b.localeCompare(a));

  // ── Filter by selected week ────────────────────────────────────────────
  const filteredHistory = selectedWeek === "all"
    ? history
    : history.filter(e => getMondayKey(e.timestamp.slice(0, 10)) === selectedWeek);

  const grouped = groupByDate(filteredHistory);

  // Current clock state
  const todayKey    = new Date().toISOString().slice(0, 10);
  const todayEntries = history.filter(e => e.timestamp.slice(0, 10) === todayKey);
  const isClockedIn  = todayEntries.length > 0 && todayEntries[todayEntries.length - 1].type === "in";

  // Hours for selected week filter
  const filteredHours = computeHoursWorked(filteredHistory);
  const filteredDays  = new Set(filteredHistory.map(e => e.timestamp.slice(0, 10))).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="size-6 text-primary shrink-0" /> Clock History
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {userName} — your personal clock-in/out record
          </p>
        </div>
        <Badge
          variant="outline"
          className={`self-start sm:self-auto gap-1.5 px-3 py-1.5 text-xs font-semibold ${
            isClockedIn
              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20"
              : "border-gray-300 bg-muted text-muted-foreground"
          }`}
        >
          <div className={`size-2 rounded-full ${isClockedIn ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
          {isClockedIn ? "Currently Clocked In" : "Currently Clocked Out"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">This Week</div>
            <div className="text-2xl font-extrabold">{weekHours.toFixed(1)}<span className="text-sm font-normal ml-1">hrs</span></div>
            <div className="text-[10px] text-muted-foreground">{weekDays} day{weekDays !== 1 ? "s" : ""} worked</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">This Month</div>
            <div className="text-2xl font-extrabold">{monthHours.toFixed(1)}<span className="text-sm font-normal ml-1">hrs</span></div>
            <div className="text-[10px] text-muted-foreground">{monthDays} day{monthDays !== 1 ? "s" : ""} worked</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Avg / Day</div>
            <div className="text-2xl font-extrabold">
              {weekDays > 0 ? (weekHours / weekDays).toFixed(1) : "—"}
              {weekDays > 0 && <span className="text-sm font-normal ml-1">hrs</span>}
            </div>
            <div className="text-[10px] text-muted-foreground">last 7 days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Total Entries</div>
            <div className="text-2xl font-extrabold">{history.length}</div>
            <div className="text-[10px] text-muted-foreground">all time records</div>
          </CardContent>
        </Card>
      </div>

      {/* Week Filter */}
      {allWeekKeys.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold shrink-0">
            <CalendarDays className="size-4 text-primary" />
            <span>Filter by Week</span>
          </div>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-full sm:w-64 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="font-medium">All Weeks</span>
                <span className="ml-2 text-muted-foreground text-xs">({history.length} entries)</span>
              </SelectItem>
              {allWeekKeys.map(key => {
                const weekEntries = history.filter(e => getMondayKey(e.timestamp.slice(0, 10)) === key);
                const hrs = computeHoursWorked(weekEntries).toFixed(1);
                const isCurrentWeek = key === getMondayKey(todayKey);
                return (
                  <SelectItem key={key} value={key}>
                    <span className="font-medium">{getWeekLabel(key)}</span>
                    {isCurrentWeek && <span className="ml-1 text-primary text-[10px]">Current</span>}
                    <span className="ml-2 text-muted-foreground text-xs">{hrs} hrs</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {selectedWeek !== "all" && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-1.5 shrink-0">
              <Timer className="size-3.5 text-primary" />
              <span>
                <strong className="text-foreground">{filteredHours.toFixed(1)} hrs</strong> across{" "}
                <strong className="text-foreground">{filteredDays}</strong> day{filteredDays !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* History list */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Clock className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {selectedWeek === "all" ? "No clock history on record yet." : "No entries for this week."}
            </p>
            {selectedWeek === "all" && (
              <p className="text-xs text-muted-foreground mt-1">Clock in from the My Work page to start tracking.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <Card key={group.dateKey}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-primary" />
                    <CardTitle className="text-sm">{group.dateLabel}</CardTitle>
                    {group.dateKey === todayKey && (
                      <Badge className="text-[9px] h-4 px-1 bg-primary">Today</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Timer className="size-3.5" />
                    <span className="font-semibold">{pairDuration(group.entries)}</span>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {group.entries.filter(e => e.type === "in").length} clock-in · {group.entries.filter(e => e.type === "out").length} clock-out
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {group.entries.map(e => (
                    <div key={e.id} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
                      <div className={`size-7 rounded-full flex items-center justify-center shrink-0 ${
                        e.type === "in"
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : "bg-red-100 dark:bg-red-900/30"
                      }`}>
                        {e.type === "in"
                          ? <LogIn  className="size-3.5 text-emerald-700 dark:text-emerald-400" />
                          : <LogOut className="size-3.5 text-red-700 dark:text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${e.type === "in" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                            {e.type === "in" ? "Clocked In" : "Clocked Out"}
                          </span>
                          <span className="text-xs text-muted-foreground">{fmtTime(e.timestamp)}</span>
                        </div>
                        {e.location && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="size-2.5 shrink-0" />
                            <span className="truncate">{e.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
