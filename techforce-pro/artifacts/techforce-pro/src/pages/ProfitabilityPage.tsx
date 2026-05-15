import { useState, useMemo, useEffect } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Fuel, Wrench,
  Info, Settings, Clock, ToggleLeft, ToggleRight, Edit3, Check, X, Download, AlertTriangle,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getEmployees, getJobs, updateEmployee, type ApiEmployee, type ApiJob } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type Period = "weekly" | "monthly" | "annual";

interface BurdenParams {
  burdenPct: number;
  fuelPerDay: number;
  toolsPerDay: number;
  workDaysPerYear: number;
  workDaysPerMonth: number;
  workDaysPerWeek: number;
  hoursPerDay: number;
}

interface TechRow {
  id: string; name: string; role: string; salary: number;
  billRate: number; utilization: number;
  shopDaysUsed: number; shopDaysAllowed: number;
  revenueYTD: number; revenueMonth: number; status: string;
}

type DayType = "billable" | "shop" | "training" | "callout" | "off";

interface WeekScheduleDay {
  type: DayType;
}

interface WeekSchedule {
  techId: string;
  techName: string;
  cert: string;
  days: WeekScheduleDay[];
  shopDaysThisWeek: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number, short = false) {
  if (short && Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function fmtRate(v: number, hourly: boolean, hoursPerDay: number) {
  const val = hourly ? v / hoursPerDay : v;
  return `${fmt(val)}${hourly ? "/hr" : "/day"}`;
}

function workDays(period: Period, p: BurdenParams) {
  if (period === "weekly") return p.workDaysPerWeek;
  if (period === "monthly") return p.workDaysPerMonth;
  return p.workDaysPerYear;
}

function calcRow(tech: TechRow, rate: number, period: Period, p: BurdenParams) {
  const wd = workDays(period, p);
  const mult = wd / p.workDaysPerYear;
  const billableDays = Math.round(wd * (tech.utilization / 100));
  const shopDays = wd - billableDays;
  const revenue   = rate * billableDays;
  const salaryCost = tech.salary * mult;
  const burdenCost = tech.salary * (p.burdenPct / 100) * mult;
  const fuelCost   = billableDays * p.fuelPerDay;
  const toolsCost  = billableDays * p.toolsPerDay;
  const totalCost  = salaryCost + burdenCost + fuelCost + toolsCost;
  const netProfit  = revenue - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  return { revenue, salaryCost, burdenCost, fuelCost, toolsCost, totalCost, netProfit, roi, billableDays, shopDays };
}

// ─── Day cell (weekly table) ──────────────────────────────────────────────────

const DAY_TYPE_OPTIONS: { type: DayType; label: string; short: string; cls: string; activeCls: string }[] = [
  { type: "billable", label: "Billable",  short: "BILL",    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",   activeCls: "ring-emerald-400" },
  { type: "shop",     label: "Shop Day",  short: "SHOP",    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-bold",        activeCls: "ring-red-400" },
  { type: "training", label: "Training",  short: "TRAIN",   cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",          activeCls: "ring-amber-400" },
  { type: "callout",  label: "Call Out",  short: "CALLOUT", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",      activeCls: "ring-purple-400" },
  { type: "off",      label: "Off Day",   short: "OFF",     cls: "bg-muted text-muted-foreground",                                                activeCls: "ring-border" },
];

function getDayCell(type: string) {
  const opt = DAY_TYPE_OPTIONS.find(o => o.type === type);
  if (opt) return { label: opt.short, cls: opt.cls };
  return { label: "Billable", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" };
}

// ─── Weekly Billable Table ────────────────────────────────────────────────────

type ShopPeriod = "weekly" | "monthly" | "yearly";

function WeeklyTable({
  techRates, onRateChange, params, hourly, empSchedules, salaryData,
  canEditShopDays, onShopDayChange, shopDaysData,
  onTrainingDayChange, trainingDaysData,
  initialDayRevOverrides,
  period,
}: {
  techRates: Record<string, number>;
  onRateChange: (id: string, rate: number) => void;
  params: BurdenParams;
  hourly: boolean;
  empSchedules: WeekSchedule[];
  salaryData: Array<{ id: string; salary: number }>;
  canEditShopDays?: boolean;
  onShopDayChange?: (techId: string, used: number) => void;
  shopDaysData?: Record<string, { used: number; allowed: number }>;
  onTrainingDayChange?: (techId: string, used: number) => void;
  trainingDaysData?: Record<string, { used: number; allowed: number }>;
  initialDayRevOverrides?: Record<string, Record<number, number>>;
  period?: Period;
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [shopPeriod, setShopPeriod] = useState<ShopPeriod>("yearly");

  function scaleAllowed(allowed: number, p: ShopPeriod) {
    if (p === "weekly")  return parseFloat((allowed / 52).toFixed(1));
    if (p === "monthly") return Math.round(allowed / 12);
    return allowed;
  }

  function shopPeriodLabel(p: ShopPeriod) {
    return p === "weekly" ? "wk" : p === "monthly" ? "mo" : "yr";
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const [dayRevOverrides, setDayRevOverrides] = useState<Record<string, Record<number, number>>>({});
  const [editingCell, setEditingCell] = useState<{ techId: string; dayIdx: number } | null>(null);
  const [cellEditVal, setCellEditVal] = useState("");

  // Day type overrides — lets any cell be changed to billable/shop/training/callout/off
  const [dayTypeOverrides, setDayTypeOverrides] = useState<Record<string, Record<number, DayType>>>({});
  const [openTypeMenu, setOpenTypeMenu] = useState<{ techId: string; dayIdx: number } | null>(null);

  // Shop days editing state
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [shopEditVal,   setShopEditVal]   = useState("");

  // Training days editing state
  const [editingTrainId, setEditingTrainId] = useState<string | null>(null);
  const [trainEditVal,   setTrainEditVal]   = useState("");

  function getEffectiveType(techId: string, dayIdx: number, originalType: DayType): DayType {
    return dayTypeOverrides[techId]?.[dayIdx] ?? originalType;
  }

  function applyDayType(techId: string, dayIdx: number, type: DayType) {
    setDayTypeOverrides(prev => ({
      ...prev,
      [techId]: { ...(prev[techId] ?? {}), [dayIdx]: type },
    }));
    setOpenTypeMenu(null);
    setEditingCell(null);
  }

  // Pre-populate overrides with actual job revenue data when it arrives
  const [overridesSeeded, setOverridesSeeded] = useState(false);
  useEffect(() => {
    if (initialDayRevOverrides && !overridesSeeded && Object.keys(initialDayRevOverrides).length > 0) {
      setDayRevOverrides(initialDayRevOverrides);
      setOverridesSeeded(true);
    }
  }, [initialDayRevOverrides, overridesSeeded]);

  function startShopEdit(techId: string, currentUsed: number) {
    setEditingShopId(techId);
    setShopEditVal(String(currentUsed));
  }

  function commitShopEdit(techId: string) {
    const v = Number(shopEditVal);
    if (!isNaN(v) && v >= 0 && onShopDayChange) {
      onShopDayChange(techId, v);
    }
    setEditingShopId(null);
  }

  function startTrainEdit(techId: string, currentUsed: number) {
    setEditingTrainId(techId);
    setTrainEditVal(String(currentUsed));
  }

  function commitTrainEdit(techId: string) {
    const v = Number(trainEditVal);
    if (!isNaN(v) && v >= 0 && onTrainingDayChange) {
      onTrainingDayChange(techId, v);
    }
    setEditingTrainId(null);
  }

  function getDayRev(techId: string, dayIdx: number) {
    return dayRevOverrides[techId]?.[dayIdx] ?? (techRates[techId] ?? 0);
  }

  function startCellEdit(techId: string, dayIdx: number) {
    setEditingCell({ techId, dayIdx });
    setCellEditVal(String(Math.round(getDayRev(techId, dayIdx))));
  }

  function commitCellEdit() {
    if (!editingCell) return;
    const v = Number(cellEditVal);
    if (!isNaN(v) && v >= 0) {
      setDayRevOverrides(prev => ({
        ...prev,
        [editingCell.techId]: { ...(prev[editingCell.techId] ?? {}), [editingCell.dayIdx]: v },
      }));
    }
    setEditingCell(null);
  }

  function startRateEdit(id: string, currentRate: number) {
    setEditingId(id);
    setEditVal(String(hourly ? Math.round(currentRate / params.hoursPerDay) : currentRate));
  }

  function commitRateEdit(id: string) {
    const v = Number(editVal);
    if (!isNaN(v) && v > 0) {
      onRateChange(id, hourly ? v * params.hoursPerDay : v);
    }
    setEditingId(null);
  }

  function getTechWeekTotal(emp: WeekSchedule) {
    return emp.days.reduce((s, d, i) =>
      getEffectiveType(emp.techId, i, d.type) === "billable" ? s + getDayRev(emp.techId, i) : s, 0);
  }

  const totalWeekRev = empSchedules.reduce((s, emp) => s + getTechWeekTotal(emp), 0);

  const salaryCostWeek = salaryData.reduce((s, e) => s + (e.salary / params.workDaysPerYear) * params.workDaysPerWeek, 0);
  const burdenCostWeek = salaryData.reduce((s, e) => s + (e.salary * (params.burdenPct / 100) / params.workDaysPerYear) * params.workDaysPerWeek, 0);
  const fuelCostWeek   = empSchedules.reduce((s, e) => s + e.days.filter((d, i) => getEffectiveType(e.techId, i, d.type) === "billable").length * params.fuelPerDay, 0);
  const toolsCostWeek  = empSchedules.reduce((s, e) => s + e.days.filter((d, i) => getEffectiveType(e.techId, i, d.type) === "billable").length * params.toolsPerDay, 0);
  const netWeekPL = totalWeekRev - salaryCostWeek - burdenCostWeek - fuelCostWeek - toolsCostWeek;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-foreground">Daily Billable Table — Current Week</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click any billable cell to correct that day's revenue · Click the rate badge to edit the default bill rate · Sat & Sun default to Off
          </p>
        </div>
        {canEditShopDays && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">Shop Days basis:</span>
            {(["weekly", "monthly", "yearly"] as ShopPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setShopPeriod(p)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors capitalize ${
                  shopPeriod === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                {p === "weekly" ? "Weekly" : p === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-sm w-48">Technician</th>
              {days.map((d, i) => (
                <th key={d} className={`text-center px-2 py-3 font-medium text-sm ${i >= 5 ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                  {d}
                  {i >= 5 && <div className="text-[9px] font-normal leading-none mt-0.5 opacity-60">off by default</div>}
                </th>
              ))}
              <th className="text-center px-3 py-3 font-medium text-muted-foreground text-sm">Bill Rate</th>
              {canEditShopDays && (
                <th className="text-center px-3 py-3 font-medium text-muted-foreground text-sm">
                  Shop Days
                  <div className="text-[9px] font-normal text-muted-foreground/70 leading-tight">used / allowed/{shopPeriodLabel(shopPeriod)}</div>
                </th>
              )}
              {canEditShopDays && (
                <th className="text-center px-3 py-3 font-medium text-muted-foreground text-sm">
                  Train Days
                  <div className="text-[9px] font-normal text-muted-foreground/70 leading-tight">used / allowed/yr</div>
                </th>
              )}
              <th className="text-right px-4 py-3 font-medium text-muted-foreground text-sm">
                {period === "monthly" ? "Month" : period === "annual" ? "Annual" : "Week"} Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {empSchedules.map(emp => {
              const rate = techRates[emp.techId] ?? 0;
              const displayRate = hourly ? rate / params.hoursPerDay : rate;
              const weekTotal = getTechWeekTotal(emp);

              return (
                <tr key={emp.techId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground text-sm">{emp.techName}</div>
                    <div className="text-xs text-muted-foreground">{emp.cert}</div>
                  </td>

                  {emp.days.map((d, i) => {
                    const effectiveType = getEffectiveType(emp.techId, i, d.type);
                    const isTypeMenuOpen = openTypeMenu?.techId === emp.techId && openTypeMenu?.dayIdx === i;

                    // ── Type picker inline panel ──
                    if (isTypeMenuOpen) {
                      return (
                        <td key={i} className="px-1 py-1 text-center">
                          <div className="inline-flex flex-col gap-1 items-center bg-card border border-border rounded-xl shadow-lg p-1.5 z-10">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Change Day Type</span>
                            <div className="grid grid-cols-1 gap-0.5 w-full">
                              {DAY_TYPE_OPTIONS.map(opt => (
                                <button
                                  key={opt.type}
                                  onClick={() => applyDayType(emp.techId, i, opt.type)}
                                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all text-left
                                    ${opt.cls}
                                    ${effectiveType === opt.type ? `ring-2 ${opt.activeCls}` : "opacity-70 hover:opacity-100"}
                                  `}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setOpenTypeMenu(null)}
                              className="text-[10px] text-muted-foreground hover:text-foreground mt-0.5"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      );
                    }

                    // ── Billable cell ──
                    if (effectiveType === "billable") {
                      const dayRev = getDayRev(emp.techId, i);
                      const isOverridden = dayRevOverrides[emp.techId]?.[i] !== undefined;
                      const isEditingThisCell = editingCell?.techId === emp.techId && editingCell?.dayIdx === i;
                      return (
                        <td key={i} className="px-1 py-2 text-center">
                          {isEditingThisCell ? (
                            <div className="flex items-center gap-0.5 justify-center">
                              <span className="text-xs text-muted-foreground">$</span>
                              <Input
                                className="h-8 w-20 text-sm px-1 text-center"
                                value={cellEditVal}
                                onChange={e => setCellEditVal(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") commitCellEdit(); if (e.key === "Escape") setEditingCell(null); }}
                                autoFocus
                              />
                              <button onClick={commitCellEdit} className="text-emerald-600 hover:text-emerald-700">
                                <Check className="size-4" />
                              </button>
                              <button onClick={() => setEditingCell(null)} className="text-muted-foreground hover:text-red-500">
                                <X className="size-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={() => startCellEdit(emp.techId, i)}
                                className={`group inline-flex flex-col items-center rounded-md px-2 py-1.5 transition-colors
                                  ${isOverridden
                                    ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                    : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                  }`}
                              >
                                <span className="text-sm font-bold leading-tight">{fmt(dayRev, true)}</span>
                                <span className="text-[11px] opacity-60 flex items-center gap-0.5 leading-tight">
                                  {isOverridden ? "edited" : "billable"}
                                  <Edit3 className="size-2.5 opacity-0 group-hover:opacity-100" />
                                </span>
                              </button>
                              <button
                                onClick={() => setOpenTypeMenu({ techId: emp.techId, dayIdx: i })}
                                className="text-[9px] text-muted-foreground hover:text-primary transition-colors"
                                title="Change day type"
                              >
                                ▾ type
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    }

                    // ── Non-billable cell (shop / training / callout / off) — clickable to change ──
                    const cell = getDayCell(effectiveType);
                    return (
                      <td key={i} className="px-1 py-2 text-center">
                        <button
                          onClick={() => setOpenTypeMenu({ techId: emp.techId, dayIdx: i })}
                          className={`inline-flex flex-col items-center rounded-md px-2.5 py-1.5 text-sm font-medium transition-all hover:opacity-80 hover:shadow-sm ${cell.cls}`}
                          title="Click to change day type"
                        >
                          <span>{cell.label}</span>
                          <span className="text-[9px] opacity-50">▾ change</span>
                        </button>
                      </td>
                    );
                  })}

                  {/* Editable Bill Rate */}
                  <td className="px-3 py-3 text-center">
                    {editingId === emp.techId ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">$</span>
                        <Input
                          className="h-8 w-20 text-sm px-1 text-center"
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") commitRateEdit(emp.techId); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus
                        />
                        <button onClick={() => commitRateEdit(emp.techId)} className="text-emerald-600 hover:text-emerald-700">
                          <Check className="size-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-red-500">
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRateEdit(emp.techId, rate)}
                        className="inline-flex items-center gap-1 rounded-md bg-muted/50 hover:bg-primary/10 hover:text-primary px-2.5 py-1.5 text-sm font-medium transition-colors group"
                      >
                        {fmt(displayRate)}<span className="text-muted-foreground text-xs">{hourly ? "/hr" : "/day"}</span>
                        <Edit3 className="size-3 opacity-0 group-hover:opacity-100" />
                      </button>
                    )}
                  </td>

                  {/* Shop Days column */}
                  {canEditShopDays && (() => {
                    const sd   = shopDaysData?.[emp.techId];
                    const usedYtd = sd?.used    ?? emp.shopDaysThisWeek;
                    const allowedYr = sd?.allowed ?? 0;
                    const allowedScaled = scaleAllowed(allowedYr, shopPeriod);
                    const periodSuffix = `/${shopPeriodLabel(shopPeriod)}`;
                    return (
                      <td className="px-3 py-3 text-center">
                        {editingShopId === emp.techId ? (
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              className="h-8 w-16 text-sm px-1 text-center"
                              value={shopEditVal}
                              onChange={e => setShopEditVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") commitShopEdit(emp.techId);
                                if (e.key === "Escape") setEditingShopId(null);
                              }}
                              autoFocus
                              type="number"
                              min="0"
                            />
                            <button onClick={() => commitShopEdit(emp.techId)} className="text-emerald-600 hover:text-emerald-700">
                              <Check className="size-4"/>
                            </button>
                            <button onClick={() => setEditingShopId(null)} className="text-muted-foreground hover:text-red-500">
                              <X className="size-4"/>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startShopEdit(emp.techId, usedYtd)}
                            className="group inline-flex flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors bg-muted/50 hover:bg-primary/10 hover:text-primary"
                          >
                            <span className={usedYtd >= allowedYr && allowedYr > 0 ? "text-red-500" : "text-foreground"}>
                              {usedYtd} used
                            </span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {allowedScaled}{periodSuffix} allowed
                            </span>
                            <Edit3 className="size-3 opacity-0 group-hover:opacity-100 text-primary"/>
                          </button>
                        )}
                      </td>
                    );
                  })()}

                  {/* Training Days column */}
                  {canEditShopDays && (() => {
                    const td   = trainingDaysData?.[emp.techId];
                    const used    = td?.used    ?? 0;
                    const allowed = td?.allowed ?? 3;
                    return (
                      <td className="px-3 py-3 text-center">
                        {editingTrainId === emp.techId ? (
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              className="h-8 w-16 text-sm px-1 text-center"
                              value={trainEditVal}
                              onChange={e => setTrainEditVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") commitTrainEdit(emp.techId);
                                if (e.key === "Escape") setEditingTrainId(null);
                              }}
                              autoFocus
                              type="number"
                              min="0"
                            />
                            <button onClick={() => commitTrainEdit(emp.techId)} className="text-emerald-600 hover:text-emerald-700">
                              <Check className="size-4"/>
                            </button>
                            <button onClick={() => setEditingTrainId(null)} className="text-muted-foreground hover:text-red-500">
                              <X className="size-4"/>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startTrainEdit(emp.techId, used)}
                            className="group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors bg-muted/50 hover:bg-amber-500/10 hover:text-amber-600"
                          >
                            <span className={used >= allowed && allowed > 0 ? "text-amber-600" : "text-foreground"}>
                              {used}/{allowed}
                            </span>
                            <Edit3 className="size-3 opacity-0 group-hover:opacity-100 text-amber-500"/>
                          </button>
                        )}
                      </td>
                    );
                  })()}

                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-base text-foreground">{fmt(weekTotal)}</span>
                    {emp.shopDaysThisWeek > 0 && (
                      <div className="text-xs text-red-500">{emp.shopDaysThisWeek} shop day{emp.shopDaysThisWeek !== 1 ? "s" : ""}</div>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Totals row */}
            <tr className="bg-muted/40 font-semibold">
              <td className="px-4 py-3 text-sm text-foreground">TOTAL</td>
              {[0, 1, 2, 3, 4, 5, 6].map(i => {
                const dayTotal = empSchedules.reduce((s, emp) =>
                  getEffectiveType(emp.techId, i, emp.days[i]?.type ?? "off") === "billable" ? s + getDayRev(emp.techId, i) : s, 0);
                const shopCount    = empSchedules.filter(e => getEffectiveType(e.techId, i, e.days[i]?.type ?? "off") === "shop").length;
                const trainCount   = empSchedules.filter(e => getEffectiveType(e.techId, i, e.days[i]?.type ?? "off") === "training").length;
                const calloutCount = empSchedules.filter(e => getEffectiveType(e.techId, i, e.days[i]?.type ?? "off") === "callout").length;
                const billCount    = empSchedules.filter(e => getEffectiveType(e.techId, i, e.days[i]?.type ?? "off") === "billable").length;
                const isWeekend = i >= 5;
                return (
                  <td key={i} className={`px-1 py-3 text-center ${isWeekend ? "opacity-60" : ""}`}>
                    {billCount > 0 && (
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmt(dayTotal, true)}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5 space-x-1">
                      {shopCount    > 0 && <span className="text-red-500">{shopCount}S</span>}
                      {trainCount   > 0 && <span className="text-amber-500">{trainCount}T</span>}
                      {calloutCount > 0 && <span className="text-purple-500">{calloutCount}C</span>}
                      {billCount    > 0 && <span className="text-emerald-600">{billCount}B</span>}
                      {shopCount === 0 && trainCount === 0 && calloutCount === 0 && billCount === 0 && isWeekend && (
                        <span className="text-muted-foreground/40 text-[10px]">—</span>
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="px-3 py-3" />
              {canEditShopDays && <td className="px-3 py-3" />}
              {canEditShopDays && <td className="px-3 py-3" />}
              <td className="px-4 py-3 text-right text-foreground text-base">{fmt(totalWeekRev)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Expense summary rows */}
      <div className="border-t border-border divide-y divide-border/50">
        {[
          { label: "💼 Salary Cost (pro-rated)", value: salaryCostWeek, cls: "text-muted-foreground" },
          { label: `📊 Payroll Burden (${params.burdenPct}%)`, value: burdenCostWeek, cls: "text-muted-foreground" },
          { label: `⛽ Fuel (${fmt(params.fuelPerDay)}/day)`, value: fuelCostWeek, cls: "text-amber-600 dark:text-amber-400" },
          { label: `🔧 Tools (${fmt(params.toolsPerDay)}/day)`, value: toolsCostWeek, cls: "text-blue-600 dark:text-blue-400" },
        ].map(row => (
          <div key={row.label} className="px-4 py-3 flex items-center justify-between">
            <span className={`text-sm ${row.cls}`}>{row.label}</span>
            <span className={`text-base font-medium ${row.cls}`}>({fmt(row.value)})</span>
          </div>
        ))}
        <div className="px-4 py-4 flex items-center justify-between bg-muted/30">
          <span className="font-semibold text-base text-foreground">Net Weekly P&L</span>
          <span className={`text-xl font-bold ${netWeekPL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
            {netWeekPL >= 0 ? "+" : ""}{fmt(netWeekPL)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Burden Settings Dialog ───────────────────────────────────────────────────

function BurdenSettingsDialog({
  open, params, onClose, onSave,
}: {
  open: boolean; params: BurdenParams; onClose: () => void; onSave: (p: BurdenParams) => void;
}) {
  const [draft, setDraft] = useState<BurdenParams>(params);

  function upd(key: keyof BurdenParams, val: string) {
    const n = parseFloat(val);
    if (!isNaN(n)) setDraft(prev => ({ ...prev, [key]: n }));
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5 text-primary"/> Burden Calculation Settings
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            These values affect all P&L calculations. Changes apply to this session only.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Payroll Burden %</Label>
              <div className="flex items-center gap-1">
                <Input className="h-8 text-xs" value={draft.burdenPct} onChange={e => upd("burdenPct", e.target.value)}/>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Taxes, benefits on top of salary</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Working Days / Year</Label>
              <Input className="h-8 text-xs" value={draft.workDaysPerYear} onChange={e => upd("workDaysPerYear", e.target.value)}/>
              <p className="text-[10px] text-muted-foreground">Used for daily salary proration</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Working Days / Month</Label>
              <Input className="h-8 text-xs" value={draft.workDaysPerMonth} onChange={e => upd("workDaysPerMonth", e.target.value)}/>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Working Days / Week</Label>
              <Input className="h-8 text-xs" value={draft.workDaysPerWeek} onChange={e => upd("workDaysPerWeek", e.target.value)}/>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Fuel Cost / Billable Day</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <Input className="h-8 text-xs" value={draft.fuelPerDay} onChange={e => upd("fuelPerDay", e.target.value)}/>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tools Cost / Billable Day</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <Input className="h-8 text-xs" value={draft.toolsPerDay} onChange={e => upd("toolsPerDay", e.target.value)}/>
              </div>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs font-semibold">Work Hours / Day</Label>
              <Input className="h-8 text-xs" value={draft.hoursPerDay} onChange={e => upd("hoursPerDay", e.target.value)}/>
              <p className="text-[10px] text-muted-foreground">Used for hourly rate conversion</p>
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <div className="font-semibold mb-1.5">Formula Preview (example at $85k):</div>
            <div>Daily salary: <strong>${Math.round(85000 / draft.workDaysPerYear)}</strong>/day</div>
            <div>Daily burden: <strong>${Math.round(85000 * draft.burdenPct / 100 / draft.workDaysPerYear)}</strong>/day ({draft.burdenPct}%)</div>
            <div>Hourly salary: <strong>${(85000 / draft.workDaysPerYear / draft.hoursPerDay).toFixed(2)}</strong>/hr</div>
            <div>Total daily cost: <strong>${Math.round(85000 * (1 + draft.burdenPct/100) / draft.workDaysPerYear + draft.fuelPerDay + draft.toolsPerDay)}</strong>/day</div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => { onSave(draft); onClose(); }}>
              <Check className="size-3.5 mr-1.5"/> Apply Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Formula Explanation Panel ────────────────────────────────────────────────

function PnLFormulaPanel({ params, hourly, onEditParams }: { params: BurdenParams; hourly: boolean; onEditParams: () => void }) {
  const [open, setOpen] = useState(false);
  const exSalary = 85000;
  const dailySalary = exSalary / params.workDaysPerYear;
  const dailyBurden = exSalary * (params.burdenPct / 100) / params.workDaysPerYear;
  const dailyCost = dailySalary + dailyBurden + params.fuelPerDay + params.toolsPerDay;
  const exBillRate = 320;
  const exRevenue = exBillRate;
  const exProfit = exRevenue - dailyCost;
  const exROI = (exProfit / dailyCost) * 100;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Info className="size-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <span className="text-sm font-semibold">How is this calculated?</span>
            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
              Daily cost = salary proration + burden + fuel + tools · Revenue = bill rate × billable days
            </span>
          </div>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Revenue */}
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10 p-3 space-y-1.5">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Revenue</div>
              <div className="font-mono text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 rounded px-2 py-1">
                Bill Rate × Billable Days
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Billable days = working days in period minus any shop days or training days used.
                {hourly && " In hourly mode, divide by hours/day."}
              </p>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                e.g. ${exBillRate}/day × 5 days = <strong>${(exBillRate * 5).toLocaleString()}/wk</strong>
              </div>
            </div>

            {/* Salary Cost */}
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10 p-3 space-y-1.5">
              <div className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Salary Cost</div>
              <div className="font-mono text-sm text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded px-2 py-1">
                Salary ÷ {params.workDaysPerYear} working days
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Annual salary prorated to the selected period. {params.workDaysPerYear} working days/year is configurable in Burden Settings.
              </p>
              <div className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">
                e.g. ${exSalary.toLocaleString()} ÷ {params.workDaysPerYear} = <strong>${dailySalary.toFixed(2)}/day</strong>
              </div>
            </div>

            {/* Burden Cost */}
            <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/10 p-3 space-y-1.5">
              <div className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wide">Burden Cost ({params.burdenPct}%)</div>
              <div className="font-mono text-sm text-violet-800 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 rounded px-2 py-1">
                Salary × {params.burdenPct}% ÷ {params.workDaysPerYear} days
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Employer taxes, benefits, insurance, and overhead on top of base salary. Burden % is configurable.
              </p>
              <div className="text-[11px] text-violet-700 dark:text-violet-400 font-medium">
                e.g. ${exSalary.toLocaleString()} × {params.burdenPct}% ÷ {params.workDaysPerYear} = <strong>${dailyBurden.toFixed(2)}/day</strong>
              </div>
            </div>

            {/* Fuel & Tools */}
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10 p-3 space-y-1.5">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Fuel + Tools</div>
              <div className="font-mono text-sm text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 rounded px-2 py-1">
                ${params.fuelPerDay}/day + ${params.toolsPerDay}/day
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Flat per-billable-day costs for vehicle fuel and tool wear. Applied on billable days only (not shop/training days).
              </p>
              <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                Combined: <strong>${params.fuelPerDay + params.toolsPerDay}/billable day</strong>
              </div>
            </div>

            {/* Net Profit */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <div className="text-xs font-bold text-foreground uppercase tracking-wide">Net Profit</div>
              <div className="font-mono text-sm bg-muted rounded px-2 py-1">
                Revenue − Total Cost
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Revenue minus all costs: salary + burden + fuel + tools. Negative means the tech costs more than they bill.
              </p>
              <div className="text-[11px] text-foreground font-medium">
                e.g. ${exRevenue} − ${dailyCost.toFixed(0)} = <strong className={exProfit >= 0 ? "text-emerald-600" : "text-red-500"}>${exProfit.toFixed(0)}/day</strong>
              </div>
            </div>

            {/* ROI */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <div className="text-xs font-bold text-foreground uppercase tracking-wide">ROI %</div>
              <div className="font-mono text-sm bg-muted rounded px-2 py-1">
                Net Profit ÷ Total Cost × 100
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Return on investment: how many cents of profit for every dollar spent on this technician. 30%+ is healthy.
              </p>
              <div className="text-[11px] text-foreground font-medium">
                e.g. ${exProfit.toFixed(0)} ÷ ${dailyCost.toFixed(0)} × 100 = <strong className={exROI >= 0 ? "text-emerald-600" : "text-red-500"}>{exROI.toFixed(1)}%</strong>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 px-3.5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
            <span>📋 <strong>Period scaling:</strong> Weekly ÷ 52 · Monthly ÷ 12 · Annual = full year</span>
            <span>🏪 <strong>Shop days:</strong> non-billable days (no fuel/tools cost, still has salary/burden)</span>
            {hourly && <span>⏱ <strong>Hourly mode:</strong> all values ÷ {params.hoursPerDay} hrs/day</span>}
            <button onClick={onEditParams} className="underline hover:no-underline text-primary font-medium ml-auto">
              Edit burden parameters →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DEFAULT_PARAMS: BurdenParams = {
  burdenPct: 30, fuelPerDay: 85, toolsPerDay: 40,
  workDaysPerYear: 260, workDaysPerMonth: 22, workDaysPerWeek: 5, hoursPerDay: 8,
};

export function ProfitabilityPage() {
  const { user } = useAuth();
  const canEditShopDays = user?.role === "manager" || user?.role === "supervisor";

  const [period, setPeriod]   = useState<Period>("monthly");
  const [hourly, setHourly]   = useState(false);
  const [params, setParams]   = useState<BurdenParams>(DEFAULT_PARAMS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiEmployees, setApiEmployees] = useState<ApiEmployee[]>([]);
  const [apiJobs,      setApiJobs]      = useState<ApiJob[]>([]);
  const [techRates,    setTechRates]    = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      getEmployees(),
      getJobs(),
    ]).then(([emps, jobs]) => {
      setApiEmployees(emps);
      setApiJobs(jobs);
      setTechRates(prev =>
        Object.keys(prev).length > 0
          ? prev
          : Object.fromEntries(emps.map(e => [String(e.id), e.billableRate]))
      );
    }).catch(() => {});
  }, []);

  // Compute actual revenue from jobs scheduled in the current week (Mon–Sun)
  const weekActualRevByEmp = useMemo(() => {
    const now   = new Date();
    const dow   = now.getDay(); // 0=Sun, 1=Mon…
    const mDiff = dow === 0 ? -6 : 1 - dow;
    const mon   = new Date(now); mon.setDate(now.getDate() + mDiff); mon.setHours(0,0,0,0);
    const sun   = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
    const byDay: Record<string, Record<number, number>> = {};
    apiJobs.forEach(j => {
      if (!j.scheduledDate || j.employeeId == null) return;
      const d = new Date(j.scheduledDate + "T12:00:00");
      if (d < mon || d > sun) return;
      const empKey = String(j.employeeId);
      const dayIdx = (d.getDay() + 6) % 7; // Mon=0…Sat=5, Sun=6
      if (!byDay[empKey]) byDay[empKey] = {};
      byDay[empKey][dayIdx] = (byDay[empKey][dayIdx] ?? 0) + j.revenue;
    });
    return byDay;
  }, [apiJobs]);

  // Total actual weekly revenue across all employees
  const actualWeekRevenue = useMemo(() =>
    Object.values(weekActualRevByEmp).reduce((s, days) =>
      s + Object.values(days).reduce((a, b) => a + b, 0), 0),
    [weekActualRevByEmp]
  );

  function handleRateChange(id: string, rate: number) {
    setTechRates(prev => ({ ...prev, [id]: rate }));
  }

  async function handleShopDayChange(techId: string, used: number) {
    const id = Number(techId);
    try {
      await updateEmployee(id, { shopDaysUsedYtd: used });
      setApiEmployees(prev => prev.map(e => e.id === id ? { ...e, shopDaysUsedYtd: used } : e));
    } catch {
      // silently fail — the table will revert on next data load
    }
  }

  async function handleTrainingDayChange(techId: string, used: number) {
    const id = Number(techId);
    try {
      await updateEmployee(id, { trainingDaysUsedYtd: used });
      setApiEmployees(prev => prev.map(e => e.id === id ? { ...e, trainingDaysUsedYtd: used } : e));
    } catch {
      // silently fail
    }
  }

  const techRows: TechRow[] = apiEmployees.map(e => ({
    id: String(e.id),
    name: e.name,
    role: e.role,
    salary: e.salary,
    billRate: techRates[String(e.id)] ?? e.billableRate,
    utilization: e.utilizationPct,
    shopDaysUsed: e.shopDaysUsedYtd,
    shopDaysAllowed: e.allowedShopDays,
    revenueYTD: 0,
    revenueMonth: 0,
    status: e.isActive ? "active" : "inactive",
  }));

  // Derive week schedule from employee data — 7 days (Mon–Sun), Sat/Sun default to "off"
  const empSchedules: WeekSchedule[] = apiEmployees.map(e => {
    const shopDaysLeft = Math.max(0, e.allowedShopDays - e.shopDaysUsedYtd);
    const shopDaysThisWeek = shopDaysLeft > 0 && e.allowedShopDays > 0 ? 1 : 0;
    const billableDays = 5 - shopDaysThisWeek;
    const days: WeekScheduleDay[] = Array(7).fill(null).map((_, i) => {
      if (i >= 5) return { type: "off" as DayType };  // Sat & Sun — off by default, fully editable
      const type: DayType = i < billableDays ? "billable" : "shop";
      return { type };
    });
    return {
      techId: String(e.id),
      techName: e.name,
      cert: e.certifications.slice(0, 2).join(", ") || "General",
      days,
      shopDaysThisWeek,
    };
  });

  const salaryData = apiEmployees.map(e => ({ id: String(e.id), salary: e.salary }));

  const pnlRows = useMemo(() =>
    techRows.map(t => ({ tech: t, ...calcRow(t, techRates[t.id] ?? t.billRate, period, params) })),
    [techRows, period, params, techRates]
  );

  const totals = useMemo(() => pnlRows.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    salaryCost: acc.salaryCost + r.salaryCost,
    burdenCost: acc.burdenCost + r.burdenCost,
    fuelCost: acc.fuelCost + r.fuelCost,
    toolsCost: acc.toolsCost + r.toolsCost,
    totalCost: acc.totalCost + r.totalCost,
    netProfit: acc.netProfit + r.netProfit,
  }), { revenue: 0, salaryCost: 0, burdenCost: 0, fuelCost: 0, toolsCost: 0, totalCost: 0, netProfit: 0 }), [pnlRows]);

  const periodLabel = period === "weekly" ? "Weekly" : period === "monthly" ? "Monthly" : "Annual";
  const unitLabel   = hourly ? "/hr" : `/${period === "annual" ? "yr" : period === "monthly" ? "mo" : "wk"}`;

  const chartData = pnlRows.map(r => ({
    name: r.tech.name.split(" ")[0],
    Revenue: Math.round(r.revenue),
    "Total Cost": Math.round(r.totalCost),
    "Net Profit": Math.round(r.netProfit),
  }));

  function downloadPnlCsv() {
    const rows = [["Name","Role","Salary","Bill Rate","Utilization","Revenue","Salary Cost","Burden Cost","Fuel Cost","Tools Cost","Total Cost","Net Profit","ROI%"]];
    pnlRows.forEach(r => rows.push([
      r.tech.name, r.tech.role, r.tech.salary.toFixed(0),
      (techRates[r.tech.id] ?? r.tech.billRate).toFixed(2),
      r.tech.utilization.toString(),
      Math.round(r.revenue).toString(), Math.round(r.salaryCost).toString(),
      Math.round(r.burdenCost).toString(), Math.round(r.fuelCost).toString(),
      Math.round(r.toolsCost).toString(), Math.round(r.totalCost).toString(),
      Math.round(r.netProfit).toString(), Math.round(r.roi).toString(),
    ]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `pl-${period}.csv` });
    a.click();
  }

  const insights = [
    ...pnlRows.filter(r => r.netProfit < 0).map(r => ({ type: "error" as const, msg: `${r.tech.name.split(" ")[0]} is unprofitable — ${fmt(r.netProfit)} ${period}` })),
    ...pnlRows.filter(r => r.tech.utilization < 75 && r.tech.utilization > 0).map(r => ({ type: "warn" as const, msg: `${r.tech.name.split(" ")[0]} utilization ${r.tech.utilization}% — below 75% target` })),
    ...pnlRows.filter(r => r.roi > 50).map(r => ({ type: "good" as const, msg: `${r.tech.name.split(" ")[0]} ROI ${Math.round(r.roi)}% — strong performer` })),
  ].slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="size-6 text-primary shrink-0"/> P&L Engine
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Profit & loss breakdown — salary, burden, fuel, tools vs. billable revenue
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setHourly(h => !h)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors"
          >
            <Clock className="size-3.5 text-primary"/>
            {hourly ? <ToggleRight className="size-4 text-primary"/> : <ToggleLeft className="size-4 text-muted-foreground"/>}
            <span className="font-medium">{hourly ? "Hourly" : "Daily"}</span>
          </button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadPnlCsv}>
            <Download className="size-3.5"/> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-3.5"/> Burden Settings
          </Button>
          <Tabs value={period} onValueChange={v => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
              <TabsTrigger value="annual" className="text-xs">Annual</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Insights Panel */}
      {insights.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {insights.map((ins, i) => (
            <div key={i} className={`rounded-xl border p-3 flex items-start gap-2.5 ${
              ins.type === "error" ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/10" :
              ins.type === "warn" ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/10" :
              "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/10"
            }`}>
              <AlertTriangle className={`size-4 shrink-0 mt-0.5 ${ins.type === "error" ? "text-red-500" : ins.type === "warn" ? "text-amber-500" : "text-emerald-500"}`} />
              <span className="text-xs font-medium">{ins.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Formula Explanation Panel */}
      <PnLFormulaPanel params={params} hourly={hourly} onEditParams={() => setSettingsOpen(true)} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: period === "weekly" && actualWeekRevenue > 0 ? "Weekly Revenue (Actual)" : `${periodLabel} Revenue${hourly ? " (avg/hr)" : ""}`,
            value: period === "weekly" && actualWeekRevenue > 0
              ? (hourly ? actualWeekRevenue / (params.workDaysPerWeek * params.hoursPerDay) : actualWeekRevenue)
              : (hourly ? totals.revenue / (workDays(period, params) * params.hoursPerDay) : totals.revenue),
            icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30",
          },
          {
            label: `${periodLabel} Net Profit${hourly ? " (avg/hr)" : ""}`,
            value: (() => {
              if (period === "weekly" && actualWeekRevenue > 0) {
                const wCosts = totals.salaryCost / (params.workDaysPerYear / params.workDaysPerWeek) + totals.fuelCost / (params.workDaysPerYear / params.workDaysPerWeek) + totals.toolsCost / (params.workDaysPerYear / params.workDaysPerWeek);
                const net = actualWeekRevenue - wCosts;
                return hourly ? net / (params.workDaysPerWeek * params.hoursPerDay) : net;
              }
              return hourly ? totals.netProfit / (workDays(period, params) * params.hoursPerDay) : totals.netProfit;
            })(),
            icon: totals.netProfit >= 0 ? TrendingUp : TrendingDown,
            color: totals.netProfit >= 0 ? "text-emerald-600" : "text-red-500",
            bg: totals.netProfit >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30",
          },
          { label: `Fuel Cost${unitLabel}`, value: hourly ? totals.fuelCost / (workDays(period, params) * params.hoursPerDay) : totals.fuelCost, icon: Fuel, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
          { label: `Tools Cost${unitLabel}`, value: hourly ? totals.toolsCost / (workDays(period, params) * params.hoursPerDay) : totals.toolsCost, icon: Wrench, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`size-8 sm:size-9 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`size-4 sm:size-5 ${kpi.color}`}/>
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight line-clamp-2">{kpi.label}</div>
                    <div className={`text-lg sm:text-xl font-bold ${kpi.color} mt-0.5`}>{fmt(kpi.value, true)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Editable weekly table */}
      {apiEmployees.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading employee data…</div>
      ) : (
        <WeeklyTable
          techRates={techRates}
          onRateChange={handleRateChange}
          params={params}
          hourly={hourly}
          empSchedules={empSchedules}
          salaryData={salaryData}
          canEditShopDays={canEditShopDays}
          onShopDayChange={handleShopDayChange}
          shopDaysData={Object.fromEntries(apiEmployees.map(e => [String(e.id), { used: e.shopDaysUsedYtd, allowed: e.allowedShopDays }]))}
          onTrainingDayChange={handleTrainingDayChange}
          trainingDaysData={Object.fromEntries(apiEmployees.map(e => [String(e.id), { used: e.trainingDaysUsedYtd, allowed: e.allowedTrainingDays }]))}
          initialDayRevOverrides={weekActualRevByEmp}
          period={period}
        />
      )}

      {/* Per-tech P&L table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Per-Technician {periodLabel} P&L</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hourly ? "Hourly rate breakdown (total ÷ billable hours)" : "Revenue vs. full cost per employee"}
            </p>
          </div>
          {hourly && <Badge variant="secondary" className="text-[10px]">Hourly Mode</Badge>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Technician</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">
                  Revenue{hourly ? " /hr" : ""}
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Salary</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Burden</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Fuel+Tools</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Net P&L</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {pnlRows.map(r => {
                const hrs = r.billableDays * params.hoursPerDay;
                const div = hourly && hrs > 0 ? hrs : 1;
                return (
                  <tr key={r.tech.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground text-sm">{r.tech.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.tech.role} · {r.billableDays}d billable · {fmtRate(techRates[r.tech.id] ?? r.tech.billRate, hourly, params.hoursPerDay)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                      {fmt(r.revenue / div)}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground hidden md:table-cell">({fmt(r.salaryCost / div)})</td>
                    <td className="px-3 py-3 text-right text-muted-foreground hidden md:table-cell">({fmt(r.burdenCost / div)})</td>
                    <td className="px-3 py-3 text-right text-amber-600 dark:text-amber-400 hidden md:table-cell">({fmt((r.fuelCost + r.toolsCost) / div)})</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${r.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {r.netProfit >= 0 ? "+" : ""}{fmt(r.netProfit / div)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Badge variant="outline" className={`text-[10px] ${r.roi >= 200 ? "border-emerald-500 text-emerald-600" : r.roi >= 100 ? "border-amber-500 text-amber-600" : "border-red-500 text-red-500"}`}>
                        {r.roi >= 0 ? "+" : ""}{Math.round(r.roi)}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/40 font-semibold border-t border-border">
                <td className="px-4 py-3 text-sm text-foreground">TOTAL</td>
                <td className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400">{fmt(totals.revenue)}</td>
                <td className="px-3 py-3 text-right text-muted-foreground hidden md:table-cell">({fmt(totals.salaryCost)})</td>
                <td className="px-3 py-3 text-right text-muted-foreground hidden md:table-cell">({fmt(totals.burdenCost)})</td>
                <td className="px-3 py-3 text-right text-amber-600 dark:text-amber-400 hidden md:table-cell">({fmt(totals.fuelCost + totals.toolsCost)})</td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-lg font-bold ${totals.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {totals.netProfit >= 0 ? "+" : ""}{fmt(totals.netProfit)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <Badge className={`text-[10px] ${totals.netProfit >= 0 ? "bg-emerald-600" : "bg-red-500"}`}>
                    {totals.totalCost > 0 ? Math.round((totals.netProfit / totals.totalCost) * 100) : 0}%
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue vs. Cost vs. Profit — {periodLabel}</CardTitle>
          <CardDescription>Full cost stack: salary + payroll burden + fuel + tools</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)"/>
              <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }}/>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey="Revenue" fill="#22c55e" radius={[4,4,0,0]}/>
              <Bar dataKey="Total Cost" fill="#f59e0b" radius={[4,4,0,0]}/>
              <Bar dataKey="Net Profit" fill="#3b82f6" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <BurdenSettingsDialog
        open={settingsOpen}
        params={params}
        onClose={() => setSettingsOpen(false)}
        onSave={p => setParams(p)}
      />
    </div>
  );
}
