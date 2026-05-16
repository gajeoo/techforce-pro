import { initials, serviceTypeLabel } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CalendarOff,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Search,
  Shield,
  UserCheck,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ConvexEmployee, ConvexJob, ConvexTimeOff } from "@/lib/convex-types";

import { useAuth } from "@/contexts/AuthContext";
import { LicenseAlertBanner } from "@/components/LicenseAlertBanner";
import { seedClockHistoryIfNeeded, addClockEntry, getLastClockEntry } from "@/lib/clockHistory";

// ─── Helpers ─────────────────────────────────────────────────────────────

type TechStatus = "pending" | "en-route" | "on-site" | "in-progress" | "completed";

function readLiveStatuses(): Record<string, TechStatus> {
  try { return JSON.parse(localStorage.getItem("tfpro_job_statuses") ?? "{}"); } catch { return {}; }
}

// Simulated GPS coordinates per employee index
const GPS_COORDS = [
  "39.2048° N, 76.8611° W",
  "39.1812° N, 76.6685° W",
  "39.2679° N, 76.7984° W",
  "39.1367° N, 76.8234° W",
  "39.2123° N, 76.8456° W",
  "39.2534° N, 76.8123° W",
];

// Operational cert alerts (static)
const operationalAlerts = [
  { tech: "Derek Williams", message: "Sprinkler certification expires in 60 days — schedule renewal training", severity: "medium" as const },
  { tech: "James Rodriguez", message: "Extinguisher cert expires in 10 days — CRITICAL action required", severity: "high" as const },
  { tech: "Kevin Park", message: "3 jobs rescheduled this month — review route planning", severity: "medium" as const },
];

// ─── Component ────────────────────────────────────────────────────────────

export function SupervisorPortalPage() {
  const employees = (useQuery(api.employees.list) ?? []) as ConvexEmployee[];
  const jobs      = (useQuery(api.jobs.list)       ?? []) as ConvexJob[];
  const timeoffs  = (useQuery(api.timeoff.list)    ?? []) as ConvexTimeOff[];
  const today     = new Date().toISOString().slice(0, 10);
  const todayOff  = timeoffs.filter(t => t.status === "approved" && (t.requestedDate ?? "") <= today && (t.endDate ?? today) >= today);

  const navigate = useNavigate();

  const pendingCount: number = timeoffs.filter(t => t.status === "pending").length;


  // Read live data on render
  const liveStatuses = readLiveStatuses();

  // Derive live tech tracker from real employees + jobs + localStorage
  const liveTechData = employees.map((emp, idx) => {
    const myJobs = jobs.filter(j => String(j.employeeId) === String(emp._id ?? emp.id));
    const completedJobs = myJobs.filter(j => (liveStatuses[String(j.id)] ?? j.status) === "completed");

    // Find the most-progressed active job
    const activeJob = myJobs.find(j => {
      const s = liveStatuses[String(j.id)] ?? j.status;
      return s === "in-progress" || s === "on-site" || s === "en-route";
    });

    const allDone = myJobs.length > 0 && completedJobs.length === myJobs.length;
    const techStatus = activeJob
      ? ((liveStatuses[String(activeJob.id)] === "en-route") ? "en-route" : "on-job")
      : allDone
        ? "done"
        : myJobs.length > 0 ? "standby" : "shop";

    const activeStatus = activeJob ? (liveStatuses[String(activeJob.id)] ?? activeJob.status) as TechStatus : null;
    const location = activeJob
      ? (activeStatus === "en-route" ? `→ ${activeJob.customerName}` : activeJob.customerName)
      : allDone ? "All jobs complete" : "Shop / Standby";

    const progress = myJobs.length > 0
      ? Math.round((completedJobs.length / myJobs.length) * 100)
      : 0;

    const eta = activeJob
      ? (activeStatus === "en-route" ? "En route" : activeStatus === "on-site" ? "On site" : "Active")
      : allDone ? "Done for day" : "Standby";

    return {
      id: String(emp._id ?? emp.id),
      name: emp.name.split(" ").map((n: string, i: number) => i === 0 ? n : n[0] + ".").join(" "),
      fullName: emp.name,
      avatar: initials(emp.name),
      status: techStatus,
      location,
      address: activeJob?.customerAddress ?? "9693 Gerwig Lane, Columbia MD 21046",
      progress,
      eta,
      gps: GPS_COORDS[idx] ?? "39.2156° N, 76.8585° W",
      vehicle: `Truck #${101 + idx}`,
      speed: techStatus === "en-route" ? `${32 + idx * 3} mph` : "0 mph (parked)",
      jobsDone: completedJobs.length,
      totalJobs: myJobs.length,
    };
  });

  const onJobCount = liveTechData.filter(t => t.status === "on-job").length;
  const enRouteCount = liveTechData.filter(t => t.status === "en-route").length;
  const shopCount = liveTechData.filter(t => t.status === "shop").length;
  const doneCount = liveTechData.filter(t => t.status === "done").length;

  const completedJobsCount = Object.values(liveStatuses).filter(s => s === "completed").length;
  const totalTodayJobs = jobs.length;

  const [reassignOpen, setReassignOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");

  // Supervisor's own appointments
  interface SupApt { id: number; title: string; date: string; startTime: string; endTime: string | null; type: string; location: string | null; }
  const [supApts, setSupApts] = useState<SupApt[]>([]);

  const todayApts = supApts.filter(a => a.date === new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcomingApts = supApts
    .filter(a => a.date > new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 5);

  function fmt12Sup(t: string) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }

  // Supervisor's own clock in/out
  const { user } = useAuth();
  const supervisorEmpId = user?.id ?? "2";
  const supervisorEmpName = user?.name ?? "Supervisor";
  const [supClockedIn, setSupClockedIn] = useState(() => {
    seedClockHistoryIfNeeded();
    const last = getLastClockEntry(supervisorEmpId);
    return last?.type === "in";
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="size-6 text-primary shrink-0" />
            Supervisor Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Real-time team operations — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <Button
            variant={supClockedIn ? "destructive" : "default"}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const newState = !supClockedIn;
              setSupClockedIn(newState);
              addClockEntry({
                empId: supervisorEmpId,
                empName: supervisorEmpName,
                type: newState ? "in" : "out",
                location: "39.2156° N, 76.8585° W — Shop, Columbia MD",
              });
            }}
          >
            {supClockedIn ? <LogOut className="size-3.5" /> : <LogIn className="size-3.5" />}
            {supClockedIn ? "Clock Out" : "Clock In"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/gps-tracking")}>
            <Navigation className="size-3.5" /> Live Map
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReassignOpen(true)}>
            <ArrowUpDown className="size-3.5" /> Reassign Job
          </Button>
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setEmergencyOpen(true)}>
            <Zap className="size-3.5" /> Emergency Dispatch
          </Button>
        </div>
      </div>

      {/* License expiry alerts */}
      <LicenseAlertBanner />

      {/* KPI Strip */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card className="cursor-pointer hover:shadow-sm" onClick={() => navigate("/jobs")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Jobs Today</span>
              <Wrench className="size-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold">{totalTodayJobs}</div>
            <Progress value={totalTodayJobs > 0 ? (completedJobsCount / totalTodayJobs) * 100 : 0} className="h-1 mt-2" />
            <div className="text-[10px] text-muted-foreground mt-1">{completedJobsCount} completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">On Job</span>
              <UserCheck className="size-3.5 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-600">{onJobCount}</div>
            <div className="text-[10px] text-muted-foreground">{doneCount} wrapped up</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">En Route</span>
              <Navigation className="size-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold text-blue-600">{enRouteCount}</div>
            <div className="text-[10px] text-muted-foreground">in transit now</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">In Shop</span>
              <Wrench className="size-3.5 text-red-600" />
            </div>
            <div className="text-xl font-extrabold text-red-600">{shopCount}</div>
            <div className="text-[10px] text-muted-foreground">standby</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-sm" onClick={() => navigate("/time-off")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Off Today</span>
              <CalendarOff className="size-3.5 text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-amber-600">{todayOff.length}</div>
            <div className="text-[10px] text-muted-foreground">{pendingCount > 0 ? `${pendingCount} pending approval` : "all requests resolved"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Live Team Tracker */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  Live Team Tracker
                </CardTitle>
                <CardDescription>Real-time technician status based on job updates</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => navigate("/gps-tracking")}>
                <Navigation className="size-3" /> Full Map
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {liveTechData.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Loading team data…</p>
              )}
              {liveTechData.map(tech => {
                const statusColor =
                  tech.status === "on-job"   ? "text-emerald-600" :
                  tech.status === "en-route" ? "text-blue-600"    :
                  tech.status === "done"     ? "text-emerald-400" :
                  tech.status === "shop"     ? "text-red-600"     : "text-gray-500";
                const statusDot =
                  tech.status === "on-job"   ? "bg-emerald-600"   :
                  tech.status === "en-route" ? "bg-blue-500"      :
                  tech.status === "done"     ? "bg-emerald-300"   :
                  tech.status === "shop"     ? "bg-red-500"       : "bg-gray-300";
                const statusLabel =
                  tech.status === "on-job"   ? "On Job"   :
                  tech.status === "en-route" ? "En Route" :
                  tech.status === "done"     ? "Done"     :
                  tech.status === "shop"     ? "Shop"     : "Standby";

                return (
                  <div
                    key={tech.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => navigate("/gps-tracking")}
                  >
                    <div className="relative shrink-0">
                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {tech.avatar}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background ${statusDot}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{tech.fullName}</span>
                        <Badge variant="secondary" className={`text-[9px] ${statusColor}`}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{tech.location}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Progress value={tech.progress} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {tech.jobsDone}/{tech.totalJobs} jobs
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Navigation className="size-2.5" /> {tech.vehicle}</span>
                        <span>{tech.eta}</span>
                        <span>{tech.gps}</span>
                      </div>
                    </div>
                    <Phone className="size-4 text-muted-foreground hover:text-primary shrink-0" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Who's Off Today */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarOff className="size-4 text-amber-600" />
                  Who's Off Today
                </CardTitle>
                <CardDescription>
                  {todayOff.length > 0
                    ? `${todayOff.length} employee${todayOff.length !== 1 ? "s" : ""} on approved leave`
                    : "Full team available today"}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => navigate("/time-off")}>
                {pendingCount > 0 && (
                  <span className="size-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {pendingCount}
                  </span>
                )}
                All Requests
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {todayOff.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Full team available</p>
                {pendingCount > 0 && (
                  <Button variant="link" size="sm" className="text-xs mt-1 text-amber-600" onClick={() => navigate("/time-off")}>
                    {pendingCount} request{pendingCount !== 1 ? "s" : ""} awaiting manager approval →
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {todayOff.map(req => (
                  <div key={req.id} className="flex items-center gap-3 rounded-lg border border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/10 px-3 py-2.5">
                    <div className="size-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <CalendarOff className="size-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{req.employeeName}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {req.type.replace(/-/g, " ")}
                        {req.startDate !== req.endDate ? ` · ${req.startDate} – ${req.endDate}` : ` · ${req.startDate}`}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">
                      Approved
                    </Badge>
                  </div>
                ))}
                {pendingCount > 0 && (
                  <Button variant="link" size="sm" className="text-xs w-full text-amber-600 mt-1" onClick={() => navigate("/time-off")}>
                    {pendingCount} pending request{pendingCount !== 1 ? "s" : ""} awaiting approval →
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Team Activity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                Today's Team Activity
              </CardTitle>
              <CardDescription>Live job completion status per technician</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => navigate("/employees")}>
              All Techs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-xs text-muted-foreground">Technician</th>
                  <th className="text-center py-2 px-2 font-medium text-xs text-muted-foreground">Jobs Done</th>
                  <th className="text-center py-2 px-2 font-medium text-xs text-muted-foreground">Total Jobs</th>
                  <th className="text-center py-2 px-2 font-medium text-xs text-muted-foreground">Progress</th>
                  <th className="text-center py-2 px-2 font-medium text-xs text-muted-foreground">Current Activity</th>
                  <th className="text-center py-2 px-2 font-medium text-xs text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {liveTechData.map(tech => {
                  const statusColor =
                    tech.status === "on-job"   ? "text-emerald-600" :
                    tech.status === "en-route" ? "text-blue-600"    :
                    tech.status === "done"     ? "text-emerald-400" :
                    tech.status === "shop"     ? "text-red-600"     : "text-gray-500";
                  const statusLabel =
                    tech.status === "on-job"   ? "On Job"   :
                    tech.status === "en-route" ? "En Route" :
                    tech.status === "done"     ? "Done"     :
                    tech.status === "shop"     ? "Shop"     : "Standby";

                  return (
                    <tr
                      key={tech.id}
                      className="border-b border-muted/50 hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => navigate("/employees")}
                    >
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {tech.avatar}
                          </div>
                          <div>
                            <span className="font-semibold text-xs">{tech.fullName}</span>
                            <div className="text-[10px] text-muted-foreground">{tech.vehicle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-xs font-bold text-emerald-600">{tech.jobsDone}</td>
                      <td className="py-2.5 px-2 text-center text-xs text-muted-foreground">{tech.totalJobs}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <Progress value={tech.progress} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground shrink-0">{tech.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-xs text-muted-foreground max-w-[150px]">
                        <span className="truncate block">{tech.location}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Badge variant="secondary" className={`text-[9px] ${statusColor}`}>
                          {statusLabel}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Supervisor Appointments */}
      {(todayApts.length > 0 || upcomingApts.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  My Appointments
                </CardTitle>
                <CardDescription>Sent to your calendar by the manager</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {todayApts.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today</p>
                <div className="space-y-2">
                  {todayApts.map(apt => (
                    <div key={apt.id} className="flex items-start gap-3 rounded-lg border bg-primary/5 border-primary/20 p-3">
                      <Calendar className="size-4 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{apt.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="size-3" /> {fmt12Sup(apt.startTime)}{apt.endTime ? ` – ${fmt12Sup(apt.endTime)}` : ""}
                          </span>
                          {apt.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="size-3" /> {apt.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {upcomingApts.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming</p>
                <div className="space-y-2">
                  {upcomingApts.map(apt => (
                    <div key={apt.id} className="flex items-start gap-3 rounded-lg border p-2.5 hover:bg-muted/20">
                      <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Calendar className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{apt.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(apt.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          {" · "}{fmt12Sup(apt.startTime)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Operational Alerts */}
      {operationalAlerts.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-amber-600" />
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Operational Alerts</span>
            </div>
            <div className="space-y-2">
              {operationalAlerts.map((alert, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-amber-200/50 last:border-0 cursor-pointer hover:bg-amber-100/30 rounded px-2 -mx-2 transition-colors"
                  onClick={() => navigate("/employees")}
                >
                  <span className="text-sm">
                    <strong className="text-amber-700 dark:text-amber-400">{alert.tech}:</strong>{" "}
                    <span className="text-muted-foreground">{alert.message}</span>
                  </span>
                  <Badge
                    variant={alert.severity === "high" ? "destructive" : "secondary"}
                    className="text-[10px] shrink-0 ml-2"
                  >
                    {alert.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reassign Job Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="size-5 text-primary" />
              Reassign Job
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Select Job</Label>
              <div className="relative mt-1 mb-1.5">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Search by customer or service type…"
                  value={jobSearch}
                  onChange={e => setJobSearch(e.target.value)}
                />
              </div>
              <Select>
                <SelectTrigger><SelectValue placeholder="Choose a job..." /></SelectTrigger>
                <SelectContent>
                  {jobs
                    .filter(j =>
                      jobSearch === "" ||
                      (j.customerName ?? "").toLowerCase().includes(jobSearch.toLowerCase()) ||
                      serviceTypeLabel(j.serviceType).toLowerCase().includes(jobSearch.toLowerCase())
                    )
                    .map(j => (
                      <SelectItem key={String(j.id)} value={String(j.id)}>
                        {j.customerName} — {serviceTypeLabel(j.serviceType)}
                      </SelectItem>
                    ))}
                  {jobs.filter(j =>
                    jobSearch === "" ||
                    (j.customerName ?? "").toLowerCase().includes(jobSearch.toLowerCase()) ||
                    serviceTypeLabel(j.serviceType).toLowerCase().includes(jobSearch.toLowerCase())
                  ).length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">No jobs match "{jobSearch}"</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From Tech</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Current tech" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={String(e._id ?? e.id)} value={String(e._id ?? e.id)}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">To Tech</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={String(e._id ?? e.id)} value={String(e._id ?? e.id)}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Reason</Label>
              <Textarea placeholder="Why is this being reassigned?" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
              <Button onClick={() => setReassignOpen(false)}>Reassign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Emergency Dispatch Dialog */}
      <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Zap className="size-5" />
              Emergency Dispatch
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
              This will immediately reassign the nearest available technician. Existing jobs may be delayed.
            </div>
            <div>
              <Label className="text-xs">Customer / Location</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={String(e._id ?? e.id)} value={String(e._id ?? e.id)}>
                      {e.name} — {e.certifications.join(", ") || "General"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Service Type</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="suppression">Suppression</SelectItem>
                    <SelectItem value="extinguisher">Extinguisher</SelectItem>
                    <SelectItem value="sprinkler">Sprinkler</SelectItem>
                    <SelectItem value="exit-light">Exit Lights</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Override Tech (optional)</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Auto-assign" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto — Nearest Available</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={String(e._id ?? e.id)} value={String(e._id ?? e.id)}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea placeholder="Describe the emergency..." rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEmergencyOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="gap-1.5" onClick={() => setEmergencyOpen(false)}>
                <Zap className="size-3.5" /> Dispatch Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
