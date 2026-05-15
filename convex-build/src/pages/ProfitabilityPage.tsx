import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  TrendingUp, AlertTriangle, DollarSign, Users, Wrench,
  ChevronDown, BarChart2, Target, Flame,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { formatCurrency, cn, initials } from "../lib/utils";

// ─── Burden Parameters Panel ─────────────────────────────────────────────────

type BurdenParams = {
  burdenPct: number;
  fuelPerDay: number;
  toolsPerDay: number;
  overheadMonthly: number;
};

const DEFAULT_PARAMS: BurdenParams = {
  burdenPct: 30,
  fuelPerDay: 45,
  toolsPerDay: 15,
  overheadMonthly: 8500,
};

function ParamInput({ label, value, onChange, prefix = "", suffix = "" }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
      <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
        {prefix && <span className="px-2 text-sm text-gray-500 border-r bg-gray-50">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
        />
        {suffix && <span className="px-2 text-sm text-gray-500 border-l bg-gray-50">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Service Revenue Card ─────────────────────────────────────────────────────

const SERVICE_COLORS: Record<string, string> = {
  suppression:  "#ef4444",
  sprinkler:    "#3b82f6",
  extinguisher: "#f59e0b",
  alarm:        "#8b5cf6",
  emergency:    "#ec4899",
  standpipe:    "#14b8a6",
  other:        "#6b7280",
};

// ─── Popup-safe context menu helper ──────────────────────────────────────────
// Clamped popup position: mirrors the popup fix from artifacts/techforce-pro

function useClampedMenu() {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [menuData, setMenuData] = useState<any>(null);

  function openMenuAt(e: React.MouseEvent, data: any, popupW = 200, popupH = 160) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const MARGIN = 8;
    const px = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - popupW - MARGIN));
    let py: number;
    if (rect.bottom + 4 + popupH <= window.innerHeight - MARGIN) {
      py = rect.bottom + 4;
    } else if (rect.top - popupH >= MARGIN) {
      py = rect.top - popupH;
    } else {
      py = MARGIN;
    }
    setMenuPos({ x: px, y: py });
    setMenuData(data);
  }

  function closeMenu() { setMenuPos(null); setMenuData(null); }

  return { menuPos, menuData, openMenuAt, closeMenu };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProfitabilityPage() {
  const roi = (useQuery(api.dashboard.employeeROI) ?? []) as any[];
  const leaks = (useQuery(api.dashboard.profitLeaks) ?? []) as any[];
  const byService = (useQuery(api.dashboard.revenueByService) ?? []) as any[];
  const summary = useQuery(api.dashboard.summary);

  const [params, setParams] = useState<BurdenParams>(DEFAULT_PARAMS);
  const [showParams, setShowParams] = useState(false);
  const paramsRef = useRef<HTMLDivElement>(null);

  const { menuPos, menuData, openMenuAt, closeMenu } = useClampedMenu();

  useEffect(() => {
    if (!showParams) return;
    function handler(e: MouseEvent) {
      if (paramsRef.current && !paramsRef.current.contains(e.target as Node)) setShowParams(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showParams]);

  useEffect(() => {
    if (!menuPos) return;
    function handler() { closeMenu(); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuPos]);

  // Derived metrics
  const totalRevenue = byService.reduce((s: number, r: any) => s + r.revenue, 0);
  const annualBurden = roi.reduce((s: number, r: any) => s + r.burdenCost, 0);
  const annualOverhead = params.overheadMonthly * 12;
  const grossProfit = totalRevenue - annualBurden - annualOverhead;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const chartData = byService.map((s: any) => ({
    name: s.serviceType.replace(/_/g, " "),
    revenue: s.revenue,
    jobs: s.jobCount,
    color: SERVICE_COLORS[s.serviceType] ?? "#6b7280",
  }));

  function setParam(k: keyof BurdenParams) {
    return (v: number) => setParams(p => ({ ...p, [k]: v }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="size-6 text-red-600 shrink-0" /> P&L Engine
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Profit & loss analysis for Multicorp Fire Protection Services</p>
        </div>

        {/* Burden Params Button */}
        <div ref={paramsRef} className="relative self-start sm:self-auto">
          <button
            onClick={() => setShowParams(v => !v)}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <Wrench className="size-4 text-gray-500" /> Burden Parameters
            <ChevronDown className={cn("size-3.5 text-gray-400 transition-transform", showParams && "rotate-180")} />
          </button>
          {showParams && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl border shadow-xl p-4 z-30 space-y-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Burden Rate Config</h3>
              <ParamInput label="Burden %" value={params.burdenPct} onChange={setParam("burdenPct")} suffix="%" />
              <ParamInput label="Fuel / Field Day" value={params.fuelPerDay} onChange={setParam("fuelPerDay")} prefix="$" />
              <ParamInput label="Tools / Field Day" value={params.toolsPerDay} onChange={setParam("toolsPerDay")} prefix="$" />
              <ParamInput label="Overhead / Month" value={params.overheadMonthly} onChange={setParam("overheadMonthly")} prefix="$" />
              <p className="text-[10px] text-gray-400">Changes apply immediately to all calculations below.</p>
            </div>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Annual Burden", value: formatCurrency(annualBurden), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Gross Profit", value: formatCurrency(grossProfit), icon: TrendingUp, color: grossProfit >= 0 ? "text-emerald-600" : "text-red-600", bg: grossProfit >= 0 ? "bg-emerald-50" : "bg-red-50" },
          { label: "Margin", value: `${margin.toFixed(1)}%`, icon: Target, color: margin >= 40 ? "text-emerald-600" : margin >= 20 ? "text-amber-600" : "text-red-600", bg: margin >= 40 ? "bg-emerald-50" : margin >= 20 ? "bg-amber-50" : "bg-red-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4 sm:p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{s.label}</span>
              <div className={cn("rounded-lg p-2", s.bg)}>
                <s.icon className={cn("size-4", s.color)} />
              </div>
            </div>
            <div className={cn("text-2xl font-extrabold", s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Shop Day Loss */}
      {summary && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
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

      {/* Revenue by Service — chart + cards */}
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
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {byService.map((s: any) => (
                <div key={s.serviceType} className="border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: SERVICE_COLORS[s.serviceType] ?? "#6b7280" }}
                    />
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

      {/* Employee ROI Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <DollarSign className="size-4 text-red-600" />
          <h2 className="font-semibold text-sm">Employee ROI</h2>
          <span className="ml-auto text-xs text-gray-400">
            Burden rate: {params.burdenPct}% · Overhead: {formatCurrency(params.overheadMonthly)}/mo
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {["Employee", "Revenue", "Burden Cost", "Gross Profit", "Margin", "Utilization", ""].map(h => (
                  <th key={h} className={cn(
                    "py-3 px-4 font-semibold text-xs uppercase tracking-wider text-gray-500",
                    h === "Employee" ? "text-left" : h === "" ? "" : "text-right"
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {roi.map((row: any) => {
                const adjustedCost = row.burdenCost * (1 + (params.burdenPct - 30) / 100);
                const adjProfit = row.revenue - adjustedCost;
                const adjMargin = row.revenue > 0 ? (adjProfit / row.revenue) * 100 : 0;

                return (
                  <tr key={row.employeeId} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-700 shrink-0">
                          {initials(row.name)}
                        </div>
                        <span className="font-medium text-gray-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{formatCurrency(row.revenue)}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{formatCurrency(adjustedCost)}</td>
                    <td className={cn("py-3 px-4 text-right font-semibold", adjProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                      {formatCurrency(adjProfit)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-semibold",
                        adjMargin >= 40 ? "bg-emerald-100 text-emerald-700" :
                        adjMargin >= 20 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {adjMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
                          <div
                            className={cn("h-2 rounded-full", row.utilization >= 85 ? "bg-emerald-500" : row.utilization >= 70 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${Math.min(row.utilization, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right shrink-0">{row.utilization}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={e => openMenuAt(e, row, 220, 130)}
                        className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                        title="More details"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {roi.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-400">No data yet — add jobs to see ROI</td>
                </tr>
              )}
            </tbody>
            {roi.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="py-3 px-4 text-xs uppercase text-gray-500">Totals</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(roi.reduce((s: number, r: any) => s + r.revenue, 0))}</td>
                  <td className="py-3 px-4 text-right text-gray-500">{formatCurrency(roi.reduce((s: number, r: any) => s + r.burdenCost, 0))}</td>
                  <td className={cn("py-3 px-4 text-right", grossProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                    {formatCurrency(grossProfit)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", margin >= 40 ? "bg-emerald-100 text-emerald-700" : margin >= 20 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
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

      {/* Profit Leaks */}
      {leaks.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <h2 className="font-semibold text-sm">Profit Leaks</h2>
            <span className="ml-auto text-xs text-red-600 font-semibold">
              {leaks.length} issue{leaks.length !== 1 ? "s" : ""} detected
            </span>
          </div>
          <div className="divide-y">
            {leaks.map((leak: any, i: number) => (
              <div key={i} className="px-5 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className={cn(
                  "size-8 rounded-lg flex items-center justify-center shrink-0",
                  (leak.impact ?? 0) > 10000 ? "bg-red-100" : "bg-amber-100"
                )}>
                  <AlertTriangle className={cn("size-4", (leak.impact ?? 0) > 10000 ? "text-red-600" : "text-amber-600")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{leak.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{leak.description}</p>
                  {leak.impact && (
                    <p className="text-xs font-bold text-red-600 mt-1">
                      Estimated impact: {formatCurrency(leak.impact)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating row-detail popup — clamped to viewport */}
      {menuPos && menuData && (
        <div
          className="fixed z-50 bg-white rounded-xl border shadow-2xl p-4 w-52"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="size-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-700">
              {initials(menuData.name)}
            </div>
            <span className="font-semibold text-sm text-gray-900 truncate">{menuData.name}</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Revenue</span>
              <span className="font-semibold">{formatCurrency(menuData.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Burden Cost</span>
              <span className="font-semibold">{formatCurrency(menuData.burdenCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Gross Profit</span>
              <span className={cn("font-semibold", menuData.grossProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                {formatCurrency(menuData.grossProfit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Margin</span>
              <span className={cn("font-bold", menuData.margin >= 40 ? "text-emerald-600" : menuData.margin >= 20 ? "text-amber-600" : "text-red-600")}>
                {menuData.margin.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Utilization</span>
              <span className="font-semibold">{menuData.utilization}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
