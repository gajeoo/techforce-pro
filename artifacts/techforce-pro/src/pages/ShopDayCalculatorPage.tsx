import {
  ArrowDown,
  ArrowUp,
  Calculator,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Download,
  Lightbulb,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type TechRow = {
  id: string;
  name: string;
  salary: number;
  dailyRate: number;
  shopDays: number;
  maxShopDays: number;
  isShopGuy: boolean;
};

const WORK_DAYS = 22;

// ─── Employee → TechRow conversion ───────────────────────────────────────────

function empToTechRow(emp: any): TechRow {
  // Monthly shop-day allowance: treat allowedShopDays as monthly baseline for the simulator
  // (suppression=2, extinguisher=5, helper=12 give meaningful monthly starting points)
  const shopDays    = Math.max(0, emp.allowedShopDays ?? 0);
  const maxShopDays = Math.max(shopDays, emp.allowedShopDays ?? 0);
  return {
    id:          String(emp._id ?? emp.id),
    name:        emp.name,
    salary:      emp.salary,
    dailyRate:   emp.billableRate,
    shopDays,
    maxShopDays,
    isShopGuy:   false,
  };
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

const scenarios = [
  {
    label: "🧑‍🔧 Hire a Shop Guy",
    description: "Add a dedicated shop guy so techs spend less time in the shop",
    apply: (techs: TechRow[]) => {
      const updated = techs.filter(t => !t.isShopGuy).map(t => ({
        ...t,
        shopDays: Math.max(0, Math.round(t.shopDays * 0.3)),
      }));
      updated.push({
        id: "shop-guy",
        name: "New Shop Guy",
        salary: 35000,
        dailyRate: 0,
        shopDays: 20,
        maxShopDays: 22,
        isShopGuy: true,
      });
      return updated;
    },
  },
  {
    label: "🚀 Max Utilization",
    description: "Every tech at peak — minimal shop days",
    apply: (techs: TechRow[]) =>
      techs.filter(t => !t.isShopGuy).map(t => ({
        ...t,
        shopDays: Math.max(1, Math.round(t.maxShopDays * 0.25)),
      })),
  },
  {
    label: "🤝 Generous Shop Time",
    description: "Give techs more shop time — see impact on margins",
    apply: (techs: TechRow[]) =>
      techs.filter(t => !t.isShopGuy).map(t => ({
        ...t,
        shopDays: t.maxShopDays,
      })),
  },
  {
    label: "📉 Slow Month",
    description: "Revenue drops 25% but costs stay fixed",
    apply: (techs: TechRow[]) =>
      techs.filter(t => !t.isShopGuy).map(t => ({
        ...t,
        dailyRate: Math.round(t.dailyRate * 0.75),
        shopDays:  Math.min(22, Math.round(t.shopDays * 1.5)),
      })),
  },
];

// ─── Calculation helpers ──────────────────────────────────────────────────────

function calcTechProfit(t: TechRow) {
  const billableDays   = WORK_DAYS - t.shopDays;
  const monthlyRevenue = t.dailyRate * billableDays;
  const monthlySalary  = t.salary / 12;
  const overhead       = t.salary * 0.30 / 12;
  const totalCost      = monthlySalary + overhead;
  const utilization    = Math.round((billableDays / WORK_DAYS) * 100);
  const profit         = monthlyRevenue - totalCost;
  return { monthlyRevenue, monthlySalary, overhead, totalCost, billableDays, utilization, profit };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShopDayCalculatorPage() {
  const apiEmps = (useQuery(api.employees.list) ?? []) as any[];

  const [techs, setTechs]   = useState<TechRow[]>([]);
  const [showHowTo, setShowHowTo] = useState(false);
  const baselineRef = useRef<TechRow[]>([]);

  // Load real employees from API on mount

  const updateTech = useCallback((id: string, field: keyof TechRow, value: number) => {
    setTechs(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  }, []);

  const removeTech = useCallback((id: string) => {
    setTechs(prev => prev.filter(t => t.id !== id));
  }, []);

  const addTech = useCallback(() => {
    setTechs(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: `Tech ${prev.length + 1}`,
      salary: 50000,
      dailyRate: 600,
      shopDays: 3,
      maxShopDays: 5,
      isShopGuy: false,
    }]);
  }, []);

  const reset = useCallback(() => {
    setTechs(baselineRef.current);
  }, []);

  // ─── Totals ───────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    let revenue = 0, cost = 0, shopDays = 0, billDays = 0;
    techs.forEach(t => {
      const c = calcTechProfit(t);
      revenue  += c.monthlyRevenue;
      cost     += c.totalCost;
      shopDays += t.shopDays;
      billDays += c.billableDays;
    });
    const profit  = revenue - cost;
    const margin  = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
    const avgUtil = techs.length > 0 ? Math.round((billDays / (techs.length * WORK_DAYS)) * 100) : 0;
    return { revenue, cost, profit, margin, shopDays, billDays, avgUtil };
  }, [techs]);

  const baseline = useMemo(() => {
    let revenue = 0, cost = 0, shopDays = 0;
    baselineRef.current.forEach(t => {
      const c = calcTechProfit(t);
      revenue  += c.monthlyRevenue;
      cost     += c.totalCost;
      shopDays += t.shopDays;
    });
    return { revenue, cost, profit: revenue - cost, shopDays };
  }, [techs]); // recalculate when techs changes so baseline is stable

  const profitDelta  = totals.profit - baseline.profit;
  const shopDelta    = totals.shopDays - baseline.shopDays;
  const annualProfit = totals.profit * 12;
  const annualRevenue = totals.revenue * 12;

  const chartData = techs
    .filter(t => !t.isShopGuy)
    .map(t => {
      const c = calcTechProfit(t);
      return {
        name:    t.name.split(" ")[0],
        Profit:  Math.round(c.profit),
        Revenue: Math.round(c.monthlyRevenue),
        Cost:    Math.round(c.totalCost),
      };
    });

  function downloadCsv() {
    const rows = [["Name", "Salary", "Daily Rate", "Shop Days", "Billable Days", "Revenue", "Cost", "Profit", "Utilization %"]];
    techs.forEach(t => {
      const c = calcTechProfit(t);
      rows.push([
        t.name, t.salary.toString(), t.dailyRate.toString(), t.shopDays.toString(),
        c.billableDays.toString(), Math.round(c.monthlyRevenue).toString(),
        Math.round(c.totalCost).toString(), Math.round(c.profit).toString(),
        c.utilization.toString(),
      ]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href:     URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "shop-calculator.csv",
    });
    a.click();
  }

  if (!apiEmps.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground mr-3" />
        <span className="text-muted-foreground">Loading employee data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="size-6 text-primary shrink-0" />
            Shop Day Calculator
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Simulate scenarios to optimize profitability — initialized from live employee data
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto flex-wrap">
          <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
            <RotateCcw className="size-3" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsv} className="gap-1.5 text-xs">
            <Download className="size-3" /> Export CSV
          </Button>
          <Button size="sm" onClick={addTech} className="gap-1.5 text-xs">
            <UserPlus className="size-3" /> Add Tech
          </Button>
        </div>
      </div>

      {/* ── KPI Summary ─────────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className={profitDelta >= 0 ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Profit</span>
              <DollarSign className="size-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold">${Math.round(totals.profit).toLocaleString()}</div>
            {profitDelta !== 0 && (
              <div className={`text-xs mt-1 font-medium flex items-center gap-1 ${profitDelta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                {profitDelta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                ${Math.abs(Math.round(profitDelta)).toLocaleString()} vs baseline
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revenue</span>
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold">${Math.round(totals.revenue).toLocaleString()}</div>
            <div className="text-xs mt-1 text-muted-foreground">Margin: {totals.margin}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Utilization</span>
              <Users className="size-4 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold">{totals.avgUtil}%</div>
            <Progress value={totals.avgUtil} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Shop Days</span>
              <Calculator className="size-4 text-red-600" />
            </div>
            <div className="text-xl font-extrabold">{totals.shopDays}</div>
            {shopDelta !== 0 && (
              <div className={`text-xs mt-1 font-medium ${shopDelta < 0 ? "text-emerald-600" : "text-red-600"}`}>
                {shopDelta > 0 ? "+" : ""}{shopDelta} vs baseline
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Annual Projection ───────────────────────────────────────────────── */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Annual Revenue</div>
              <div className="text-xl font-extrabold text-blue-600">${Math.round(annualRevenue).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Annual Profit</div>
              <div className={`text-xl font-extrabold ${annualProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                ${Math.round(annualProfit).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Annual Cost</div>
              <div className="text-xl font-extrabold text-muted-foreground">${Math.round(totals.cost * 12).toLocaleString()}</div>
            </div>
            {profitDelta !== 0 && (
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Annual Δ vs Baseline</div>
                <div className={`text-xl font-extrabold ${profitDelta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {profitDelta > 0 ? "+" : ""}${Math.round(profitDelta * 12).toLocaleString()}
                </div>
              </div>
            )}
            <div className="ml-auto text-xs text-muted-foreground">Annualized — multiply monthly by 12</div>
          </div>
        </CardContent>
      </Card>

      {/* ── Scenario Presets ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" />
            What-If Scenarios
          </CardTitle>
          <CardDescription>Click to apply — use Reset to go back to live employee data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {scenarios.map(sc => (
              <button
                key={sc.label}
                onClick={() => setTechs(sc.apply(techs))}
                className="text-left border rounded-xl p-3 hover:bg-primary/5 hover:border-primary/30 transition-all group"
              >
                <div className="text-sm font-bold group-hover:text-primary transition-colors">{sc.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{sc.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Calculator Table ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Per-Technician Calculator</CardTitle>
              <CardDescription>
                Edit values directly — profit recalculates instantly.
                <span className="text-primary font-medium"> Revenue = daily rate × billable days.</span>
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 text-muted-foreground"
              onClick={() => setShowHowTo(p => !p)}
            >
              {showHowTo ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              How it works
            </Button>
          </div>
          {showHowTo && (
            <div className="mt-2 rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Daily Rate</strong> = revenue this tech generates per billable field day</p>
              <p><strong>Billable Days</strong> = {WORK_DAYS} work days − shop days</p>
              <p><strong>Monthly Revenue</strong> = daily rate × billable days</p>
              <p><strong>Cost</strong> = salary/12 + 30% overhead</p>
              <p><strong>Profit</strong> = revenue − cost</p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-foreground/20">
                  {["Technician", "Annual Salary", "Daily Rate", "Shop Days", "Billable", "Revenue", "Util %", "Total Cost", "Profit", ""].map((h, i) => (
                    <th
                      key={i}
                      className={`py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground ${i === 0 ? "text-left" : i === 9 ? "" : "text-right"} ${i === 3 ? "text-center" : ""} ${i === 4 ? "text-center" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {techs.map(tech => {
                  const c = calcTechProfit(tech);
                  return (
                    <tr key={tech.id} className={`border-b border-muted/50 ${tech.isShopGuy ? "bg-blue-50/50 dark:bg-blue-950/10" : ""}`}>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{tech.name}</span>
                          {tech.isShopGuy && <Badge className="bg-blue-600 text-[10px]">Shop Guy</Badge>}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Input
                          type="number"
                          value={tech.salary}
                          onChange={e => updateTech(tech.id, "salary", Number(e.target.value))}
                          className="w-24 text-right text-xs h-8 ml-auto"
                        />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Input
                          type="number"
                          value={tech.dailyRate}
                          onChange={e => updateTech(tech.id, "dailyRate", Number(e.target.value))}
                          className="w-20 text-right text-xs h-8 ml-auto"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost" size="icon" className="size-6"
                            onClick={() => updateTech(tech.id, "shopDays", Math.max(0, tech.shopDays - 1))}
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span className={`text-lg font-extrabold w-8 text-center ${tech.shopDays > tech.maxShopDays ? "text-red-600" : ""}`}>
                            {tech.shopDays}
                          </span>
                          <Button
                            variant="ghost" size="icon" className="size-6"
                            onClick={() => updateTech(tech.id, "shopDays", Math.min(22, tech.shopDays + 1))}
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center text-sm font-medium">{c.billableDays}</td>
                      <td className="py-3 px-2 text-right text-xs font-semibold text-emerald-600">
                        ${Math.round(c.monthlyRevenue).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`font-bold ${c.utilization >= 85 ? "text-emerald-600" : c.utilization >= 70 ? "text-amber-600" : "text-red-600"}`}>
                          {c.utilization}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-xs text-muted-foreground">
                        ${Math.round(c.totalCost).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`font-bold ${c.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          ${Math.round(c.profit).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <Button
                          variant="ghost" size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeTech(tech.id)}
                        >
                          ×
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/20 bg-muted/30">
                  <td className="py-3 px-2 font-bold text-xs uppercase">Total ({techs.length})</td>
                  <td className="py-3 px-2 text-right font-bold text-xs">
                    ${Math.round(techs.reduce((s, t) => s + t.salary, 0)).toLocaleString()}
                  </td>
                  <td className="py-3 px-2"></td>
                  <td className="py-3 px-2 text-center font-bold text-red-600">{totals.shopDays}</td>
                  <td className="py-3 px-2 text-center font-bold">{totals.billDays}</td>
                  <td className="py-3 px-2 text-right font-bold text-xs text-emerald-600">
                    ${Math.round(totals.revenue).toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-bold">{totals.avgUtil}%</td>
                  <td className="py-3 px-2 text-right font-bold text-xs">
                    ${Math.round(totals.cost).toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-extrabold text-emerald-600">
                    ${Math.round(totals.profit).toLocaleString()}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {techs.map(tech => {
              const c = calcTechProfit(tech);
              return (
                <div key={tech.id} className={`border rounded-xl p-4 ${tech.isShopGuy ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/10" : ""}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{tech.name}</span>
                      {tech.isShopGuy && <Badge className="bg-blue-600 text-[10px]">Shop Guy</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" className="size-6 text-muted-foreground" onClick={() => removeTech(tech.id)}>×</Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">Annual Salary</label>
                      <Input
                        type="number"
                        value={tech.salary}
                        onChange={e => updateTech(tech.id, "salary", Number(e.target.value))}
                        className="text-xs h-8"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">Daily Rate</label>
                      <Input
                        type="number"
                        value={tech.dailyRate}
                        onChange={e => updateTech(tech.id, "dailyRate", Number(e.target.value))}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium">Shop Days</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" size="icon" className="size-7"
                        onClick={() => updateTech(tech.id, "shopDays", Math.max(0, tech.shopDays - 1))}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className={`text-lg font-extrabold w-8 text-center ${tech.shopDays > tech.maxShopDays ? "text-red-600" : ""}`}>
                        {tech.shopDays}
                      </span>
                      <Button
                        variant="outline" size="icon" className="size-7"
                        onClick={() => updateTech(tech.id, "shopDays", Math.min(22, tech.shopDays + 1))}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/30 p-2">
                      <div className="text-muted-foreground">Revenue</div>
                      <div className="font-bold text-emerald-600">${Math.round(c.monthlyRevenue).toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <div className="text-muted-foreground">Profit</div>
                      <div className={`font-bold ${c.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        ${Math.round(c.profit).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <div className="text-muted-foreground">Billable Days</div>
                      <div className="font-bold">{c.billableDays}</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <div className="text-muted-foreground">Utilization</div>
                      <div className={`font-bold ${c.utilization >= 85 ? "text-emerald-600" : c.utilization >= 70 ? "text-amber-600" : "text-red-600"}`}>
                        {c.utilization}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Mobile totals */}
            <div className="border-2 rounded-xl p-4 bg-muted/20">
              <div className="text-xs font-bold uppercase mb-2">Total — {techs.length} techs</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Revenue: </span><span className="font-bold text-emerald-600">${Math.round(totals.revenue).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Profit: </span><span className={`font-bold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>${Math.round(totals.profit).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Shop Days: </span><span className="font-bold text-red-600">{totals.shopDays}</span></div>
                <div><span className="text-muted-foreground">Avg Util: </span><span className="font-bold">{totals.avgUtil}%</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bar Chart ───────────────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Per-Tech Monthly Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Cost"    fill="#94a3b8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Profit"  fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
