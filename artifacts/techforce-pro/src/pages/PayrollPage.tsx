import { useState, useMemo } from "react";
import {
  Banknote, Users, Download, RefreshCw, ChevronDown, ChevronRight,
  Briefcase, TrendingUp, DollarSign, Calendar, FileText, AlertCircle,
  Zap, Fuel, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAILY_FUEL   = 25;    // $25 fuel per working day
const DAILY_TOOLS  = 15;    // $15 tools/equipment per working day
const BURDEN_RATE  = 0.30;  // 30% overhead on wages (FICA, benefits, insurance)

// ─── Labels ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  suppression_lead:  "Suppression Lead",
  sprinkler_tech:    "Sprinkler Tech",
  extinguisher_tech: "Extinguisher Tech",
  helper:            "Helper",
  admin:             "Admin",
};

const SERVICE_LABELS: Record<string, string> = {
  hood_suppression:        "Hood Suppression",
  extinguisher_inspection: "Extinguisher Inspection",
  sprinkler_test:          "Sprinkler Test",
  exit_light_check:        "Exit Light Check",
  standpipe_test:          "Standpipe Test",
  fire_alarm_test:         "Fire Alarm Test",
  backflow_test:           "Backflow Test",
  other:                   "Other",
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  paid:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtCurrency(n: number) {
  return "$" + fmt(Math.round(Math.abs(n)));
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
      const start = new Date(y, m, 1);
      const end   = new Date(y, m + 1, 0);
      return { start, end, label: `${start.toLocaleString("default", { month: "long" })} ${y}` };
    }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobWithInvoice {
  job: any;
  invoice: any | null;
  billedRevenue: number;
  reAttributed: boolean;
}

interface DayEntry {
  date: string;
  dayLabel: string;
  jobs: JobWithInvoice[];
  revenue: number;
  hoursWorked: number;
  wageCost: number;
  burdenCost: number;
  fuelCost: number;
  toolsCost: number;
  totalCost: number;
  netPL: number;
}

interface PayrollRow {
  employee: any;
  hourlyRate: number;
  hoursPerDay: number;
  dailyBreakdown: DayEntry[];
  workingDays: number;
  totalRevenue: number;
  periodWageCost: number;
  periodBurdenCost: number;
  periodFuelCost: number;
  periodToolsCost: number;
  totalCost: number;
  netContribution: number;
  grossMarginPct: number;
  jobsWithInvoices: JobWithInvoice[];
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportPayrollCsv(rows: PayrollRow[], period: string) {
  const { label } = getPeriodBounds(period);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines: string[] = [
    `Payroll Report — ${label}`,
    "",
    ["Employee", "Role", "Hourly Rate", "Hours/Day", "Working Days",
     "Period Wage", "Period Burden", "Fuel", "Tools", "Total Cost",
     "Jobs", "Revenue", "Net P&L", "Margin %"].join(","),
    ...rows.map(r => [
      r.employee.name,
      ROLE_LABELS[r.employee.role] ?? r.employee.role,
      r.hourlyRate.toFixed(2),
      r.hoursPerDay,
      r.workingDays,
      r.periodWageCost.toFixed(2),
      r.periodBurdenCost.toFixed(2),
      r.periodFuelCost.toFixed(2),
      r.periodToolsCost.toFixed(2),
      r.totalCost.toFixed(2),
      r.jobsWithInvoices.length,
      r.totalRevenue.toFixed(2),
      r.netContribution.toFixed(2),
      r.totalRevenue > 0 ? ((r.netContribution / r.totalRevenue) * 100).toFixed(1) + "%" : "N/A",
    ].map(escape).join(",")),
    "",
    "Daily Breakdown",
    ["Employee", "Date", "Jobs", "Revenue", "Wage", "Burden", "Fuel", "Tools", "Total Cost", "Day P&L"].join(","),
    ...rows.flatMap(r =>
      r.dailyBreakdown.map(d => [
        r.employee.name,
        d.date,
        d.jobs.length,
        d.revenue.toFixed(2),
        d.wageCost.toFixed(2),
        d.burdenCost.toFixed(2),
        d.fuelCost.toFixed(2),
        d.toolsCost.toFixed(2),
        d.totalCost.toFixed(2),
        d.netPL.toFixed(2),
      ].map(escape).join(","))
    ),
  ];

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll-${label.replace(/\s/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Daily Breakdown Table ─────────────────────────────────────────────────────

function DailyBreakdownTable({ row }: { row: PayrollRow }) {
  if (row.dailyBreakdown.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        No completed jobs found in this period — {fmtCurrency(row.totalCost)} in costs still accrued across {row.workingDays} working days
      </div>
    );
  }

  const avgDailyRevenue = row.totalRevenue / Math.max(row.dailyBreakdown.length, 1);
  const avgDailyCost    = row.totalCost / Math.max(row.workingDays, 1);

  return (
    <div className="space-y-3">
      {/* Per-day table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between flex-wrap gap-1">
          <span>Daily P&L — Job Days</span>
          <span className="text-[10px] font-normal">Cost runs all {row.workingDays} working days; revenue only on job days</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left py-2 px-3 font-semibold text-muted-foreground whitespace-nowrap">Date</th>
                <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Jobs</th>
                <th className="text-right py-2 px-3 font-semibold text-emerald-700 whitespace-nowrap">Billable</th>
                <th className="text-right py-2 px-3 font-semibold text-muted-foreground whitespace-nowrap">Hrs</th>
                <th className="text-right py-2 px-3 font-semibold text-amber-600 whitespace-nowrap">Wage</th>
                <th className="text-right py-2 px-3 font-semibold text-amber-600 whitespace-nowrap">Burden</th>
                <th className="text-right py-2 px-3 font-semibold text-purple-600 whitespace-nowrap">Fuel</th>
                <th className="text-right py-2 px-3 font-semibold text-cyan-600 whitespace-nowrap">Tools</th>
                <th className="text-right py-2 px-3 font-semibold text-muted-foreground whitespace-nowrap">Day Cost</th>
                <th className="text-right py-2 px-3 font-semibold text-muted-foreground whitespace-nowrap">Day P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {row.dailyBreakdown.map(day => (
                <tr key={day.date} className="hover:bg-muted/20">
                  <td className="py-2.5 px-3 font-medium whitespace-nowrap">{day.dayLabel}</td>
                  <td className="py-2.5 px-3">
                    <div className="space-y-0.5">
                      {day.jobs.map(({ job: j, billedRevenue }, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground">{j.customerName}</span>
                          {" — "}
                          {SERVICE_LABELS[j.serviceType] ?? j.serviceType}
                          <span className="ml-1 text-emerald-600 font-semibold">{fmtCurrency(billedRevenue)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{fmtCurrency(day.revenue)}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{day.hoursWorked}h</td>
                  <td className="py-2.5 px-3 text-right text-amber-600">{fmtCurrency(day.wageCost)}</td>
                  <td className="py-2.5 px-3 text-right text-amber-600">{fmtCurrency(day.burdenCost)}</td>
                  <td className="py-2.5 px-3 text-right text-purple-600">{fmtCurrency(day.fuelCost)}</td>
                  <td className="py-2.5 px-3 text-right text-cyan-600">{fmtCurrency(day.toolsCost)}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{fmtCurrency(day.totalCost)}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${day.netPL >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {day.netPL >= 0 ? "+" : "−"}{fmtCurrency(day.netPL)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/30 font-bold text-xs">
              <tr>
                <td className="py-2.5 px-3">Period Total</td>
                <td className="py-2.5 px-3 text-[10px] text-muted-foreground font-normal">
                  {row.jobsWithInvoices.length} job{row.jobsWithInvoices.length !== 1 ? "s" : ""} · {row.workingDays} working days
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-700">{fmtCurrency(row.totalRevenue)}</td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">{row.hoursPerDay}h/day</td>
                <td className="py-2.5 px-3 text-right text-amber-600">{fmtCurrency(row.periodWageCost)}</td>
                <td className="py-2.5 px-3 text-right text-amber-600">{fmtCurrency(row.periodBurdenCost)}</td>
                <td className="py-2.5 px-3 text-right text-purple-600">{fmtCurrency(row.periodFuelCost)}</td>
                <td className="py-2.5 px-3 text-right text-cyan-600">{fmtCurrency(row.periodToolsCost)}</td>
                <td className="py-2.5 px-3 text-right">{fmtCurrency(row.totalCost)}</td>
                <td className={`py-2.5 px-3 text-right ${row.netContribution >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {row.netContribution >= 0 ? "+" : "−"}{fmtCurrency(row.netContribution)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Projections */}
      {avgDailyRevenue > 0 && (
        <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-3">
          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5">
            <TrendingUp className="size-3.5" />
            Projections — based on avg {fmtCurrency(avgDailyRevenue)}/job-day revenue · avg {fmtCurrency(avgDailyCost)}/day cost
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Weekly",    days: 5   },
              { label: "Monthly",   days: 21  },
              { label: "Quarterly", days: 65  },
              { label: "Yearly",    days: 260 },
            ].map(({ label, days }) => {
              const projRev  = avgDailyRevenue * days;
              const projCost = avgDailyCost * days;
              const projPL   = projRev - projCost;
              return (
                <div key={label} className="rounded-md bg-background border p-2.5 space-y-0.5">
                  <div className="text-[10px] text-muted-foreground">{label} ({days} days)</div>
                  <div className="text-xs font-bold text-emerald-600">{fmtCurrency(projRev)}</div>
                  <div className="text-[10px] text-muted-foreground">revenue</div>
                  <div className={`text-xs font-bold ${projPL >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {projPL >= 0 ? "+" : "−"}{fmtCurrency(projPL)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">net P&L</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timesheet Detail ──────────────────────────────────────────────────────────

function TimesheetDetail({ row }: { row: PayrollRow }) {
  return (
    <div className="mt-3 space-y-3">
      <Separator />

      {/* Rate & cost summary cards */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
            <Zap className="size-3" /> Hourly Rate
          </div>
          <div className="text-lg font-bold text-primary">${fmt(row.hourlyRate, 2)}/hr</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {row.hoursPerDay}h/day · {row.workingDays} working days
          </div>
        </div>
        <div className="rounded-lg bg-amber-500/10 p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
            <DollarSign className="size-3 text-amber-600" /> Period Wage + Burden
          </div>
          <div className="text-lg font-bold text-amber-600">{fmtCurrency(row.periodWageCost + row.periodBurdenCost)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {fmtCurrency(row.periodWageCost)} wage + {fmtCurrency(row.periodBurdenCost)} burden ({Math.round(BURDEN_RATE * 100)}%)
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
            <Fuel className="size-3 text-purple-500" /> Field Costs
          </div>
          <div className="text-lg font-bold">{fmtCurrency(row.periodFuelCost + row.periodToolsCost)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Fuel ${DAILY_FUEL}/day · Tools ${DAILY_TOOLS}/day · {row.workingDays} days
          </div>
        </div>
        <div className={`rounded-lg p-3 ${row.netContribution >= 0 ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
            <TrendingUp className={`size-3 ${row.netContribution >= 0 ? "text-emerald-600" : "text-destructive"}`} /> Net Contribution
          </div>
          <div className={`text-lg font-bold ${row.netContribution >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {row.netContribution >= 0 ? "" : "−"}{fmtCurrency(row.netContribution)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {fmtCurrency(row.totalRevenue)} revenue − {fmtCurrency(row.totalCost)} cost
          </div>
        </div>
      </div>

      {/* Job list (for invoice tracking) */}
      {row.jobsWithInvoices.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Completed Jobs — Invoice Sync
          </div>
          <div className="divide-y">
            {row.jobsWithInvoices.map(({ job: j, invoice, billedRevenue, reAttributed }) => (
              <div key={j.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Briefcase className="size-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">{j.customerName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {SERVICE_LABELS[j.serviceType] ?? j.serviceType}
                    {invoice?.generatedAt
                      ? ` · ${new Date(invoice.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : j.scheduledDate
                        ? ` · ${new Date(j.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : ""}
                  </div>
                  {invoice && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-muted-foreground font-mono">{invoice.invoiceNumber}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${INVOICE_STATUS_STYLES[invoice.status] ?? INVOICE_STATUS_STYLES.draft}`}>
                        {invoice.status}
                      </span>
                      {reAttributed && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <AlertCircle className="size-2.5" /> re-attributed
                        </span>
                      )}
                    </div>
                  )}
                  {!invoice && (
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5 italic">no invoice — using job estimate</div>
                  )}
                </div>
                <div className="text-xs font-semibold text-emerald-700 shrink-0 mt-0.5">{fmtCurrency(billedRevenue)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily P&L breakdown */}
      <DailyBreakdownTable row={row} />
    </div>
  );
}

// ─── Payroll Card ──────────────────────────────────────────────────────────────

function PayrollCard({ row }: { row: PayrollRow }) {
  const [expanded, setExpanded] = useState(false);
  const emp = row.employee;
  const initials = emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const invoicedCount = row.jobsWithInvoices.filter(j => j.invoice).length;

  return (
    <Card>
      <CardContent className="p-0">
        <button
          className="w-full text-left p-4 flex items-center gap-3"
          onClick={() => setExpanded(x => !x)}
        >
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{emp.name}</div>
            <div className="text-xs text-muted-foreground">
              {ROLE_LABELS[emp.role] ?? emp.role}
              <span className="mx-1.5 text-border">·</span>
              <span className="text-primary font-medium">${fmt(row.hourlyRate, 2)}/hr</span>
              <span className="mx-1.5 text-border">·</span>
              {row.hoursPerDay}h/day
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Jobs</div>
              <div className="font-semibold">{row.jobsWithInvoices.length}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Invoiced</div>
              <div className="font-semibold text-blue-600">{invoicedCount}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Revenue</div>
              <div className="font-semibold text-emerald-700">{fmtCurrency(row.totalRevenue)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Total Cost</div>
              <div className="font-semibold text-amber-600">{fmtCurrency(row.totalCost)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Net P&L</div>
              <div className={`font-semibold ${row.netContribution >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {row.netContribution >= 0 ? "+" : "−"}{fmtCurrency(row.netContribution)}
              </div>
            </div>
          </div>
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
            <div className="text-[10px] text-muted-foreground">Revenue</div>
            <div className="font-semibold text-emerald-700">{fmtCurrency(row.totalRevenue)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Cost</div>
            <div className="font-semibold text-amber-600">{fmtCurrency(row.totalCost)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Net P&L</div>
            <div className={`font-semibold ${row.netContribution >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {row.netContribution >= 0 ? "+" : "−"}{fmtCurrency(row.netContribution)}
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
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const jobs      = (useQuery(api.jobs.list)       ?? []) as any[];
  const invoices  = (useQuery(api.invoices.list)   ?? []) as any[];
  const [period,    setPeriod]    = useState("this_month");
  const [empFilter, setEmpFilter] = useState("all");
  const [rateMode,  setRateMode]  = useState<"hourly" | "salary">("hourly");
  const [hoursPerDay, setHoursPerDay] = useState(8);

  const { start, end, label } = useMemo(() => getPeriodBounds(period), [period]);
  const workingDays = useMemo(() => countWeekdays(start, end), [start, end]);

  const invoiceByJobId = useMemo(() => {
    const map = new Map<number, any>();
    for (const inv of invoices) {
      if (inv.jobId != null) map.set(inv.jobId, inv);
    }
    return map;
  }, [invoices]);

  const allRows = useMemo<PayrollRow[]>(() => {
    const completedInPeriod = jobs.filter(j => {
      if (j.status !== "completed") return false;
      const invoice = invoiceByJobId.get(j.id);
      let d: Date | null = null;
      if (invoice?.generatedAt) {
        d = new Date(invoice.generatedAt);
      } else if (j.scheduledDate) {
        d = new Date(j.scheduledDate + "T12:00:00");
      }
      if (!d) return false;
      return d >= start && d <= end;
    });

    const enriched: JobWithInvoice[] = completedInPeriod.map(job => {
      const invoice = invoiceByJobId.get(job.id) ?? null;
      const billedRevenue = invoice ? invoice.totalAmount : job.revenue;
      const reAttributed = invoice != null && invoice.techId != null && invoice.techId !== job.employeeId;
      return { job, invoice, billedRevenue, reAttributed };
    });

    return employees.map(emp => {
      // Effective hourly rate
      const hourlyRate = rateMode === "salary"
        ? Number(emp.salary) / 2080
        : (emp.hourlyRate ?? Number(emp.salary) / 2080);

      const hpd = hoursPerDay;

      // Daily cost breakdown
      const dailyWage   = hourlyRate * hpd;
      const dailyBurden = dailyWage * BURDEN_RATE;
      const totalDailyCost = dailyWage + dailyBurden + DAILY_FUEL + DAILY_TOOLS;

      // Period-wide costs (all working days, not just job days — employee is paid regardless)
      const periodWageCost   = dailyWage * workingDays;
      const periodBurdenCost = dailyBurden * workingDays;
      const periodFuelCost   = DAILY_FUEL * workingDays;
      const periodToolsCost  = DAILY_TOOLS * workingDays;
      const totalCost        = periodWageCost + periodBurdenCost + periodFuelCost + periodToolsCost;

      // Jobs attributed to this employee
      const empJobs = enriched.filter(({ job, invoice }) => {
        if (invoice && invoice.techId != null) return invoice.techId === emp.id;
        return job.employeeId === emp.id;
      });

      const totalRevenue    = empJobs.reduce((s, j) => s + j.billedRevenue, 0);
      const netContribution = totalRevenue - totalCost;
      const grossMarginPct  = totalRevenue > 0 ? (netContribution / totalRevenue) * 100 : 0;

      // Group jobs by date for daily P&L breakdown
      const jobsByDate = new Map<string, JobWithInvoice[]>();
      for (const jwi of empJobs) {
        const { invoice, job } = jwi;
        let dateKey: string | null = null;
        if (invoice?.generatedAt) {
          dateKey = new Date(invoice.generatedAt).toISOString().slice(0, 10);
        } else if (job.scheduledDate) {
          dateKey = job.scheduledDate;
        }
        if (!dateKey) continue;
        if (!jobsByDate.has(dateKey)) jobsByDate.set(dateKey, []);
        jobsByDate.get(dateKey)!.push(jwi);
      }

      const dailyBreakdown: DayEntry[] = Array.from(jobsByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayJobs]) => {
          const revenue  = dayJobs.reduce((s, j) => s + j.billedRevenue, 0);
          const d        = new Date(date + "T12:00:00");
          const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          return {
            date, dayLabel, jobs: dayJobs, revenue,
            hoursWorked: hpd,
            wageCost:    dailyWage,
            burdenCost:  dailyBurden,
            fuelCost:    DAILY_FUEL,
            toolsCost:   DAILY_TOOLS,
            totalCost:   totalDailyCost,
            netPL:       revenue - totalDailyCost,
          };
        });

      return {
        employee: emp,
        hourlyRate,
        hoursPerDay: hpd,
        dailyBreakdown,
        workingDays,
        totalRevenue,
        periodWageCost,
        periodBurdenCost,
        periodFuelCost,
        periodToolsCost,
        totalCost,
        netContribution,
        grossMarginPct,
        jobsWithInvoices: empJobs,
      };
    });
  }, [employees, jobs, invoiceByJobId, start, end, workingDays, rateMode, hoursPerDay]);

  const displayRows = useMemo(() => {
    if (empFilter === "all") return allRows;
    return allRows.filter(r => String(r.employee._id ?? r.employee.id) === empFilter);
  }, [allRows, empFilter]);

  const totals = useMemo(() => ({
    revenue: displayRows.reduce((s, r) => s + r.totalRevenue, 0),
    cost:    displayRows.reduce((s, r) => s + r.totalCost, 0),
    net:     displayRows.reduce((s, r) => s + r.netContribution, 0),
    jobs:    displayRows.reduce((s, r) => s + r.jobsWithInvoices.length, 0),
  }), [displayRows]);

  function handleRefresh() { /* Convex auto-refreshes */ }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Banknote className="size-6 text-primary shrink-0" />
          Payroll & P&L
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Hourly-based payroll with daily job-level P&L, per-employee gain/loss, and weekly/monthly/yearly projections.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={period} onValueChange={v => setPeriod(v)}>
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

        {/* Rate mode toggle */}
        <div className="flex items-center gap-1 p-0.5 bg-muted rounded-lg text-xs">
          <button
            onClick={() => setRateMode("hourly")}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${rateMode === "hourly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Hourly Rate
          </button>
          <button
            onClick={() => setRateMode("salary")}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${rateMode === "salary" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Salary Proration
          </button>
        </div>

        {/* Hours per day selector */}
        <Select value={String(hoursPerDay)} onValueChange={v => setHoursPerDay(Number(v))}>
          <SelectTrigger className="w-36">
            <Wrench className="size-3.5 text-muted-foreground mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[6, 7, 8, 9, 10].map(h => (
              <SelectItem key={h} value={String(h)}>{h}h / day</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={handleRefresh} disabled={false} className="gap-2">
          <RefreshCw className={`size-4 ${""}`} />
          {"Refresh"}
        </Button>

        <Button variant="outline" onClick={() => exportPayrollCsv(displayRows, period)} className="gap-2" disabled={displayRows.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {/* Period banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 text-primary" />
          <span className="font-semibold">{label}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-muted-foreground text-xs">{workingDays} working days</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
          {end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>
        <div className="text-xs text-muted-foreground ml-auto">
          Mode: <span className="font-semibold text-foreground capitalize">{rateMode}</span>
          {" · "}
          <span className="font-semibold text-foreground">{hoursPerDay}h/day</span>
          {" · "}
          Burden: {Math.round(BURDEN_RATE * 100)}% + ${DAILY_FUEL} fuel + ${DAILY_TOOLS} tools/day
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Revenue",     value: totals.revenue, sub: `${totals.jobs} jobs completed`,     icon: DollarSign, color: "text-emerald-600" },
          { label: "Total Cost",        value: totals.cost,    sub: `wages + burden + fuel + tools`,     icon: TrendingUp, color: "text-amber-600"   },
          { label: "Net Contribution",  value: totals.net,     sub: "revenue minus all costs",           icon: FileText,   color: totals.net >= 0 ? "text-emerald-600" : "text-destructive" },
          { label: "Profit Margin",     value: null,
            display: totals.revenue > 0 ? `${((totals.net / totals.revenue) * 100).toFixed(1)}%` : "—",
            sub: totals.revenue > 0 ? (totals.net >= 0 ? "healthy margin" : "below cost") : "no revenue",
            icon: Users, color: totals.net >= 0 ? "text-emerald-600" : "text-destructive" },
        ].map(({ label: lbl, value, display, sub, icon: Icon, color }) => (
          <Card key={lbl}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`size-3.5 ${color}`} />
                <span className="text-xs text-muted-foreground">{lbl}</span>
              </div>
              <div className={`text-xl font-bold ${color}`}>
                {display ?? (value !== null && value !== undefined
                  ? `${value < 0 ? "−" : ""}${fmtCurrency(value)}`
                  : "—")}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Methodology notes */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300 flex gap-2">
          <FileText className="size-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Revenue:</strong> Uses actual invoiced amount when invoice exists; falls back to job estimate otherwise.
            Re-attributed invoices credit the technician on the invoice, not the original job assignee.
          </span>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
          <TrendingUp className="size-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Cost formula:</strong> hourlyRate × {hoursPerDay}h = daily wage · +{Math.round(BURDEN_RATE * 100)}% burden (FICA/benefits) ·
            +${DAILY_FUEL} fuel · +${DAILY_TOOLS} tools — applied to <em>all {workingDays} working days</em>, not just job days.
          </span>
        </div>
      </div>

      {/* Employee Cards */}
      {displayRows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            No employees found. Add employees to generate payroll reports.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {displayRows.length} Employee{displayRows.length !== 1 ? "s" : ""}
            </h2>
            <span className="text-xs text-muted-foreground">Click a row to expand daily P&L</span>
          </div>
          {displayRows.map(row => (
            <PayrollCard key={row.employee.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
