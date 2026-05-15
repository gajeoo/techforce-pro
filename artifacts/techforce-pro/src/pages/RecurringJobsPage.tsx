import { useEffect, useState } from "react";
import {
  CalendarDays, CheckCircle2, ChevronRight, Clock, Edit3,
  Pause, Play, Plus, RefreshCw, RotateCcw, Search, Trash2,
  User, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getRecurringSchedules, createRecurringSchedule, updateRecurringSchedule,
  deleteRecurringSchedule, pauseRecurringSchedule, resumeRecurringSchedule,
  getCustomers, getEmployees,
  serviceTypeLabel,
  type ApiRecurringSchedule, type ApiCustomer, type ApiEmployee,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  "Hood Suppression Inspection",
  "Hood Suppression Service",
  "Extinguisher Annual",
  "Sprinkler Annual Test",
  "Exit Light Inspection",
  "Full Fire Safety Inspection",
  "Standpipe Test",
  "Fire Alarm Inspection",
  "Kitchen Hood Cleaning",
  "Emergency Service",
];

const INTERVAL_OPTIONS = [
  { value: "6months", label: "Every 6 Months" },
  { value: "1year",   label: "Yearly (Every 12 Months)" },
  { value: "custom",  label: "Custom Interval" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function intervalLabel(s: ApiRecurringSchedule) {
  if (s.intervalType === "6months") return "Every 6 months";
  if (s.intervalType === "1year")   return "Yearly";
  if (s.intervalType === "custom" && s.customDays) return `Every ${s.customDays} days`;
  return s.intervalType;
}

function daysUntil(dateStr: string): number {
  const next = new Date(dateStr + "T12:00:00");
  const now  = new Date();
  return Math.ceil((next.getTime() - now.getTime()) / 86400000);
}

function urgencyColor(days: number) {
  if (days <= 7)  return "text-red-600 bg-red-50 dark:bg-red-950/30";
  if (days <= 30) return "text-amber-600 bg-amber-50 dark:bg-amber-950/30";
  return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30";
}

// ─── Schedule Form Dialog ─────────────────────────────────────────────────────

interface ScheduleForm {
  customerId:   string;
  employeeId:   string;
  serviceType:  string;
  intervalType: string;
  customDays:   string;
  startDate:    string;
  revenue:      string;
  notes:        string;
}

function ScheduleFormDialog({
  open, onClose, onSaved, edit,
  customers, employees,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (s: ApiRecurringSchedule) => void;
  edit?: ApiRecurringSchedule;
  customers: ApiCustomer[];
  employees: ApiEmployee[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const blank: ScheduleForm = {
    customerId: "", employeeId: "", serviceType: "",
    intervalType: "1year", customDays: "90",
    startDate: today, revenue: "0", notes: "",
  };

  const [form, setForm] = useState<ScheduleForm>(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (edit) {
        setForm({
          customerId:   String(edit.customerId),
          employeeId:   edit.employeeId ? String(edit.employeeId) : "",
          serviceType:  edit.serviceType,
          intervalType: edit.intervalType,
          customDays:   String(edit.customDays ?? 90),
          startDate:    edit.startDate,
          revenue:      String(edit.revenue),
          notes:        edit.notes ?? "",
        });
      } else {
        setForm(blank);
      }
    }
  }, [open]);

  function upd<K extends keyof ScheduleForm>(k: K, v: ScheduleForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    if (!form.customerId || !form.serviceType || !form.startDate) {
      toast.error("Customer, service type, and start date are required");
      return;
    }
    if (form.intervalType === "custom" && (!form.customDays || Number(form.customDays) < 1)) {
      toast.error("Enter a valid number of days for the custom interval");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        customerId:   Number(form.customerId),
        employeeId:   form.employeeId ? Number(form.employeeId) : null,
        serviceType:  form.serviceType,
        intervalType: form.intervalType,
        customDays:   form.intervalType === "custom" ? Number(form.customDays) : null,
        startDate:    form.startDate,
        revenue:      Number(form.revenue) || 0,
        notes:        form.notes || null,
      };
      let result: ApiRecurringSchedule;
      if (edit) {
        result = await updateRecurringSchedule(edit.id, body);
        toast.success("Schedule updated");
      } else {
        result = await createRecurringSchedule(body);
        toast.success("Recurring schedule created");
      }
      onSaved(result);
      onClose();
    } catch {
      toast.error(edit ? "Failed to update schedule" : "Failed to create schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-4 text-primary"/>
            {edit ? "Edit Recurring Schedule" : "New Recurring Schedule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold">Customer *</Label>
              <Select value={form.customerId} onValueChange={v => upd("customerId", v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select customer…"/></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold">Service Type *</Label>
              <Select value={form.serviceType} onValueChange={v => upd("serviceType", v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select service…"/></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assigned Tech</Label>
              <Select value={form.employeeId || "__none__"} onValueChange={v => upd("employeeId", v === "__none__" ? "" : v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Unassigned"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Revenue ($)</Label>
              <Input
                type="number" min="0" value={form.revenue}
                onChange={e => upd("revenue", e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recurrence Schedule</p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Date *</Label>
              <Input
                type="date" value={form.startDate}
                onChange={e => upd("startDate", e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">First job will be scheduled on this date. Subsequent jobs follow the interval below.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Repeat Interval</Label>
              <Select value={form.intervalType} onValueChange={v => upd("intervalType", v)}>
                <SelectTrigger className="text-sm"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.intervalType === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Custom Interval (days)</Label>
                <Input
                  type="number" min="1" max="3650" value={form.customDays}
                  onChange={e => upd("customDays", e.target.value)}
                  className="text-sm"
                  placeholder="e.g. 90 for every 3 months"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes</Label>
            <Textarea
              rows={2}
              className="text-xs resize-none"
              value={form.notes}
              onChange={e => upd("notes", e.target.value)}
              placeholder="Any special instructions or scope details…"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : edit ? "Save Changes" : "Create Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schedule Card ────────────────────────────────────────────────────────────

function ScheduleCard({
  schedule, isManager,
  onEdit, onDelete, onPause, onResume,
}: {
  schedule: ApiRecurringSchedule;
  isManager: boolean;
  onEdit: (s: ApiRecurringSchedule) => void;
  onDelete: (id: number) => void;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
}) {
  const days = daysUntil(schedule.nextOccurrence);
  const urgency = urgencyColor(days);
  const isPaused = schedule.status === "paused";

  return (
    <Card className={`transition-shadow hover:shadow-sm ${isPaused ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2 shrink-0 ${isPaused ? "bg-muted" : "bg-primary/10"}`}>
            <RotateCcw className={`size-4 ${isPaused ? "text-muted-foreground" : "text-primary"}`}/>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-bold">{schedule.customerName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{schedule.serviceType}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isPaused
                  ? <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-500 dark:bg-gray-800">Paused</Badge>
                  : <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Active</Badge>
                }
                {schedule.revenue > 0 && (
                  <span className="text-xs font-semibold text-emerald-600">{fmtCurrency(schedule.revenue)}</span>
                )}
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="flex items-center gap-1 text-muted-foreground">
                <RefreshCw className="size-3 shrink-0"/>
                <span>{intervalLabel(schedule)}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="size-3 shrink-0"/>
                <span>Started {fmtDate(schedule.startDate)}</span>
              </div>
              {schedule.employeeName && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="size-3 shrink-0"/>
                  <span>{schedule.employeeName}</span>
                </div>
              )}
            </div>

            {!isPaused && (
              <div className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${urgency}`}>
                <Clock className="size-3"/>
                Next: {fmtDate(schedule.nextOccurrence)}
                {days >= 0
                  ? <span className="opacity-70">({days === 0 ? "today" : `in ${days}d`})</span>
                  : <span className="opacity-70">(overdue)</span>
                }
              </div>
            )}

            {schedule.notes && (
              <p className="mt-2 text-[11px] text-muted-foreground italic truncate">{schedule.notes}</p>
            )}
          </div>

          {isManager && (
            <div className="flex flex-col gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={() => onEdit(schedule)}>
                <Edit3 className="size-3.5"/>
              </Button>
              {isPaused
                ? <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" title="Resume" onClick={() => onResume(schedule.id)}>
                    <Play className="size-3.5"/>
                  </Button>
                : <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600" title="Pause" onClick={() => onPause(schedule.id)}>
                    <Pause className="size-3.5"/>
                  </Button>
              }
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Delete" onClick={() => onDelete(schedule.id)}>
                <Trash2 className="size-3.5"/>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function RecurringJobsPage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const [schedules,  setSchedules]  = useState<ApiRecurringSchedule[]>([]);
  const [customers,  setCustomers]  = useState<ApiCustomer[]>([]);
  const [employees,  setEmployees]  = useState<ApiEmployee[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "paused">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<ApiRecurringSchedule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getRecurringSchedules(), getCustomers(), getEmployees()])
      .then(([s, c, e]) => { setSchedules(s); setCustomers(c); setEmployees(e); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = schedules.filter(s => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![s.customerName, s.serviceType, s.employeeName ?? ""].some(v => v.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return a.nextOccurrence.localeCompare(b.nextOccurrence);
  });

  function upsertSchedule(s: ApiRecurringSchedule) {
    setSchedules(prev => {
      const idx = prev.findIndex(x => x.id === s.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = s; return next; }
      return [...prev, s];
    });
  }

  async function handlePause(id: number) {
    try {
      const updated = await pauseRecurringSchedule(id);
      upsertSchedule(updated);
      toast.success("Schedule paused");
    } catch { toast.error("Failed to pause schedule"); }
  }

  async function handleResume(id: number) {
    try {
      const updated = await resumeRecurringSchedule(id);
      upsertSchedule(updated);
      toast.success("Schedule resumed");
    } catch { toast.error("Failed to resume schedule"); }
  }

  async function handleDelete(id: number) {
    try {
      await deleteRecurringSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      setDeleteConfirm(null);
      toast.success("Schedule deleted");
    } catch { toast.error("Failed to delete schedule"); }
  }

  const activeCount = schedules.filter(s => s.status === "active").length;
  const pausedCount = schedules.filter(s => s.status === "paused").length;
  const dueThisMonth = schedules.filter(s => {
    if (s.status !== "active") return false;
    const days = daysUntil(s.nextOccurrence);
    return days >= 0 && days <= 30;
  }).length;
  const totalRevenue = schedules.filter(s => s.status === "active").reduce((sum, s) => sum + s.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <RotateCcw className="size-6 text-primary shrink-0"/> Recurring Jobs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Scheduled recurring service contracts — set intervals, track next visits, pause at any time
          </p>
        </div>
        {isManager && (
          <Button size="sm" className="gap-1.5 self-start sm:self-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5"/> New Schedule
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active", value: activeCount, sub: "recurring contracts", color: "text-emerald-600" },
          { label: "Paused", value: pausedCount, sub: "on hold", color: "text-amber-600" },
          { label: "Due This Month", value: dueThisMonth, sub: "upcoming visits", color: "text-primary" },
          { label: "Active Revenue", value: fmtCurrency(totalRevenue), sub: "per cycle", color: "text-foreground" },
        ].map(({ label, value, sub, color }) => (
          <Card key={label}><CardContent className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
            <div className="text-[10px] text-muted-foreground">{sub}</div>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/>
              <Input
                className="pl-9 h-9 text-sm"
                placeholder="Search by customer, service type, or technician…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as typeof filterStatus)}>
              <SelectTrigger className="h-9 w-36 text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schedules</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="paused">Paused Only</SelectItem>
              </SelectContent>
            </Select>
            {(search || filterStatus !== "all") && (
              <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5 text-muted-foreground"
                onClick={() => { setSearch(""); setFilterStatus("all"); }}>
                <X className="size-3.5"/> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading recurring schedules…</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <RotateCcw className="size-10 text-muted-foreground mx-auto mb-3"/>
            <p className="text-sm font-medium mb-1">
              {schedules.length === 0 ? "No recurring schedules yet" : "No schedules match your filters"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {schedules.length === 0
                ? "Create a recurring schedule to automatically track repeat service visits."
                : "Try adjusting your search or filter."}
            </p>
            {isManager && schedules.length === 0 && (
              <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5"/> Create First Schedule
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map(schedule => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              isManager={isManager}
              onEdit={s => setEditSchedule(s)}
              onDelete={id => setDeleteConfirm(id)}
              onPause={handlePause}
              onResume={handleResume}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <ScheduleFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={s => { upsertSchedule(s); }}
        customers={customers}
        employees={employees}
      />

      {/* Edit Dialog */}
      <ScheduleFormDialog
        open={!!editSchedule}
        onClose={() => setEditSchedule(null)}
        onSaved={s => { upsertSchedule(s); }}
        edit={editSchedule ?? undefined}
        customers={customers}
        employees={employees}
      />

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={o => !o && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-4"/> Delete Schedule?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This recurring schedule will be permanently removed. Past jobs are not affected.
          </p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
