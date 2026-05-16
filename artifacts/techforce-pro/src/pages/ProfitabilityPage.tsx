import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  TrendingUp, AlertTriangle, DollarSign, Users, Wrench,
  ChevronDown, BarChart2, Target, Flame, ChevronLeft, ChevronRight,
  Info, Download, CheckCircle2, RotateCcw, Pencil,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { formatCurrency, cn, initials } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "daily" | "weekly" | "monthly" | "annual";
type DayType = "billable" | "shopDay" | "training" | "callOut" | "offDay";

type BurdenParams = {
  burdenPct: number;
  fuelPerDay: number;
  toolsPerDay: number;
  overheadMonthly: number;
};

type PopupState = {
  empId: string;
  emp: any;
  dateStr: string;
  currentType: DayType;
  jobs: any[];
  dayCost: number;
  dayRev: number;
  x: number;
  y: number;
} | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PARAMS: BurdenParams = {
  burdenPct: 30,
  fuelPerDay: 45,
  toolsPerDay: 15,
  overheadMonthly: 8500,
};

const SHOP_DAY_COST = 275;

const DAY_TYPE_OPTIONS: { value: DayType; label: string; textCls: string; bgCls: string }[] = [
  { value: "billable", label: "Billable",  textCls: "text-gray-900",   bgCls: "bg-white" },
  { value: "shopDay",  label: "Shop Day",  textCls: "text-amber-700",  bgCls: "bg-amber-50" },
  { value: "training", label: "Training",  textCls: "text-yellow-700", bgCls: "bg-yellow-50" },
  { value: "callOut",  label: "Call Out",  textCls: "text-purple-700", bgCls: "bg-purple-50" },
  { value: "offDay",   label: "Off Day",   textCls: "text-gray-500",   bgCls: "bg-gray-50" },
];

const SERVICE_COLORS: Record<string, string> = {
  suppression: "#ef4444", sprinkler: "#3b82f6", extinguisher: "#f59e0b",
  alarm: "#8b5cf6", emergency: "#ec4899", standpipe: "#14b8a6", other: "#6b7280",
};

const DAY_NAMES  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(d.getDate() + n); return r;
}
function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }

function fmtCompact(n: number) {
  const abs = Math.abs(n);
  const fmt = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1_000 ? `$${(abs / 1_000).toFixed(1)}k`
    : `$${Math.round(abs)}`;
  return n < 0 ? `-${fmt}` : fmt;
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ParamInput({ label, value, onChange, prefix = "", suffix = "" }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
      <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
        {prefix && <span className="px-2 text-sm text-gray-500 border-r bg-gray-50">{prefix}</span>}
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
          className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0" />
        {suffix && <span className="px-2 text-sm text-gray-500 border-l bg-gray-50">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProfitabilityPage() {
  // ── Persisted state from localStorage ────────────────────────────────────
  const [period, setPeriodRaw] = useState<Period>(() => {
    try { return (localStorage.getItem("pl-period") as Period) ?? "weekly"; } catch { return "weekly"; }
  });
  const [weekStart, setWeekStartRaw] = useState<Date>(() => {
    try {
      const s = localStorage.getItem("pl-week-start");
      return s ? new Date(s) : getMonday(new Date());
    } catch { return getMonday(new Date()); }
  });
  const [dayOverrides, setDayOverridesRaw] = useState<Record<string, DayType>>(() => {
    try {
      const s = localStorage.getItem("pl-day-overrides");
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  });

  function setPeriod(p: Period) {
    setPeriodRaw(p);
    try { localStorage.setItem("pl-period", p); } catch {}
  }
  function setWeekStart(d: Date | ((prev: Date) => Date)) {
    setWeekStartRaw(prev => {
      const next = typeof d === "function" ? d(prev) : d;
      try { localStorage.setItem("pl-week-start", next.toISOString()); } catch {}
      return next;
    });
  }
  function setDayOverrides(fn: (prev: Record<string, DayType>) => Record<string, DayType>) {
    setDayOverridesRaw(prev => {
      const next = fn(prev);
      try { localStorage.setItem("pl-day-overrides", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // ── Convex queries ────────────────────────────────────────────────────────
  const roi       = (useQuery(api.dashboard.employeeROI)      ?? []) as any[];
  const leaks     = (useQuery(api.dashboard.profitLeaks)      ?? []) as any[];
  const byService = (useQuery(api.dashboard.revenueByService) ?? []) as any[];
  const summary   = useQuery(api.dashboard.summary);
  const employees = (useQuery(api.employees.list)             ?? []) as any[];
  const allJobs   = (useQuery(api.jobs.list, {})              ?? []) as any[];

  // ── UI state ──────────────────────────────────────────────────────────────
  const [params, setParams]           = useState<BurdenParams>(DEFAULT_PARAMS);
  const [showParams, setShowParams]   = useState(false);
  const [showCalcInfo, setShowCalcInfo] = useState(false);
  const [shopDaysMode, setShopDaysMode] = useState<"basic" | "weekly" | "monthly" | "yearly">("basic");
  const [popup, setPopup]             = useState<PopupState>(null);
  // ── Revenue overrides (user-edited figures, persisted) ────────────────────
  const [revOverrides, setRevOverridesRaw] = useState<Record<string, number>>(() => {
    try {
      const s = localStorage.getItem("pl-rev-overrides");
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  });
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingVal,  setEditingVal]  = useState<string>("");

  const paramsRef = useRef<HTMLDivElement>(null);
  const popupRef  = useRef<HTMLDivElement>(null);

  // Close burden params on outside click
  useEffect(() => {
    if (!showParams) return;
    const h = (e: MouseEvent) => {
      if (paramsRef.current && !paramsRef.current.contains(e.target as Node)) setShowParams(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showParams]);

  // Close day-type popup on outside click
  useEffect(() => {
    if (!popup) return;
    const h = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [popup]);

  // ── Cost helpers ──────────────────────────────────────────────────────────
  function empDailyCostRaw(emp: any): number {
    const salary = emp.salary ?? 0;
    const laborPerDay  = salary / 260;
    const burdenPerDay = laborPerDay * (params.burdenPct / 100);
    return laborPerDay + burdenPerDay + params.fuelPerDay + params.toolsPerDay;
  }

  function empDailyCost(emp: any, dayType: DayType): number {
    if (dayType === "offDay" || dayType === "callOut") return 0;
    if (dayType === "shopDay") return SHOP_DAY_COST;
    return empDailyCostRaw(emp); // billable or training
  }

  // ── Day type helpers ──────────────────────────────────────────────────────
  function getDayType(empId: string, dateStr: string): DayType {
    const override = dayOverrides[`${empId}:${dateStr}`];
    if (override) return override;
    const dow = new Date(dateStr + "T00:00:00").getDay();
    return (dow === 0 || dow === 6) ? "offDay" : "billable";
    // NOTE: Fridays (dow=5) default to "billable", NOT shop day
  }

  function setDayType(empId: string, dateStr: string, dt: DayType) {
    setDayOverrides(prev => ({ ...prev, [`${empId}:${dateStr}`]: dt }));
  }

  // ── Date navigation ───────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);

  function handleSetPeriod(p: Period) {
    setPeriod(p);
    if (p === "daily")   setWeekStart(new Date(today));
    else if (p === "weekly")  setWeekStart(getMonday(weekStart));
    else if (p === "monthly") setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
    else                      setWeekStart(new Date(weekStart.getFullYear(), 0, 1));
  }

  function navPrev() {
    setWeekStart(d => {
      if (period === "daily")   return addDays(d, -1);
      if (period === "weekly")  return addDays(d, -7);
      if (period === "monthly") return new Date(d.getFullYear(), d.getMonth() - 1, 1);
      return new Date(d.getFullYear() - 1, 0, 1);
    });
  }
  function navNext() {
    setWeekStart(d => {
      if (period === "daily")   return addDays(d, 1);
      if (period === "weekly")  return addDays(d, 7);
      if (period === "monthly") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return new Date(d.getFullYear() + 1, 0, 1);
    });
  }
  function goToday() {
    if (period === "daily")   setWeekStart(new Date(today));
    else if (period === "weekly")  setWeekStart(getMonday(new Date()));
    else if (period === "monthly") setWeekStart(new Date(today.getFullYear(), today.getMonth(), 1));
    else                           setWeekStart(new Date(today.getFullYear(), 0, 1));
  }

  // ── Columns & period helpers ──────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const columns: Date[] = (() => {
    if (period === "daily")  return [new Date(weekStart)];
    if (period === "weekly") return weekDays;
    if (period === "monthly") {
      const yr = weekStart.getFullYear(), mo = weekStart.getMonth();
      const first = new Date(yr, mo, 1);
      const mon = getMonday(first);
      const weeks: Date[] = [];
      let cur = new Date(mon);
      const lastDay = new Date(yr, mo + 1, 0);
      while (cur <= lastDay) { weeks.push(new Date(cur)); cur = addDays(cur, 7); }
      return weeks.slice(0, 6);
    }
    const yr = weekStart.getFullYear();
    return Array.from({ length: 12 }, (_, i) => new Date(yr, i, 1));
  })();

  function colLabel(d: Date, i: number): string {
    if (period === "daily")   return `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()}`;
    if (period === "weekly")  return `${DAY_NAMES[i]} ${d.getDate()}`;
    if (period === "monthly") return `Wk${i + 1} ${MONTH_NAMES[d.getMonth()]}${d.getDate()}`;
    return MONTH_NAMES[d.getMonth()];
  }

  function isWeekendCol(d: Date, i: number): boolean {
    if (period === "weekly") return i === 5 || i === 6;
    if (period === "daily")  return d.getDay() === 0 || d.getDay() === 6;
    return false;
  }

  function isTodayCol(d: Date): boolean {
    return (period === "daily" || period === "weekly") && toDateStr(d) === toDateStr(today);
  }

  function isInPeriod(dateStr: string): boolean {
    if (!dateStr) return false;
    const jd = new Date(dateStr + "T00:00:00");
    if (period === "daily") return toDateStr(jd) === toDateStr(weekStart);
    if (period === "weekly") { const end = addDays(weekStart, 6); return jd >= weekStart && jd <= end; }
    if (period === "monthly") return jd.getFullYear() === weekStart.getFullYear() && jd.getMonth() === weekStart.getMonth();
    return jd.getFullYear() === weekStart.getFullYear();
  }

  function workingDaysInPeriod(): number {
    if (period === "daily") return 1;
    if (period === "weekly") return 5;
    if (period === "monthly") {
      const yr = weekStart.getFullYear(), mo = weekStart.getMonth();
      const days = new Date(yr, mo + 1, 0).getDate();
      let cnt = 0;
      for (let d = 1; d <= days; d++) {
        const dow = new Date(yr, mo, d).getDay();
        if (dow !== 0 && dow !== 6) cnt++;
      }
      return cnt;
    }
    return 260;
  }

  function getJobsForCell(empId: string, col: Date, i: number): any[] {
    if (period === "daily" || period === "weekly") {
      const ds = toDateStr(col);
      return allJobs.filter((j: any) => j.employeeId === empId && j.scheduledDate === ds);
    }
    if (period === "monthly") {
      const end = addDays(col, 6);
      return allJobs.filter((j: any) => {
        if (j.employeeId !== empId || !j.scheduledDate) return false;
        const jd = new Date(j.scheduledDate + "T00:00:00");
        return jd >= col && jd <= end;
      });
    }
    return allJobs.filter((j: any) => {
      if (j.employeeId !== empId || !j.scheduledDate) return false;
      const jd = new Date(j.scheduledDate + "T00:00:00");
      return jd.getMonth() === i && jd.getFullYear() === col.getFullYear();
    });
  }

  // ── Range label ───────────────────────────────────────────────────────────
  function rangeLabel(): string {
    if (period === "daily") {
      const d = weekStart;
      return `${DAY_NAMES[(d.getDay() + 6) % 7]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
    if (period === "weekly") {
      const end = weekDays[6];
      const sameM = weekStart.getMonth() === end.getMonth();
      return `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()} – ${sameM ? "" : MONTH_NAMES[end.getMonth()] + " "}${end.getDate()}, ${end.getFullYear()}`;
    }
    if (period === "monthly") return `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
    return String(weekStart.getFullYear());
  }

  // ── Active employees ──────────────────────────────────────────────────────
  const activeEmps = employees.filter((e: any) => e.isActive);

  // ── Period-aware KPIs (whole-page state from selected period) ─────────────
  const periodLabel = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", annual: "Annual" }[period];
  const periodJobs  = allJobs.filter((j: any) => j.scheduledDate && isInPeriod(j.scheduledDate));
  const periodRevenue = periodJobs.reduce((s: number, j: any) => s + (j.revenue ?? 0), 0);
  const workDays = workingDaysInPeriod();

  const periodEmpCost = activeEmps.reduce((s: number, emp: any) => {
    const laborPerDay = (emp.salary ?? 0) / 260;
    const burdenPerDay = laborPerDay * (params.burdenPct / 100);
    return s + (laborPerDay + burdenPerDay) * workDays;
  }, 0);
  const periodFuelTotal  = params.fuelPerDay  * workDays * activeEmps.length;
  const periodToolsTotal = params.toolsPerDay * workDays * activeEmps.length;
  const periodNetPL = periodRevenue - periodEmpCost - periodFuelTotal - periodToolsTotal;

  // ── Period-specific employee P&L for banners ──────────────────────────────
  const periodEmpStats = activeEmps.map((emp: any) => {
    const empJobs = periodJobs.filter((j: any) => j.employeeId === emp._id);
    const rev  = empJobs.reduce((s: number, j: any) => s + (j.revenue ?? 0), 0);
    const cost = empDailyCostRaw(emp) * workDays;
    return { empId: emp._id, name: emp.name ?? "?", rev, cost, pnl: rev - cost };
  });

  // ── Annual YTD (for lower sections) ──────────────────────────────────────
  const totalRevenue = byService.reduce((s: number, r: any) => s + r.revenue, 0);
  const annualBurden = roi.reduce((s: number, r: any) => s + r.burdenCost, 0);
  const annualOverhead = activeEmps.length > 0 ? params.overheadMonthly * 12 : 0;
  const grossProfit = totalRevenue - annualBurden - annualOverhead;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const chartData = byService.map((s: any) => ({
    name: s.serviceType.replace(/_/g, " "),
    revenue: s.revenue,
    jobs: s.jobCount,
    color: SERVICE_COLORS[s.serviceType] ?? "#6b7280",
  }));

  // ── Column P&L totals (override-aware) ───────────────────────────────────
  const colTotals = columns.map((col, i) => {
    let rev = 0, cost = 0;
    for (const emp of activeEmps) {
      const jobs = getJobsForCell(emp._id, col, i);
      const ds = (period === "daily" || period === "weekly") ? toDateStr(col) : "";
      const cellKey = `${emp._id}:${ds || `col-${i}`}`;
      const dayType = ds ? getDayType(emp._id, ds) : "billable";
      const calcRev = jobs.reduce((s: number, j: any) => s + (j.revenue ?? 0), 0);
      rev  += revOverrides[cellKey] !== undefined ? revOverrides[cellKey] : calcRev;
      cost += empDailyCost(emp, dayType) * (period === "daily" || period === "weekly" ? 1 : period === "monthly" ? 5 : workDays / 12);
    }
    return { rev, cost, pnl: rev - cost };
  });

  // ── Day / cell popup opener ───────────────────────────────────────────────
  function openDayPopup(e: React.MouseEvent, emp: any, dateStr: string, jobs: any[], dayCost: number, dayRev: number) {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const PW = 288, PH = 420, MARGIN = 8;
    let x = rect.left;
    let y = rect.bottom + 6;
    if (x + PW > window.innerWidth  - MARGIN) x = window.innerWidth  - PW - MARGIN;
    if (x < MARGIN) x = MARGIN;
    if (y + PH > window.innerHeight - MARGIN) y = rect.top - PH - 6;
    if (y < MARGIN) y = MARGIN;
    const currentType = dateStr ? getDayType(emp._id, dateStr) : "billable";
    setPopup({ empId: emp._id, emp, dateStr, currentType, jobs, dayCost, dayRev, x, y });
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ["Employee", ...columns.map((d, i) => colLabel(d, i)), "Bill Rate", "Shop Days", "Month Total", "Month P&L"];
    const rows = [headers.join(",")];
    const now = new Date();
    for (const emp of activeEmps) {
      const row: string[] = [emp.name ?? ""];
      for (let i = 0; i < columns.length; i++) {
        const jobs = getJobsForCell(emp._id, columns[i], i);
        const rev = jobs.reduce((s: number, j: any) => s + (j.revenue ?? 0), 0);
        row.push(jobs.length === 0 ? "OFF" : String(rev));
      }
      row.push(String(emp.billableRate ?? 0));
      row.push(`${emp.shopDaysUsedYtd ?? 0}/${emp.allowedShopDays ?? 0}`);
      const monthTotal = allJobs.filter((j: any) => {
        if (j.employeeId !== emp._id || !j.scheduledDate) return false;
        return sameMonth(new Date(j.scheduledDate + "T00:00:00"), now);
      }).reduce((s: number, j: any) => s + (j.revenue ?? 0), 0);
      const monthCost = empDailyCostRaw(emp) * 22;
      row.push(String(monthTotal));
      row.push(String(monthTotal - monthCost));
      rows.push(row.join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pl-${period}-${toDateStr(weekStart)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function setParam(k: keyof BurdenParams) { return (v: number) => setParams(p => ({ ...p, [k]: v })); }

  // ── Revenue override helpers ───────────────────────────────────────────────
  function saveRevOverride(cellKey: string, val: number) {
    setRevOverridesRaw(prev => {
      const next = { ...prev, [cellKey]: val };
      try { localStorage.setItem("pl-rev-overrides", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function resetAllOverrides() {
    setRevOverridesRaw({});
    setDayOverrides(() => ({}));
    try { localStorage.removeItem("pl-rev-overrides"); } catch {}
  }

  const hasAnyOverrides = Object.keys(revOverrides).length > 0 || Object.keys(dayOverrides).length > 0;


  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="size-6 text-red-600 shrink-0" /> P&L Engine
          </h1>
          <p className="text-gray-400 mt-0.5 text-xs">
            Profit &amp; loss breakdown — salary, burden, fuel, tools vs. billable revenue
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden text-xs font-semibold">
            {(["daily","weekly","monthly","annual"] as Period[]).map(p => (
              <button key={p} onClick={() => handleSetPeriod(p)}
                className={cn("px-3 py-1.5 capitalize transition-colors",
                  period === p ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-gray-50 text-gray-600">
            <Download className="size-3.5" /> Export CSV
          </button>
          <div ref={paramsRef} className="relative">
            <button onClick={() => setShowParams(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-gray-50 text-gray-600">
              <Wrench className="size-3.5" /> Burden Settings
              <ChevronDown className={cn("size-3 transition-transform", showParams && "rotate-180")} />
            </button>
            {showParams && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl border shadow-xl p-4 z-30 space-y-3">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Burden Rate Config</h3>
                <ParamInput label="Burden %" value={params.burdenPct} onChange={setParam("burdenPct")} suffix="%" />
                <ParamInput label="Fuel / Field Day" value={params.fuelPerDay} onChange={setParam("fuelPerDay")} prefix="$" />
                <ParamInput label="Tools / Field Day" value={params.toolsPerDay} onChange={setParam("toolsPerDay")} prefix="$" />
                <ParamInput label="Overhead / Month" value={params.overheadMonthly} onChange={setParam("overheadMonthly")} prefix="$" />
                <p className="text-[10px] text-gray-400">Changes apply immediately to all calculations.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Employee banners (period-aware) ────────────────────────────────── */}
      {periodEmpStats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {periodEmpStats.map(s => {
            const unprofitable = s.pnl < 0;
            return (
              <div key={s.empId} className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium flex-1 min-w-[220px]",
                unprofitable ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
              )}>
                {unprofitable
                  ? <AlertTriangle className="size-3.5 shrink-0" />
                  : <CheckCircle2 className="size-3.5 shrink-0" />}
                <span>
                  <strong>{s.name}</strong>{" "}
                  {unprofitable
                    ? <>is unprofitable — <strong>{fmtCompact(Math.abs(s.pnl))}</strong> net loss this {periodLabel.toLowerCase()}</>
                    : <>P&L <strong className="text-emerald-700">+{fmtCompact(s.pnl)}</strong> this {periodLabel.toLowerCase()}</>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── How is this calculated ──────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
        <button onClick={() => setShowCalcInfo(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-700 font-medium hover:bg-blue-100 text-left">
          <Info className="size-4 text-blue-500 shrink-0" />
          How is this calculated?
          <ChevronDown className={cn("size-4 text-blue-400 ml-auto transition-transform", showCalcInfo && "rotate-180")} />
        </button>
        {showCalcInfo && (
          <div className="px-4 pb-4 text-xs text-blue-700 space-y-1.5 border-t border-blue-200 pt-3">
            <p><strong>Billable</strong> = sum of all job revenues for that employee on that day</p>
            <p><strong>Daily cost</strong> = (Hourly Pay × Hours Worked) + Burden + Fuel + Tools</p>
            <p className="font-mono bg-blue-100 rounded px-2 py-1">
              P&L = Billable − ((salary ÷ 2080 × 8 hrs) × (1 + {params.burdenPct}%) + ${params.fuelPerDay} fuel + ${params.toolsPerDay} tools)
            </p>
            <p><strong>Shop Day</strong> = flat ${SHOP_DAY_COST}/day cost, $0 billable → full day loss</p>
            <p><strong>Green P&L</strong> = employee revenue covered all costs that day</p>
          </div>
        )}
      </div>

      {/* ── Period KPI cards (reads from selected period) ───────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: `${periodLabel} Revenue`,   value: fmtCompact(periodRevenue),  icon: DollarSign,  color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: `${periodLabel} Net P&L`,   value: fmtCompact(periodNetPL),    icon: TrendingUp,  color: periodNetPL >= 0 ? "text-emerald-600" : "text-red-600", bg: periodNetPL >= 0 ? "bg-emerald-50" : "bg-red-50" },
          { label: `${periodLabel} Fuel Cost`, value: fmtCompact(periodFuelTotal), icon: Flame,       color: "text-amber-600",   bg: "bg-amber-50" },
          { label: `${periodLabel} Tools Cost`,value: fmtCompact(periodToolsTotal),icon: Wrench,      color: "text-blue-600",    bg: "bg-blue-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{s.label}</span>
              <div className={cn("rounded-lg p-1.5", s.bg)}>
                <s.icon className={cn("size-3.5", s.color)} />
              </div>
            </div>
            <div className={cn("text-2xl font-extrabold", s.color)}>{s.value}</div>
            <div className="text-[10px] text-gray-400 mt-1">{workDays} working day{workDays !== 1 ? "s" : ""} · {activeEmps.length} staff</div>
          </div>
        ))}
      </div>

      {/* ── Annual YTD cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenue YTD",     value: formatCurrency(totalRevenue), icon: DollarSign,  color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Annual Burden",   value: formatCurrency(annualBurden), icon: Users,       color: "text-blue-600",    bg: "bg-blue-50" },
          { label: "Gross Profit YTD",value: formatCurrency(grossProfit),  icon: TrendingUp,  color: grossProfit >= 0 ? "text-emerald-600" : "text-red-600", bg: grossProfit >= 0 ? "bg-emerald-50" : "bg-red-50" },
          { label: "Margin",          value: `${margin.toFixed(1)}%`,      icon: Target,      color: margin >= 40 ? "text-emerald-600" : margin >= 20 ? "text-amber-600" : "text-red-600", bg: margin >= 40 ? "bg-emerald-50" : margin >= 20 ? "bg-amber-50" : "bg-red-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{s.label}</span>
              <div className={cn("rounded-lg p-1.5", s.bg)}><s.icon className={cn("size-3.5", s.color)} /></div>
            </div>
            <div className={cn("text-2xl font-extrabold", s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Shop Day Loss Banner ─────────────────────────────────────────────── */}
      {summary && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Flame className="size-5 text-amber-700" />
            </div>
            <div>
              <div className="font-bold text-amber-900">Shop Day Revenue Loss YTD</div>
              <div className="text-sm text-amber-700">
                ${Math.round(summary.shopDayCostYtd).toLocaleString()} in billable revenue surrendered to shop days
              </div>
            </div>
          </div>
          <div className="sm:ml-auto text-right">
            <div className="text-2xl font-extrabold text-amber-700">${Math.round(summary.projectedAnnualSavings).toLocaleString()}</div>
            <div className="text-xs text-amber-600">projected annual savings if optimized</div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DAILY BILLABLE TABLE
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border overflow-hidden">

        {/* Table header bar */}
        <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3 bg-gray-50">
          <span className="font-bold text-sm text-gray-800">Daily Billable Table</span>

          <div className="flex items-center gap-1">
            <button onClick={navPrev} className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap px-1">{rangeLabel()}</span>
            <button onClick={navNext} className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <button onClick={goToday}
            className="px-2.5 py-1 text-xs font-bold border border-red-200 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
            Today
          </button>

          {hasAnyOverrides && (
            <button
              onClick={resetAllOverrides}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border border-blue-200 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
              <RotateCcw className="size-3" /> Reset to Actual
            </button>
          )}

          <div className="ml-auto flex items-center gap-1 text-[10px] font-semibold">
            <span className="text-gray-400 mr-1">Shop Days</span>
            {(["basic","weekly","monthly","yearly"] as const).map(m => (
              <button key={m} onClick={() => setShopDaysMode(m)}
                className={cn("px-2 py-1 rounded capitalize transition-colors",
                  shopDaysMode === m ? "bg-red-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 border-b bg-white flex flex-wrap items-center gap-4 text-[10px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-emerald-300 bg-emerald-50 inline-block" />
            actual = jobs completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-blue-200 bg-blue-50 inline-block" />
            projected = pending jobs
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-amber-300 bg-amber-50 inline-block" />
            shop day
          </span>
          <span className="text-gray-300">P&L shown below each cell · click · type to change day</span>
        </div>

        {/* Scrollable table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="py-3 px-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider w-40 sticky left-0 bg-gray-50 z-10">
                  Technician
                </th>
                {columns.map((col, i) => {
                  const isToday = isTodayCol(col);
                  const isWknd  = isWeekendCol(col, i);
                  return (
                    <th key={i} className={cn(
                      "py-3 px-3 text-center text-[11px] font-bold uppercase tracking-wider min-w-[110px]",
                      isToday ? "text-red-600 bg-red-50" : isWknd ? "text-gray-300 bg-gray-50" : "text-gray-500"
                    )}>
                      <div>{colLabel(col, i)}</div>
                      {isToday && <div className="text-[9px] font-bold text-red-400 normal-case mt-0.5">today</div>}
                    </th>
                  );
                })}
                <th className="py-3 px-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Bill Rate</th>
                <th className="py-3 px-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Shop Days</th>
                <th className="py-3 px-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {periodLabel} Total
                </th>
              </tr>
            </thead>

            <tbody>
              {activeEmps.map((emp: any) => {
                const roiRow = roi.find((r: any) => r.employeeId === emp._id);
                const shopUsed    = emp.shopDaysUsedYtd ?? 0;
                const shopAllowed = emp.allowedShopDays ?? 0;
                const shopExcess  = shopUsed > shopAllowed;
                const certs       = (emp.certifications ?? []).slice(0, 2).join(", ");
                const dailyCostRaw = empDailyCostRaw(emp);

                // Period total for this employee
                const empPeriodJobs = periodJobs.filter((j: any) => j.employeeId === emp._id);
                const empPeriodRev  = empPeriodJobs.reduce((s: number, j: any) => s + (j.revenue ?? 0), 0);
                const empPeriodCost = dailyCostRaw * workDays;
                const empPeriodPnL  = empPeriodRev - empPeriodCost;

                return (
                  <tr key={emp._id} className="border-b hover:bg-gray-50/50 transition-colors">
                    {/* Employee name */}
                    <td className="py-3 px-4 sticky left-0 bg-white z-10 border-r border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-black text-red-700 shrink-0">
                          {initials(emp.name ?? "?")}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 text-sm truncate">{emp.name}</div>
                          {certs && <div className="text-[9px] text-gray-400 truncate">{certs}</div>}
                          <div className="text-[9px] text-gray-400">${(dailyCostRaw).toFixed(0)}/day cost</div>
                        </div>
                      </div>
                    </td>

                    {/* Day cells */}
                    {columns.map((col, i) => {
                      const dateStr   = (period === "daily" || period === "weekly") ? toDateStr(col) : "";
                      const dayType   = dateStr ? getDayType(emp._id, dateStr) : "billable";
                      const jobs      = getJobsForCell(emp._id, col, i);
                      const cellKey   = `${emp._id}:${dateStr || `col-${i}`}`;
                      const calcRev   = jobs.reduce((s: number, j: any) => s + (j.revenue ?? 0), 0);
                      const hasOverride = revOverrides[cellKey] !== undefined;
                      const dayRev    = hasOverride ? revOverrides[cellKey] : calcRev;
                      const isEditing = editingCell === cellKey;
                      const dayCost   = empDailyCost(emp, dayType);
                      const dayPnL    = dayRev - dayCost;
                      const hasActual = jobs.some((j: any) => j.status === "completed" || j.status === "in_progress");
                      const isOff     = dayType === "offDay";
                      const isShop    = dayType === "shopDay";
                      const isToday   = isTodayCol(col);
                      const isWknd    = isWeekendCol(col, i);
                      const canEdit   = !isOff && !isShop && dayType !== "training" && dayType !== "callOut";

                      return (
                        <td key={i} className={cn("py-2 px-2 align-top", isToday && "bg-red-50/30")}>
                          <div
                            onClick={(e) => { if (!isEditing) openDayPopup(e, emp, dateStr || `col-${i}`, jobs, dayCost, dayRev); }}
                            className={cn(
                              "rounded-xl text-center flex flex-col items-center gap-1 min-h-[80px] px-2 py-3",
                              !isOff && !isWknd && "cursor-pointer",
                              isOff
                                ? "bg-gray-50 justify-center"
                                : isShop
                                ? "bg-amber-50 border border-amber-200 hover:border-amber-400 transition-colors"
                                : dayType === "training"
                                ? "bg-yellow-50 border border-yellow-200 hover:border-yellow-400 transition-colors"
                                : dayType === "callOut"
                                ? "bg-purple-50 border border-purple-200 hover:border-purple-400 transition-colors"
                                : hasOverride
                                ? "bg-blue-50 border border-blue-300 hover:border-blue-500 transition-colors"
                                : hasActual
                                ? "bg-emerald-50 border border-emerald-200 hover:border-emerald-400 transition-colors"
                                : isWknd
                                ? "bg-gray-50 justify-center"
                                : "bg-blue-50 border border-blue-100 hover:border-blue-300 transition-colors"
                            )}>
                            {isOff ? (
                              <>
                                <span className="text-[13px] font-bold text-gray-300">OFF</span>
                                {dateStr && (
                                  <button
                                    onClick={(e) => openDayPopup(e, emp, dateStr, jobs, dayCost, 0)}
                                    className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors mt-1">
                                    change
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                {/* ── Revenue: inline editable ───────────── */}
                                {isEditing ? (
                                  <div className="w-full flex items-center justify-center gap-1">
                                    <span className="text-xs text-gray-400">$</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={editingVal}
                                      autoFocus
                                      onChange={e => setEditingVal(e.target.value)}
                                      onBlur={() => {
                                        const v = parseFloat(editingVal);
                                        if (!isNaN(v) && v >= 0) saveRevOverride(cellKey, v);
                                        setEditingCell(null);
                                      }}
                                      onKeyDown={e => {
                                        if (e.key === "Enter") e.currentTarget.blur();
                                        if (e.key === "Escape") setEditingCell(null);
                                      }}
                                      className="w-16 text-center font-black text-base border-b-2 border-blue-500 bg-transparent focus:outline-none"
                                    />
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      if (!canEdit) return;
                                      setEditingCell(cellKey);
                                      setEditingVal(String(dayRev));
                                    }}
                                    title={canEdit ? "Click to edit revenue" : undefined}
                                    className={cn(
                                      "font-black text-lg leading-none flex items-center gap-0.5 group",
                                      hasOverride
                                        ? "text-blue-700"
                                        : isShop ? "text-amber-700"
                                        : dayType === "training" ? "text-yellow-700"
                                        : "text-gray-900",
                                      canEdit && "hover:opacity-70 transition-opacity cursor-text"
                                    )}>
                                    {isShop
                                      ? "SHOP"
                                      : dayType === "training"
                                      ? "TRAIN"
                                      : dayType === "callOut"
                                      ? "CALL"
                                      : dayRev > 0 ? fmtCompact(dayRev) : "$0"}
                                    {canEdit && (
                                      <Pencil className="size-2.5 opacity-0 group-hover:opacity-40 transition-opacity ml-0.5 shrink-0" />
                                    )}
                                  </button>
                                )}

                                {/* Status / override badge */}
                                <div className={cn("text-[10px] font-semibold",
                                  hasOverride ? "text-blue-500"
                                  : hasActual ? "text-emerald-600"
                                  : isShop ? "text-amber-500"
                                  : dayType === "training" ? "text-yellow-600"
                                  : dayType === "callOut" ? "text-purple-500"
                                  : "text-blue-400")}>
                                  {hasOverride ? "edited"
                                    : hasActual ? "actual"
                                    : isShop ? "shop day"
                                    : dayType === "training" ? "training"
                                    : dayType === "callOut" ? "call out"
                                    : "projected"}
                                </div>

                                {/* Compact job count — detail in popup */}
                                {jobs.length > 0 && (
                                  <div className="text-[9px] text-gray-400 mt-0.5">
                                    {jobs.length} job{jobs.length !== 1 ? "s" : ""}
                                    {hasOverride && <span className="ml-1 text-blue-400">·edited</span>}
                                  </div>
                                )}

                                {/* ── P&L under cell ──────────────────────── */}
                                <div className={cn("text-[12px] font-black leading-none mt-auto pt-1",
                                  dayPnL >= 0 ? "text-emerald-600" : "text-red-500")}>
                                  {dayPnL >= 0 ? "+" : ""}{fmtCompact(dayPnL)}
                                </div>
                                <div className="text-[8px] text-gray-300 -mt-0.5">
                                  {dayPnL >= 0 ? "profit" : "loss"}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Bill Rate */}
                    <td className="py-3 px-3 text-right align-middle">
                      <div className="font-bold text-gray-800">{formatCurrency(emp.billableRate ?? 0)}</div>
                      <div className="text-[9px] text-gray-400">/day</div>
                    </td>

                    {/* Shop Days */}
                    <td className="py-3 px-3 text-center align-middle">
                      <div className={cn("font-bold text-sm", shopExcess ? "text-red-600" : "text-gray-700")}>
                        {shopUsed} used
                      </div>
                      <div className="text-[9px] text-gray-400">
                        {shopDaysMode === "basic"   ? `/${shopAllowed}yr`
                         : shopDaysMode === "weekly" ? `${(shopUsed / 52).toFixed(1)}/wk`
                         : shopDaysMode === "monthly" ? `${(shopUsed / 12).toFixed(1)}/mo`
                         : `${shopAllowed} allowed`}
                      </div>
                      {shopExcess && <div className="text-[9px] text-red-500 font-bold">{shopUsed - shopAllowed} over</div>}
                    </td>

                    {/* Period Total */}
                    <td className="py-3 px-4 text-right align-middle">
                      <div className="font-black text-gray-900">{fmtCompact(empPeriodRev)}</div>
                      <div className={cn("text-xs font-bold", empPeriodPnL >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {empPeriodPnL >= 0 ? "+" : ""}{fmtCompact(empPeriodPnL)}
                      </div>
                      {(roiRow?.shopDaysUsed ?? 0) > 0 && (
                        <div className="text-[9px] text-red-400">{roiRow.shopDaysUsed} shop day{roiRow.shopDaysUsed !== 1 ? "s" : ""}</div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {activeEmps.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 4} className="py-16 text-center text-sm text-gray-400">
                    No active employees — add employees to see the billable table
                  </td>
                </tr>
              )}
            </tbody>

            {activeEmps.length > 0 && (
              <tfoot>
                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                    TOTAL
                  </td>
                  {colTotals.map(({ rev, pnl }, i) => (
                    <td key={i} className="py-3 px-3 text-center">
                      {rev > 0 ? (
                        <>
                          <div className="font-black text-gray-900">{fmtCompact(rev)}</div>
                          <div className={cn("text-xs font-bold", pnl >= 0 ? "text-emerald-600" : "text-red-500")}>
                            {pnl >= 0 ? "+" : ""}{fmtCompact(pnl)}
                          </div>
                          <div className="text-[9px] text-gray-400">
                            {activeEmps.filter(e => getJobsForCell(e._id, columns[i], i).length > 0).length}B
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-200 text-sm">—</span>
                      )}
                    </td>
                  ))}
                  <td colSpan={3} />
                </tr>

                {/* Wage cost row */}
                <tr className="border-t border-gray-200 bg-gray-50/50">
                  <td className="py-2 px-4 text-[10px] text-gray-500 sticky left-0 bg-gray-50/50">
                    Wage Cost <span className="text-gray-400">(hourly × 8 hrs)</span>
                  </td>
                  {columns.map((col, i) => {
                    const isWknd = isWeekendCol(col, i);
                    const wageCost = isWknd ? 0 : activeEmps.reduce((s: number, emp: any) => {
                      return s + (emp.salary ?? 0) / 260;
                    }, 0);
                    return (
                      <td key={i} className="py-2 px-3 text-center text-[10px]">
                        {wageCost > 0
                          ? <span className="text-red-400 font-semibold">({fmtCompact(wageCost)})</span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                    );
                  })}
                  <td colSpan={3} className="py-2 px-4 text-right text-[10px] text-red-400 font-semibold">
                    ({fmtCompact(activeEmps.reduce((s: number, emp: any) => s + (emp.salary ?? 0) / 260, 0) * workDays)})
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Revenue by Service ───────────────────────────────────────────────── */}
      {byService.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <BarChart2 className="size-4 text-red-600" />
            <h2 className="font-semibold text-sm">Revenue by Service Type</h2>
          </div>
          <div className="p-5">
            <div className="h-52 mb-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {byService.map((s: any) => (
                <div key={s.serviceType} className="border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: SERVICE_COLORS[s.serviceType] ?? "#6b7280" }} />
                    <span className="text-xs font-semibold text-gray-700 capitalize">{s.serviceType.replace(/_/g, " ")}</span>
                  </div>
                  <div className="text-lg font-extrabold text-gray-900">{formatCurrency(s.revenue)}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{s.jobCount} jobs · avg {formatCurrency(s.avgRevenue)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Employee ROI table ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <DollarSign className="size-4 text-red-600" />
          <h2 className="font-semibold text-sm">Employee ROI</h2>
          <span className="ml-auto text-xs text-gray-400">
            Burden: {params.burdenPct}% · Overhead: {formatCurrency(params.overheadMonthly)}/mo
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {["Employee","Revenue","Burden Cost","Gross Profit","Margin","Utilization",""].map(h => (
                  <th key={h} className={cn("py-3 px-4 font-semibold text-xs uppercase tracking-wider text-gray-500",
                    h === "Employee" ? "text-left" : h === "" ? "" : "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {roi.map((row: any) => {
                const adjCost   = row.burdenCost * (1 + (params.burdenPct - 30) / 100);
                const adjProfit = row.revenue - adjCost;
                const adjMargin = row.revenue > 0 ? (adjProfit / row.revenue) * 100 : 0;
                return (
                  <tr key={row.employeeId} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-black text-red-700 shrink-0">
                          {initials(row.name ?? "?")}
                        </div>
                        <span className="font-medium text-gray-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{formatCurrency(row.revenue)}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{formatCurrency(adjCost)}</td>
                    <td className={cn("py-3 px-4 text-right font-semibold", adjProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                      {formatCurrency(adjProfit)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold",
                        adjMargin >= 40 ? "bg-emerald-100 text-emerald-700" : adjMargin >= 20 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                        {adjMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
                          <div className={cn("h-2 rounded-full", row.utilization >= 85 ? "bg-emerald-500" : row.utilization >= 70 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${Math.min(row.utilization, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right shrink-0">{row.utilization}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4" />
                  </tr>
                );
              })}
              {roi.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">No data yet — add jobs to see ROI</td></tr>
              )}
            </tbody>
            {roi.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="py-3 px-4 text-xs uppercase text-gray-500">Totals</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(roi.reduce((s: number, r: any) => s + r.revenue, 0))}</td>
                  <td className="py-3 px-4 text-right text-gray-500">{formatCurrency(roi.reduce((s: number, r: any) => s + r.burdenCost, 0))}</td>
                  <td className={cn("py-3 px-4 text-right", grossProfit >= 0 ? "text-emerald-700" : "text-red-600")}>{formatCurrency(grossProfit)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold",
                      margin >= 40 ? "bg-emerald-100 text-emerald-700" : margin >= 20 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                      {margin.toFixed(1)}%
                    </span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Profit Leaks ─────────────────────────────────────────────────────── */}
      {leaks.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <h2 className="font-semibold text-sm">Profit Leaks</h2>
            <span className="ml-auto text-xs text-red-600 font-semibold">{leaks.length} issue{leaks.length !== 1 ? "s" : ""} detected</span>
          </div>
          <div className="divide-y">
            {leaks.map((leak: any, i: number) => (
              <div key={i} className="px-5 py-4 flex items-start gap-3 hover:bg-gray-50">
                <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", (leak.impact ?? 0) > 10000 ? "bg-red-100" : "bg-amber-100")}>
                  <AlertTriangle className={cn("size-4", (leak.impact ?? 0) > 10000 ? "text-red-600" : "text-amber-600")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{leak.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{leak.description}</p>
                  {leak.impact && <p className="text-xs font-bold text-red-600 mt-1">Impact: {formatCurrency(leak.impact)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CELL DETAIL popup — jobs, costs, P&L, day type changer
          Fixed position, clamped to viewport
      ════════════════════════════════════════════════════════════════════════ */}
      {popup && (
        <div
          ref={popupRef}
          className="fixed z-[9999] bg-white rounded-xl border border-gray-200 shadow-2xl w-72 overflow-hidden"
          style={{ left: popup.x, top: popup.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* ── Job list ────────────────────────────────────────────────── */}
          {popup.jobs.length > 0 ? (
            <div className="px-4 py-3 border-b space-y-2">
              {popup.jobs.map((j: any, ji: number) => (
                <div key={ji} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">
                      {(j.customerName ?? j.locationName ?? "Customer").split(",")[0]}
                    </div>
                    <div className="text-[11px] text-gray-400 capitalize">
                      {j.serviceType?.replace(/_/g, " ") ?? "service"}
                    </div>
                  </div>
                  <div className="text-sm font-black text-emerald-600 shrink-0">{fmtCompact(j.revenue ?? 0)}</div>
                </div>
              ))}
              {popup.jobs.length > 1 && (
                <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-xs">
                  <span className="text-gray-400 font-medium">Total billable</span>
                  <span className="font-black text-gray-800">{fmtCompact(popup.dayRev)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-3 border-b text-sm text-gray-400 italic">No jobs scheduled</div>
          )}

          {/* ── Cost breakdown ──────────────────────────────────────────── */}
          <div className="px-4 py-3 border-b space-y-2">
            {(() => {
              const salary      = popup.emp?.salary ?? 0;
              const laborPerDay = salary / 260;
              const burdenAmt   = laborPerDay * (params.burdenPct / 100);
              return (
                <>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>Hourly pay (8h)</span>
                    <span className="font-semibold text-red-500">({fmtCompact(laborPerDay)})</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>Burden ({params.burdenPct}%)</span>
                    <span className="font-semibold text-red-500">({fmtCompact(burdenAmt)})</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-red-400 shrink-0" />
                      Fuel
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">$</span>
                      <input
                        type="number" min="0"
                        value={params.fuelPerDay}
                        onChange={e => setParams(p => ({ ...p, fuelPerDay: Number(e.target.value) }))}
                        onClick={e => e.stopPropagation()}
                        className="w-14 text-right border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-blue-400 shrink-0" />
                      Tools
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">$</span>
                      <input
                        type="number" min="0"
                        value={params.toolsPerDay}
                        onChange={e => setParams(p => ({ ...p, toolsPerDay: Number(e.target.value) }))}
                        onClick={e => e.stopPropagation()}
                        className="w-14 text-right border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* ── Day Net P&L ─────────────────────────────────────────────── */}
          <div className="px-4 py-2.5 border-b flex justify-between items-center">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Day Net P&amp;L</span>
            <span className={cn("text-sm font-black",
              (popup.dayRev - popup.dayCost) >= 0 ? "text-emerald-600" : "text-red-500")}>
              {(popup.dayRev - popup.dayCost) >= 0 ? "+" : ""}{fmtCompact(popup.dayRev - popup.dayCost)}
            </span>
          </div>

          {/* ── Change Day Type ─────────────────────────────────────────── */}
          {popup.dateStr && (
            <>
              <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Change Day Type
              </div>
              {DAY_TYPE_OPTIONS.map(opt => {
                const isSelected = popup.currentType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setDayType(popup.empId, popup.dateStr, opt.value); setPopup(null); }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2",
                      opt.textCls,
                      isSelected ? opt.bgCls + " ring-1 ring-inset ring-current" : "hover:bg-gray-50"
                    )}
                  >
                    <span className={cn("size-2 rounded-full flex-shrink-0", isSelected ? "bg-current" : "bg-gray-200")} />
                    {opt.label}
                  </button>
                );
              })}
            </>
          )}

          {/* ── Close ───────────────────────────────────────────────────── */}
          <div className="border-t px-4 py-2">
            <button onClick={() => setPopup(null)}
              className="w-full text-xs text-gray-400 hover:text-gray-700 transition-colors text-center py-0.5">
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
