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
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
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
import { employees, monthlyRevenue } from "@/lib/mockData";

// ─── Invoice aging data ────────────────────────────────────────────────

const invoiceAging: { id: string; client: string; amount: number; issued: string; due: string; age: number; bucket: "current" | "30" | "60" | "90" }[] = [];

const agingBuckets = {
  current: invoiceAging.filter(i => i.bucket === "current"),
  "30": invoiceAging.filter(i => i.bucket === "30"),
  "60": invoiceAging.filter(i => i.bucket === "60"),
  "90": invoiceAging.filter(i => i.bucket === "90"),
};

// ─── Cert tracker data ──────────────────────────────────────────────────

const certTracker: { tech: string; cert: string; expiry: string; status: "current" | "expiring" | "critical"; daysLeft: number }[] = [];

// ─── Returns & Reschedules Summary ──────────────────────────────────────

const returnsData: { reason: string; count: number; avgDays: number }[] = [];
const rescheduleData: { reason: string; count: number; pctTotal: number }[] = [];

const techProfitability: {
  id: string; name: string; role: string; avatar: string;
  utilization: number; shopDaysUsed: number; shopDaysAllowed: number;
  revenueThisMonth: number; monthlyCost: number; profit: number;
  roi: number; shopCostPerDay: number; shopCostTotal: number;
}[] = [];

// ─── Component ──────────────────────────────────────────────────────────

export function ReportsPage() {
  const [activePeriod, setActivePeriod] = useState<"YTD" | "Q1" | "Q2" | "Q3">("YTD");

  const periodMonths: Record<string, string[]> = {
    YTD: ["Jan","Feb","Mar","Apr","May","Jun"],
    Q1: ["Jan","Feb","Mar"],
    Q2: ["Apr","May","Jun"],
    Q3: ["Jul","Aug","Sep"],
  };

  const filteredRevenue = activePeriod === "YTD"
    ? monthlyRevenue
    : monthlyRevenue.filter(m => periodMonths[activePeriod]?.includes(m.month));

  function downloadRevenueCsv() {
    const rows = [["Month","Revenue","Cost","Profit","Shop Days"]];
    filteredRevenue.forEach(m => rows.push([m.month, m.revenue.toString(), m.cost.toString(), m.profit.toString(), m.shopDays.toString()]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "revenue-report.csv" });
    a.click();
  }

  function downloadAgingCsv() {
    const rows = [["Invoice","Client","Amount","Issued","Due","Age (days)","Bucket"]];
    [...invoiceAging].sort((a,b) => b.age - a.age).forEach(inv => rows.push([inv.id, inv.client, inv.amount.toString(), inv.issued, inv.due, inv.age.toString(), inv.bucket]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "invoice-aging.csv" });
    a.click();
  }

  const ytdRevenue = filteredRevenue.reduce((s, m) => s + m.revenue, 0);
  const ytdCost = filteredRevenue.reduce((s, m) => s + m.cost, 0);
  const ytdProfit = ytdRevenue - ytdCost;
  const ytdShopDays = filteredRevenue.reduce((s, m) => s + m.shopDays, 0);
  const maxMonthlyRevenue = Math.max(...filteredRevenue.map(m => m.revenue), 1);
  const avgProfit = filteredRevenue.length > 0 ? ytdProfit / filteredRevenue.length : 0;

  const totalOutstanding = invoiceAging.reduce((s, i) => s + i.amount, 0);

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
            YTD performance through June 2026
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            {(["YTD","Q1","Q2","Q3"] as const).map(p => (
              <button key={p} onClick={() => setActivePeriod(p)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${activePeriod === p ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {p}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadRevenueCsv}>
            <FileSpreadsheet className="size-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Mail className="size-3.5" /> Schedule
          </Button>
        </div>
      </div>

      {/* ── YTD Summary ────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">YTD Revenue</span>
              <DollarSign className="size-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold">${(ytdRevenue / 1000).toFixed(0)}K</div>
            <div className="text-xs text-emerald-600 mt-1 flex items-center gap-0.5">
              <ArrowUpRight className="size-3" /> +22% vs last year
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">YTD Profit</span>
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-600">${(ytdProfit / 1000).toFixed(0)}K</div>
            <div className="text-xs text-muted-foreground mt-1">{ytdRevenue > 0 ? Math.round((ytdProfit / ytdRevenue) * 100) : 0}% margin</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Monthly Profit</span>
              <BarChart3 className="size-4 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold">${(avgProfit / 1000).toFixed(1)}K</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Shop Days</span>
              <Calendar className="size-4 text-red-600" />
            </div>
            <div className="text-xl font-extrabold text-red-600">{ytdShopDays}</div>
            <div className="text-xs text-emerald-600 mt-1 flex items-center gap-0.5">
              <TrendingDown className="size-3" /> −14% vs last year
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabs ─────────────────────────────────────────────── */}
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
              <CardDescription>Revenue (green) vs Cost (gray) — profit is the difference</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={filteredRevenue} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4,4,0,0]} />
                  <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[4,4,0,0]} />
                  <Bar dataKey="profit" name="Profit" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {filteredRevenue.map(m => (
                  <div key={m.month} className="text-[10px] text-center">
                    <div className="font-medium text-muted-foreground">{m.month}</div>
                    <div className="font-bold text-emerald-600">${(m.profit/1000).toFixed(1)}K profit</div>
                    <div className={`${m.shopDays <= 35 ? "text-muted-foreground" : "text-red-500 font-medium"}`}>{m.shopDays} shop days</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Profitability by Client */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Profitability by Client (Top 6)</CardTitle>
              <CardDescription>Revenue per client vs cost to service — YTD</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
                <DollarSign className="size-8 opacity-30" />
                <p className="text-sm">No client data yet. Complete jobs to see profitability by client.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Utilization & Shop Days ═══ */}
        <TabsContent value="utilization">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Shop Day Trend (Monthly)</CardTitle>
              <CardDescription>Fewer shop days = more billable revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-40">
                {monthlyRevenue.map(m => {
                  const maxShop = Math.max(...monthlyRevenue.map(r => r.shopDays));
                  const pct = (m.shopDays / maxShop) * 100;
                  const isLow = m.shopDays <= 35;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-bold">{m.shopDays}</span>
                      <div className="w-full rounded-t-lg relative" style={{ height: `${pct}%` }}>
                        <div className={`w-full h-full rounded-t-lg ${isLow ? "bg-emerald-500" : "bg-red-500"}`} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{m.month}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-muted-foreground text-center">
                ↓ Shop days trending down from 48 (Feb) to 30 (Jun) — 37.5% improvement
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Utilization by Technician</CardTitle>
              <CardDescription>Billable vs shop vs training days — this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employees.map(emp => {
                  const billDays = Math.round(22 * emp.utilization / 100);
                  const shopDays = emp.shopDaysUsed;
                  const trainDays = Math.max(0, 22 - billDays - shopDays);
                  return (
                    <div key={emp.id}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium">{emp.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-600">{billDays}d bill</span>
                          <span className="text-red-600">{shopDays}d shop</span>
                          {trainDays > 0 && <span className="text-amber-600">{trainDays}d train</span>}
                          <span className={`font-bold ${emp.utilization >= 90 ? "text-emerald-600" : emp.utilization >= 85 ? "text-amber-600" : "text-red-600"}`}>
                            {emp.utilization}%
                          </span>
                        </div>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden bg-muted/50">
                        <div className="bg-emerald-500" style={{ width: `${(billDays / 22) * 100}%` }} />
                        <div className="bg-red-500" style={{ width: `${(shopDays / 22) * 100}%` }} />
                        {trainDays > 0 && <div className="bg-amber-500" style={{ width: `${(trainDays / 22) * 100}%` }} />}
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
                  <CardDescription>Monthly profitability ranked by return on investment</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">#</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Technician</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Revenue</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Cost</th>
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
                        <td className="py-2.5 px-2 text-right text-xs font-medium text-emerald-600">${tech.revenueThisMonth.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right text-xs text-muted-foreground">${Math.round(tech.monthlyCost).toLocaleString()}</td>
                        <td className={`py-2.5 px-2 text-right text-xs font-bold ${tech.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          ${Math.round(tech.profit).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <Badge variant={tech.roi >= 150 ? "default" : tech.roi >= 100 ? "secondary" : "destructive"} className="text-[10px]">
                            {tech.roi}%
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2 text-right text-xs">{tech.shopDaysUsed}/{tech.shopDaysAllowed}</td>
                        <td className="py-2.5 px-2 text-right text-xs text-red-600 font-medium">${tech.shopCostTotal.toLocaleString()}</td>
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
                        <div className={`font-bold ${tech.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>${Math.round(tech.profit).toLocaleString()}</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <div className="text-[9px] text-muted-foreground">Util</div>
                        <div className="font-bold">{tech.utilization}%</div>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                        <div className="text-[9px] text-muted-foreground">Shop Cost</div>
                        <div className="font-bold text-red-600">${tech.shopCostTotal}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Invoice Aging ═══ */}
        <TabsContent value="invoices">
          {/* Aging Summary Cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current</div>
                <div className="text-xl font-extrabold text-emerald-600">
                  ${(agingBuckets.current.reduce((s, i) => s + i.amount, 0) / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-muted-foreground">{agingBuckets.current.length} invoices</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">30+ Days</div>
                <div className="text-xl font-extrabold text-amber-600">
                  ${(agingBuckets["30"].reduce((s, i) => s + i.amount, 0) / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-muted-foreground">{agingBuckets["30"].length} invoices</div>
              </CardContent>
            </Card>
            <Card className="border-orange-200 dark:border-orange-800">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">60+ Days</div>
                <div className="text-xl font-extrabold text-orange-600">
                  ${(agingBuckets["60"].reduce((s, i) => s + i.amount, 0) / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-muted-foreground">{agingBuckets["60"].length} invoices</div>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">90+ Days</div>
                <div className="text-xl font-extrabold text-red-600">
                  ${(agingBuckets["90"].reduce((s, i) => s + i.amount, 0) / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-muted-foreground">{agingBuckets["90"].length} invoices</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    Outstanding Invoices — ${totalOutstanding.toLocaleString()} Total
                  </CardTitle>
                  <CardDescription>Sorted by age (oldest first)</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadAgingCsv}>
                  <Download className="size-3.5" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
                    {[...invoiceAging].sort((a, b) => b.age - a.age).map(inv => (
                      <tr key={inv.id} className="border-b border-muted/50 hover:bg-muted/20">
                        <td className="py-2.5 px-2 text-xs font-mono font-medium">{inv.id}</td>
                        <td className="py-2.5 px-2 text-xs font-medium">{inv.client}</td>
                        <td className="py-2.5 px-2 text-right text-xs font-bold">${inv.amount.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">{inv.issued}</td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">{inv.due}</td>
                        <td className="py-2.5 px-2 text-right text-xs font-bold">{inv.age}d</td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant={inv.bucket === "current" ? "secondary" : inv.bucket === "30" ? "default" : inv.bucket === "60" ? "default" : "destructive"}
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
                {[...invoiceAging].sort((a, b) => b.age - a.age).map(inv => (
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
                      <span className="font-bold">${inv.amount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Cert Tracker ═══ */}
        <TabsContent value="certs">
          {/* Alert for critical certs */}
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
              <CardDescription>Cert expiry dates, training needed, compliance status</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Technician</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Certification</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Expiry</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Days Left</th>
                      <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certTracker.map((c, i) => (
                      <tr key={i} className={`border-b border-muted/50 hover:bg-muted/20 ${c.status === "critical" ? "bg-red-50/50 dark:bg-red-950/10" : c.status === "expiring" ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
                        <td className="py-2.5 px-2 text-xs font-medium">{c.tech}</td>
                        <td className="py-2.5 px-2">
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/40">{c.cert}</Badge>
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">{c.expiry}</td>
                        <td className="py-2.5 px-2 text-right text-xs font-bold">
                          <span className={c.status === "critical" ? "text-red-600" : c.status === "expiring" ? "text-amber-600" : "text-emerald-600"}>
                            {c.daysLeft}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant={c.status === "critical" ? "destructive" : c.status === "expiring" ? "default" : "secondary"}
                            className={`text-[10px] ${c.status === "expiring" ? "bg-amber-600" : ""}`}>
                            {c.status === "critical" ? "⚠ CRITICAL" : c.status === "expiring" ? "Expiring Soon" : "✓ Current"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {certTracker.map((c, i) => (
                  <div key={i} className={`border rounded-lg p-3 ${c.status === "critical" ? "border-red-300" : c.status === "expiring" ? "border-amber-300" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold">{c.tech}</span>
                      <Badge variant={c.status === "critical" ? "destructive" : c.status === "expiring" ? "default" : "secondary"}
                        className={`text-[10px] ${c.status === "expiring" ? "bg-amber-600" : ""}`}>
                        {c.status === "critical" ? "CRITICAL" : c.status === "expiring" ? "Expiring" : "Current"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant="outline" className="text-[10px]">{c.cert}</Badge>
                      <span className="text-muted-foreground">Expires: {c.expiry} ({c.daysLeft}d)</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Returns & Reschedules ═══ */}
        <TabsContent value="returns">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Return Reasons — This Month</CardTitle>
                <CardDescription>Frequency, average resolution time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {returnsData.map(r => (
                    <div key={r.reason} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/20">
                      <div>
                        <div className="text-sm font-medium">{r.reason}</div>
                        <div className="text-xs text-muted-foreground">Avg resolution: {r.avgDays} days</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-amber-600">{r.count}</div>
                        <div className="text-[10px] text-muted-foreground">returns</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total returns this month</span>
                  <span className="font-bold text-amber-600">{returnsData.reduce((s, r) => s + r.count, 0)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Reschedule Reasons — This Month</CardTitle>
                <CardDescription>Breakdown by cause</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rescheduleData.map(r => (
                    <div key={r.reason}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{r.reason}</span>
                        <span className="text-muted-foreground">{r.count} ({r.pctTotal}%)</span>
                      </div>
                      <Progress value={r.pctTotal} className="h-2.5" />
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total reschedules this month</span>
                  <span className="font-bold">{rescheduleData.reduce((s, r) => s + r.count, 0)}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                  ⚠ Jobs rescheduled 3+ times are auto-flagged for supervisor attention
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
