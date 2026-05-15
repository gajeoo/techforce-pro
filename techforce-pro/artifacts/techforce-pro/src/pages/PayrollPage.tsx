import { useState, useEffect, useMemo } from "react";
import {
  Banknote, Users, Download, RefreshCw, ChevronDown, ChevronRight,
  Briefcase, TrendingUp, DollarSign, Calendar, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getEmployees, getJobs, type ApiEmployee, type ApiJob } from "@/lib/api";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  suppression_lead:   "Suppression Lead",
  sprinkler_tech:     "Sprinkler Tech",
  extinguisher_tech:  "Extinguisher Tech",
  helper:             "Helper",
  admin:              "Admin",
};

const SERVICE_LABELS: Record<string, string> = {
  hood_suppression:         "Hood Suppression",
  extinguisher_inspection:  "Extinguisher Inspection",
  sprinkler_test:           "Sprinkler Test",
  exit_light_check:         "Exit Light Check",
  standpipe_test:           "Standpipe Test",
  fire_alarm_test:          "Fire Alarm Test",
  backflow_test:            "Backflow Test",
  other:                    "Other",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtCurrency(n: number) {
  return "$" + fmt(Math.round(n));
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  while (d <= e) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getPeriodBounds(period: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "this_week": {
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: mon, end: sun, label: "This Week" };
    }
    case "last_week": {
      const day = now.getDay();
      const thisMon = new Date(now); thisMon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
      const lastSun = new Date(lastMon); lastSun.setDate(lastMon.getDate() + 6);
      return { start: lastMon, end: lastSun, label: "Last Week" };
    }
    case "last_month": {
      const start = new Date(y, m - 1, 1);
      const end   = new Date(y, m, 0);
      return { start, end, label: `${start.toLocaleString("default", { month: "long" })} ${start.getFullYear()}` };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      const start = new Date(y, q * 3, 1);
      const end   = new Date(y, q * 3 + 3, 0);
      return { start, end, label: `Q${q + 1} ${y}` };
    }
    case "ytd": {
      return { start: new Date(y, 0, 1), end: new Date(), label: `YTD ${y}` };
    }
    default: {
      // this_month
      const start = new Date(y, m, 1);
      const end   = new Date(y, m + 1, 0);
      return { start, end, label: `${start.toLocaleString("default", { month: "long" })} ${y}` };
    }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayrollRow {
  employee: ApiEmployee;
  periodPay: number;
  dailyBurden: number;
  workingDays: number;
  periodBurden: number;
  jobs: ApiJob[];
  revenue: number;
  netContribution: number;
  grossMarginPct: number;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportPayrollCsv(rows: PayrollRow[], period: string) {
  const { label } = getPeriodBounds(period);
  const headers = [
    "Employee", "Role", "Annual Salary", "Period Gross Pay", "Daily Burden Rate",
    "Working Days", "Period Burden", "Jobs Completed", "Revenue Generated",
    "Net Contribution", "Gross Margin %",
  ];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const dataRows = rows.map(r => [
    r.employee.name,
    ROLE_LABELS[r.employee.role] ?? r.employee.role,
    r.employee.salary,
    r.periodPay.toFixed(2),
    r.dailyBurden.toFixed(2),
    r.workingDays,
    r.periodBurden.toFixed(2),
    r.jobs.length,
    r.revenue.toFixed(2),
    r.netContribution.toFixed(2),
    r.revenue > 0 ? ((r.netContribution / r.revenue) * 100).toFixed(1) + "%" : "N/A",
  ].map(escape).join(","));

  const csv = [headers.join(","), ...dataRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll-${label.replace(/\s/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Employee Timesheet Detail ─────────────────────────────────────────────────

function TimesheetDetail({ row }: { row: PayrollRow }) {
  const emp = row.employee;
  return (
    <div className="mt-3 space-y-3">
      <Separator />
      {/* Financials */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Period Gross Pay</div>
          <div className="text-lg font-bold text-primary">{fmtCurrency(row.periodPay)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            ${fmt(emp.salary)} salary ÷ period
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Period Burden</div>
          <div className="text-lg font-bold text-amber-600">{fmtCurrency(row.periodBurden)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {fmtCurrency(row.dailyBurden)}/day × {row.workingDays} working days
          </div>
        </div>
        <div className={`rounded-lg p-3 ${row.netContribution >= 0 ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Net Contribution</div>
          <div className={`text-lg font-bold ${row.netContribution >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {fmtCurrency(row.netContribution)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Revenue – burden ({row.jobs.length} job{row.jobs.length !== 1 ? "s" : ""})
          </div>
        </div>
      </div>

      {/* Job Timesheet */}
      {row.jobs.length > 0 ? (
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Completed Jobs — Timesheet
          </div>
          <div className="divide-y">
            {row.jobs.map(j => (
              <div key={j.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="size-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">{j.customerName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {SERVICE_LABELS[j.serviceType] ?? j.serviceType}
                    {j.scheduledDate && ` · ${new Date(j.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </div>
                </div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                  {fmtCurrency(j.revenue)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No completed jobs in this period
        </div>
      )}
    </div>
  );
}

// ─── Payroll Row Card ──────────────────────────────────────────────────────────

function PayrollCard({ row }: { row: PayrollRow }) {
  const [expanded, setExpanded] = useState(false);
  const emp = row.employee;
  const initials = emp.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Card>
      <CardContent className="p-0">
        <button
          className="w-full text-left p-4 flex items-center gap-3"
          onClick={() => setExpanded(x => !x)}
        >
          {/* Avatar */}
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
            {initials}
          </div>

          {/* Name + Role */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{emp.name}</div>
            <div className="text-xs text-muted-foreground">{ROLE_LABELS[emp.role] ?? emp.role}</div>
          </div>

          {/* Summary chips */}
          <div className="hidden sm:flex items-center gap-3 text-xs shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Period Pay</div>
              <div className="font-semibold">{fmtCurrency(row.periodPay)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Jobs</div>
              <div className="font-semibold">{row.jobs.length}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Revenue</div>
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">{fmtCurrency(row.revenue)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Net</div>
              <div className={`font-semibold ${row.netContribution >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {fmtCurrency(row.netContribution)}
              </div>
            </div>
          </div>

          {/* Status badge + expand */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={emp.isActive ? "default" : "secondary"} className={`text-[10px] hidden sm:flex ${emp.isActive ? "bg-emerald-600" : ""}`}>
              {emp.isActive ? "active" : "inactive"}
            </Badge>
            {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Mobile summary */}
        <div className="sm:hidden flex gap-4 px-4 pb-3 text-xs">
          <div>
            <div className="text-[10px] text-muted-foreground">Period Pay</div>
            <div className="font-semibold">{fmtCurrency(row.periodPay)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Revenue</div>
            <div className="font-semibold text-emerald-700">{fmtCurrency(row.revenue)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Net</div>
            <div className={`font-semibold ${row.netContribution >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {fmtCurrency(row.netContribution)}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="px-4 pb-4">
            <TimesheetDetail row={row} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PayrollPage() {
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [jobs,      setJobs]      = useState<ApiJob[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState("this_month");
  const [empFilter, setEmpFilter] = useState("all");
  const [calculated, setCalculated] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getEmployees(), getJobs()])
      .then(([emps, jbs]) => {
        setEmployees(emps);
        setJobs(jbs);
      })
      .catch(() => toast.error("Failed to load payroll data"))
      .finally(() => setLoading(false));
  }, []);

  const { start, end, label } = useMemo(() => getPeriodBounds(period), [period]);

  const workingDays = useMemo(() => countWeekdays(start, end), [start, end]);

  const allRows = useMemo<PayrollRow[]>(() => {
    const completedInPeriod = jobs.filter(j => {
      if (j.status !== "completed") return false;
      if (!j.scheduledDate) return false;
      const d = new Date(j.scheduledDate + "T12:00:00");
      return d >= start && d <= end;
    });

    return employees.map(emp => {
      const dailyBurden    = (emp.salary * 1.3 + 10000) / 260;
      const periodBurden   = dailyBurden * workingDays;
      // Monthly pay = salary / 12; bi-weekly = /26; weekly = /52; quarter = /4; ytd is accrued
      const periodFactor: Record<string, number> = {
        this_week: 52, last_week: 52,
        this_month: 12, last_month: 12,
        this_quarter: 4, ytd: 1,
      };
      const factor = periodFactor[period] ?? 12;
      const periodPay = period === "ytd"
        ? (emp.salary * (end.getMonth() + 1)) / 12
        : emp.salary / factor;

      const empJobs = completedInPeriod.filter(j => j.employeeId === emp.id);
      const revenue = empJobs.reduce((s, j) => s + j.revenue, 0);
      const netContribution = revenue - periodBurden;
      const grossMarginPct  = revenue > 0 ? (netContribution / revenue) * 100 : 0;

      return { employee: emp, periodPay, dailyBurden, workingDays, periodBurden, jobs: empJobs, revenue, netContribution, grossMarginPct };
    });
  }, [employees, jobs, start, end, workingDays, period]);

  const displayRows = useMemo(() => {
    if (empFilter === "all") return allRows;
    return allRows.filter(r => String(r.employee.id) === empFilter);
  }, [allRows, empFilter]);

  const totals = useMemo(() => ({
    payroll:  displayRows.reduce((s, r) => s + r.periodPay, 0),
    burden:   displayRows.reduce((s, r) => s + r.periodBurden, 0),
    revenue:  displayRows.reduce((s, r) => s + r.revenue, 0),
    jobs:     displayRows.reduce((s, r) => s + r.jobs.length, 0),
    net:      displayRows.reduce((s, r) => s + r.netContribution, 0),
  }), [displayRows]);

  function handleCalculate() {
    setLoading(true);
    Promise.all([getEmployees(), getJobs()])
      .then(([emps, jbs]) => { setEmployees(emps); setJobs(jbs); setCalculated(true); })
      .catch(() => toast.error("Failed to refresh data"))
      .finally(() => setLoading(false));
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Banknote className="size-6 text-primary shrink-0" />
          Payroll & Timesheets
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Calculate gross pay, burden rates, and revenue contribution per employee for any period.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={period} onValueChange={v => { setPeriod(v); setCalculated(false); }}>
          <SelectTrigger className="w-44">
            <Calendar className="size-3.5 text-muted-foreground mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="last_week">Last Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="ytd">Year to Date</SelectItem>
          </SelectContent>
        </Select>

        <Select value={empFilter} onValueChange={setEmpFilter}>
          <SelectTrigger className="w-52">
            <Users className="size-3.5 text-muted-foreground mr-1" />
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleCalculate} disabled={loading} className="gap-2">
          {loading ? <RefreshCw className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
          {loading ? "Loading…" : "Run Payroll"}
        </Button>

        {calculated && (
          <Button variant="outline" onClick={() => exportPayrollCsv(displayRows, period)} className="gap-2">
            <Download className="size-4" /> Export CSV
          </Button>
        )}
      </div>

      {/* Period summary banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 text-primary" />
          <span className="font-semibold">{label}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-muted-foreground text-xs">{workingDays} working days</span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <span><span className="text-muted-foreground">Period:</span> {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Payroll",  value: fmtCurrency(totals.payroll),  sub: "gross period pay",       icon: DollarSign,  color: "text-primary" },
          { label: "Total Burden",   value: fmtCurrency(totals.burden),   sub: "including overhead",     icon: TrendingUp,  color: "text-amber-600" },
          { label: "Revenue Generated", value: fmtCurrency(totals.revenue), sub: `${totals.jobs} jobs`, icon: Briefcase,   color: "text-emerald-600" },
          { label: "Net Contribution", value: fmtCurrency(totals.net),    sub: "revenue minus burden",   icon: FileText,    color: totals.net >= 0 ? "text-emerald-600" : "text-destructive" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`size-3.5 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Burden rate methodology note */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300 flex gap-2">
        <TrendingUp className="size-3.5 shrink-0 mt-0.5" />
        <span>
          <strong>Burden formula:</strong> (Annual Salary × 1.3 + $10,000) ÷ 260 = daily burden rate. Includes payroll taxes, benefits, and overhead (~30% uplift + $10K fixed cost per employee per year).
        </span>
      </div>

      {/* Employee Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="size-5 animate-spin" />
          <span>Loading employee data…</span>
        </div>
      ) : displayRows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No employees found</CardTitle>
            <CardDescription>Add employees to generate payroll reports.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {displayRows.length} Employee{displayRows.length !== 1 ? "s" : ""}
            </h2>
            <span className="text-xs text-muted-foreground">Click a row to expand timesheet</span>
          </div>
          {displayRows.map(row => (
            <PayrollCard key={row.employee.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
