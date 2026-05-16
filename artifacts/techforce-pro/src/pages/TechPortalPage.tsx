import { initials, serviceTypeLabel } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarOff,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardList,
  FileText,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  Upload,
  UserRound,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { useAuth } from "@/contexts/AuthContext";
import { LicenseAlertBanner } from "@/components/LicenseAlertBanner";
import {
  seedClockHistoryIfNeeded,
  addClockEntry,
  getLastClockEntry,
} from "@/lib/clockHistory";

// ─── Status types & persistence ─────────────────────────────────────────

type TechStatus = "pending" | "en-route" | "on-site" | "in-progress" | "completed";

const STATUS_ORDER: TechStatus[] = ["pending", "en-route", "on-site", "in-progress", "completed"];

const STATUS_KEY = "tfpro_job_statuses";

function loadStatuses(): Record<string, TechStatus> {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TechStatus>) : {};
  } catch { return {}; }
}

function saveStatuses(s: Record<string, TechStatus>) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(s));
}

function jobStatusToTechStatus(s: string): TechStatus {
  if (s === "completed") return "completed";
  if (s === "in-progress" || s === "in_progress") return "in-progress";
  return "pending";
}

// ─── Open job assignments from localStorage ──────────────────────────────

const ASSIGNMENTS_KEY = "tfpro_open_job_assignments";

function loadAssignedOpenJobIds(empId: string): Set<string> {
  try {
    const data = JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) ?? "{}") as Record<string, string>;
    return new Set(Object.entries(data).filter(([, v]) => v === empId).map(([k]) => k));
  } catch { return new Set(); }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getStatusBg(status: TechStatus) {
  const map: Record<TechStatus, string> = {
    pending:       "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    "en-route":    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "on-site":     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    "in-progress": "bg-primary/10 text-primary",
    completed:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
  return map[status];
}

function getStatusIcon(status: TechStatus) {
  if (status === "completed")   return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "in-progress") return <Wrench className="size-4 text-primary" />;
  if (status === "en-route")    return <MapPin className="size-4 text-blue-600" />;
  if (status === "on-site")     return <Clock className="size-4 text-amber-600" />;
  return <Clock className="size-4 text-gray-400" />;
}

function getNextLabel(status: TechStatus) {
  if (status === "pending")     return "Start Route";
  if (status === "en-route")    return "Arrived On-Site";
  if (status === "on-site")     return "Begin Work";
  if (status === "in-progress") return "Complete Job";
  return "";
}

function getStatusStripColor(status: TechStatus) {
  const map: Record<TechStatus, string> = {
    completed:     "bg-emerald-500",
    "in-progress": "bg-primary",
    "en-route":    "bg-blue-500",
    "on-site":     "bg-amber-500",
    pending:       "bg-gray-300",
  };
  return map[status];
}

// ─── Synthesize open-job record ──────────────────────────────────

function openJobToRecord(oj: any, empId: string): Record<string, unknown> & { _id: string; _isOpenJob: true } {
  return {
    _id: `open-${oj._id ?? oj.id}`,
    _isOpenJob: true as const,
    customerId: "",
    employeeId: empId,
    serviceType: oj.certRequired ?? "inspection",
    status: "pending",
    priority: oj.priority,
    scheduledDate: null,
    scheduledTime: null,
    revenue: 0,
    quantity: 1,
    notes: oj.notes,
    requiresFollowUp: false,
    followUpConfirmed: false,
    certificationRequired: oj.certRequired,
    locationId: null,
    locationName: null,
    dueDate: null,
    customerName: oj.clientName,
    customerAddress: "See job details",
    employeeName: null,
  };
}

// ─── Job Card ────────────────────────────────────────────────────────────────

function JobCard({
  job, idx, statuses, navigate, advanceStatus, openJobs,
}: {
  job: any;
  idx: number;
  statuses: Record<string, TechStatus>;
  navigate: (path: string) => void;
  advanceStatus: (job: any) => void;
  openJobs: any[];
}) {
  const isOpenJob = job._isOpenJob === true;
  const status    = statuses[job._id] ?? jobStatusToTechStatus(job.status);
  const nextLabel = getNextLabel(status);
  return (
    <Card
      className={`overflow-hidden transition-all ${isOpenJob ? "ring-1 ring-primary/30" : ""} ${status === "completed" ? "opacity-70" : "hover:shadow-md cursor-pointer"}`}
      onClick={() => !isOpenJob && navigate(`/jobs/${job._id}`)}
    >
      <div className={`h-1.5 ${getStatusStripColor(status)}`} />
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="text-xs font-bold text-muted-foreground">{idx + 1}</div>
            {getStatusIcon(status)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">
                  {job.customerName}
                  {isOpenJob && <Badge className="ml-2 text-[9px] bg-primary/20 text-primary border-0">Newly Assigned</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{serviceTypeLabel(job.serviceType)}</div>
              </div>
              <Badge className={`text-[9px] shrink-0 ${getStatusBg(status)}`}>{status.replace("-", " ")}</Badge>
            </div>
            {job.scheduledDate && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                <ClipboardList className="size-3 shrink-0" />
                <span>{job.scheduledDate}{job.scheduledTime ? ` · ${job.scheduledTime}` : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{job.customerAddress}</span>
            </div>
            {isOpenJob && (() => {
              const oj = openJobs.find((o: any) => `open-${o._id ?? o.id}` === job._id);
              const coNames: string[] = oj?.coTechnicianNames ?? [];
              return coNames.length > 0 ? (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-primary">
                  <UserRound className="size-3 shrink-0" />
                  <span>Working with: {coNames.join(", ")}</span>
                </div>
              ) : null;
            })()}
            {job.notes && (
              <div className="mt-2 text-[11px] text-muted-foreground italic bg-muted/40 rounded px-2 py-1">{job.notes}</div>
            )}
          </div>
        </div>
        {status !== "completed" && nextLabel && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Button size="sm" className="flex-1 gap-1.5 h-8" onClick={e => { e.stopPropagation(); advanceStatus(job); }}>
              <Check className="size-3.5" /> {nextLabel}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 px-3" onClick={e => { e.stopPropagation(); navigate("/messages"); }}>
              <MessageSquare className="size-3.5" />
            </Button>
            {!isOpenJob && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 px-3" onClick={e => { e.stopPropagation(); navigate(`/jobs/${job._id}`); }}>
                <ChevronRight className="size-3.5" />
              </Button>
            )}
          </div>
        )}
        {status === "completed" && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="size-3.5" /> Completed
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TechPortalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const employees = (useQuery(api.employees.list)  ?? []) as any[];
  const jobs      = (useQuery(api.jobs.list, {})   ?? []) as any[];
  const openJobs  = (useQuery(api.openJobs.list)   ?? []) as any[];
  const timeoffs  = (useQuery(api.timeoff.list)    ?? []) as any[];
  const today     = new Date().toISOString().slice(0, 10);
  const todayOff  = timeoffs.filter((t: any) => t.status === "approved" && t.startDate <= today && t.endDate >= today);

  // Match by name (user.name entered at login) so the tech portal shows the
  // correct person regardless of how auth IDs are stored.
  const currentTech = useMemo(() => {
    if (!employees.length) return null;
    const byName = user?.name
      ? employees.find((e: any) => e.name.toLowerCase() === user.name!.toLowerCase())
      : null;
    if (byName) return byName;
    // Fallback: first employee whose role is a tech role
    const techRoles = ["suppression_lead", "extinguisher_tech", "sprinkler_tech", "helper"];
    return employees.find((e: any) => techRoles.includes(e.role)) ?? employees[0];
  }, [employees, user?.name]);

  // All regular jobs assigned to this tech — past, present, and future.
  const regularJobs: any[] = useMemo(() => {
    if (!currentTech) return [];
    return jobs.filter((j: any) => String(j.employeeId) === String(currentTech._id));
  }, [jobs, currentTech]);

  // Open jobs assigned to this tech via the AI scheduler.
  const assignedOpenJobs: any[] = useMemo(() => {
    if (!currentTech) return [];
    return openJobs
      .filter((oj: any) => String(oj.assignedEmployeeId) === String(currentTech._id))
      .map((oj: any) => openJobToRecord(oj, String(currentTech._id)));
  }, [openJobs, currentTech]);

  const myJobs: any[] = useMemo(
    () => [...regularJobs, ...assignedOpenJobs],
    [regularJobs, assignedOpenJobs],
  );

  // Split into past / today / upcoming for the timeline view.
  const pastJobs     = useMemo(() => myJobs.filter((j: any) => j.scheduledDate && j.scheduledDate < today), [myJobs, today]);
  const todayJobs    = useMemo(() => myJobs.filter((j: any) => j.scheduledDate === today || (!j.scheduledDate && !j._isOpenJob)), [myJobs, today]);
  const upcomingJobs = useMemo(() => myJobs.filter((j: any) => j.scheduledDate && j.scheduledDate > today), [myJobs, today]);
  const openJobCards = useMemo(() => myJobs.filter((j: any) => j._isOpenJob), [myJobs]);

  // Status state backed by localStorage (keys are job._id strings)
  const [statuses, setStatuses] = useState<Record<string, TechStatus>>(loadStatuses);

  const [clockLocation] = useState("39.2156° N, 76.8585° W — Shop, Columbia MD");
  const [clockedIn, setClockedIn] = useState(() => {
    seedClockHistoryIfNeeded();
    const empId = user?.id ?? "1";
    const last = getLastClockEntry(empId);
    return last?.type === "in";
  });
  const [clockTime, setClockTime] = useState(() => {
    const empId = user?.id ?? "1";
    const last = getLastClockEntry(empId);
    if (last?.type === "in") {
      return new Date(last.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    return "—";
  });
  const [completingJob, setCompletingJob] = useState<any | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);

  // Completion form state
  const [compNotes, setCompNotes] = useState("");
  const [compDeficiencies, setCompDeficiencies] = useState("");

  const completedCount = myJobs.filter(j => (statuses[j._id] ?? jobStatusToTechStatus(j.status)) === "completed").length;

  function updateStatus(jobId: string, next: TechStatus) {
    const updated = { ...statuses, [jobId]: next };
    setStatuses(updated);
    saveStatuses(updated);
  }

  function advanceStatus(job: any) {
    const current = statuses[job._id] ?? jobStatusToTechStatus(job.status);
    const idx = STATUS_ORDER.indexOf(current);
    if (idx >= STATUS_ORDER.length - 1) return;
    const next = STATUS_ORDER[idx + 1];
    if (next === "completed") {
      setCompletingJob(job);
      setCompNotes("");
      setCompDeficiencies("");
      setCompleteOpen(true);
      return;
    }
    updateStatus(job._id, next);
  }

  function confirmComplete() {
    if (!completingJob) return;
    updateStatus(completingJob._id, "completed");
    setCompletingJob(null);
    setCompleteOpen(false);
  }

  const techName     = currentTech?.name ?? user?.name ?? "Technician";
  const techInitials = currentTech ? initials(currentTech.name) : "?";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="size-6 text-primary shrink-0" />
            My Work
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {techName} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button
            variant={clockedIn ? "destructive" : "default"}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const newState = !clockedIn;
              setClockedIn(newState);
              const empId = user?.id ?? String(currentTech?.id ?? "1");
              const entry = addClockEntry({
                empId,
                empName: techName,
                type: newState ? "in" : "out",
                location: clockLocation,
              });
              if (newState) {
                setClockTime(new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
              }
            }}
          >
            {clockedIn ? <LogOut className="size-3.5" /> : <LogIn className="size-3.5" />}
            {clockedIn ? "Clock Out" : "Clock In"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/time-off")}>
            <FileText className="size-3.5" /> Request
          </Button>
        </div>
      </div>

      {/* License expiry alerts */}
      <LicenseAlertBanner />

      {/* Status Bar */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Clock Status</div>
            <div className="flex items-center gap-2">
              <div className={`size-3 rounded-full ${clockedIn ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
              <span className="text-sm font-bold">{clockedIn ? `In since ${clockTime}` : "Clocked Out"}</span>
            </div>
            {clockedIn && (
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="size-2.5" /> {clockLocation}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Job Progress</div>
            <div className="text-lg font-extrabold">{completedCount}/{myJobs.length}</div>
            <Progress value={myJobs.length ? (completedCount / myJobs.length) * 100 : 0} className="h-2 mt-1" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">In Progress</div>
            <div className="text-lg font-extrabold text-blue-600">
              {myJobs.filter(j => {
                const s = statuses[j._id] ?? jobStatusToTechStatus(j.status);
                return s === "in-progress" || s === "en-route" || s === "on-site";
              }).length}
            </div>
            <div className="text-[10px] text-muted-foreground">active right now</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Shop Days</div>
            <div className="text-lg font-extrabold text-amber-600">
              {currentTech ? `${currentTech.shopDaysUsedYtd}/${currentTech.allowedShopDays}` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">used this year</div>
          </CardContent>
        </Card>
      </div>

      {/* Who's Off Today */}
      {todayOff.filter(r => r.employeeName !== (currentTech?.name ?? "")).length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="flex items-center gap-2 shrink-0 text-sm font-medium text-amber-700 dark:text-amber-400">
            <CalendarOff className="size-4 text-amber-600" /> Colleagues Off Today:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {todayOff.filter(r => r.employeeName !== (currentTech?.name ?? "")).map(r => (
              <span key={r._id ?? r.id} className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full px-2.5 py-0.5 font-medium capitalize">
                {r.employeeName} · {r.type.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Job Cards — Past / Today / Upcoming / Open */}
      <div className="space-y-6">
        {myJobs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="size-10 text-muted-foreground mx-auto mb-3" />
              <div className="text-muted-foreground text-sm">
                {employees.length === 0 ? "Loading…" : "No jobs assigned to you yet."}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Today ── */}
        {todayJobs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary inline-block" />
              Today — {todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""}
            </h2>
            {todayJobs.map((job, idx) => <JobCard key={job._id} job={job} idx={idx} statuses={statuses} navigate={navigate} advanceStatus={advanceStatus} openJobs={openJobs} />)}
          </div>
        )}

        {/* ── Upcoming ── */}
        {upcomingJobs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="size-2 rounded-full bg-blue-500 inline-block" />
              Upcoming — {upcomingJobs.length} job{upcomingJobs.length !== 1 ? "s" : ""}
            </h2>
            {upcomingJobs.map((job, idx) => <JobCard key={job._id} job={job} idx={idx} statuses={statuses} navigate={navigate} advanceStatus={advanceStatus} openJobs={openJobs} />)}
          </div>
        )}

        {/* ── Newly Assigned (open jobs) ── */}
        {openJobCards.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500 inline-block" />
              Newly Assigned — {openJobCards.length}
            </h2>
            {openJobCards.map((job, idx) => <JobCard key={job._id} job={job} idx={idx} statuses={statuses} navigate={navigate} advanceStatus={advanceStatus} openJobs={openJobs} />)}
          </div>
        )}

        {/* ── Past ── */}
        {pastJobs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="size-2 rounded-full bg-gray-400 inline-block" />
              Past Jobs — {pastJobs.length}
            </h2>
            {pastJobs.map((job, idx) => <JobCard key={job._id} job={job} idx={idx} statuses={statuses} navigate={navigate} advanceStatus={advanceStatus} openJobs={openJobs} />)}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/clock-history")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="size-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Clock History</div>
              <div className="text-xs text-muted-foreground">View your time records</div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/messages")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="size-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Messages</div>
              <div className="text-xs text-muted-foreground">Contact your supervisor</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Complete Job Dialog */}
      <Dialog open={completeOpen} onOpenChange={o => !o && setCompleteOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Complete Job — {completingJob?.customerName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold">Completion Notes</Label>
              <Textarea
                className="mt-1 text-sm resize-none"
                rows={3}
                placeholder="Describe what was done, any issues encountered…"
                value={compNotes}
                onChange={e => setCompNotes(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Deficiencies Found (optional)</Label>
              <Textarea
                className="mt-1 text-sm resize-none"
                rows={2}
                placeholder="List any code violations or items needing follow-up…"
                value={compDeficiencies}
                onChange={e => setCompDeficiencies(e.target.value)}
              />
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Upload className="size-3.5" /> <span>Photo upload: available in full desktop portal</span>
              </div>
              <div className="flex items-center gap-2">
                <Camera className="size-3.5" /> <span>Certificate will be auto-generated</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCompleteOpen(false)}>Cancel</Button>
              <Button className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={confirmComplete}>
                <CheckCircle2 className="size-4" /> Mark Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
