import { useState, useMemo, useEffect } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Fuel, Wrench,
  Info, Settings, Clock, ToggleLeft, ToggleRight, Edit3, Check, X, Download, AlertTriangle,
  ChevronUp, ChevronDown, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getEmployees, getJobs, updateEmployee, serviceTypeLabel, type ApiEmployee, type ApiJob } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type Period = "weekly" | "monthly" | "annual";

interface BurdenParams {
  burdenPct: number;
  taxPct: number;
  fuelPerDay: number;
  toolsPerDay: number;
  workDaysPerYear: number;
  workDaysPerMonth: number;
  workDaysPerWeek: number;
  hoursPerDay: number;
}

interface TechRow {
  id: string; name: string; role: string; salary: number;
  hourlyRate: number; hoursPerDay: number;
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
  const billableDays = Math.round(wd * (tech.utilization / 100));
  const shopDays     = wd - billableDays;
  const revenue      = rate * billableDays;
  const dailyWage    = tech.hourlyRate * tech.hoursPerDay;
  const wageCost     = dailyWage * wd;
  const burdenCost   = wageCost * (p.burdenPct / 100);
  const fuelCost     = billableDays * p.fuelPerDay;
  const toolsCost    = billableDays * p.toolsPerDay;
  const totalCost    = wageCost + burdenCost + fuelCost + toolsCost;
  const netProfit    = revenue - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  return { revenue, salaryCost: wageCost, burdenCost, fuelCost, toolsCost, totalCost, netProfit, roi, billableDays, shopDays };
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
  actualRevByEmp,
  weekJobsByEmp,
  weekStart,
  onNavWeek,
  period,
}: {
  techRates: Record<string, number>;
  onRateChange: (id: string, rate: number) => void;
  params: BurdenParams;
  hourly: boolean;
  empSchedules: WeekSchedule[];
  salaryData: Array<{ id: string; hourlyRate: number; hoursPerDay: number }>;
  canEditShopDays?: boolean;
  onShopDayChange?: (techId: string, used: number) => void;
  shopDaysData?: Record<string, { used: number; allowed: number }>;
  onTrainingDayChange?: (techId: string, used: number) => void;
  trainingDaysData?: Record<string, { used: number; allowed: number }>;
  actualRevByEmp?: Record<string, Record<number, number>>;
  weekJobsByEmp?: Record<string, Record<number, ApiJob[]>>;
  weekStart?: Date;
  onNavWeek?: (delta: number) => void;
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

  // Fixed popup position (captured from button rect to avoid table layout shift)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Per-day actual cost overrides (fuel + tools per tech per day)
  const [dayFuelOverrides,  setDayFuelOverrides]  = useState<Record<string, Record<number, number>>>({});
  const [dayToolsOverrides, setDayToolsOverrides] = useState<Record<string, Record<number, number>>>({}); 

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

  // Priority: manual cell edit → actual job revenue for that day → projected rate
  function getDayRev(techId: string, dayIdx: number) {
    if (dayRevOverrides[techId]?.[dayIdx] !== undefined) return dayRevOverrides[techId][dayIdx];
    if (actualRevByEmp?.[techId]?.[dayIdx] !== undefined) return actualRevByEmp[techId][dayIdx];
    return techRates[techId] ?? 0;
  }

  // Whether a cell has been manually edited (highest priority)
  function isCellEdited(techId: string, dayIdx: number) {
    return dayRevOverrides[techId]?.[dayIdx] !== undefined;
  }

  // Whether a cell has actual job revenue data (second priority)
  function isCellActual(techId: string, dayIdx: number) {
    return !isCellEdited(techId, dayIdx) && actualRevByEmp?.[techId]?.[dayIdx] !== undefined;
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

  // Per-day actual cost helpers
  function getActualFuel(techId: string, dayIdx: number) {
    return dayFuelOverrides[techId]?.[dayIdx] ?? params.fuelPerDay;
  }
  function getActualTools(techId: string, dayIdx: number) {
    return dayToolsOverrides[techId]?.[dayIdx] ?? params.toolsPerDay;
  }
  function setActualFuel(techId: string, dayIdx: number, val: number) {
    setDayFuelOverrides(prev => ({ ...prev, [techId]: { ...(prev[techId] ?? {}), [dayIdx]: val } }));
  }
  function setActualTools(techId: string, dayIdx: number, val: number) {
    setDayToolsOverrides(prev => ({ ...prev, [techId]: { ...(prev[techId] ?? {}), [dayIdx]: val } }));
  }
  function isFuelActual(techId: string, dayIdx: number) {
    return dayFuelOverrides[techId]?.[dayIdx] !== undefined;
  }
  function isToolsActual(techId: string, dayIdx: number) {
    return dayToolsOverrides[techId]?.[dayIdx] !== undefined;
  }

  function openMenuAt(e: React.MouseEvent, techId: string, dayIdx: number) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const POPUP_W = 232;
    const POPUP_H = 460;
    const MARGIN = 8;
    // Clamp x so popup never bleeds off right/left edge
    const px = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - POPUP_W - MARGIN));
    // Try below first; if not enough room try above; otherwise just pin to top with scroll
    let py: number;
    if (rect.bottom + 4 + POPUP_H <= window.innerHeight - MARGIN) {
      py = rect.bottom + 4;
    } else if (rect.top - POPUP_H >= MARGIN) {
      py = rect.top - POPUP_H;
    } else {
      py = MARGIN;
    }
    setMenuPos({ x: px, y: py });
    setOpenTypeMenu({ techId, dayIdx });
  }

  function closeMenu() {
    setOpenTypeMenu(null);
    setMenuPos(null);
  }

  function getTechWeekTotal(emp: WeekSchedule) {
    return emp.days.reduce((s, d, i) =>
      getEffectiveType(emp.techId, i, d.type) === "billable" ? s + getDayRev(emp.techId, i) : s, 0);
  }

  const totalWeekRev = empSchedules.reduce((s, emp) => s + getTechWeekTotal(emp), 0);

  const salaryCostWeek = salaryData.reduce((s, e) => s + e.hourlyRate * e.hoursPerDay * params.workDaysPerWeek, 0);
  const burdenCostWeek = salaryData.reduce((s, e) => s + e.hourlyRate * e.hoursPerDay * params.workDaysPerWeek * (params.burdenPct / 100), 0);
  const fuelCostWeek   = empSchedules.reduce((s, e) => s + e.days.reduce((ds, d, i) =>
    getEffectiveType(e.techId, i, d.type) === "billable" ? ds + getActualFuel(e.techId, i) : ds, 0), 0);
  const toolsCostWeek  = empSchedules.reduce((s, e) => s + e.days.reduce((ds, d, i) =>
    getEffectiveType(e.techId, i, d.type) === "billable" ? ds + getActualTools(e.techId, i) : ds, 0), 0);
  const netWeekPL = totalWeekRev - salaryCostWeek - burdenCostWeek - fuelCostWeek - toolsCostWeek;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-foreground">Daily Billable Table</h3>
            {/* Week navigation */}
            {onNavWeek && weekStart && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onNavWeek(-1)}
                  className="size-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Previous week"
                >
                  <ChevronDown className="size-3.5 rotate-90" />
                </button>
                <span className="text-xs font-medium text-foreground px-1 whitespace-nowrap">
                  {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" – "}
                  {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <button
                  onClick={() => onNavWeek(1)}
                  className="size-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Next week"
                >
                  <ChevronDown className="size-3.5 -rotate-90" />
                </button>
                <button
                  onClick={() => onNavWeek(0)}
                  className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted text-muted-foreground transition-colors ml-1"
                  title="Jump to current week"
                >
                  Today
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="inline-flex items-center gap-1 mr-2"><span className="inline-block size-2 rounded-sm bg-emerald-500 opacity-80"/>actual = sum of job revenues · click ▾ to see breakdown</span>
            <span className="inline-flex items-center gap-1 mr-2"><span className="inline-block size-2 rounded-sm bg-emerald-200"/>projected = estimated</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-sm bg-blue-400"/>edited = manual override</span>
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

              // Per-employee daily cost (wage + burden) for P&L display
              const empSal = salaryData.find(s => s.id === emp.techId);
              const empDailyWage   = (empSal?.hourlyRate ?? 0) * (empSal?.hoursPerDay ?? 8);
              const empDailyBurden = empDailyWage * (params.burdenPct / 100);
              const empDailyCost   = empDailyWage + empDailyBurden;

              return (
                <tr key={emp.techId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground text-sm">{emp.techName}</div>
                    <div className="text-xs text-muted-foreground">{emp.cert}</div>
                  </td>

                  {emp.days.map((d, i) => {
                    const effectiveType = getEffectiveType(emp.techId, i, d.type);

                    // ── Billable cell ──
                    if (effectiveType === "billable") {
                      const dayRev = getDayRev(emp.techId, i);
                      const edited  = isCellEdited(emp.techId, i);
                      const actual  = isCellActual(emp.techId, i);
                      const isEditingThisCell = editingCell?.techId === emp.techId && editingCell?.dayIdx === i;

                      // Per-day P&L = revenue minus daily wage+burden (weekends have no wage cost)
                      const isWorkDay = i < 5;
                      const dayPL = dayRev - (isWorkDay ? empDailyCost : 0);

                      // Color + label based on data source
                      const cellCls = edited
                        ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                        : actual
                          ? "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                          : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 opacity-60";
                      const cellLabel = edited ? "edited" : actual ? "actual" : "projected";

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
                                className={`group inline-flex flex-col items-center rounded-md px-2 py-1.5 transition-colors ${cellCls}`}
                                title={actual ? "Sum of all jobs completed this day — click to override" : edited ? "Manually edited — click to change" : "Projected rate — click to enter actual"}
                              >
                                <span className="text-sm font-bold leading-tight">{fmt(dayRev, true)}</span>
                                <span className="text-[11px] opacity-70 flex items-center gap-0.5 leading-tight">
                                  {cellLabel}
                                  <Edit3 className="size-2.5 opacity-0 group-hover:opacity-100" />
                                </span>
                              </button>
                              {/* Per-day P&L */}
                              <span
                                className={`text-[10px] font-semibold tabular-nums leading-tight ${dayPL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
                                title={`Day P&L: $${Math.round(dayRev)} revenue − $${Math.round(isWorkDay ? empDailyCost : 0)} cost`}
                              >
                                {dayPL >= 0 ? "+" : ""}{fmt(dayPL, true)}
                              </span>
                              <button
                                onClick={e => openMenuAt(e, emp.techId, i)}
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
                          onClick={e => openMenuAt(e, emp.techId, i)}
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
          { label: "💼 Wage Cost (hourly × hrs/day)", value: salaryCostWeek, cls: "text-muted-foreground" },
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

      {/* ── Floating day-type popup — fixed position so it never shifts the table layout ── */}
      {openTypeMenu && menuPos && (() => {
        const omEmp = empSchedules.find(e => e.techId === openTypeMenu.techId);
        if (!omEmp) return null;
        const omI        = openTypeMenu.dayIdx;
        const omD        = omEmp.days[omI];
        const omType     = getEffectiveType(omEmp.techId, omI, omD?.type ?? "billable");
        const omJobs     = weekJobsByEmp?.[omEmp.techId]?.[omI] ?? [];
        const omSal      = salaryData.find(s => s.id === omEmp.techId);
        const omHr       = omSal?.hourlyRate ?? 0;
        const omHpd      = omSal?.hoursPerDay ?? 8;
        const omWork     = omI < 5;
        const omWage     = omWork ? omHr * omHpd : 0;
        const omBurd     = omWork ? omWage * (params.burdenPct / 100) : 0;
        const omFuel     = getActualFuel(omEmp.techId, omI);
        const omTools    = getActualTools(omEmp.techId, omI);
        const omBill     = omJobs.reduce((s, j) => s + j.revenue, 0);
        const omCost     = omWage + omBurd + (omJobs.length > 0 ? omFuel + omTools : 0);
        const omNet      = omBill - omCost;
        const omFuelAct  = isFuelActual(omEmp.techId, omI);
        const omToolsAct = isToolsActual(omEmp.techId, omI);

        return (
          <>
            {/* Invisible backdrop — captures outside clicks to close */}
            <div className="fixed inset-0 z-40" onMouseDown={closeMenu} />

            {/* Popup card */}
            <div
              className="fixed z-50 flex flex-col gap-1 items-stretch bg-card border border-border rounded-xl shadow-xl p-2.5 text-left w-[224px]"
              style={{ left: menuPos.x, top: menuPos.y }}
              onMouseDown={e => e.stopPropagation()}
            >
              {/* ── Jobs + cost breakdown ── */}
              {omJobs.length > 0 && (
                <>
                  <div className="space-y-0.5">
                    {omJobs.map(j => (
                      <div key={j.id} className="flex items-start justify-between gap-2 text-[11px]">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{j.customerName}</div>
                          <div className="text-muted-foreground truncate">{serviceTypeLabel(j.serviceType)}</div>
                        </div>
                        <div className="text-emerald-600 font-bold tabular-nums whitespace-nowrap shrink-0">{fmt(j.revenue)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border/50 pt-1.5 space-y-1 text-[10px]">
                    {omWork && <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Hourly pay ({omHpd}h)</span>
                        <span className="tabular-nums">({fmt(omWage)})</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Burden ({params.burdenPct}%)</span>
                        <span className="tabular-nums">({fmt(omBurd)})</span>
                      </div>
                    </>}
                    <div className="flex items-center justify-between gap-1">
                      <span className={omFuelAct ? "text-amber-600 font-medium" : "text-amber-600/70"}>
                        ⛽ Fuel{omFuelAct ? " ✎" : ""}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground">$</span>
                        <input type="number" min={0} step={1} value={omFuel}
                          onChange={e => setActualFuel(omEmp.techId, omI, Number(e.target.value) || 0)}
                          className="w-14 h-5 text-[10px] text-right bg-background border border-input rounded px-1 focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                          onMouseDown={e => e.stopPropagation()} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className={omToolsAct ? "text-blue-600 font-medium" : "text-blue-600/70"}>
                        🔧 Tools{omToolsAct ? " ✎" : ""}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground">$</span>
                        <input type="number" min={0} step={1} value={omTools}
                          onChange={e => setActualTools(omEmp.techId, omI, Number(e.target.value) || 0)}
                          className="w-14 h-5 text-[10px] text-right bg-background border border-input rounded px-1 focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                          onMouseDown={e => e.stopPropagation()} />
                      </div>
                    </div>
                    <div className={`flex justify-between font-bold pt-1 border-t border-border/50 ${omNet >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      <span>Day Net P&L</span>
                      <span className="tabular-nums">{omNet >= 0 ? "+" : ""}{fmt(omNet)}</span>
                    </div>
                  </div>
                  <div className="border-t border-border/50 pt-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Change Day Type</span>
                  </div>
                </>
              )}

              {/* ── No jobs: show cost fields only if a work day ── */}
              {omJobs.length === 0 && omWork && (
                <div className="space-y-1 text-[10px] mb-0.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Hourly pay ({omHpd}h)</span>
                    <span className="tabular-nums">({fmt(omWage)})</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Burden ({params.burdenPct}%)</span>
                    <span className="tabular-nums">({fmt(omBurd)})</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-amber-600/70">⛽ Fuel</span>
                    <div className="flex items-center gap-0.5">
                      <span className="text-[9px] text-muted-foreground">$</span>
                      <input type="number" min={0} step={1} value={omFuel}
                        onChange={e => setActualFuel(omEmp.techId, omI, Number(e.target.value) || 0)}
                        className="w-14 h-5 text-[10px] text-right bg-background border border-input rounded px-1 focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                        onMouseDown={e => e.stopPropagation()} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-blue-600/70">🔧 Tools</span>
                    <div className="flex items-center gap-0.5">
                      <span className="text-[9px] text-muted-foreground">$</span>
                      <input type="number" min={0} step={1} value={omTools}
                        onChange={e => setActualTools(omEmp.techId, omI, Number(e.target.value) || 0)}
                        className="w-14 h-5 text-[10px] text-right bg-background border border-input rounded px-1 focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                        onMouseDown={e => e.stopPropagation()} />
                    </div>
                  </div>
                  <div className="border-t border-border/50 pt-0.5 flex justify-between font-bold text-red-500">
                    <span>Day cost (no jobs)</span>
                    <span className="tabular-nums">({fmt(omWage + omBurd)})</span>
                  </div>
                  <div className="pt-0.5">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Change Day Type</span>
                  </div>
                </div>
              )}
              {omJobs.length === 0 && !omWork && (
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Change Day Type</span>
              )}

              {/* ── Day type buttons ── */}
              <div className="grid grid-cols-1 gap-0.5 w-full">
                {DAY_TYPE_OPTIONS.map(opt => (
                  <button key={opt.type}
                    onClick={() => applyDayType(omEmp.techId, omI, opt.type)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all text-left
                      ${opt.cls}
                      ${omType === opt.type ? `ring-2 ${opt.activeCls}` : "opacity-70 hover:opacity-100"}
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button onClick={closeMenu} className="text-[10px] text-muted-foreground hover:text-foreground mt-0.5 text-center">
                Close
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ─── Daily P&L Breakdown ─────────────────────────────────────────────────────

interface DayDetail {
  dayIdx: number;
  date: Date;
  label: string;
  jobs: ApiJob[];
  billable: number;
  dailyWage: number;
  burden: number;
  fuel: number;
  tools: number;
  totalCost: number;
  netPnl: number;
}

interface EmpWeek {
  emp: ApiEmployee;
  days: DayDetail[];
  weekBillable: number;
  weekCost: number;
  weekNet: number;
}

function DailyPnlTable({
  apiEmployees, apiJobs, params,
}: {
  apiEmployees: ApiEmployee[];
  apiJobs: ApiJob[];
  params: BurdenParams;
}) {
  const [showAllDays, setShowAllDays] = useState(false);
  const [expandedEmps, setExpandedEmps] = useState<Set<number>>(() => new Set<number>());

  // Initialize with all employees expanded on first render
  const initialized = useMemo(() => {
    if (apiEmployees.length > 0 && expandedEmps.size === 0) {
      return new Set(apiEmployees.map(e => e.id));
    }
    return null;
  }, [apiEmployees]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveExpanded = initialized ?? expandedEmps;

  // Current week Mon–Sun
  const weekDays = useMemo(() => {
    const now = new Date();
    const dow = now.getDay();
    const mDiff = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(now);
    mon.setDate(now.getDate() + mDiff);
    mon.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  }, []);

  const weekLabel = useMemo(() => {
    const f = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${f(weekDays[0])} – ${f(weekDays[6])}`;
  }, [weekDays]);

  const empWeeks = useMemo((): EmpWeek[] => {
    return apiEmployees.map(emp => {
      const hourlyRate = emp.hourlyRate != null ? Number(emp.hourlyRate) : emp.salary / 2080;
      const hoursPerDay = Number(emp.hoursPerDay ?? 8);
      const dailyWageBase = hourlyRate * hoursPerDay;
      const burdenRate = params.burdenPct / 100;

      const days: DayDetail[] = weekDays.map((date, dayIdx) => {
        const dateStr = date.toISOString().slice(0, 10);
        const jobs = apiJobs.filter(
          j => j.employeeId === emp.id && j.scheduledDate === dateStr
        );
        const billable = jobs.reduce((s, j) => s + j.revenue, 0);
        const isWorkingDay = dayIdx < 5; // Mon–Fri

        const dailyWage  = isWorkingDay ? dailyWageBase : 0;
        const burden     = isWorkingDay ? dailyWageBase * burdenRate : 0;
        const fuel       = jobs.length > 0 ? params.fuelPerDay : 0;
        const tools      = jobs.length > 0 ? params.toolsPerDay : 0;
        const totalCost  = dailyWage + burden + fuel + tools;
        const netPnl     = billable - totalCost;

        const label = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        return { dayIdx, date, label, jobs, billable, dailyWage, burden, fuel, tools, totalCost, netPnl };
      });

      const weekBillable = days.reduce((s, d) => s + d.billable, 0);
      const weekCost     = days.reduce((s, d) => s + d.totalCost, 0);
      const weekNet      = weekBillable - weekCost;
      return { emp, days, weekBillable, weekCost, weekNet };
    }).filter(ew => ew.weekBillable > 0 || ew.days.some(d => d.jobs.length > 0));
  }, [apiEmployees, apiJobs, weekDays, params]);

  function toggleEmp(id: number) {
    const next = new Set(effectiveExpanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedEmps(next);
  }

  if (empWeeks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-8 text-center">
        <DollarSign className="size-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">No jobs scheduled this week</p>
        <p className="text-xs text-muted-foreground mt-1">Assign jobs to employees with dates in the current week to see daily P&L data here.</p>
      </div>
    );
  }

  const grandBillable = empWeeks.reduce((s, e) => s + e.weekBillable, 0);
  const grandCost     = empWeeks.reduce((s, e) => s + e.weekCost, 0);
  const grandNet      = grandBillable - grandCost;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="size-4 text-primary" />
            Daily P&L Breakdown — {weekLabel}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Formula: <span className="font-mono">Billable − (Hourly Pay × Hours + Burden + Fuel + Tools)</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAllDays(v => !v)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors border rounded-md px-2.5 py-1"
          >
            {showAllDays ? "Billable days only" : "Show all 7 days"}
          </button>
          {/* Grand total pill */}
          <div className={`text-xs font-semibold px-3 py-1 rounded-full border ${grandNet >= 0 ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300"}`}>
            Week net: {grandNet >= 0 ? "+" : ""}{fmt(grandNet)}
          </div>
        </div>
      </div>

      {/* Per-employee sections */}
      <div className="divide-y divide-border/50">
        {empWeeks.map(({ emp, days, weekBillable, weekCost, weekNet }) => {
          const isExpanded = effectiveExpanded.has(emp.id);
          const hourlyRate = emp.hourlyRate != null ? Number(emp.hourlyRate) : emp.salary / 2080;
          const hoursPerDay = Number(emp.hoursPerDay ?? 8);
          const visibleDays = showAllDays ? days : days.filter(d => d.jobs.length > 0);

          return (
            <div key={emp.id}>
              {/* Employee row — click to expand/collapse */}
              <button
                onClick={() => toggleEmp(emp.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-left gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`size-2 shrink-0 rounded-full ${weekNet >= 0 ? "bg-emerald-500" : "bg-red-500"}`} />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-foreground">{emp.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {emp.role} · ${hourlyRate.toFixed(2)}/hr × {hoursPerDay}h/day
                      {visibleDays.length > 0 && ` · ${days.filter(d => d.jobs.length > 0).length} day${days.filter(d => d.jobs.length > 0).length !== 1 ? "s" : ""} with jobs this week`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-muted-foreground">Billable</div>
                    <div className="text-sm font-semibold text-emerald-600 tabular-nums">{fmt(weekBillable)}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-muted-foreground">Total cost</div>
                    <div className="text-sm font-semibold text-amber-600 tabular-nums">({fmt(weekCost)})</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">Net P&L</div>
                    <div className={`text-sm font-bold tabular-nums ${weekNet >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {weekNet >= 0 ? "+" : ""}{fmt(weekNet)}
                    </div>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Day-level detail */}
              {isExpanded && (
                <div className="border-t border-border/30 bg-muted/5">
                  {visibleDays.length === 0 ? (
                    <p className="px-8 py-4 text-xs text-muted-foreground italic">
                      No jobs scheduled this week — toggle "Show all 7 days" to see cost rows.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border/50 text-muted-foreground">
                            <th className="text-left px-4 py-2 font-medium w-28">Day</th>
                            <th className="text-left px-3 py-2 font-medium">Jobs</th>
                            <th className="text-right px-3 py-2 font-medium w-24">Billable</th>
                            <th className="text-right px-3 py-2 font-medium w-28 hidden md:table-cell">Hourly Pay</th>
                            <th className="text-right px-3 py-2 font-medium w-20 hidden md:table-cell">Burden</th>
                            <th className="text-right px-3 py-2 font-medium w-16 hidden md:table-cell">Fuel</th>
                            <th className="text-right px-3 py-2 font-medium w-16 hidden md:table-cell">Tools</th>
                            <th className="text-right px-4 py-2 font-medium w-24">Net P&L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {visibleDays.map(d => (
                            <tr key={d.dayIdx} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{d.label}</td>
                              <td className="px-3 py-2.5">
                                {d.jobs.length === 0 ? (
                                  <span className="italic text-muted-foreground/60">No jobs (working day)</span>
                                ) : (
                                  <div className="space-y-1">
                                    {d.jobs.map(j => (
                                      <div key={j.id} className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-medium text-foreground">{j.customerName}</span>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span className="text-muted-foreground">{serviceTypeLabel(j.serviceType)}</span>
                                        <span className="ml-auto font-semibold text-emerald-600 tabular-nums whitespace-nowrap pl-3">{fmt(j.revenue)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-emerald-600 tabular-nums whitespace-nowrap">{fmt(d.billable)}</td>
                              <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums whitespace-nowrap hidden md:table-cell">
                                <span title={`$${hourlyRate.toFixed(2)}/hr × ${hoursPerDay}h`}>({fmt(d.dailyWage)})</span>
                              </td>
                              <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums whitespace-nowrap hidden md:table-cell">({fmt(d.burden)})</td>
                              <td className="px-3 py-2.5 text-right text-amber-600 tabular-nums whitespace-nowrap hidden md:table-cell">{d.fuel > 0 ? `(${fmt(d.fuel)})` : <span className="text-muted-foreground/40">—</span>}</td>
                              <td className="px-3 py-2.5 text-right text-blue-600 tabular-nums whitespace-nowrap hidden md:table-cell">{d.tools > 0 ? `(${fmt(d.tools)})` : <span className="text-muted-foreground/40">—</span>}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                                <span className={`font-bold ${d.netPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  {d.netPnl >= 0 ? "+" : ""}{fmt(d.netPnl)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30 border-t border-border font-semibold text-xs">
                            <td className="px-4 py-2.5 text-foreground">Week Total</td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {days.filter(d => d.jobs.length > 0).length} of 5 days billable
                            </td>
                            <td className="px-3 py-2.5 text-right text-emerald-600 tabular-nums">{fmt(weekBillable)}</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums hidden md:table-cell">({fmt(days.reduce((s, d) => s + d.dailyWage, 0))})</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums hidden md:table-cell">({fmt(days.reduce((s, d) => s + d.burden, 0))})</td>
                            <td className="px-3 py-2.5 text-right text-amber-600 tabular-nums hidden md:table-cell">({fmt(days.reduce((s, d) => s + d.fuel, 0))})</td>
                            <td className="px-3 py-2.5 text-right text-blue-600 tabular-nums hidden md:table-cell">({fmt(days.reduce((s, d) => s + d.tools, 0))})</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              <span className={`font-bold text-sm ${weekNet >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                {weekNet >= 0 ? "+" : ""}{fmt(weekNet)}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Grand total footer */}
        {empWeeks.length > 1 && (
          <div className="px-4 py-3 bg-muted/20 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold text-foreground">All Technicians — Week Total</span>
            <div className="flex items-center gap-6 text-sm">
              <span className="text-emerald-600 font-semibold">Billable: {fmt(grandBillable)}</span>
              <span className="text-amber-600 font-semibold">Cost: ({fmt(grandCost)})</span>
              <span className={`font-bold text-base ${grandNet >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                Net: {grandNet >= 0 ? "+" : ""}{fmt(grandNet)}
              </span>
            </div>
          </div>
        )}
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
              <p className="text-[10px] text-muted-foreground">Employer taxes + benefits on top of wages</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Income Tax Rate %</Label>
              <div className="flex items-center gap-1">
                <Input className="h-8 text-xs" value={draft.taxPct} onChange={e => upd("taxPct", e.target.value)}/>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Applied to net profit in P&L table and projections</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Working Days / Year</Label>
              <Input className="h-8 text-xs" value={draft.workDaysPerYear} onChange={e => upd("workDaysPerYear", e.target.value)}/>
              <p className="text-[10px] text-muted-foreground">Used for wage cost scaling</p>
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
  burdenPct: 30, taxPct: 25, fuelPerDay: 85, toolsPerDay: 40,
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

  // Selected week navigation — persisted across refreshes & page changes
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const stored = localStorage.getItem("tfpro_pnl_week");
    if (stored) { const d = new Date(stored); if (!isNaN(d.getTime())) return d; }
    const now = new Date();
    const dow = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  useEffect(() => {
    localStorage.setItem("tfpro_pnl_week", selectedWeekStart.toISOString());
  }, [selectedWeekStart]);

  function handleNavWeek(delta: number) {
    if (delta === 0) {
      // jump to today
      const now = new Date();
      const dow = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
      mon.setHours(0, 0, 0, 0);
      setSelectedWeekStart(mon);
    } else {
      setSelectedWeekStart(prev => {
        const next = new Date(prev);
        next.setDate(prev.getDate() + delta * 7);
        return next;
      });
    }
  }

  // Jobs grouped by employee + day index for the selected week
  const weekJobsByEmp = useMemo(() => {
    const sun = new Date(selectedWeekStart);
    sun.setDate(selectedWeekStart.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    const byDay: Record<string, Record<number, ApiJob[]>> = {};
    apiJobs.forEach(j => {
      if (!j.scheduledDate || j.employeeId == null) return;
      const d = new Date(j.scheduledDate + "T12:00:00");
      if (d < selectedWeekStart || d > sun) return;
      const empKey = String(j.employeeId);
      const dayIdx = (d.getDay() + 6) % 7;
      if (!byDay[empKey]) byDay[empKey] = {};
      if (!byDay[empKey][dayIdx]) byDay[empKey][dayIdx] = [];
      byDay[empKey][dayIdx].push(j);
    });
    return byDay;
  }, [apiJobs, selectedWeekStart]);

  // Revenue sums derived from weekJobsByEmp
  const weekActualRevByEmp = useMemo(() => {
    const byDay: Record<string, Record<number, number>> = {};
    Object.entries(weekJobsByEmp).forEach(([empKey, days]) => {
      byDay[empKey] = {};
      Object.entries(days).forEach(([dayIdx, jobs]) => {
        byDay[empKey][Number(dayIdx)] = jobs.reduce((s, j) => s + j.revenue, 0);
      });
    });
    return byDay;
  }, [weekJobsByEmp]);

  // Total actual weekly revenue across all employees
  const actualWeekRevenue = useMemo(() =>
    Object.values(weekActualRevByEmp).reduce((s, days) =>
      s + Object.values(days).reduce((a, b) => a + b, 0), 0),
    [weekActualRevByEmp]
  );

  // Per-employee total actual revenue for the selected week
  const weekActualRevByEmpTotal = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(weekActualRevByEmp).forEach(([empKey, days]) => {
      totals[empKey] = Object.values(days).reduce((s, v) => s + v, 0);
    });
    return totals;
  }, [weekActualRevByEmp]);

  // End-of-selected-week date
  const selectedWeekEnd = useMemo(() => {
    const end = new Date(selectedWeekStart);
    end.setDate(selectedWeekStart.getDate() + 6);
    return end;
  }, [selectedWeekStart]);

  const weekLabel = `${selectedWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${selectedWeekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // True when weekly period has actual job data to show
  const isActualWeekMode = period === "weekly" && actualWeekRevenue > 0;

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
    hourlyRate: e.hourlyRate != null ? Number(e.hourlyRate) : e.salary / 2080,
    hoursPerDay: e.hoursPerDay ?? 8,
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
    // All weekdays default to billable — no day is auto-assigned as shop
    // Users change individual days via the ▾ type menu in each cell
    const days: WeekScheduleDay[] = Array(7).fill(null).map((_, i) => ({
      type: (i >= 5 ? "off" : "billable") as DayType,
    }));
    return {
      techId: String(e.id),
      techName: e.name,
      cert: e.certifications.slice(0, 2).join(", ") || "General",
      days,
      shopDaysThisWeek,
    };
  });

  const salaryData = apiEmployees.map(e => ({
    id: String(e.id),
    hourlyRate: e.hourlyRate != null ? Number(e.hourlyRate) : e.salary / 2080,
    hoursPerDay: e.hoursPerDay ?? 8,
  }));

  const projectionTotals = useMemo(() => {
    const compute = (p: Period) => techRows.reduce((acc, t) => {
      const r = calcRow(t, techRates[t.id] ?? t.billRate, p, params);
      return { revenue: acc.revenue + r.revenue, totalCost: acc.totalCost + r.totalCost, netProfit: acc.netProfit + r.netProfit };
    }, { revenue: 0, totalCost: 0, netProfit: 0 });
    return { weekly: compute("weekly"), monthly: compute("monthly"), annual: compute("annual") };
  }, [techRows, techRates, params]);

  const pnlRows = useMemo(() =>
    techRows.map(t => {
      const base = calcRow(t, techRates[t.id] ?? t.billRate, period, params);
      // When viewing a specific week with actual job data, use real per-tech revenue
      if (period === "weekly" && actualWeekRevenue > 0) {
        const actualRev = weekActualRevByEmpTotal[t.id] ?? 0;
        const netProfit = actualRev - base.totalCost;
        const roi = base.totalCost > 0 ? (netProfit / base.totalCost) * 100 : 0;
        return { tech: t, ...base, revenue: actualRev, netProfit, roi };
      }
      return { tech: t, ...base };
    }),
    [techRows, period, params, techRates, weekActualRevByEmpTotal, actualWeekRevenue]
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

      {/* Week context banner — only shown when Weekly period is active */}
      {period === "weekly" && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
          isActualWeekMode
            ? "border-primary/25 bg-primary/5"
            : "border-border bg-muted/30"
        }`}>
          <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${isActualWeekMode ? "bg-primary/10" : "bg-muted"}`}>
            <CalendarDays className={`size-4 ${isActualWeekMode ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <div className="font-semibold text-foreground">
              Week of {weekLabel}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {isActualWeekMode
                ? "All figures below use actual job revenue for this week — navigate the schedule table to change the week"
                : "No jobs found for this week — figures are projected. Navigate the schedule table to find a week with jobs"}
            </div>
          </div>
          {isActualWeekMode && (
            <div className="ml-auto shrink-0">
              <span className="rounded-full bg-primary/15 text-primary text-[11px] font-semibold px-2.5 py-1">
                Actual data
              </span>
            </div>
          )}
        </div>
      )}

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
          actualRevByEmp={weekActualRevByEmp}
          weekJobsByEmp={weekJobsByEmp}
          weekStart={selectedWeekStart}
          onNavWeek={handleNavWeek}
          period={period}
        />
      )}

      {/* Per-tech P&L table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-foreground">
              Per-Technician {isActualWeekMode ? `P&L — ${weekLabel}` : `${periodLabel} P&L`}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isActualWeekMode
                ? "Actual job revenue for the week · costs are formula-based"
                : hourly ? "Hourly rate breakdown (total ÷ billable hours)" : "Revenue vs. full cost per employee"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isActualWeekMode && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Actual Revenue</Badge>}
            {hourly && <Badge variant="secondary" className="text-[10px]">Hourly Mode</Badge>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Technician</th>
                <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground">
                  {isActualWeekMode ? "Actual Revenue" : `Revenue${hourly ? " /hr" : ""}`}
                </th>
                <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Wage Cost</th>
                <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Burden</th>
                <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Fuel+Tools</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Net P&L</th>
                <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {pnlRows.map(r => {
                const hrs = r.billableDays * params.hoursPerDay;
                const div = hourly && hrs > 0 ? hrs : 1;
                return (
                  <tr key={r.tech.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-medium text-foreground text-sm">{r.tech.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {r.tech.role} · {r.billableDays}d billable · {fmtRate(techRates[r.tech.id] ?? r.tech.billRate, hourly, params.hoursPerDay)}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                      {fmt(r.revenue / div)}
                    </td>
                    <td className="px-3 py-4 text-right text-muted-foreground hidden md:table-cell">({fmt(r.salaryCost / div)})</td>
                    <td className="px-3 py-4 text-right text-muted-foreground hidden md:table-cell">({fmt(r.burdenCost / div)})</td>
                    <td className="px-3 py-4 text-right text-amber-600 dark:text-amber-400 hidden md:table-cell">({fmt((r.fuelCost + r.toolsCost) / div)})</td>
                    <td className="px-4 py-4 text-right">
                      <span className={`font-bold ${r.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {r.netProfit >= 0 ? "+" : ""}{fmt(r.netProfit / div)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <Badge variant="outline" className={`text-[10px] ${r.roi >= 200 ? "border-emerald-500 text-emerald-600" : r.roi >= 100 ? "border-amber-500 text-amber-600" : "border-red-500 text-red-500"}`}>
                        {r.roi >= 0 ? "+" : ""}{Math.round(r.roi)}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/40 font-semibold border-t border-border">
                <td className="px-4 py-4 text-sm text-foreground">TOTAL</td>
                <td className="px-3 py-4 text-right text-emerald-600 dark:text-emerald-400">{fmt(totals.revenue)}</td>
                <td className="px-3 py-4 text-right text-muted-foreground hidden md:table-cell">({fmt(totals.salaryCost)})</td>
                <td className="px-3 py-4 text-right text-muted-foreground hidden md:table-cell">({fmt(totals.burdenCost)})</td>
                <td className="px-3 py-4 text-right text-amber-600 dark:text-amber-400 hidden md:table-cell">({fmt(totals.fuelCost + totals.toolsCost)})</td>
                <td className="px-4 py-4 text-right">
                  <span className={`text-lg font-bold ${totals.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {totals.netProfit >= 0 ? "+" : ""}{fmt(totals.netProfit)}
                  </span>
                </td>
                <td className="px-3 py-4 text-right">
                  <Badge className={`text-[10px] ${totals.netProfit >= 0 ? "bg-emerald-600" : "bg-red-500"}`}>
                    {totals.totalCost > 0 ? Math.round((totals.netProfit / totals.totalCost) * 100) : 0}%
                  </Badge>
                </td>
              </tr>
              {totals.netProfit > 0 && (
                <tr className="bg-amber-50/50 dark:bg-amber-950/10">
                  <td className="px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400 font-medium">
                    🏛 Est. Income Tax ({params.taxPct}%)
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground hidden md:table-cell" colSpan={3}>on net profit</td>
                  <td className="px-3 py-2.5 hidden md:table-cell" />
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      ({fmt(totals.netProfit * (params.taxPct / 100))})
                    </span>
                  </td>
                  <td className="px-3 py-2.5" />
                </tr>
              )}
              {totals.netProfit > 0 && (
                <tr className="bg-primary/5 font-semibold">
                  <td className="px-4 py-3 text-sm text-foreground">After-Tax Net</td>
                  <td className="px-3 py-3" colSpan={4} />
                  <td className="px-4 py-3 text-right">
                    <span className={`text-lg font-bold ${totals.netProfit * (1 - params.taxPct / 100) >= 0 ? "text-primary" : "text-red-500"}`}>
                      {totals.netProfit * (1 - params.taxPct / 100) >= 0 ? "+" : ""}{fmt(totals.netProfit * (1 - params.taxPct / 100))}
                    </span>
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Projections */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="size-4 text-primary"/> Revenue Projections
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Projected incoming revenue, costs, and after-tax net — based on current billing rates and utilization
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {([
            { label: "Weekly",  icon: "📅", key: "weekly"  as const },
            { label: "Monthly", icon: "📆", key: "monthly" as const },
            { label: "Annual",  icon: "📊", key: "annual"  as const },
          ]).map(({ label, icon, key }) => {
            const t = projectionTotals[key];
            const taxAmt   = t.netProfit > 0 ? t.netProfit * (params.taxPct / 100) : 0;
            const afterTax = t.netProfit - taxAmt;
            return (
              <div key={key} className="p-4 space-y-3">
                <div className="text-sm font-semibold text-foreground">{icon} {label}</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Incoming Revenue</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(t.revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total Cost</span>
                    <span className="font-medium text-red-500">({fmt(t.totalCost)})</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
                    <span className="text-xs font-medium">Net P&L</span>
                    <span className={`font-bold ${t.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {t.netProfit >= 0 ? "+" : ""}{fmt(t.netProfit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Est. Tax ({params.taxPct}%)</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">({fmt(taxAmt)})</span>
                  </div>
                  <div className="flex items-center justify-between bg-primary/5 rounded-lg px-2.5 py-2">
                    <span className="text-xs font-semibold">After-Tax Keep</span>
                    <span className={`text-base font-extrabold ${afterTax >= 0 ? "text-primary" : "text-red-500"}`}>
                      {afterTax >= 0 ? "+" : ""}{fmt(afterTax)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue vs. Cost vs. Profit — {periodLabel}</CardTitle>
          <CardDescription>Full cost stack: hourly wage + payroll burden + fuel + tools</CardDescription>
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
