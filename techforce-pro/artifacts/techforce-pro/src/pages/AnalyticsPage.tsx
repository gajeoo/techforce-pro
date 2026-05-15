import { useState, useEffect, useMemo } from "react";
import {
  BarChart3, DollarSign, TrendingUp, TrendingDown, Activity,
  Download, Users, AlertCircle, CheckCircle2, Clock, FileText,
  Target,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { monthlyRevenue } from "@/lib/mockData";
import { getInvoices, getEmployees, type ApiInvoice, type ApiEmployee } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtK = (n: number) => (Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`);

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
const STATUS_COLORS: Record<string, string> = {
  paid: "#22c55e",
  sent: "#3b82f6",
  draft: "#94a3b8",
  overdue: "#ef4444",
};

const SERVICE_REVENUE: { name: string; revenue: number; jobs: number }[] = [];

const EXPENSES_BREAKDOWN: { name: string; value: number; color: string }[] = [];

export function AnalyticsPage() {
  const [period, setPeriod] = useState<"ytd" | "q1" | "q2" | "q3">("ytd");
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [apiEmployees, setApiEmployees] = useState<ApiEmployee[]>([]);

  useEffect(() => {
    getInvoices().then(setInvoices).catch(() => {});
    getEmployees().then(setApiEmployees).catch(() => {});
  }, []);

  const periodData = useMemo(() => {
    if (period === "q1") return monthlyRevenue.slice(0, 3);
    if (period === "q2") return monthlyRevenue.slice(3, 6);
    if (period === "q3") return monthlyRevenue.slice(0, 0);
    return monthlyRevenue;
  }, [period]);

  const ytdRevenue = useMemo(() => periodData.reduce((s, m) => s + m.revenue, 0), [periodData]);
  const ytdCost = useMemo(() => periodData.reduce((s, m) => s + m.cost, 0), [periodData]);
  const ytdProfit = ytdRevenue - ytdCost;
  const ytdMargin = ytdRevenue > 0 ? (ytdProfit / ytdRevenue) * 100 : 0;
  const ytdShopDays = useMemo(() => periodData.reduce((s, m) => s + m.shopDays, 0), [periodData]);

  const invoiceStatusCounts = useMemo(() => {
    const counts: Record<string, { count: number; amount: number }> = {};
    invoices.forEach(inv => {
      if (!counts[inv.status]) counts[inv.status] = { count: 0, amount: 0 };
      counts[inv.status].count++;
      counts[inv.status].amount += inv.totalAmount;
    });
    return Object.entries(counts).map(([status, d]) => ({ name: status, ...d, color: STATUS_COLORS[status] ?? "#94a3b8" }));
  }, [invoices]);

  const techPerformance = useMemo(() => {
    const empSource = apiEmployees.length > 0 ? apiEmployees : [];
    return empSource.map(e => {
      const salary = Number(e.salary) || 0;
      const billRate = Number(e.billableRate) || 0;
      const utilization = Number(e.utilizationPct) || 0;
      const billableDays = Math.round((utilization / 100) * 21);
      const revenue = billableDays * billRate * 8;
      const cost = salary * 1.3 / 12;
      const profit = revenue - cost;
      return {
        name: e.name.split(" ")[0],
        revenue: Math.round(revenue),
        cost: Math.round(cost),
        profit: Math.round(profit),
        utilization,
        shopDays: e.shopDaysUsedYtd ?? 0,
      };
    }).filter(t => t.revenue > 0);
  }, [apiEmployees]);

  const techData = techPerformance;

  const cashflowData = periodData.map(m => ({
    month: m.month,
    inflow: m.revenue,
    outflow: -m.cost,
    net: m.profit,
  }));

  function downloadCsv() {
    const rows = [["Month","Revenue","Cost","Profit","Shop Days"]];
    periodData.forEach(m => rows.push([m.month, m.revenue.toString(), m.cost.toString(), m.profit.toString(), m.shopDays.toString()]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `analytics-${period}.csv`,
    });
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-6 text-primary shrink-0" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Comprehensive financial and operational insights — income, expenses, and performance
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            {(["ytd", "q1", "q2", "q3"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all uppercase ${period === p ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadCsv}>
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Revenue", value: ytdRevenue, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", change: "+22%" },
          { label: "Total Expenses", value: ytdCost, icon: TrendingDown, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", change: "+8%" },
          { label: "Net Profit", value: ytdProfit, icon: TrendingUp, color: ytdProfit >= 0 ? "text-emerald-600" : "text-red-600", bg: ytdProfit >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30", change: "+41%" },
          { label: "Profit Margin", value: null, display: `${ytdMargin.toFixed(1)}%`, icon: Target, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", change: "+6.2pp" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                <div className={`size-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`size-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="text-xl font-extrabold">{kpi.display ?? fmt(kpi.value ?? 0)}</div>
              <div className="text-xs text-emerald-600 mt-1">{kpi.change} vs last year</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: Revenue/Cost/Profit Trend + Expense Breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Revenue, Cost &amp; Profit Trend
            </CardTitle>
            <CardDescription>Monthly breakdown — bars show revenue &amp; cost, line shows net profit</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={periodData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="bar" tickFormatter={v => fmtK(v)} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="line" orientation="right" tickFormatter={v => fmtK(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => [fmt(v), name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="bar" dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4,4,0,0]} opacity={0.85} />
                <Bar yAxisId="bar" dataKey="cost" name="Cost" fill="#f59e0b" radius={[4,4,0,0]} opacity={0.85} />
                <Line yAxisId="line" type="monotone" dataKey="profit" name="Net Profit" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: "#3b82f6" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="size-4 text-amber-500" />
              Expense Breakdown
            </CardTitle>
            <CardDescription>YTD cost distribution by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={EXPENSES_BREAKDOWN}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {EXPENSES_BREAKDOWN.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {EXPENSES_BREAKDOWN.map(e => (
                <div key={e.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="text-muted-foreground">{e.name}</span>
                  </div>
                  <span className="font-semibold">{fmt(e.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Tech Performance + Invoice Status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="size-4 text-blue-500" />
              Technician Revenue Performance
            </CardTitle>
            <CardDescription>Monthly revenue vs cost per technician</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={techData} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtK(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[0,4,4,0]} />
                <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Invoice Status Distribution
            </CardTitle>
            <CardDescription>Count and value by status</CardDescription>
          </CardHeader>
          <CardContent>
            {invoiceStatusCounts.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={invoiceStatusCounts}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {invoiceStatusCounts.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} invoices`]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {invoiceStatusCounts.map(s => (
                    <div key={s.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <div className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <div>
                        <div className="text-xs capitalize font-medium">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground">{s.count} · {fmt(s.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading invoice data…</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Service Revenue + Cash Flow */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="size-4 text-emerald-500" />
              Revenue by Service Type
            </CardTitle>
            <CardDescription>YTD revenue breakdown by service category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={SERVICE_REVENUE} layout="vertical" margin={{ top: 5, right: 10, left: 70, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip
                  formatter={(v: number, name: string) => [name === "revenue" ? fmt(v) : `${v} jobs`, name === "revenue" ? "Revenue" : "Jobs"]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="revenue" name="revenue" fill="#22c55e" radius={[0,4,4,0]}>
                  {SERVICE_REVENUE.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="size-4 text-blue-500" />
              Monthly Cash Flow
            </CardTitle>
            <CardDescription>Inflows (green) vs outflows (amber), net profit line</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={cashflowData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => fmtK(Math.abs(v))} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(Math.abs(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="inflow" name="Revenue" fill="url(#inflowGrad)" stroke="#22c55e" strokeWidth={2} />
                <Area type="monotone" dataKey="net" name="Net Profit" fill="url(#netGrad)" stroke="#3b82f6" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tech Deep Dive Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Technician Deep Dive
          </CardTitle>
          <CardDescription>Monthly revenue, cost, profit, utilization, and shop days per tech</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Technician</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Revenue</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Cost</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Profit</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Margin</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Utilization</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Shop Days</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {techData.map(t => {
                  const margin = t.revenue > 0 ? (t.profit / t.revenue) * 100 : 0;
                  return (
                    <tr key={t.name} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{t.name[0]}</div>
                          <span className="font-semibold">{t.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-emerald-600">{fmt(t.revenue)}</td>
                      <td className="py-3 px-3 text-right text-amber-600">{fmt(t.cost)}</td>
                      <td className={`py-3 px-3 text-right font-bold ${t.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(t.profit)}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-semibold ${margin >= 30 ? "text-emerald-600" : margin >= 15 ? "text-amber-600" : "text-red-600"}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(t.utilization, 100)}%` }} />
                          </div>
                          <span className={t.utilization >= 75 ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                            {t.utilization}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant={t.shopDays > 10 ? "destructive" : "secondary"} className="text-[10px]">
                          {t.shopDays} days
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {t.profit > 0
                          ? <CheckCircle2 className="size-4 text-emerald-500 mx-auto" />
                          : <AlertCircle className="size-4 text-red-500 mx-auto" />}
                      </td>
                    </tr>
                  );
                })}
                {techData.length === 0 && (
                  <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Loading employee data…</td></tr>
                )}
              </tbody>
              {techData.length > 0 && (
                <tfoot className="border-t border-border bg-muted/20">
                  <tr>
                    <td className="py-2.5 px-3 font-bold">Totals</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{fmt(techData.reduce((s, t) => s + t.revenue, 0))}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-600">{fmt(techData.reduce((s, t) => s + t.cost, 0))}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{fmt(techData.reduce((s, t) => s + t.profit, 0))}</td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {techData.length > 0 ? (techData.reduce((s, t) => s + t.profit, 0) / Math.max(techData.reduce((s, t) => s + t.revenue, 0), 1) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      {techData.length > 0 ? Math.round(techData.reduce((s, t) => s + t.utilization, 0) / techData.length) : 0}% avg
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">{techData.reduce((s, t) => s + t.shopDays, 0)} days</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Shop Day Cost Impact */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="size-4 text-red-500" />
                Shop Day Cost Impact
              </CardTitle>
              <CardDescription>YTD shop days used per tech — each shop day represents lost billable revenue</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total Shop Day Cost</div>
              <div className="text-base font-extrabold text-red-600">{fmt(ytdShopDays * 420)}</div>
              <div className="text-[10px] text-muted-foreground">@ $420/day avg burden</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={techData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v} days`, "Shop Days"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="shopDays" name="Shop Days" radius={[4,4,0,0]}>
                {techData.map((t, i) => (
                  <Cell key={i} fill={t.shopDays > 10 ? "#ef4444" : t.shopDays > 5 ? "#f59e0b" : "#22c55e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs justify-center text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-emerald-500" /> 0–5 days (good)</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-amber-500" /> 6–10 days (watch)</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-red-500" /> 10+ days (over limit)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
