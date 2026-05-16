import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, List, X,
  Clock, User, DollarSign, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  "Hood Suppression Inspection",
  "Extinguisher Annual",
  "Sprinkler Annual Test",
  "Exit Light Inspection",
  "Full Fire Safety Inspection",
  "Standpipe Test",
  "Fire Alarm Inspection",
  "Kitchen Hood Cleaning",
  "Emergency Service",
];

const PRIORITY_COLORS: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  low:    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
};

const STATUS_COLORS: Record<string, string> = {
  completed:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  scheduled:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "in-progress": "bg-primary/10 text-primary",
  pending:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  cancelled:   "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400",
};

const DOW    = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fmt(v: number) {
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
}

// ─── Add Job Dialog ───────────────────────────────────────────────────────────

function AddJobDialog({
  open, date, customers, employees, onClose, onSaved,
}: {
  open: boolean;
  date: string;
  customers: any[];
  employees: any[];
  onClose: () => void;
  onSaved: (job: any) => void;
}) {
  const createJobFn = useMutation(api.jobs.create);
  const [customerId,   setCustomerId]   = useState("");
  const [employeeId,   setEmployeeId]   = useState("");
  const [serviceType,  setServiceType]  = useState("");
  const [time,         setTime]         = useState("08:00");
  const [priority,     setPriority]     = useState("medium");
  const [revenue,      setRevenue]      = useState("350");
  const [notes,        setNotes]        = useState("");
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId(""); setEmployeeId(""); setServiceType("");
      setTime("08:00"); setPriority("medium"); setRevenue("350"); setNotes("");
    }
  }, [open]);

  async function handleSave() {
    if (!customerId || !serviceType) return;
    setSaving(true);
    try {
      const job = await createJobFn({
        customerId:             Number(customerId),
        employeeId:             employeeId ? Number(employeeId) : null,
        serviceType,
        scheduledDate:          date,
        scheduledTime:          time,
        priority,
        revenue:                Number(revenue) || 0,
        notes:                  notes || null,
        status:                 "scheduled",
        quantity:               1,
        requiresFollowUp:       false,
        followUpConfirmed:      false,
        certificationRequired:  "fire_suppression",
      });
      toast.success("Job added to calendar");
      onSaved(job);
    } catch {
      toast.error("Failed to create job");
    } finally {
      setSaving(false);
    }
  }

  const displayDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "";

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary"/> Add Job
            {date && <span className="text-muted-foreground font-normal">— {displayDate}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select customer…"/>
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Service Type *</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select service…"/>
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assigned Tech</Label>
              <Select value={employeeId || "__none__"} onValueChange={v => setEmployeeId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Unassigned"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="text-sm"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Revenue ($)</Label>
              <Input
                type="number"
                min="0"
                value={revenue}
                onChange={e => setRevenue(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes</Label>
            <Input
              placeholder="Optional notes…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!customerId || !serviceType || saving}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Add to Calendar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────

export function CalendarPage() {
  const navigate = useNavigate();
  const today    = new Date();

  const [year,        setYear]        = useState(() => {
    const v = localStorage.getItem("tfpro_cal_year");
    return v ? Number(v) : today.getFullYear();
  });
  const [month,       setMonth]       = useState(() => {
    const v = localStorage.getItem("tfpro_cal_month");
    return v !== null ? Number(v) : today.getMonth();
  });

  useEffect(() => { localStorage.setItem("tfpro_cal_year",  String(year));  }, [year]);
  useEffect(() => { localStorage.setItem("tfpro_cal_month", String(month)); }, [month]);
  const [view,        setView]        = useState<"month" | "list">("month");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [addJobDate,  setAddJobDate]  = useState("");
  const [addJobOpen,  setAddJobOpen]  = useState(false);

  const jobs      = (useQuery(api.jobs.list)       ?? []) as any[];
  const customers = (useQuery(api.customers.list) ?? []) as any[];
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const [loading,   setLoading]   = useState(true);


  const calendarDays = useMemo(() => getCalendarGrid(year, month), [year, month]);

  const jobsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    jobs.forEach(j => {
      if (j.scheduledDate) {
        const d = j.scheduledDate.slice(0, 10);
        if (!map[d]) map[d] = [];
        map[d].push(j);
      }
    });
    return map;
  }, [jobs]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(toYMD(today));
  }

  function openAddJob(date: string) {
    setAddJobDate(date);
    setAddJobOpen(true);
  }

  const todayStr    = toYMD(today);
  const selectedJobs = selectedDay ? (jobsByDate[selectedDay] ?? []) : [];

  const monthStart = `${year}-${String(month+1).padStart(2,"0")}-01`;
  const monthEnd   = `${year}-${String(month+1).padStart(2,"0")}-${String(new Date(year, month+1, 0).getDate()).padStart(2,"0")}`;
  const monthJobs  = useMemo(() =>
    jobs
      .filter(j => j.scheduledDate && j.scheduledDate.slice(0,10) >= monthStart && j.scheduledDate.slice(0,10) <= monthEnd)
      .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "")),
    [jobs, monthStart, monthEnd]
  );

  const monthRevenue = monthJobs.reduce((s, j) => s + j.revenue, 0);

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="size-6 text-primary shrink-0"/> Job Calendar
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Schedule and manage jobs by date — click any day to view or add jobs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="text-xs" onClick={goToday}>Today</Button>
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setView("month")}
          >
            <CalendarDays className="size-3.5"/> Month
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setView("list")}
          >
            <List className="size-3.5"/> List
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => openAddJob(todayStr)}>
            <Plus className="size-3.5"/> Add Job
          </Button>
        </div>
      </div>

      {/* Month nav + summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={prevMonth}>
            <ChevronLeft className="size-4"/>
          </Button>
          <h2 className="text-lg font-semibold min-w-[170px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <Button variant="ghost" size="icon" className="size-8" onClick={nextMonth}>
            <ChevronRight className="size-4"/>
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Briefcase className="size-3.5"/>
            {monthJobs.length} job{monthJobs.length !== 1 ? "s" : ""}
          </span>
          {monthRevenue > 0 && (
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <DollarSign className="size-3.5"/>
              {fmt(monthRevenue)}
            </span>
          )}
        </div>
      </div>

      {view === "month" ? (
        <div className="flex gap-4">
          {/* Calendar Grid */}
          <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {DOW.map(d => (
                <div key={d} className="py-2.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return (
                    <div
                      key={idx}
                      className="border-r border-b border-border/40 bg-muted/10 min-h-[110px]"
                    />
                  );
                }
                const dateStr  = toYMD(day);
                const dayJobs  = jobsByDate[dateStr] ?? [];
                const isToday  = dateStr === todayStr;
                const isSel    = dateStr === selectedDay;
                const isPast   = dateStr < todayStr && !isToday;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(isSel ? null : dateStr)}
                    className={`border-r border-b border-border/40 min-h-[148px] p-2.5 cursor-pointer transition-colors
                      ${isSel ? "bg-primary/5 ring-2 ring-inset ring-primary" : "hover:bg-muted/30"}
                      ${isPast ? "opacity-60" : ""}
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors
                        ${isToday ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}
                      `}>
                        {day.getDate()}
                      </span>
                      {dayJobs.length > 0 && (
                        <span className="text-[10px] font-medium text-muted-foreground">{dayJobs.length}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayJobs.slice(0, 3).map(job => {
                        const assignedEmp = employees.find(e => e.id === job.employeeId);
                        return (
                        <div
                          key={job.id}
                          onClick={e => { e.stopPropagation(); navigate(`/jobs/${job.id}`); }}
                          className={`text-[10px] rounded px-1.5 py-0.5 cursor-pointer font-medium leading-tight border
                            ${STATUS_COLORS[job.status] ?? STATUS_COLORS.pending}
                          `}
                          title={`${job.customerName} — ${job.serviceType}${assignedEmp ? ` · ${assignedEmp.name}` : ""}`}
                        >
                          <div className="truncate">{job.customerName}</div>
                          {assignedEmp && (
                            <div className="text-[9px] opacity-70 truncate">{assignedEmp.name.split(" ")[0]}</div>
                          )}
                        </div>
                        );
                      })}
                      {dayJobs.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{dayJobs.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day detail panel */}
          {selectedDay && (
            <div className="w-72 shrink-0 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                <div>
                  <div className="font-semibold text-sm text-foreground">
                    {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "long", month: "short", day: "numeric",
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedJobs.length} job{selectedJobs.length !== 1 ? "s" : ""}
                    {selectedJobs.length > 0 && (
                      <span className="ml-1 text-emerald-600 font-medium">
                        · {fmt(selectedJobs.reduce((s, j) => s + j.revenue, 0))}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-4"/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {selectedJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    No jobs scheduled for this day
                  </div>
                ) : (
                  selectedJobs.map(job => {
                    const emp = employees.find(e => e.id === job.employeeId);
                    return (
                      <div
                        key={job.id}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="rounded-lg border border-border bg-background p-3 cursor-pointer hover:bg-muted/30 transition-colors space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-medium text-sm text-foreground leading-tight">{job.customerName}</div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${PRIORITY_COLORS[job.priority] ?? ""}`}
                          >
                            {job.priority}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{job.serviceType}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {job.scheduledTime && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="size-3"/>{job.scheduledTime}
                            </span>
                          )}
                          {emp && (
                            <span className="flex items-center gap-0.5">
                              <User className="size-3"/>{emp.name.split(" ")[0]}
                            </span>
                          )}
                          {job.revenue > 0 && (
                            <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                              <DollarSign className="size-3"/>{fmt(job.revenue)}
                            </span>
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${STATUS_COLORS[job.status] ?? ""}`}
                        >
                          {job.status}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 border-t border-border">
                <Button
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => openAddJob(selectedDay)}
                >
                  <Plus className="size-3.5"/> Add Job on This Day
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── List View ── */
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {monthJobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No jobs scheduled this month
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {monthJobs.map(job => {
                const emp  = employees.find(e => e.id === job.employeeId);
                const cust = customers.find(c => c.id === job.customerId);
                const dateObj = job.scheduledDate
                  ? new Date(job.scheduledDate + "T12:00:00")
                  : null;
                return (
                  <div
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="px-4 py-3 flex items-center gap-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    {/* Date badge */}
                    <div className="shrink-0 text-center w-12">
                      {dateObj && (
                        <>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {dateObj.toLocaleDateString("en-US",{month:"short"})}
                          </div>
                          <div className="text-xl font-bold text-foreground leading-tight">
                            {dateObj.getDate()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {dateObj.toLocaleDateString("en-US",{weekday:"short"})}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground">{job.customerName}</div>
                      <div className="text-xs text-muted-foreground truncate">{job.serviceType}</div>
                      {cust && (
                        <div className="text-[10px] text-muted-foreground truncate">{cust.address}</div>
                      )}
                    </div>

                    {/* Right meta */}
                    <div className="shrink-0 text-right space-y-0.5">
                      {job.revenue > 0 && (
                        <div className="text-sm font-semibold text-emerald-600">{fmt(job.revenue)}</div>
                      )}
                      {emp && (
                        <div className="text-xs text-muted-foreground">{emp.name.split(" ")[0]}</div>
                      )}
                      {job.scheduledTime && (
                        <div className="text-xs text-muted-foreground">{job.scheduledTime}</div>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${STATUS_COLORS[job.status] ?? ""}`}
                      >
                        {job.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${PRIORITY_COLORS[job.priority] ?? ""}`}
                      >
                        {job.priority}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Status legend */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
        <span className="font-semibold">Legend:</span>
        {Object.entries(STATUS_COLORS).map(([s, cls]) => (
          <span key={s} className={`px-1.5 py-0.5 rounded border font-medium ${cls}`}>
            {s}
          </span>
        ))}
      </div>

      {/* Add Job Dialog */}
      <AddJobDialog
        open={addJobOpen}
        date={addJobDate}
        customers={customers}
        employees={employees}
        onClose={() => setAddJobOpen(false)}
        onSaved={job => {
                    setAddJobOpen(false);
          setSelectedDay(addJobDate);
        }}
      />
    </div>
  );
}
