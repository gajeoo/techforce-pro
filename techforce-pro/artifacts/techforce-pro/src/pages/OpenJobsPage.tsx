import { useState, useEffect, useCallback } from "react";
import {
  Bot, Briefcase, Camera, CheckCircle2, ChevronDown, Clock,
  DollarSign, FileText, History, Image as ImageIcon,
  MapPin, RefreshCw, Search, ArrowUpDown,
  Sparkles, User, UserCheck, X, Zap, CalendarDays,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getOpenJobs, getEmployees, updateJob, initials,
  type ApiOpenJob, type ApiEmployee,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Priority     = "high" | "medium" | "low";
type AssignFilter = "all" | "assigned" | "unassigned";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getPriorityStyle(p: string) {
  if (p === "high")   return { badge: "destructive" as const, bar: "bg-red-500",   label: "HIGH" };
  if (p === "medium") return { badge: "default"     as const, bar: "bg-amber-500", label: "MED" };
  return { badge: "secondary" as const, bar: "bg-gray-400", label: "LOW" };
}

function getCertColor(cert: string): string {
  const c = cert.toLowerCase();
  if (c.includes("suppression"))  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (c.includes("sprinkler"))    return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300";
  if (c.includes("extinguisher")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (c.includes("exit"))         return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
}

function getEligibleTechs(cert: string, emps: ApiEmployee[]): ApiEmployee[] {
  if (!cert || cert === "Any" || cert === "any") return emps.filter(e => e.role !== "admin");
  return emps.filter(e =>
    e.certifications.some(c =>
      c.toLowerCase().includes(cert.toLowerCase().replace("exit lights", "exit").replace("extinguisher", "ext"))
    ) || e.certifications.length === 0
  );
}

function aiPickTech(job: ApiOpenJob, emps: ApiEmployee[]): ApiEmployee | undefined {
  const eligible = getEligibleTechs(job.certRequired, emps);
  if (eligible.length === 0) return emps[0];
  return eligible.sort((a, b) => a.shopDaysUsedYtd - b.shopDaysUsedYtd)[0];
}

// ─── Simulated data ───────────────────────────────────────────────────────────

const SIMULATED_HISTORY = [
  { date: "Oct 12, 2025", action: "Annual inspection completed", tech: "Marcus Taylor", result: "Pass" },
  { date: "Apr 8, 2025",  action: "Semi-annual check",           tech: "Angela Davis",  result: "Pass" },
  { date: "Oct 5, 2024",  action: "Annual inspection completed", tech: "Marcus Taylor", result: "Pass — 2 deficiencies noted" },
];
const SIMULATED_DOCS = [
  { name: "Certificate_2025.pdf",       type: "pdf",   date: "Oct 12, 2025" },
  { name: "Inspection_Report_2025.pdf", type: "pdf",   date: "Oct 12, 2025" },
  { name: "site_photo_1.jpg",           type: "image", date: "Oct 12, 2025" },
];

// ─── Assign Schedule Dialog ───────────────────────────────────────────────────

interface AssignTarget {
  jobId: number;
  empId: string;
}

function AssignScheduleDialog({
  open, target, employees, jobs, onClose, onSaved,
}: {
  open: boolean;
  target: AssignTarget | null;
  employees: ApiEmployee[];
  jobs: ApiOpenJob[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [empId,      setEmpId]      = useState("");
  const [coTechIds,  setCoTechIds]  = useState<number[]>([]);
  const [date,       setDate]       = useState(todayISO());
  const [time,       setTime]       = useState("08:00");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    if (target) {
      setEmpId(target.empId);
      setCoTechIds([]);
      setDate(todayISO());
      setTime("08:00");
      setError("");
    }
  }, [target]);

  const job = jobs.find(j => j.id === target?.jobId);
  const emp = employees.find(e => String(e.id) === empId);

  function toggleCoTech(id: number) {
    setCoTechIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSave() {
    if (!target || !empId || !date) { setError("Please select an employee and date."); return; }
    setSaving(true);
    setError("");
    try {
      await updateJob(target.jobId, {
        employeeId:    Number(empId),
        scheduledDate: date,
        scheduledTime: time || "08:00",
        status:        "pending",
      });
      // Also store co-technicians on the open job record
      await fetch(`/api/open-jobs/${target.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedEmployeeId: Number(empId), coTechnicianIds: coTechIds }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign job.");
    } finally {
      setSaving(false);
    }
  }

  if (!target || !job) return null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-amber-500" /> Schedule Job
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Job info */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
            <div className="text-sm font-semibold">{job.clientName}</div>
            <div className="text-xs text-muted-foreground">{job.title}</div>
            <Badge variant={getPriorityStyle(job.priority).badge} className="text-[10px] mt-1">
              {job.priority.toUpperCase()}
            </Badge>
          </div>

          {/* Primary tech */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Primary Technician</Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.isActive).map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    <span className="flex items-center gap-2">
                      <span>{e.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        ({e.certifications[0]?.replace(/_/g, " ") ?? "General"})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Co-technicians */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Additional Technicians <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="rounded-md border divide-y max-h-36 overflow-y-auto">
              {employees.filter(e => e.isActive && String(e.id) !== empId).map(e => (
                <label key={e.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40 select-none">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={coTechIds.includes(e.id)}
                    onChange={() => toggleCoTech(e.id)}
                  />
                  <span className="text-sm flex-1">{e.name}</span>
                  <span className="text-[10px] text-muted-foreground">{e.certifications[0]?.replace(/_/g, " ") ?? "General"}</span>
                </label>
              ))}
            </div>
            {coTechIds.length > 0 && (
              <p className="text-[11px] text-primary">{coTechIds.length} co-technician{coTechIds.length > 1 ? "s" : ""} selected</p>
            )}
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <CalendarDays className="size-3" /> Date
              </Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Clock className="size-3" /> Time
              </Label>
              <Input
                type="time"
                className="h-9 text-sm"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Preview */}
          {emp && date && (
            <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg p-2.5">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>
                <strong>{emp.name}</strong> · {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {time}
              </span>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving || !empId || !date}>
              {saving ? "Saving…" : <><CheckCircle2 className="size-3.5" /> Confirm</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function OpenJobsPage() {
  const { user } = useAuth();
  const isManager    = user?.role === "manager";
  const isSupervisor = user?.role === "supervisor";
  const canAssign    = isManager || isSupervisor;

  const [openJobs,  setOpenJobs]  = useState<ApiOpenJob[]>([]);
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [loading,   setLoading]   = useState(true);

  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [assignFilter,   setAssignFilter]   = useState<AssignFilter>("all");
  const [search,         setSearch]         = useState("");
  const [sortBy,         setSortBy]         = useState<"priority-desc" | "priority-asc" | "client-az" | "client-za" | "unassigned-first" | "assigned-first">("priority-desc");

  const [aiRunning,   setAiRunning]   = useState<string | null>(null);
  const [aiResult,    setAiResult]    = useState<{ jobId: string; empId: string } | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone,    setBulkDone]    = useState(false);
  const [detailJob,   setDetailJob]   = useState<ApiOpenJob | null>(null);
  const [detailTab,   setDetailTab]   = useState<"info" | "history" | "docs" | "photos">("info");

  // Assign schedule dialog
  const [assignDialog, setAssignDialog] = useState<AssignTarget | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const reload = useCallback(async () => {
    const [jobs, emps] = await Promise.all([getOpenJobs(), getEmployees()]);
    setOpenJobs(jobs);
    setEmployees(emps);
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  // Derive assignment status directly from API data
  const assignedMap: Record<string, number> = {};
  for (const j of openJobs) {
    if (j.assignedEmployeeId) assignedMap[String(j.id)] = j.assignedEmployeeId;
  }

  const assignedCount   = Object.keys(assignedMap).length;
  const unassignedCount = openJobs.filter(j => !j.assignedEmployeeId).length;
  const highCount       = openJobs.filter(j => j.priority === "high").length;

  // Filters + search + sort
  const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const priorityFiltered = priorityFilter === "all"
    ? openJobs : openJobs.filter(j => j.priority === priorityFilter);
  const assignFiltered = assignFilter === "assigned"
    ? priorityFiltered.filter(j => j.assignedEmployeeId)
    : assignFilter === "unassigned"
    ? priorityFiltered.filter(j => !j.assignedEmployeeId)
    : priorityFiltered;
  const q = search.trim().toLowerCase();
  const searched = q
    ? assignFiltered.filter(j =>
        j.clientName.toLowerCase().includes(q) ||
        j.title.toLowerCase().includes(q) ||
        (j.certRequired ?? "").toLowerCase().includes(q) ||
        (j.notes ?? "").toLowerCase().includes(q) ||
        (j.assignedEmployeeName ?? "").toLowerCase().includes(q) ||
        (j.clientAddress ?? "").toLowerCase().includes(q) ||
        (j.zipCode ?? "").toLowerCase().includes(q) ||
        (j.coTechnicianNames ?? []).some(n => n.toLowerCase().includes(q))
      )
    : assignFiltered;
  const filteredJobs = [...searched].sort((a, b) => {
    switch (sortBy) {
      case "priority-desc": return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      case "priority-asc":  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      case "client-az":     return a.clientName.localeCompare(b.clientName);
      case "client-za":     return b.clientName.localeCompare(a.clientName);
      case "unassigned-first": return (a.assignedEmployeeId ? 1 : 0) - (b.assignedEmployeeId ? 1 : 0);
      case "assigned-first":   return (b.assignedEmployeeId ? 1 : 0) - (a.assignedEmployeeId ? 1 : 0);
      default: return 0;
    }
  });

  function openAssignDialog(jobId: number, empId: string) {
    setAssignDialog({ jobId, empId });
    setAssignDialogOpen(true);
  }

  async function unassign(jobId: string) {
    try {
      await updateJob(Number(jobId), { employeeId: null, scheduledDate: null, scheduledTime: null });
      await reload();
    } catch { /* ignore */ }
  }

  function runAI(job: ApiOpenJob) {
    setAiRunning(String(job.id));
    setAiResult(null);
    setTimeout(() => {
      const pick = aiPickTech(job, employees);
      setAiRunning(null);
      if (pick) setAiResult({ jobId: String(job.id), empId: String(pick.id) });
    }, 1200);
  }

  function acceptAI() {
    if (!aiResult) return;
    openAssignDialog(Number(aiResult.jobId), aiResult.empId);
    setAiResult(null);
  }

  function rerunAI() {
    const job = openJobs.find(j => String(j.id) === aiResult?.jobId);
    if (job) { setAiResult(null); runAI(job); }
  }

  function runBulkAI() {
    setBulkRunning(true);
    setBulkDone(false);
    const unassignedHigh = openJobs.filter(j => j.priority === "high" && !j.assignedEmployeeId);
    let delay = 0;
    for (const job of unassignedHigh) {
      delay += 400;
      setTimeout(() => {
        const pick = aiPickTech(job, employees);
        if (pick) openAssignDialog(job.id, String(pick.id));
      }, delay);
    }
    setTimeout(() => { setBulkRunning(false); setBulkDone(true); }, delay + 200);
  }

  const suggestedEmp     = aiResult ? employees.find(e => String(e.id) === aiResult.empId) : null;
  const suggestedJobName = aiResult ? openJobs.find(j => String(j.id) === aiResult.jobId)?.clientName : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="size-6 text-primary shrink-0" /> Open Jobs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isSupervisor
              ? "Unscheduled jobs — assign technicians, set dates, and update status"
              : "Unscheduled jobs ready for dispatch — assign techs with date & time, or use AI"}
          </p>
        </div>
        {isManager && (
          <div className="flex gap-2 self-start sm:self-auto">
            <Button
              variant={bulkDone ? "outline" : "default"}
              size="sm"
              className="gap-1.5"
              disabled={bulkRunning || loading}
              onClick={bulkRunning ? undefined : runBulkAI}
            >
              {bulkRunning
                ? <><RefreshCw className="size-3.5 animate-spin" /> Assigning…</>
                : bulkDone
                  ? <><CheckCircle2 className="size-3.5 text-emerald-600" /> High Priority Assigned</>
                  : <><Sparkles className="size-3.5" /> AI Auto-Assign High Priority</>}
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Total Open</div>
            <div className="text-2xl font-extrabold">{openJobs.length}</div>
            <div className="text-[10px] text-muted-foreground">{assignedCount} scheduled, {unassignedCount} unassigned</div>
            <Progress value={openJobs.length ? (assignedCount / openJobs.length) * 100 : 0} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">High Priority</div>
            <div className="text-2xl font-extrabold text-red-600">{highCount}</div>
            <div className="text-[10px] text-muted-foreground">
              {openJobs.filter(j => j.priority === "high" && j.assignedEmployeeId).length} scheduled
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Unscheduled</div>
            <div className="text-2xl font-extrabold text-amber-600">{unassignedCount}</div>
            <div className="text-[10px] text-muted-foreground">need date & technician</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Eligible Techs</div>
            <div className="text-2xl font-extrabold text-emerald-600">{employees.filter(e => e.role !== "admin").length}</div>
            <div className="text-[10px] text-muted-foreground">available for dispatch</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Search + Sort row */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search client, address, zip, title, cert, technician…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-9 w-auto min-w-[180px] text-sm gap-1.5">
              <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority-desc">Priority: High → Low</SelectItem>
              <SelectItem value="priority-asc">Priority: Low → High</SelectItem>
              <SelectItem value="client-az">Client: A → Z</SelectItem>
              <SelectItem value="client-za">Client: Z → A</SelectItem>
              <SelectItem value="unassigned-first">Unscheduled First</SelectItem>
              <SelectItem value="assigned-first">Scheduled First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Priority tabs + assign filter row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Tabs value={priorityFilter} onValueChange={v => setPriorityFilter(v as typeof priorityFilter)}>
            <div className="overflow-x-auto">
              <TabsList className="w-max min-w-full sm:w-auto">
                <TabsTrigger value="all">All ({openJobs.length})</TabsTrigger>
                <TabsTrigger value="high" className="text-red-600 data-[state=active]:text-red-600">
                  High ({highCount})
                </TabsTrigger>
                <TabsTrigger value="medium">Medium ({openJobs.filter(j => j.priority === "medium").length})</TabsTrigger>
                <TabsTrigger value="low">Low ({openJobs.filter(j => j.priority === "low").length})</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
          <div className="flex gap-1.5 ml-auto">
            {(["all", "assigned", "unassigned"] as AssignFilter[]).map(f => (
              <Button
                key={f}
                variant={assignFilter === f ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs capitalize"
                onClick={() => setAssignFilter(f)}
              >
                {f === "all" ? "All" : f === "assigned" ? `Scheduled (${assignedCount})` : `Unscheduled (${unassignedCount})`}
              </Button>
            ))}
          </div>
        </div>

        {/* Active search indicator */}
        {q && (
          <p className="text-xs text-muted-foreground">
            Showing <strong>{filteredJobs.length}</strong> of {openJobs.length} jobs matching <em>"{search}"</em>
          </p>
        )}
      </div>

      {loading && <div className="text-center py-8 text-muted-foreground text-sm">Loading open jobs…</div>}

      {/* AI Result Banner */}
      {aiResult && suggestedEmp && isManager && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> AI Recommendation
                </div>
                <p className="text-sm text-muted-foreground">
                  Assign <strong>{suggestedJobName}</strong> → <strong className="text-foreground">{suggestedEmp.name}</strong>{" "}
                  <span className="text-[11px]">({suggestedEmp.certifications.slice(0, 2).join(", ") || "General"})</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Click "Accept" to choose date & time.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={acceptAI}>
                  <CheckCircle2 className="size-3.5" /> Accept
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={rerunAI}>
                  <RefreshCw className="size-3.5" /> Re-run
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAiResult(null)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredJobs.map(job => {
          const pStyle       = getPriorityStyle(job.priority);
          const jobKey       = String(job.id);
          const assignedEmp  = job.assignedEmployeeId ? employees.find(e => e.id === job.assignedEmployeeId) : null;
          const isRunningAI  = aiRunning === jobKey;
          const eligible     = getEligibleTechs(job.certRequired, employees);

          return (
            <Card
              key={job.id}
              className={`overflow-hidden transition-all hover:shadow-md ${assignedEmp ? "ring-1 ring-emerald-400/50" : ""}`}
            >
              <div className={`h-1 ${pStyle.bar}`} />
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      className="text-sm font-bold text-primary cursor-pointer hover:underline leading-tight"
                      onClick={() => { setDetailJob(job); setDetailTab("info"); }}
                    >
                      {job.clientName}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{job.title}</p>
                  </div>
                  <Badge variant={pStyle.badge} className="text-[9px] shrink-0">{pStyle.label}</Badge>
                </div>

                {/* Meta */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-[9px] px-1.5 ${getCertColor(job.certRequired)}`}>
                      {job.certRequired || "Any cert"}
                    </Badge>
                  </div>
                  {(job.clientAddress || job.zipCode) && (
                    <div className="flex items-center gap-1">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{job.clientAddress}{job.zipCode ? (job.clientAddress ? ` · ${job.zipCode}` : job.zipCode) : ""}</span>
                    </div>
                  )}
                  {job.notes && (
                    <p className="text-[11px] italic bg-muted/40 rounded px-2 py-1">{job.notes}</p>
                  )}
                </div>

                {/* Assignment area */}
                {assignedEmp ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                          {initials(assignedEmp.name)}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{assignedEmp.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {assignedEmp.certifications.slice(0, 2).join(", ") || "General"}
                          </div>
                        </div>
                      </div>
                      {canAssign && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] text-primary hover:text-primary"
                            onClick={() => openAssignDialog(job.id, String(assignedEmp.id))}
                          >
                            Reschedule
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => unassign(jobKey)}
                          >
                            <X className="size-3 mr-1" /> Remove
                          </Button>
                        </div>
                      )}
                    </div>
                    {/* Show scheduled date if available */}
                    {job.assignedEmployeeName && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                        <CheckCircle2 className="size-3 text-emerald-500" />
                        <span>Assigned to <strong>{job.assignedEmployeeName}</strong> — will appear on schedule</span>
                      </div>
                    )}
                    {/* Co-technicians */}
                    {(job.coTechnicianNames ?? []).length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-primary px-1">
                        <UserCheck className="size-3" />
                        <span>+ {(job.coTechnicianNames ?? []).join(", ")}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {canAssign ? (
                      <>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5 justify-between">
                              <span className="flex items-center gap-1.5">
                                <User className="size-3.5" /> Assign + Schedule
                              </span>
                              <ChevronDown className="size-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
                            {eligible.map(e => (
                              <DropdownMenuItem
                                key={e.id}
                                onClick={() => openAssignDialog(job.id, String(e.id))}
                                className="gap-2"
                              >
                                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                  {initials(e.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-medium truncate">{e.name}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {e.certifications.slice(0, 2).join(", ") || "General"}
                                  </div>
                                </div>
                              </DropdownMenuItem>
                            ))}
                            {eligible.length === 0 && (
                              <DropdownMenuItem disabled>No eligible techs</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {isManager && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs gap-1.5 shrink-0"
                            disabled={isRunningAI}
                            onClick={() => runAI(job)}
                          >
                            {isRunningAI
                              ? <RefreshCw className="size-3.5 animate-spin" />
                              : <><Sparkles className="size-3.5" /> AI</>}
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 h-8 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" /> Awaiting assignment
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-[10px] text-muted-foreground hover:text-primary gap-1.5"
                  onClick={() => { setDetailJob(job); setDetailTab("info"); }}
                >
                  View History, Docs & Photos
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && filteredJobs.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <UserCheck className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {assignFilter === "unassigned" ? "All jobs in this filter are scheduled." : "No jobs match your filters."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Job Detail Dialog */}
      {detailJob && (
        <Dialog open onOpenChange={o => !o && setDetailJob(null)}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Briefcase className="size-4 text-primary" /> {detailJob.clientName}
              </DialogTitle>
            </DialogHeader>
            <Tabs value={detailTab} onValueChange={v => setDetailTab(v as typeof detailTab)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full grid grid-cols-4 shrink-0">
                <TabsTrigger value="info"    className="gap-1.5 text-xs"><User className="size-3" /> Info</TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5 text-xs"><History className="size-3" /> History</TabsTrigger>
                <TabsTrigger value="docs"    className="gap-1.5 text-xs"><FileText className="size-3" /> Docs</TabsTrigger>
                <TabsTrigger value="photos"  className="gap-1.5 text-xs"><Camera className="size-3" /> Photos</TabsTrigger>
              </TabsList>
              <div className="overflow-y-auto flex-1 mt-3 space-y-3">

                {detailTab === "info" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-muted/40 rounded-lg p-3">
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Job Title</div>
                        <div className="font-medium">{detailJob.title}</div>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Priority</div>
                        <Badge variant={getPriorityStyle(detailJob.priority).badge} className="text-[10px]">
                          {detailJob.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Cert Required</div>
                        <div className="text-sm font-medium">{detailJob.certRequired || "Any"}</div>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Assigned To</div>
                        <div className="text-sm font-medium">
                          {detailJob.assignedEmployeeName ?? "Unassigned"}
                        </div>
                      </div>
                    </div>
                    {detailJob.notes && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
                        <div className="text-[10px] font-semibold uppercase mb-1">Notes</div>
                        {detailJob.notes}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Eligible Technicians</div>
                      <div className="space-y-1.5">
                        {getEligibleTechs(detailJob.certRequired, employees).map(e => (
                          <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                              {initials(e.name)}
                            </div>
                            <span className="font-medium">{e.name}</span>
                            <span className="text-muted-foreground">— {e.certifications.slice(0, 2).join(", ") || "General"}</span>
                            {canAssign && (
                              <Button
                                size="sm"
                                className="ml-auto h-6 text-[10px] px-2"
                                onClick={() => { openAssignDialog(detailJob.id, String(e.id)); setDetailJob(null); }}
                              >
                                Schedule
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {detailTab === "history" && (
                  <div className="space-y-2">
                    {SIMULATED_HISTORY.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <History className="size-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">{h.action}</span>
                            <Badge
                              variant={h.result.startsWith("Pass") ? "default" : "destructive"}
                              className={`text-[9px] shrink-0 ${h.result.startsWith("Pass") ? "bg-emerald-600" : ""}`}
                            >
                              {h.result.startsWith("Pass") ? "PASS" : "FAIL"}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{h.date} · {h.tech}</div>
                          {h.result.includes("deficiencie") && (
                            <div className="text-[11px] text-amber-600 mt-0.5">{h.result.split("—")[1]?.trim()}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {detailTab === "docs" && (
                  <div className="space-y-2">
                    {SIMULATED_DOCS.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                        <div className="size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                          {doc.type === "pdf"
                            ? <FileText className="size-4 text-blue-600" />
                            : <ImageIcon className="size-4 text-emerald-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{doc.name}</div>
                          <div className="text-[10px] text-muted-foreground">{doc.date}</div>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 shrink-0">
                          <FileText className="size-3" /> View
                        </Button>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground text-center pt-1">
                      Documents are attached to completed inspection records.
                    </p>
                  </div>
                )}

                {detailTab === "photos" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Suppression panel", color: "bg-slate-200 dark:bg-slate-700" },
                        { label: "Sprinkler heads",   color: "bg-zinc-200 dark:bg-zinc-700" },
                        { label: "Extinguisher rack",  color: "bg-stone-200 dark:bg-stone-700" },
                        { label: "Exit signs",         color: "bg-neutral-200 dark:bg-neutral-700" },
                      ].map((p, i) => (
                        <div key={i} className={`rounded-xl ${p.color} h-28 flex flex-col items-center justify-center gap-1 text-center`}>
                          <Camera className="size-6 text-muted-foreground/60" />
                          <span className="text-[10px] text-muted-foreground">{p.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Site photos uploaded by technicians during inspection.
                    </p>
                  </div>
                )}
              </div>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign Schedule Dialog */}
      <AssignScheduleDialog
        open={assignDialogOpen}
        target={assignDialog}
        employees={employees}
        jobs={openJobs}
        onClose={() => { setAssignDialogOpen(false); setAssignDialog(null); }}
        onSaved={async () => {
          setAssignDialogOpen(false);
          setAssignDialog(null);
          await reload();
        }}
      />
    </div>
  );
}
