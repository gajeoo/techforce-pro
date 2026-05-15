import { useState, useEffect } from "react";
import {
  AlertTriangle, ArrowRight, CalendarDays, CalendarOff, Clock,
  DollarSign, Flame, TrendingDown, TrendingUp, Users, Wrench, Zap,
  FileText, Receipt, PlusCircle, ClipboardList, Building2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  getDashboardSummary, getProfitLeaks, getEmployees, getJobs, getTeamCalendar, getCustomers, createJob, getInvoices,
  getWeekDates, initials, serviceTypeLabel, jobStatusIcon,
  type ApiEmployee, type ApiJob, type ApiCustomer, type ApiInvoice, type DashboardSummary, type ProfitLeak, type CalendarEntry,
} from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDayBg(hasJob: boolean, isEmpty: boolean) {
  if (isEmpty) return "bg-muted/50 text-muted-foreground";
  if (hasJob) return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
  return "bg-muted/30 text-muted-foreground";
}

function getStatusColor(status: string) {
  if (status === "completed") return "bg-emerald-600";
  if (status === "in-progress" || status === "in_progress") return "bg-blue-600";
  if (status === "return" || status === "will_return") return "bg-amber-600";
  if (status === "reschedule") return "bg-primary";
  if (status === "emergency") return "bg-red-600";
  return "bg-muted-foreground";
}

function getStatusLabel(status: string) {
  if (status === "completed") return "Done";
  if (status === "in-progress" || status === "in_progress") return "Active";
  if (status === "return" || status === "will_return") return "Return";
  if (status === "reschedule") return "Reschedule";
  if (status === "emergency") return "Emergency";
  return "Pending";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencySaving, setEmergencySaving] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({
    customerId: "", employeeId: "", description: "", revenue: "",
  });

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [leaks, setLeaks] = useState<ProfitLeak[]>([]);
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayOff, setTodayOff] = useState<{ id: number; employeeName: string; type: string; startDate: string; endDate: string }[]>([]);

  useEffect(() => {
    Promise.all([
      getDashboardSummary().then(setSummary).catch(() => null),
      getEmployees().then(setEmployees).catch(() => null),
      getJobs().then(setJobs).catch(() => null),
      getInvoices().then(setInvoices).catch(() => null),
      getProfitLeaks().then(setLeaks).catch(() => null),
      getTeamCalendar().then(setCalendar).catch(() => null),
      getCustomers().then(setCustomers).catch(() => null),
      fetch(`/api/time-off?status=approved&date=${new Date().toISOString().slice(0, 10)}`)
        .then(r => r.ok ? r.json() : []).then(setTodayOff).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const weekDates = getWeekDates(0);

  // Group calendar entries by employee for weekly schedule
  const empCalMap: Record<number, { name: string; cert: string; byDate: Record<string, CalendarEntry[]> }> = {};
  for (const entry of calendar) {
    if (!empCalMap[entry.employeeId]) {
      empCalMap[entry.employeeId] = { name: entry.employeeName, cert: entry.certification, byDate: {} };
    }
    if (!empCalMap[entry.employeeId].byDate[entry.date]) {
      empCalMap[entry.employeeId].byDate[entry.date] = [];
    }
    empCalMap[entry.employeeId].byDate[entry.date].push(entry);
  }
  const weekScheduleRows = Object.values(empCalMap).slice(0, 5);

  // Today progress
  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const activeJobs = jobs.filter(j => j.status === "in-progress" || j.status === "in_progress").length;
  const pendingJobs = jobs.filter(j => j.status === "pending").length;
  const issueJobs = jobs.filter(j => j.status === "return" || j.status === "will_return" || j.status === "reschedule").length;
  const totalJobs = jobs.length || 1;

  // Invoice KPIs
  const pendingInvoices = invoices.filter(inv => inv.status === "draft" || inv.status === "pending");
  const overdueInvoices = invoices.filter(inv => inv.status === "overdue");
  const pendingInvoiceTotal = pendingInvoices.reduce((s, inv) => s + inv.totalAmount, 0);

  // KPI stats
  const stats = [
    {
      title: "Revenue YTD",
      value: summary ? `$${summary.revenueYtd.toLocaleString()}` : "—",
      sub: `${jobs.filter(j => j.status === "completed").length} jobs completed`,
      icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", link: "/reports",
    },
    {
      title: "Team Utilization",
      value: summary ? `${summary.teamUtilizationPct.toFixed(1)}%` : "—",
      sub: `${summary?.activeTechCount ?? employees.length} active technicians`,
      icon: Users, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", link: "/employees",
    },
    {
      title: "Open Jobs",
      value: summary ? String(summary.openJobCount) : "—",
      sub: `${summary?.returnJobCount ?? 0} returns · ${summary?.rescheduleJobCount ?? 0} reschedules`,
      icon: DollarSign, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", link: "/open-jobs",
    },
    {
      title: "Lost to Shop Days",
      value: summary ? `$${Math.round(summary.shopDayCostYtd).toLocaleString()}` : "—",
      sub: summary ? `Projected save: $${Math.round(summary.projectedAnnualSavings).toLocaleString()}/yr` : "—",
      icon: TrendingDown, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", link: "/shop-calculator",
    },
  ];

  async function handleEmergencyDispatch() {
    if (!emergencyForm.customerId) return;
    setEmergencySaving(true);
    try {
      await createJob({
        customerId: Number(emergencyForm.customerId),
        employeeId: emergencyForm.employeeId ? Number(emergencyForm.employeeId) : null,
        serviceType: "emergency",
        status: "pending",
        priority: "high",
        scheduledDate: new Date().toISOString().split("T")[0],
        scheduledTime: "08:00",
        certRequired: "any",
        notes: emergencyForm.description || "Emergency dispatch",
        revenue: Number(emergencyForm.revenue) || 0,
      });
      setEmergencyOpen(false);
      setEmergencyForm({ customerId: "", employeeId: "", description: "", revenue: "" });
      const updated = await getJobs();
      setJobs(updated);
    } finally {
      setEmergencySaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Flame className="size-7 text-primary shrink-0" /> Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Multicorp Fire Protection Services — Columbia, MD
          </p>
        </div>
        <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-1.5 self-start sm:self-auto">
              <Zap className="size-3.5" /> Emergency Override
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Zap className="size-5" /> Emergency Job Override
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                Creates an emergency job and immediately queues it for dispatch.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Customer *</Label>
                  <Select value={emergencyForm.customerId} onValueChange={v => setEmergencyForm(f => ({ ...f, customerId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Override Tech</Label>
                  <Select value={emergencyForm.employeeId || "__auto__"} onValueChange={v => setEmergencyForm(f => ({ ...f, employeeId: v === "__auto__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Auto-assign" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto__">Auto — Nearest Available</SelectItem>
                      {employees.map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Emergency Description</Label>
                <Textarea
                  placeholder="Describe the emergency..."
                  rows={3}
                  value={emergencyForm.description}
                  onChange={e => setEmergencyForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Estimated Revenue ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={emergencyForm.revenue}
                  onChange={e => setEmergencyForm(f => ({ ...f, revenue: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEmergencyOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  className="gap-1.5"
                  disabled={!emergencyForm.customerId || emergencySaving}
                  onClick={handleEmergencyDispatch}
                >
                  <Zap className="size-3.5" /> {emergencySaving ? "Dispatching…" : "Dispatch Emergency"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5" asChild>
          <Link to="/jobs"><PlusCircle className="size-3.5" /> New Job</Link>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <Link to="/open-jobs"><ClipboardList className="size-3.5" /> Open Jobs</Link>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <Link to="/estimates"><FileText className="size-3.5" /> Estimates</Link>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <Link to="/invoices"><Receipt className="size-3.5" /> Invoices</Link>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <Link to="/customers"><Building2 className="size-3.5" /> Customers</Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <Card
            key={stat.title}
            className="relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(stat.link)}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                  {stat.title}
                </span>
                <div className={`rounded-lg p-2 ${stat.bg} shrink-0`}>
                  <stat.icon className={`size-4 ${stat.color}`} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {loading ? <span className="text-muted-foreground">—</span> : stat.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Who's Off Today */}
      {todayOff.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <CalendarOff className="size-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Off Today ({todayOff.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {todayOff.map(r => (
              <span key={r.id} className="flex items-center gap-1.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full px-2.5 py-1 font-medium">
                {r.employeeName}
                <span className="text-amber-500 dark:text-amber-500 font-normal">·</span>
                <span className="capitalize font-normal">{r.type.replace(/-/g, " ")}</span>
              </span>
            ))}
          </div>
          <button className="text-xs text-amber-600 hover:underline ml-auto shrink-0" onClick={() => navigate("/time-off")}>
            View all →
          </button>
        </div>
      )}

      {/* Today's Progress */}
      <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => navigate("/jobs")}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-primary" />
            <span className="text-sm font-bold">Job Status Overview</span>
            <ArrowRight className="size-3 text-muted-foreground ml-auto" />
          </div>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
            {completedJobs > 0 && (
              <div className="bg-emerald-500 transition-all" style={{ width: `${(completedJobs / totalJobs) * 100}%` }} />
            )}
            {activeJobs > 0 && (
              <div className="bg-blue-500 transition-all" style={{ width: `${(activeJobs / totalJobs) * 100}%` }} />
            )}
            {pendingJobs > 0 && (
              <div className="bg-gray-300 dark:bg-gray-600 transition-all" style={{ width: `${(pendingJobs / totalJobs) * 100}%` }} />
            )}
            {issueJobs > 0 && (
              <div className="bg-amber-500 transition-all" style={{ width: `${(issueJobs / totalJobs) * 100}%` }} />
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" /> {completedJobs} Completed</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-500" /> {activeJobs} In Progress</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-gray-400" /> {pendingJobs} Pending</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500" /> {issueJobs} Needs Attention</span>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Overview */}
      <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => navigate("/invoices")}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="size-4 text-primary" />
            <span className="text-sm font-bold">Invoice Overview</span>
            <ArrowRight className="size-3 text-muted-foreground ml-auto" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Pending</div>
              <div className="text-xl font-extrabold text-amber-600">{loading ? "—" : pendingInvoices.length}</div>
              <div className="text-[10px] text-muted-foreground">${loading ? "—" : pendingInvoiceTotal.toLocaleString()} total</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Overdue</div>
              <div className="text-xl font-extrabold text-red-600">{loading ? "—" : overdueInvoices.length}</div>
              <div className="text-[10px] text-muted-foreground">{overdueInvoices.length > 0 ? "Action needed" : "All clear"}</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Total Invoices</div>
              <div className="text-xl font-extrabold">{loading ? "—" : invoices.length}</div>
              <div className="text-[10px] text-muted-foreground">${loading ? "—" : invoices.reduce((s, inv) => s + inv.totalAmount, 0).toLocaleString()} billed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit Leak Alerts */}
      {leaks.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-red-600" />
              <span className="text-sm font-bold text-red-700 dark:text-red-400">Profit Leak Alerts</span>
              <Button variant="link" size="sm" className="ml-auto p-0 h-auto text-xs text-red-600" onClick={() => navigate("/shop-calculator")}>
                Open Calculator →
              </Button>
            </div>
            <div className="space-y-2">
              {leaks.map((leak, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 border-b border-red-200/50 dark:border-red-800/30 last:border-0 text-sm cursor-pointer hover:bg-red-100/30 dark:hover:bg-red-900/10 rounded px-2 -mx-2 transition-colors"
                  onClick={() => navigate("/employees")}
                >
                  <div>
                    <span className="font-semibold text-red-700 dark:text-red-400">{leak.employeeName}: </span>
                    <span className="text-muted-foreground">{leak.message}</span>
                  </div>
                  <Badge variant={leak.severity === "high" ? "destructive" : "secondary"} className="text-[10px] self-start sm:self-auto shrink-0">
                    {leak.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shop Day Tracker */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="size-4 text-primary" /> Shop Day Tracker — YTD
              </CardTitle>
              <CardDescription>Each tech's shop day allocation and usage</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/shop-calculator" className="gap-1.5">Calculator <ArrowRight className="size-3" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {employees.filter(e => e.isActive).map(emp => {
              const pct = emp.allowedShopDays > 0 ? (emp.shopDaysUsedYtd / emp.allowedShopDays) * 100 : 0;
              const remaining = emp.allowedShopDays - emp.shopDaysUsedYtd;
              const isWarning = pct >= 80;
              const isDanger = pct >= 100;
              return (
                <div
                  key={emp.id}
                  className={`rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-all ${isDanger ? "border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20" : isWarning ? "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/10" : "border-border hover:border-primary/30"}`}
                  onClick={() => navigate("/employees")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {initials(emp.name)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold leading-tight">{emp.name.split(" ")[0]}</div>
                        <div className="text-[11px] text-muted-foreground capitalize">{emp.role.replace(/_/g, " ")}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-extrabold ${isDanger ? "text-red-600" : isWarning ? "text-amber-600" : "text-foreground"}`}>
                        {emp.shopDaysUsedYtd}/{emp.allowedShopDays}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{remaining > 0 ? `${remaining} left` : "maxed out"}</div>
                    </div>
                  </div>
                  <Progress
                    value={Math.min(pct, 100)}
                    className={`h-2 ${isDanger ? "[&>div]:bg-red-600" : isWarning ? "[&>div]:bg-amber-500" : ""}`}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Schedule + Dispatch */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Weekly Schedule */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="size-4" /> This Week's Schedule
                </CardTitle>
                <CardDescription>Billable job assignments per technician</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/schedule" className="gap-1">Full Schedule <ArrowRight className="size-3" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1 font-medium text-muted-foreground text-xs">Tech</th>
                    {weekDates.map(d => (
                      <th key={d.label} className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekScheduleRows.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                        No scheduled jobs for this week.
                      </td>
                    </tr>
                  )}
                  {weekScheduleRows.map(row => (
                    <tr key={row.name} className="border-b border-muted/50 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => navigate("/schedule")}>
                      <td className="py-2 px-1 font-semibold text-xs">{row.name.split(" ")[0]}</td>
                      {weekDates.map(d => {
                        const entries = row.byDate[d.date] ?? [];
                        const hasJob = entries.length > 0;
                        const label = hasJob
                          ? entries.length === 1
                            ? (entries[0].customerName ?? "").replace(/—.*/, "").trim().split(" ").slice(0, 2).join(" ")
                            : `${entries.length} Jobs`
                          : "—";
                        return (
                          <td key={d.date} className="py-1.5 px-0.5 text-center">
                            <div className={`rounded px-1.5 py-1 text-xs font-medium ${getDayBg(hasJob, !hasJob)}`}>
                              {label}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {employees.filter(e => e.isActive && !weekScheduleRows.find(r => r.name === e.name)).slice(0, 3).map(emp => (
                    <tr key={emp.id} className="border-b border-muted/50 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => navigate("/schedule")}>
                      <td className="py-2 px-1 font-semibold text-xs">{emp.name.split(" ")[0]}</td>
                      {weekDates.map(d => (
                        <td key={d.date} className="py-1.5 px-0.5 text-center">
                          <div className="rounded px-1.5 py-1 text-xs font-medium bg-muted/30 text-muted-foreground">—</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summary && (
              <div className="flex flex-wrap justify-end gap-4 mt-3 text-xs text-muted-foreground">
                <span>Revenue YTD: <strong className="text-emerald-600">${summary.revenueYtd.toLocaleString()}</strong></span>
                <span>Shop Cost: <strong className="text-red-600">${Math.round(summary.shopDayCostYtd).toLocaleString()}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Dispatch */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recent Jobs</CardTitle>
                <CardDescription>{jobs.length} total · ${jobs.reduce((s, j) => s + j.revenue, 0).toLocaleString()} revenue</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/jobs" className="gap-1">All Jobs <ArrowRight className="size-3" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {jobs.slice(0, 6).map(job => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <div className="text-base shrink-0">{jobStatusIcon(job.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold truncate text-primary">{job.customerName}</p>
                      <span className="text-xs font-bold text-emerald-600 shrink-0">${job.revenue.toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{serviceTypeLabel(job.serviceType)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{job.employeeName ?? "Unassigned"} · {job.scheduledDate ?? "TBD"}</span>
                      <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full ${getStatusColor(job.status)}`}>
                        {getStatusLabel(job.status)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {jobs.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground text-center py-4">No jobs found.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
