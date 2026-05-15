// ─── Clock history types & localStorage helpers ───────────────────────────

export interface ClockEntry {
  id: string;
  empId: string;
  empName: string;
  type: "in" | "out";
  timestamp: string;   // ISO string
  location?: string;
}

const CLOCK_KEY   = "tfpro_clock_history";
const SEEDED_KEY  = "tfpro_clock_seeded";

// ─── Seed data: 10 workdays for each employee ─────────────────────────────

function generateSeed(): ClockEntry[] {
  const empData = [
    { id: "1", name: "Sarah Johnson" },
    { id: "2", name: "Derek Williams" },
    { id: "3", name: "Marcus Taylor" },
    { id: "4", name: "James Rodriguez" },
    { id: "5", name: "Kevin Park" },
    { id: "6", name: "Angela Davis" },
  ];

  const locations = [
    "39.2156° N, 76.8585° W — Shop, Columbia MD",
    "39.1988° N, 76.7412° W — Field, Ellicott City MD",
    "39.2904° N, 76.6122° W — Field, Baltimore MD",
  ];

  // Work backward from May 7 2026, collect 10 weekdays
  const workDays: Date[] = [];
  const ref = new Date("2026-05-07");
  let d = new Date(ref);
  while (workDays.length < 10) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) workDays.push(new Date(d));
    d.setDate(d.getDate() - 1);
  }

  const entries: ClockEntry[] = [];
  let seed = 0;

  for (const emp of empData) {
    for (const day of workDays) {
      const inH  = 7;
      const inM  = 15 + (seed % 4) * 8;     // 15, 23, 31, 39, cycling
      const outH = 16 + (seed % 2);          // 16 or 17
      const outM = (seed * 11) % 60;

      const inTs  = new Date(day); inTs.setHours(inH, inM, 0, 0);
      const outTs = new Date(day); outTs.setHours(outH, outM, 0, 0);
      const loc   = locations[seed % locations.length];

      entries.push({ id: `CE-${emp.id}-${day.toISOString().slice(0, 10)}-in`,  empId: emp.id, empName: emp.name, type: "in",  timestamp: inTs.toISOString(),  location: loc });
      entries.push({ id: `CE-${emp.id}-${day.toISOString().slice(0, 10)}-out`, empId: emp.id, empName: emp.name, type: "out", timestamp: outTs.toISOString(), location: loc });
      seed++;
    }
  }

  return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function seedClockHistoryIfNeeded(): void {
  if (localStorage.getItem(SEEDED_KEY)) return;
  localStorage.setItem(CLOCK_KEY, JSON.stringify(generateSeed()));
  localStorage.setItem(SEEDED_KEY, "1");
}

export function loadClockHistory(): ClockEntry[] {
  try {
    const raw = localStorage.getItem(CLOCK_KEY);
    return raw ? (JSON.parse(raw) as ClockEntry[]) : [];
  } catch { return []; }
}

function saveClockHistory(entries: ClockEntry[]): void {
  localStorage.setItem(CLOCK_KEY, JSON.stringify(entries));
}

export function addClockEntry(entry: Omit<ClockEntry, "id" | "timestamp"> & { timestamp?: string }): ClockEntry {
  const all = loadClockHistory();
  const newEntry: ClockEntry = {
    ...entry,
    id: `CE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };
  all.push(newEntry);
  saveClockHistory(all);
  return newEntry;
}

export function getMyClockHistory(empId: string): ClockEntry[] {
  return loadClockHistory()
    .filter(e => e.empId === empId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getLastClockEntry(empId: string): ClockEntry | null {
  const mine = getMyClockHistory(empId);
  return mine.length > 0 ? mine[0] : null;
}

// Compute total hours worked from paired in/out entries
export function computeHoursWorked(entries: ClockEntry[]): number {
  let total = 0;
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let lastIn: ClockEntry | null = null;
  for (const e of sorted) {
    if (e.type === "in") { lastIn = e; }
    else if (e.type === "out" && lastIn) {
      total += (new Date(e.timestamp).getTime() - new Date(lastIn.timestamp).getTime()) / 3600000;
      lastIn = null;
    }
  }
  return total;
}

// Group entries by date label  e.g. "Mon, May 5, 2026"
export function groupByDate(entries: ClockEntry[]): { dateLabel: string; dateKey: string; entries: ClockEntry[] }[] {
  const map = new Map<string, ClockEntry[]>();
  for (const e of entries) {
    const key = e.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => ({
      dateKey: key,
      dateLabel: new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
      entries: list.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }));
}
