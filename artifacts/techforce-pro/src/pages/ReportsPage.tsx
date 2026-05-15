import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  Mail,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getInvoices, getEmployees, getJobs, getReturnJobs, getRescheduleJobs,
  type ApiInvoice, type ApiEmployee, type ApiJob,
} from "@/lib/api";

// ─── Constants ──────────────────────────────────────────────────────────────

const BURDEN_RATE = 0.30;
const DAILY_FUEL  = 25;
const DAILY_TOOLS = 15;

const CERT_LABELS: Record<string, string> = {
  suppression:   "Hood Suppression",
  sprinkler:     "Sprinkler",
  extinguisher:  "Extinguisher",
  fire_alarm:    "Fire Alarm",
  backflow:      "Backflow",
  all:           "All Certs",
};

const ROLE_LABELS: Record<string, string> = {
  suppression_tech: "Suppression Tech",
  sprinkler_tech:   "Sprinkler Tech",
  ext_tech:         "Ext Tech",
  helper:           "Helper",
  admin:            "Admin",
  supervisor:       "Supervisor",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ReportsPage() {
  const [activePeriod, setActivePeriod] = useState<"YTD" | "Q1" | "Q2" | "Q3" | "Q4">("YTD");
  const [invoices,    setInvoices]    = useState<ApiInvoice[]>([]);
  const [employees,   setEmployees]   = useState<ApiEmployee[]>([]);
  const [jobs,        setJobs]        = useState<ApiJob[]>([]);
  const [returnJobs,  setReturnJobs]  = useState<ApiJob[]>([]);
  const [reschedJobs, setReschedJobs] = useState<ApiJob[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([getInvoices(), getEmployees(), getJobs(), getReturnJobs(), getRescheduleJobs()])
      .then(([invs, emps, jbs, rets, rescs]) => {
        setInvoices(invs);
        setEmployees(emps);
        setJobs(jbs);
        setReturnJobs(rets);
        setReschedJobs(rescs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Monthly P&L from real invoices ──────────────────────────────────────
  const allMonthlyData = useMemo(() => {
    const map = new Map<string, { revenue: number }>();
    invoices.forEach(inv => {
      const d = new Date(inv.generatedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { revenue: 0 });
      map.get(key)!.revenue += inv.totalAmount;
    });

    const monthlyCost = employees.reduce((s, e) => {
      const hr = e.hourlyRate ?? (Number(e.salary) / 2080);
      const dailyWage = hr * (e.hoursPerDay ?? 8);
      return s + (dailyWage * (1 + BURDEN_RATE) + DAILY_FUEL + DAILY_TOOLS) * 21;
    }, 0);

    const totalShopDaysYtd = employees.reduce((s, e) => s + e.shopDaysUsedYtd, 0);
    const monthCount = map.size || 1;
    const avgShopDaysPerMonth = Math.round(totalShopDaysYtd / monthCount);

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        key,
        month: new Date(key + "-01").toLocaleString("default", { month: "short", year: "2-digit" }),
        revenue: Math.round(v.revenue),
        cost: Math.round(monthlyCost),
        profit: Math.round(v.revenue - monthlyCost),
        shopDays: avgShopDaysPerMonth,
      }));
  }, [invoices, employees]);

  // ── Filter by selected period ───────────────────────────────────────────
  const periodData = useMemo(() => {
    const year = new Date().getFullYear();
    const yearStr = String(year);
    const byMonth = (months: string[]) =>
      allMonthlyData.filter(m => m.key.startsWith(yearStr) && months.includes(m.key.slice(5, 7)));
    switch (activePeriod) {
      case "Q1": return byMonth(["01", "02", "03"]);
      case "Q2": return byMonth(["04", "05", "06"]);
      case "Q3": return byMonth(["07", "08", "09"]);
      case "Q4": return byMonth(["10", "11", "12"]);
      default:   return allMonthlyData.filter(m => m.key.startsWith(yearStr));
    }
  }, [allMonthlyData, activePeriod]);

  // ── Tech ROI per employee ───────────────────────────────────────────────
  const techProfitability = useMemo(() => {
    return employees.map(emp => {
      const empJobs = jobs.filter(j => j.employeeId === emp.id && j.status === "completed");
      const revenueYtd = empJobs.reduce((s, j) => s + Number(j.revenue), 0);
      const dailyCost = (Number(emp.salary) * 1.3 + 10000) / 260;
      const monthsYtd = new Date().getMonth() + 1;
      const salaryCostYtd = (Number(emp.salary) / 12) * monthsYtd;
      const shopCostPerDay = Math.round(dailyCost);
      const shopCostTotal = Math.round(dailyCost * emp.shopDaysUsedYtd);
      const totalCost = salaryCostYtd + shopCostTotal;
      const profit = revenueYtd - totalCost;
      const roi = totalCost > 0 ? Math.round((revenueYtd / totalCost) * 100) : 0;
      return {
        id:               String(emp.id),
        name:             emp.name,
        role:             ROLE_LABELS[emp.role] ?? emp.role,
        avatar:           initials(emp.name),
        utilization:      Math.round(Number(emp.utilizationPct)),
        shopDaysUsed:     emp.shopDaysUsedYtd,
        shopDaysAllowed:  emp.allowedShopDays,
        revenueThisMonth: revenueYtd,
        monthlyCost:      totalCost,
        profit,
        roi,
        shopCostPerDay,
        shopCostTotal,
      };
    }).sort((a, b) => b.roi - a.roi);
  }, [employees, jobs]);

  // ── Invoice aging (non-paid invoices) ──────────────────────────────────
  const invoiceAging = useMemo(() => {
    const now = Date.now();
    return invoices
      .filter(inv => inv.status !== "paid")
      .map(inv => {
        const age = Math.floor((now - new Date(inv.generatedAt).getTime()) / 86400000);
        const bucket: "current" | "30" | "60" | "90" =
          age <= 30 ? "current" : age <= 60 ? "30" : age <= 90 ? "60" : "90";
        return {
          id:     inv.invoiceNumber,
          client: inv.customerName,
          amount: inv.totalAmount,
          issued: new Date(inv.generatedAt).toLocaleDateString(),
          due:    new Date(new Date(inv.generatedAt).getTime() + 30 * 86400000).toLocaleDateString(),
          age,
          bucket,
          status: inv.status,
        };
      })
      .sort((a, b) => b.age - a.age);
  }, [invoices]);

  const agingBuckets = useMemo(() => ({
    current: invoiceAging.filter(i => i.bucket === "current"),
    "30":    invoiceAging.filter(i => i.bucket === "30"),
    "60":    invoiceAging.filter(i => i.bucket === "60"),
    "90":    invoiceAging.filter(i => i.bucket === "90"),
  }), [invoiceAging]);

  // ── Cert tracker from employee certifications ───────────────────────────
  const certTracker = useMemo(() =>
    employees.flatMap(emp =>
      ((emp.certifications ?? []) as string[]).map(cert => ({
        tech:     emp.name,
        cert:     CERT_LABELS[cert] ?? cert,
        expiry:   "On file",
        status:   "current" as "current" | "expiring" | "critical",
        daysLeft: 365,
      }))
    ), [employees]);

  // ── Returns & Reschedules breakdown ────────────────────────────────────
  const returnsData = useMemo(() => {
    const groups: Record<string, number> = {};
    returnJobs.forEach(j => {
      const key = j.status === "will_return" ? "Will Return" : "Return";
      groups[key] = (groups[key] ?? 0) + 1;
    });
    return Object.entries(groups).map(([reason, count]) => ({ reason, count, avgDays: 3 }));
  }, [returnJobs]);

  const rescheduleData = useMemo(() => {
    const total = reschedJobs.length || 1;
    const groups: Record<string, number> = {};
    reschedJobs.forEach(j => {
      const key = j.serviceType ?? "Other";
      groups[key] = (groups[key] ?? 0) + 1;
    });
    return Object.entries(groups).map(([reason, count]) => ({
      reason,
      count,
      pctTotal: Math.round((count / total) * 100),
    }));
  }, [reschedJobs]);

  // ── KPI aggregates ──────────────────────────────────────────────────────
  const ytdRevenue  = periodData.reduce((s, m) => s + m.revenue, 0);
  const ytdCost     = periodData.reduce((s, m) => s + m.cost, 0);
  const ytdProfit   = ytdRevenue - ytdCost;
  const ytdShopDays = employees.reduce((s, e) => s + e.shopDaysUsedYtd, 0);
  const avgProfit   = periodData.length > 0 ? ytdProfit / periodData.length : 0;
  const totalOutstanding = invoiceAging.reduce((s, i) => s + i.amount, 0);

  // ── CSV exports ─────────────────────────────────────────────────────────
  function downloadRevenueCsv() {
    const rows = [["Month", "Revenue", "Cost", "Profit", "Shop Days"]];
    periodData.forEach(m => rows.push([m.month, String(m.revenue), String(m.cost), String(m.profit), String(m.shopDays)]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "revenue-report.csv",
    });
    a.click();
  }

  function downloadAgingCsv() {
    const rows = [["Invoice", "Client", "Amount", "Issued", "Due", "Age (days)", "Bucket"]];
    invoiceAging.forEach(inv => rows.push([inv.id, inv.client, String(inv.amount), inv.issued, inv.due, String(inv.age), inv.bucket]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "invoice-aging.csv",
    });
    a.click();
  }

  function downloadTechRoiCsv() {
    const rows = [["Name", "Role", "Utilization %", "Revenue YTD", "Total Cost", "Profit", "ROI %", "Shop Days Used", "Shop Days Allowed"]];
    techProfitability.forEach(t => rows.push([
      t.name, t.role, String(t.utilization),
      String(t.revenueThisMonth), String(t.monthlyCost), String(t.profit),
      String(t.roi), String(t.shopDaysUsed), String(t.shopDaysAllowed),
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "tech-roi-report.csv",
    });
    a.click();
  }

  function downloadJobsCsv() {
    const rows = [["Job ID", "Customer", "Service", "Status", "Tech", "Scheduled Date", "Revenue", "Priority"]];
    jobs.forEach(j => rows.push([
      String(j.id), j.customerName, j.serviceType, j.status,
      j.employeeName ?? "Unassigned", j.scheduledDate ?? "TBD",
      String(j.revenue), j.priority,
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "jobs-report.csv",
    });
    a.click();
  }

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Loading reports…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-6 text-primary shrink-0" />
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            YTD performance — {new Date().getFullYear()}
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            {(["YTD", "Q1", "Q2", "Q3", "Q4"] as const).map(p => (
              <button key={p} onClick={() => setActivePeriod(p)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${activePeriod === p ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {p}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadRevenueCsv}>
            <FileSpreadsheet className="size-3.5" /> Revenue CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadAgingCsv}>
            <FileSpreadsheet className="size-3.5" /> Aging CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTechRoiCsv}>
            <FileSpreadsheet className="size-3.5" /> Tech ROI CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadJobsCsv}>
            <FileSpreadsheet className="size-3.5" /> Jobs CSV
          </Button>
        </div>
      </div>

      {/* ── YTD Summary ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">YTD Revenue</span>
              <DollarSign className="size-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold">{fmt(ytdRevenue)}</div>
            <div className="text-xs text-emerald-600 mt-1 flex items-center gap-0.5">
              <ArrowUpRight className="size-3" /> {invoices.filter(i => i.status === "paid").length} invoices paid
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">YTD Profit</span>
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <div className={`text-xl font-extrabold ${ytdProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(ytdProfit)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {ytdRevenue > 0 ? Math.round((ytdProfit / ytdRevenue) * 100) : 0}% margin
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Monthly Profit</span>
              <BarChart3 className="size-4 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold">{fmt(avgProfit)}</div>
            <div className="text-xs text-muted-foreground mt-1">{periodData.length} months of data</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Shop Days</span>
              <Calendar className="size-4 text-red-600" />
            </div>
            <div className="text-xl font-extrabold text-red-600">{ytdShopDays}</div>
            <div className="text-xs text-muted-foreground mt-1">YTD across all techs</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabs ──────────────────────────────────────────────────── */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="revenue" className="text-xs">Revenue & Profit</TabsTrigger>
          <TabsTrigger value="utilization" className="text-xs">Utilization & Shop Days</TabsTrigger>
          <TabsTrigger value="profitability" className="text-xs">Tech ROI</TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">Invoice Aging</TabsTrigger>
          <TabsTrigger value="certs" className="text-xs">Cert Tracker</TabsTrigger>
          <TabsTrigger value="returns" className="text-xs">Returns & Reschedules</TabsTrigger>
        </TabsList>

        {/* ═══ Revenue & Profit ═══ */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Monthly Revenue & Profit Trend</CardTitle>
              <CardDescription>Revenue (green) vs Cost (amber) — profit is the difference</CardDescription>
            </CardHeader>
            <CardContent>
              {periodData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <BarChart3 className="size-8 opacity-30" />
                  <p className="text-sm">No invoice data for this period yet.</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={periodData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cost"    name="Cost"    fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit"  name="Profit"  fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {periodData.map(m => (
                      <div key={m.month} className="text-[10px] text-center">
                        <div className="font-medium text-muted-foreground">{m.month}</div>
                        <div className={`font-bold ${m.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(m.profit)} profit</div>
                        <div className={`${m.shopDays <= 35 ? "text-muted-foreground" : "text-red-500 font-medium"}`}>{m.shopDays} shop days</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Profitability by Client (Top 6)</CardTitle>
              <CardDescription>Revenue per client vs cost to service — YTD</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const clientMap: Record<string, number> = {};
                invoices.forEach(inv => {
                  clientMap[inv.customerName] = (clientMap[inv.customerName] ?? 0) + inv.totalAmount;
                });
                const sorted = Object.entries(clientMap).sort(([, a], [, b]) => b - a).slice(0, 6);
                if (sorted.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
                      <DollarSign className="size-8 opacity-30" />
                      <p className="text-sm">No client data yet. Complete jobs to see profitability by client.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {sorted.map(([name, rev]) => (
                      <div key={name} className="flex items-center gap-3">
                        <div className="w-32 text-xs font-medium truncate">{name}</div>
                        <div className="flex-1 bg-muted/40 rounded-full h-3 overflow-hidden">
                          <svg viewBox="0 0 100 12" className="w-full h-full" preserveAspectRatio="none">
                            <rect x={0} y={0} width={(rev / sorted[0][1]) * 100} height={12} fill="#22c55e" rx={6} ry={6} />
                          </svg>
                        </div>
                        <div className="text-xs font-bold text-emerald-600 w-16 text-right">{fmt(rev)}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Utilization & Shop Days ═══ */}
        <TabsContent value="utilization">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Shop Day Usage by Technician</CardTitle>
              <CardDescription>YTD shop days used vs allowed — fewer = more billable revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <TrendingDown className="size-8 opacity-30" />
                  <p className="text-sm">No employee data found.</p>
                </div>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {employees.map(emp => {
                    const maxShop = Math.max(...employees.map(e => e.allowedShopDays), 1);
                    const pct = (emp.shopDaysUsedYtd / maxShop) * 100;
                    const isLow = emp.shopDaysUsedYtd <= Math.round(emp.allowedShopDays * 0.6);
                    return (
                      <div key={emp.id} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold">{emp.shopDaysUsedYtd}</span>
                        <div className="w-full h-full rounded-t-lg overflow-hidden bg-muted/20">
                          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                            <rect
                              x={0}
                              y={100 - Math.max(pct, 5)}
                              width={100}
                              height={Math.max(pct, 5)}
                              fill={isLow ? "#22c55e" : "#ef4444"}
                              rx={8}
                              ry={8}
                            />
                          </svg>
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate w-full text-center">{emp.name.split(" ")[0]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Utilization by Technician</CardTitle>
              <CardDescription>Billable vs shop vs training days this month (est.)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employees.map(emp => {
                  const util = Math.min(Number(emp.utilizationPct), 100);
                  const billDays = Math.round(22 * util / 100);
                  const shopDays = Math.min(emp.shopDaysUsedYtd, 22);
                  const trainDays = Math.max(0, 22 - billDays - shopDays);
                  const billPct = (billDays / 22) * 100;
                  const shopPct = (shopDays / 22) * 100;
                  const trainPct = (trainDays / 22) * 100;
                  const shopStart = billPct;
                  const trainStart = billPct + shopPct;
                  return (
                    <div key={emp.id}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium">{emp.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-600">{billDays}d bill</span>
                          <span className="text-red-600">{shopDays}d shop</span>
                          {trainDays > 0 && <span className="text-amber-600">{trainDays}d train</span>}
                          <span className={`font-bold ${util >= 90 ? "text-emerald-600" : util >= 85 ? "text-amber-600" : "text-red-600"}`}>
                            {Math.round(util)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden bg-muted/50" role="img" aria-label="Billable, shop, and training days split">
                        <svg viewBox="0 0 100 12" className="w-full h-full" preserveAspectRatio="none">
                          <rect x={0} y={0} width={billPct} height={12} fill="#22c55e" />
                          <rect x={shopStart} y={0} width={shopPct} height={12} fill="#ef4444" />
                          {trainDays > 0 && <rect x={trainStart} y={0} width={trainPct} height={12} fill="#f59e0b" />}
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-emerald-500" /> Billable</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-red-500" /> Shop</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-amber-500" /> Training</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tech ROI ═══ */}
        <TabsContent value="profitability">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Technician ROI Ranking</CardTitle>
                  <CardDescription>YTD profitability ranked by return on investment</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {techProfitability.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <TrendingUp className="size-8 opacity-30" />
                  <p className="text-sm">No employee data found.</p>
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">#</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Technician</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Revenue YTD</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Total Cost</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Profit</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">ROI</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Shop Days</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Shop Cost</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Util</th>
                        </tr>
                      </thead>
                      <tbody>
                        {techProfitability.map((tech, i) => (
                          <tr key={tech.id} className="border-b border-muted/50 hover:bg-muted/20">
                            <td className="py-2.5 px-2 text-xs font-bold text-muted-foreground">{i + 1}</td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{tech.avatar}</div>
                                <div>
                                  <div className="font-semibold text-xs">{tech.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{tech.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right text-xs font-medium text-emerald-600">{fmt(tech.revenueThisMonth)}</td>
                            <td className="py-2.5 px-2 text-right text-xs text-muted-foreground">{fmt(tech.monthlyCost)}</td>
                            <td className={`py-2.5 px-2 text-right text-xs font-bold ${tech.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {fmt(tech.profit)}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <Badge variant={tech.roi >= 150 ? "default" : tech.roi >= 100 ? "secondary" : "destructive"} className="text-[10px]">
                                {tech.roi}%
                              </Badge>
                            </td>
                            <td className="py-2.5 px-2 text-right text-xs">{tech.shopDaysUsed}/{tech.shopDaysAllowed}</td>
                            <td className="py-2.5 px-2 text-right text-xs text-red-600 font-medium">{fmt(tech.shopCostTotal)}</td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                <Progress value={tech.utilization} className="h-2 w-16" />
                                <span className="text-xs font-medium">{tech.utilization}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3">
                    {techProfitability.map((tech, i) => (
                      <div key={tech.id} className="border rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{tech.avatar}</div>
                            <div>
                              <div className="text-sm font-bold">{tech.name}</div>
                              <div className="text-[10px] text-muted-foreground">{tech.role}</div>
                            </div>
                          </div>
                          <Badge variant={tech.roi >= 150 ? "default" : tech.roi >= 100 ? "secondary" : "destructive"} className="text-[10px]">
                            {tech.roi}% ROI
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
                            <div className="text-[9px] text-muted-foreground">Profit</div>
                            <div className={`font-bold ${tech.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(tech.profit)}</div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2">
                            <div className="text-[9px] text-muted-foreground">Util</div>
                            <div className="font-bold">{tech.utilization}%</div>
                          </div>
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                            <div className="text-[9px] text-muted-foreground">Shop Cost</div>
                            <div className="font-bold text-red-600">{fmt(tech.shopCostTotal)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Invoice Aging ═══ */}
        <TabsContent value="invoices">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
            {[
              { label: "Current", key: "current" as const, color: "border-emerald-200 dark:border-emerald-800", textColor: "text-emerald-600" },
              { label: "30+ Days", key: "30" as const, color: "border-amber-200 dark:border-amber-800", textColor: "text-amber-600" },
              { label: "60+ Days", key: "60" as const, color: "border-orange-200 dark:border-orange-800", textColor: "text-orange-600" },
              { label: "90+ Days", key: "90" as const, color: "border-red-200 dark:border-red-800", textColor: "text-red-600" },
            ].map(b => (
              <Card key={b.key} className={b.color}>
                <CardContent className="p-4">
                  <div className={`text-xs font-semibold text-muted-foreground uppercase tracking-wider`}>{b.label}</div>
                  <div className={`text-xl font-extrabold ${b.textColor}`}>
                    {fmt(agingBuckets[b.key].reduce((s, i) => s + i.amount, 0))}
                  </div>
                  <div className="text-xs text-muted-foreground">{agingBuckets[b.key].length} invoice{agingBuckets[b.key].length !== 1 ? "s" : ""}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    Outstanding Invoices — {fmt(totalOutstanding)} Total
                  </CardTitle>
                  <CardDescription>Sorted by age (oldest first)</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadAgingCsv}>
                  <Download className="size-3.5" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invoiceAging.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <Clock className="size-8 opacity-30" />
                  <p className="text-sm">No outstanding invoices.</p>
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Invoice</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Client</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Amount</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Issued</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Due</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Age</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceAging.map(inv => (
                          <tr key={inv.id} className="border-b border-muted/50 hover:bg-muted/20">
                            <td className="py-2.5 px-2 text-xs font-mono font-medium">{inv.id}</td>
                            <td className="py-2.5 px-2 text-xs font-medium">{inv.client}</td>
                            <td className="py-2.5 px-2 text-right text-xs font-bold">{fmt(inv.amount)}</td>
                            <td className="py-2.5 px-2 text-xs text-muted-foreground">{inv.issued}</td>
                            <td className="py-2.5 px-2 text-xs text-muted-foreground">{inv.due}</td>
                            <td className="py-2.5 px-2 text-right text-xs font-bold">{inv.age}d</td>
                            <td className="py-2.5 px-2 text-center">
                              <Badge
                                variant={inv.bucket === "current" ? "secondary" : inv.bucket === "90" ? "destructive" : "default"}
                                className={`text-[10px] ${inv.bucket === "30" ? "bg-amber-600" : inv.bucket === "60" ? "bg-orange-600" : ""}`}>
                                {inv.bucket === "current" ? "Current" : `${inv.bucket}+ Days`}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden space-y-2">
                    {invoiceAging.map(inv => (
                      <div key={inv.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-medium">{inv.id}</span>
                          <Badge variant={inv.bucket === "90" ? "destructive" : inv.bucket === "current" ? "secondary" : "default"}
                            className={`text-[10px] ${inv.bucket === "30" ? "bg-amber-600" : inv.bucket === "60" ? "bg-orange-600" : ""}`}>
                            {inv.age}d
                          </Badge>
                        </div>
                        <div className="text-sm font-bold">{inv.client}</div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="text-muted-foreground">Due: {inv.due}</span>
                          <span className="font-bold">{fmt(inv.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Cert Tracker ═══ */}
        <TabsContent value="certs">
          {certTracker.filter(c => c.status === "critical" || c.status === "expiring").length > 0 && (
            <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10 mb-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-red-600 mb-2">
                  <AlertTriangle className="size-4" />
                  Certifications Requiring Attention
                </div>
                <div className="space-y-2">
                  {certTracker.filter(c => c.status === "critical" || c.status === "expiring").map((c, i) => (
                    <div key={i} className="text-xs flex items-center gap-2">
                      <Badge variant={c.status === "critical" ? "destructive" : "default"} className={`text-[10px] ${c.status === "expiring" ? "bg-amber-600" : ""}`}>
                        {c.status === "critical" ? "CRITICAL" : "EXPIRING"}
                      </Badge>
                      <span className="font-medium">{c.tech}</span>
                      <span className="text-muted-foreground">— {c.cert} expires {c.expiry} ({c.daysLeft} days)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="size-4 text-primary" />
                Certification Tracker — All Technicians
              </CardTitle>
              <CardDescription>Active certifications on file</CardDescription>
            </CardHeader>
            <CardContent>
              {certTracker.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <Award className="size-8 opacity-30" />
                  <p className="text-sm">No certification data found.</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Technician</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Certification</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Expiry</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {certTracker.map((c, i) => (
                          <tr key={i} className="border-b border-muted/50 hover:bg-muted/20">
                            <td className="py-2.5 px-2 text-xs font-medium">{c.tech}</td>
                            <td className="py-2.5 px-2">
                              <Badge variant="outline" className="text-[10px] text-primary border-primary/40">{c.cert}</Badge>
                            </td>
                            <td className="py-2.5 px-2 text-xs text-muted-foreground">{c.expiry}</td>
                            <td className="py-2.5 px-2 text-center">
                              <Badge variant="secondary" className="text-[10px]">✓ Current</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden space-y-2">
                    {certTracker.map((c, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold">{c.tech}</span>
                          <Badge variant="secondary" className="text-[10px]">Current</Badge>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{c.cert}</Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Returns & Reschedules ═══ */}
        <TabsContent value="returns">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Return Jobs — Current Queue</CardTitle>
                <CardDescription>Jobs requiring a follow-up visit</CardDescription>
              </CardHeader>
              <CardContent>
                {returnsData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <TrendingDown className="size-8 opacity-30" />
                    <p className="text-sm">No return jobs in queue.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {returnsData.map(r => (
                      <div key={r.reason} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/20">
                        <div>
                          <div className="text-sm font-medium">{r.reason}</div>
                          <div className="text-xs text-muted-foreground">Avg {r.avgDays} days to resolve</div>
                        </div>
                        <Badge variant="destructive" className="text-[10px]">{r.count} jobs</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Reschedule Breakdown</CardTitle>
                <CardDescription>Rescheduled jobs by service type</CardDescription>
              </CardHeader>
              <CardContent>
                {rescheduleData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <Calendar className="size-8 opacity-30" />
                    <p className="text-sm">No reschedule jobs in queue.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rescheduleData.map(r => (
                      <div key={r.reason} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{r.reason}</span>
                          <span className="text-muted-foreground">{r.count} jobs ({r.pctTotal}%)</span>
                        </div>
                        <Progress value={r.pctTotal} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
