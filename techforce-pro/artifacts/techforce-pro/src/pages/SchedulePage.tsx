import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, ChevronLeft, ChevronRight, Wrench, Zap, TrendingUp,
  Plus, X, Check, UserCheck, Briefcase, Clock, DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getTeamCalendar, getOpenJobs, getEmployees, getCustomers, createJob, updateJob,
  getWeekDates, formatWeekLabel, serviceTypeLabel, initials, roleLabel,
  type CalendarEntry, type ApiOpenJob, type ApiEmployee, type ApiCustomer,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  { value: "hood_suppression",        label: "Hood Suppression" },
  { value: "extinguisher_inspection", label: "Extinguisher Inspection" },
  { value: "sprinkler_test",          label: "Sprinkler Test" },
  { value: "exit_light_check",        label: "Exit Light Check" },
  { value: "full_inspection",         label: "Full Fire Safety Inspection" },
  { value: "standpipe_test",          label: "Standpipe Test" },
  { value: "fire_alarm",              label: "Fire Alarm Inspection" },
  { value: "emergency",               label: "Emergency Service" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDayBg(hasJobs: boolean) {
  if (hasJobs) return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  return "bg-muted/40 text-muted-foreground border-border";
}

function getPriorityBadge(priority: string) {
  if (priority === "high")   return <Badge variant="destructive" className="text-[10px]">HIGH</Badge>;
  if (priority === "medium") return <Badge variant="default" className="bg-amber-600 text-[10px]">MED</Badge>;
  return <Badge variant="secondary" className="text-[10px]">LOW</Badge>;
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m)-1]} ${Number(d)}`;
}

// ─── Add New Job Dialog ───────────────────────────────────────────────────────

interface AddJobTarget {
  employeeId: number;
  employeeName: string;
  date: string;
}

function AddJobDialog({
  open, target, employees, customers, canChangeAssignee, onClose, onSaved,
}: {
  open: boolean;
  target: AddJobTarget | null;
  employees: ApiEmployee[];
  customers: ApiCustomer[];
  canChangeAssignee: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerId,   setCustomerId]   = useState("");
  const [serviceType,  setServiceType]  = useState("extinguisher_inspection");
  const [revenue,      setRevenue]      = useState("0");
  const [priority,     setPriority]     = useState("medium");
  const [scheduledTime,setScheduledTime]= useState("08:00");
  const [notes,        setNotes]        = useState("");
  const [assigneeId,   setAssigneeId]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  // Reset form whenever target changes
  useEffect(() => {
    if (target) {
      setAssigneeId(String(target.employeeId));
      setCustomerId("");
      setServiceType("extinguisher_inspection");
      setRevenue("0");
      setPriority("medium");
      setScheduledTime("08:00");
      setNotes("");
      setError("");
    }
  }, [target]);

  async function handleSave() {
    if (!customerId) { setError("Please select a customer."); return; }
    if (!target) return;
    setSaving(true);
    setError("");
    try {
      await createJob({
        customerId: Number(customerId),
        employeeId: Number(assigneeId) || target.employeeId,
        serviceType,
        status: "pending",
        priority,
        scheduledDate: target.date,
        scheduledTime: scheduledTime || "08:00",
        revenue: Number(revenue) || 0,
        certRequired: "any",
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create job.");
    } finally {
      setSaving(false);
    }
  }

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="size-4 text-primary" /> Add Job
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Context pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1 text-xs">
              <UserCheck className="size-3" /> {target.employeeName}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <CalendarDays className="size-3 mr-1" />{fmtDate(target.date)}
            </Badge>
          </div>

          {/* Assignee override (managers only) */}
          {canChangeAssignee && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Assign To</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.isActive).map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name} <span className="text-muted-foreground text-xs ml-1">({roleLabel(e.role)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Customer */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Customer <span className="text-destructive">*</span></Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="text-sm h-9">
                <SelectValue placeholder="Select customer…" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service type */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Service Type</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger className="text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Revenue + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Revenue ($)</Label>
              <Input
                className="h-9 text-sm"
                type="number"
                min="0"
                value={revenue}
                onChange={e => setRevenue(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Scheduled Time</Label>
              <Input
                className="h-9 text-sm"
                type="time"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Priority</Label>
            <div className="flex gap-2">
              {(["low","medium","high"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold capitalize transition-colors
                    ${priority === p
                      ? p === "high" ? "bg-red-500 text-white border-red-500"
                        : p === "medium" ? "bg-amber-500 text-white border-amber-500"
                        : "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Textarea
              className="text-sm resize-none"
              rows={2}
              placeholder="Any special instructions…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : <><Check className="size-3.5" /> Add Job</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Open Job Dialog ───────────────────────────────────────────────────

function AssignOpenJobDialog({
  open, target, openJobs, employees, canChangeAssignee, onClose, onSaved,
}: {
  open: boolean;
  target: AddJobTarget | null;
  openJobs: ApiOpenJob[];
  employees: ApiEmployee[];
  canChangeAssignee: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedJobId,  setSelectedJobId]  = useState<number | null>(null);
  const [assigneeId,     setAssigneeId]     = useState("");
  const [scheduledDate,  setScheduledDate]  = useState("");
  const [scheduledTime,  setScheduledTime]  = useState("08:00");
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");

  useEffect(() => {
    if (target) {
      setAssigneeId(String(target.employeeId));
      setSelectedJobId(null);
      setScheduledDate(target.date);
      setScheduledTime("08:00");
      setError("");
    }
  }, [target]);

  const unassigned = openJobs.filter(j => !j.assignedEmployeeId);
  const selected   = openJobs.find(j => j.id === selectedJobId);

  async function handleAssign() {
    if (!selectedJobId || !target) { setError("Please select an open job."); return; }
    if (!scheduledDate) { setError("Please choose a date."); return; }
    setSaving(true);
    setError("");
    try {
      await updateJob(selectedJobId, {
        employeeId: Number(assigneeId) || target.employeeId,
        scheduledDate,
        scheduledTime: scheduledTime || "08:00",
        status: "pending",
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign job.");
    } finally {
      setSaving(false);
    }
  }

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" /> Assign Open Job
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1 text-xs">
              <UserCheck className="size-3" /> {target.employeeName}
            </Badge>
          </div>

          {/* Assignee override */}
          {canChangeAssignee && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Assign To</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.isActive).map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name} <span className="text-muted-foreground text-xs ml-1">({roleLabel(e.role)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Open jobs list */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Select Open Job</Label>
            {unassigned.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">No unassigned open jobs available.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {unassigned.map(job => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`w-full text-left rounded-lg border p-2.5 transition-colors
                      ${selectedJobId === job.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-muted/50"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      {getPriorityBadge(job.priority)}
                      <span className="text-xs font-semibold truncate">{job.title}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {job.clientName} · {job.certRequired.replace(/_/g, " ")}
                    </div>
                    {job.notes && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 italic truncate">{job.notes}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date + Time — shown once a job is picked */}
          {selected && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <CalendarDays className="size-3" /> Date
                </Label>
                <Input
                  className="h-9 text-sm"
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Time</Label>
                <Input
                  className="h-9 text-sm"
                  type="time"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={handleAssign}
              disabled={saving || !selectedJobId || !scheduledDate}
            >
              {saving ? "Assigning…" : <><Check className="size-3.5" /> Assign Job</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Day Cell Menu (for cells that already have jobs) ────────────────────────

function DayCellMenu({
  open, entries, onAddNew, onAssignOpen, onNavigate, onClose,
}: {
  open: boolean;
  entries: CalendarEntry[];
  onAddNew: () => void;
  onAssignOpen: () => void;
  onNavigate: (jobId: number) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-20 rounded-xl bg-card/95 backdrop-blur-sm border border-primary/30 shadow-xl flex flex-col p-1.5 gap-1"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
          {entries.length} job{entries.length !== 1 ? "s" : ""}
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-3" />
        </button>
      </div>
      {entries.map((e, i) => e.jobId && (
        <button
          key={i}
          onClick={() => onNavigate(e.jobId!)}
          className="text-left text-[10px] rounded px-1.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 truncate"
        >
          {(e.customerName ?? "").replace(/\s*-.*/, "").trim() || "Job"}
        </button>
      ))}
      <div className="border-t mt-0.5 pt-1 flex flex-col gap-0.5">
        <button onClick={onAddNew}    className="text-[10px] text-left px-1.5 py-1 rounded hover:bg-muted text-primary font-medium">+ New job</button>
        <button onClick={onAssignOpen} className="text-[10px] text-left px-1.5 py-1 rounded hover:bg-muted text-amber-600 font-medium">⚡ Assign open job</button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const isManager = user?.role === "manager" || user?.role === "supervisor";

  const [weekOffset,  setWeekOffset]  = useState(0);
  const [calendar,    setCalendar]    = useState<CalendarEntry[]>([]);
  const [openJobs,    setOpenJobs]    = useState<ApiOpenJob[]>([]);
  const [employees,   setEmployees]   = useState<ApiEmployee[]>([]);
  const [customers,   setCustomers]   = useState<ApiCustomer[]>([]);
  const [loading,     setLoading]     = useState(true);

  // Dialog state
  const [addJobTarget,    setAddJobTarget]    = useState<AddJobTarget | null>(null);
  const [addJobOpen,      setAddJobOpen]      = useState(false);
  const [assignOpenTarget,setAssignOpenTarget]= useState<AddJobTarget | null>(null);
  const [assignOpenOpen,  setAssignOpenOpen]  = useState(false);

  // Per-cell overlay menu state
  const [openCellMenu, setOpenCellMenu] = useState<{ empId: number; dateIdx: number } | null>(null);

  function loadAll() {
    return Promise.all([
      getTeamCalendar().then(setCalendar),
      getOpenJobs().then(setOpenJobs),
      getEmployees().then(setEmployees),
      getCustomers().then(setCustomers),
    ]).finally(() => setLoading(false));
  }

  useEffect(() => { loadAll(); }, []);

  const weekDates = getWeekDates(weekOffset);
  const weekLabel = formatWeekLabel(weekOffset);

  // Build per-employee week grid from calendar entries
  const empMap: Record<number, {
    id: number; name: string; cert: string;
    byDate: Record<string, CalendarEntry[]>;
  }> = {};

  for (const entry of calendar) {
    if (!empMap[entry.employeeId]) {
      empMap[entry.employeeId] = { id: entry.employeeId, name: entry.employeeName, cert: entry.certification, byDate: {} };
    }
    if (!empMap[entry.employeeId].byDate[entry.date]) {
      empMap[entry.employeeId].byDate[entry.date] = [];
    }
    empMap[entry.employeeId].byDate[entry.date].push(entry);
  }

  // Ensure all active employees appear even without jobs
  for (const emp of employees) {
    if (emp.isActive && !empMap[emp.id]) {
      empMap[emp.id] = { id: emp.id, name: emp.name, cert: emp.certifications[0] ?? "any", byDate: {} };
    }
  }

  const scheduleRows = Object.values(empMap).sort((a, b) => a.id - b.id);

  // Summary
  const weekDateStrs = weekDates.map(d => d.date);
  let billableDays = 0;
  for (const row of scheduleRows) {
    for (const date of weekDateStrs) {
      if ((row.byDate[date] ?? []).length > 0) billableDays++;
    }
  }
  const shopDaysYtd = employees.filter(e => e.isActive).reduce((s, e) => s + e.shopDaysUsedYtd, 0);
  const unassignedCount = openJobs.filter(j => !j.assignedEmployeeId).length;

  function openAddJob(empId: number, empName: string, date: string) {
    setAddJobTarget({ employeeId: empId, employeeName: empName, date });
    setAddJobOpen(true);
    setOpenCellMenu(null);
  }

  function openAssignOpen(empId: number, empName: string, date: string) {
    setAssignOpenTarget({ employeeId: empId, employeeName: empName, date });
    setAssignOpenOpen(true);
    setOpenCellMenu(null);
  }

  async function handleSaved() {
    await loadAll();
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="size-6 text-primary shrink-0" /> Weekly Schedule
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>
            This Week
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="destructive" size="sm" className="ml-1 gap-1.5 text-xs" onClick={() => navigate("/dashboard")}>
            <Zap className="size-3.5" /> Emergency
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billable Days</div>
            <div className="text-xl font-extrabold text-emerald-600">{loading ? "—" : billableDays}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shop Days YTD</div>
            <div className="text-xl font-extrabold text-red-600">{loading ? "—" : shopDaysYtd}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Staff</div>
            <div className="text-xl font-extrabold text-primary">{employees.filter(e => e.isActive).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unassigned Jobs</div>
            <div className={`text-xl font-extrabold ${unassignedCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
              {loading ? "—" : unassignedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 sm:gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300" /> Billable</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-muted/50 border border-border" /> Available</span>
        {isManager && <span className="flex items-center gap-1.5 text-primary"><Plus className="size-3" /> Click any cell to add or assign a job</span>}
      </div>

      {/* Schedule Grid */}
      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading schedule…</p>}

        {scheduleRows.map(row => {
          const emp = employees.find(e => e.id === row.id);
          return (
            <Card key={row.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-5">
                {/* Employee Header */}
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 sm:size-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {initials(row.name)}
                    </div>
                    <div>
                      <div className="font-bold text-sm sm:text-base leading-tight">{row.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/40 font-semibold capitalize">
                          {row.cert.replace(/_/g, " ")}
                        </Badge>
                        {emp && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground">{roleLabel(emp.role)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {emp && emp.shopDaysUsedYtd > 0 && (
                      <span className="text-xs text-red-600 font-semibold hidden sm:block">
                        {emp.shopDaysUsedYtd}/{emp.allowedShopDays} shop
                      </span>
                    )}
                    {isManager && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px] gap-1 text-primary border-primary/30 hover:bg-primary/5"
                        onClick={() => openAddJob(row.id, row.name, weekDates[0].date)}
                      >
                        <Plus className="size-3" /> Add Job
                      </Button>
                    )}
                  </div>
                </div>

                {/* Day Grid */}
                <TooltipProvider delayDuration={300}>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {weekDates.map((d, di) => {
                    const entries = row.byDate[d.date] ?? [];
                    const hasJobs = entries.length > 0;
                    const menuOpen = openCellMenu?.empId === row.id && openCellMenu?.dateIdx === di;

                    const mainLabel = hasJobs
                      ? entries.length === 1
                        ? (entries[0].customerName ?? "").replace(/\s*-.*/, "").trim().split(" ").slice(0, 2).join(" ") || "Job"
                        : `${entries.length} Jobs`
                      : isManager ? "+" : "—";

                    const cellEl = (
                      <div
                        className={`relative rounded-xl border px-1 sm:px-2.5 py-2 sm:py-3 text-center transition-all
                          ${getDayBg(hasJobs)}
                          ${isManager || hasJobs ? "cursor-pointer hover:shadow-sm hover:scale-[1.02]" : "opacity-50"}
                          ${!hasJobs && isManager ? "border-dashed hover:border-primary/40 hover:bg-primary/5" : ""}
                        `}
                        onClick={() => {
                          if (menuOpen) { setOpenCellMenu(null); return; }
                          if (hasJobs) {
                            if (entries.length === 1 && entries[0].jobId && !isManager) {
                              navigate(`/jobs/${entries[0].jobId}`);
                            } else if (isManager) {
                              setOpenCellMenu({ empId: row.id, dateIdx: di });
                            } else {
                              navigate(`/jobs/${entries[0].jobId}`);
                            }
                          } else if (isManager) {
                            openAddJob(row.id, row.name, d.date);
                          }
                        }}
                      >
                        <div className="text-[10px] sm:text-xs opacity-60 mb-0.5 font-medium">{d.label}</div>
                        <div className={`text-xs sm:text-sm font-bold leading-tight ${!hasJobs && isManager ? "text-primary/40" : ""}`}>
                          {mainLabel}
                        </div>

                        {hasJobs && entries.length === 1 && (
                          <div className="hidden sm:block mt-0.5 text-[10px] opacity-60 leading-tight">
                            {serviceTypeLabel(entries[0].type)}
                          </div>
                        )}
                        {hasJobs && entries.length > 1 && (
                          <div className="hidden sm:block mt-1 space-y-0.5">
                            {entries.slice(0, 2).map((e, ei) => (
                              <div key={ei} className="text-[9px] leading-tight opacity-70 truncate">
                                {(e.customerName ?? "").replace(/\s*-.*/, "").trim()}
                              </div>
                            ))}
                            {entries.length > 2 && <div className="text-[9px] opacity-40">+{entries.length - 2} more</div>}
                          </div>
                        )}

                        {/* Cell menu overlay */}
                        <DayCellMenu
                          open={menuOpen}
                          entries={entries}
                          onAddNew={() => openAddJob(row.id, row.name, d.date)}
                          onAssignOpen={() => openAssignOpen(row.id, row.name, d.date)}
                          onNavigate={jobId => { setOpenCellMenu(null); navigate(`/jobs/${jobId}`); }}
                          onClose={() => setOpenCellMenu(null)}
                        />
                      </div>
                    );

                    if (!hasJobs) return <div key={di}>{cellEl}</div>;

                    return (
                      <Tooltip key={di}>
                        <TooltipTrigger asChild>{cellEl}</TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="p-0 w-56 rounded-xl shadow-xl border bg-card text-card-foreground overflow-hidden"
                        >
                          <div className="px-3 py-2 border-b bg-muted/40">
                            <div className="font-semibold text-xs">{d.label} — {row.name}</div>
                            <div className="text-[10px] text-muted-foreground">{entries.length} job{entries.length !== 1 ? "s" : ""}</div>
                          </div>
                          <div className="p-2 space-y-2">
                            {entries.map((e, ei) => (
                              <div key={ei} className="space-y-0.5">
                                <div className="text-xs font-semibold leading-tight">
                                  {(e.customerName ?? "Unknown").replace(/\s*-.*/, "").trim()}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{serviceTypeLabel(e.type)}</div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                                  {e.status && (
                                    <span className="capitalize font-medium">{e.status.replace(/_/g, " ")}</span>
                                  )}
                                  {e.revenue > 0 && (
                                    <span className="flex items-center gap-0.5 text-emerald-600 font-semibold">
                                      <DollarSign className="size-2.5" />
                                      {e.revenue.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                {ei < entries.length - 1 && <div className="border-t border-border/50 mt-1.5" />}
                              </div>
                            ))}
                          </div>
                          {isManager && (
                            <div className="px-3 py-1.5 border-t bg-muted/20 text-[10px] text-primary font-medium">
                              Click to manage jobs
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                </TooltipProvider>

                {/* Footer */}
                {emp && (
                  <div className="mt-2.5 pt-2 border-t text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <Wrench className="size-3 shrink-0" />
                    <span>Shop: {emp.shopDaysUsedYtd}/{emp.allowedShopDays}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>Utilization: {emp.utilizationPct}%</span>
                    {isManager && (
                      <>
                        <button
                          className="ml-auto text-primary hover:underline"
                          onClick={() => navigate("/profitability")}
                        >
                          P&L →
                        </button>
                        <button
                          className="text-amber-600 hover:underline"
                          onClick={() => openAssignOpen(row.id, row.name, weekDates[0].date)}
                        >
                          ⚡ Assign open job
                        </button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Open Jobs Queue */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingUp className="size-4 text-primary" /> Open Jobs — Available for Assignment
              {unassignedCount > 0 && (
                <Badge className="bg-amber-500 text-[10px] ml-1">{unassignedCount}</Badge>
              )}
            </CardTitle>
            <Button size="sm" className="text-xs" onClick={() => navigate("/open-jobs")}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {openJobs.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">No open jobs awaiting assignment. 🎉</p>
          )}

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Priority</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Job</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Client</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Cert Required</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Assigned To</th>
                  {isManager && <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Action</th>}
                </tr>
              </thead>
              <tbody>
                {openJobs.map(job => (
                  <tr
                    key={job.id}
                    className={`border-b border-muted/50 hover:bg-muted/20 transition-colors ${job.priority === "high" ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}
                  >
                    <td className="py-2.5 px-2">{getPriorityBadge(job.priority)}</td>
                    <td className="py-2.5 px-2 font-semibold text-xs cursor-pointer hover:text-primary" onClick={() => navigate("/open-jobs")}>{job.title}</td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground">{job.clientName}</td>
                    <td className="py-2.5 px-2">
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/40 capitalize">
                        {job.certRequired.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground italic">
                      {job.assignedEmployeeName ?? (
                        <span className="text-amber-600 font-medium">Unassigned</span>
                      )}
                    </td>
                    {isManager && (
                      <td className="py-2.5 px-2 text-right">
                        {!job.assignedEmployeeId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] gap-1 text-amber-600 border-amber-300 hover:bg-amber-50"
                            onClick={() => {
                              const firstEmp = employees.find(e => e.isActive);
                              if (firstEmp) {
                                setAssignOpenTarget({ employeeId: firstEmp.id, employeeName: firstEmp.name, date: weekDates[0].date });
                                setAssignOpenOpen(true);
                              }
                            }}
                          >
                            <Zap className="size-2.5" /> Assign
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {openJobs.map(job => (
              <div
                key={job.id}
                className="border rounded-lg p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {getPriorityBadge(job.priority)}
                    <span className="text-xs font-bold truncate">{job.title}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{job.clientName} · {job.certRequired}</div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {job.assignedEmployeeName ?? "Unassigned"}
                  </Badge>
                  {isManager && !job.assignedEmployeeId && (
                    <button
                      className="text-[10px] text-amber-600 font-medium"
                      onClick={() => {
                        const firstEmp = employees.find(e => e.isActive);
                        if (firstEmp) {
                          setAssignOpenTarget({ employeeId: firstEmp.id, employeeName: firstEmp.name, date: weekDates[0].date });
                          setAssignOpenOpen(true);
                        }
                      }}
                    >
                      ⚡ Assign
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddJobDialog
        open={addJobOpen}
        target={addJobTarget}
        employees={employees}
        customers={customers}
        canChangeAssignee={user?.role === "manager"}
        onClose={() => { setAddJobOpen(false); setAddJobTarget(null); }}
        onSaved={handleSaved}
      />

      <AssignOpenJobDialog
        open={assignOpenOpen}
        target={assignOpenTarget}
        openJobs={openJobs}
        employees={employees}
        canChangeAssignee={user?.role === "manager"}
        onClose={() => { setAssignOpenOpen(false); setAssignOpenTarget(null); }}
        onSaved={handleSaved}
      />
    </div>
  );
}
