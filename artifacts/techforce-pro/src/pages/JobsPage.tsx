import { useNavigate } from "react-router-dom";
import {
  ArrowUpDown, Briefcase, Plus, Search, RefreshCw, Calendar, Users, Filter, Clock,
  ShieldX, Send, MapPin, Building2, ChevronDown, ChevronRight, SortAsc, X,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getJobs, getReturnJobs, getRescheduleJobs, getCustomers, getEmployees,
  getCustomerLocations, createJob, createOpenJob, updateJob,
  serviceTypeLabel, jobStatusIcon, roleLabel, initials,
  type ApiJob, type ApiCustomer, type ApiEmployee, type ApiCustomerLocation,
} from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { saveNCNotice } from "@/lib/nonCompliance";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  if (status === "completed")   return <Badge variant="default" className="bg-emerald-600 text-[10px]">✅ Done</Badge>;
  if (status === "in-progress" || status === "in_progress") return <Badge variant="default" className="bg-blue-600 text-[10px]">🔧 Active</Badge>;
  if (status === "return" || status === "will_return") return <Badge variant="default" className="bg-amber-600 text-[10px]">🔄 Return</Badge>;
  if (status === "reschedule")  return <Badge variant="default" className="bg-primary text-[10px]">📅 Reschd</Badge>;
  if (status === "emergency")   return <Badge variant="destructive" className="text-[10px]">🚨 Emergency</Badge>;
  if (status === "non_compliant") return <Badge variant="destructive" className="text-[10px]">🚫 Non-Compliant</Badge>;
  if (status === "cancelled")   return <Badge variant="secondary" className="text-[10px]">❌ Cancelled</Badge>;
  return <Badge variant="secondary" className="text-[10px]">⏳ Pending</Badge>;
}

function getPriorityBadge(priority: string) {
  if (priority === "high") return <Badge variant="destructive" className="text-[10px]">HIGH</Badge>;
  if (priority === "medium") return <Badge variant="default" className="bg-amber-600 text-[10px]">MED</Badge>;
  return <Badge variant="secondary" className="text-[10px]">LOW</Badge>;
}

// ─── Dispatch Board ───────────────────────────────────────────────────────────

const TIME_SLOTS = ["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM"];

const SLOT_COLORS = [
  "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200",
  "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200",
  "bg-violet-100 dark:bg-violet-900/40 border-violet-200 dark:border-violet-700 text-violet-800 dark:text-violet-200",
  "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200",
  "bg-rose-100 dark:bg-rose-900/40 border-rose-200 dark:border-rose-700 text-rose-800 dark:text-rose-200",
];

function parseHour(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const t = timeStr.trim().toUpperCase();
  const match = t.match(/^(\d+)(?::(\d+))?\s*(AM|PM)?$/);
  if (!match) return null;
  let h = Number(match[1]);
  const ampm = match[3];
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h;
}

function hourToSlot(hour: number): string {
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function DispatchBoard({ jobs }: { jobs: ApiJob[] }) {
  const navigate = useNavigate();
  const byEmp: Record<string, { jobs: ApiJob[]; color: string }> = {};
  let colorIdx = 0;
  for (const job of jobs) {
    const name = job.employeeName ?? "Unassigned";
    if (!byEmp[name]) {
      byEmp[name] = { jobs: [], color: SLOT_COLORS[colorIdx++ % SLOT_COLORS.length] };
    }
    byEmp[name].jobs.push(job);
  }
  const techNames = Object.keys(byEmp);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs" style={{ minWidth: 900 }}>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="sticky left-0 z-10 bg-muted/80 backdrop-blur text-left px-4 py-3 font-semibold text-muted-foreground w-36 min-w-[144px]">Technician</th>
                {TIME_SLOTS.map(slot => (
                  <th key={slot} className="px-2 py-3 text-center font-medium text-muted-foreground w-24 min-w-[96px]">{slot}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {techNames.map(tech => {
                const { jobs: techJobs, color } = byEmp[tech];
                const jobsBySlot: Record<string, ApiJob> = {};
                for (const job of techJobs) {
                  const hour = parseHour(job.scheduledTime);
                  if (hour !== null) {
                    const slot = hourToSlot(hour);
                    if (!jobsBySlot[slot]) jobsBySlot[slot] = job;
                  }
                }
                return (
                  <tr key={tech} className="hover:bg-muted/10 transition-colors">
                    <td className="sticky left-0 z-10 bg-card px-4 py-3 font-semibold text-sm border-r border-border">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">{initials(tech)}</div>
                        <span className="truncate">{tech.split(" ")[0]}</span>
                      </div>
                    </td>
                    {TIME_SLOTS.map(slot => {
                      const job = jobsBySlot[slot];
                      return (
                        <td key={slot} className="px-1.5 py-2 align-top">
                          {job ? (
                            <div
                              className={`rounded-lg border px-2 py-1.5 cursor-pointer hover:opacity-80 transition-opacity ${color}`}
                              onClick={() => navigate(`/jobs/${job.id}`)}
                            >
                              <div className="font-semibold truncate text-[11px]">{job.customerName.replace(/\s*-.*/, "")}</div>
                              <div className="text-[10px] opacity-75 truncate">{serviceTypeLabel(job.serviceType)}</div>
                              {job.locationName && <div className="text-[9px] opacity-60 truncate">📍 {job.locationName}</div>}
                            </div>
                          ) : (
                            <div className="h-14 rounded-lg border border-dashed border-border/40 bg-muted/10 flex items-center justify-center opacity-30 hover:opacity-60 cursor-pointer transition-opacity">
                              <Plus className="size-3 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {techNames.length === 0 && (
                <tr><td colSpan={TIME_SLOTS.length + 1} className="py-10 text-center text-sm text-muted-foreground">No jobs with scheduled times to display.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {techNames.slice(0, 5).map(tech => {
          const techJobs = byEmp[tech].jobs;
          const done = techJobs.filter(j => j.status === "completed").length;
          const active = techJobs.filter(j => j.status === "in-progress" || j.status === "in_progress").length;
          const pending = techJobs.filter(j => j.status === "pending").length;
          return (
            <Card key={tech} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate("/employees")}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">{initials(tech)}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs truncate">{tech.split(" ")[0]}</div>
                    <div className="text-[10px] text-muted-foreground">{techJobs.length} jobs</div>
                  </div>
                </div>
                <div className="flex gap-2 text-[10px]">
                  <span className="text-emerald-600 font-medium">{done} done</span>
                  {active > 0 && <span className="text-blue-600 font-medium">{active} active</span>}
                  <span className="text-muted-foreground">{pending} pending</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Job Queue ────────────────────────────────────────────────────────────────

function JobQueue({ jobs, emptyMsg }: { jobs: ApiJob[]; emptyMsg: string }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-2">
      {jobs.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">{emptyMsg}</p>}
      {jobs.map(job => (
        <div key={job.id} className="flex items-center gap-3 py-3 px-4 rounded-lg border bg-card hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/jobs/${job.id}`)}>
          <div className="text-base shrink-0">{jobStatusIcon(job.status)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-primary truncate">{job.customerName}</span>
              <span className="text-xs font-bold text-emerald-600 shrink-0">${job.revenue.toLocaleString()}</span>
            </div>
            {job.locationName && <div className="text-[11px] text-primary/70 flex items-center gap-1"><MapPin className="size-2.5" />{job.locationName}</div>}
            <div className="text-[11px] text-muted-foreground truncate">{serviceTypeLabel(job.serviceType)}</div>
            <div className="text-[10px] text-muted-foreground">{job.employeeName ?? "Unassigned"} · {job.scheduledDate ?? "No date"} · {job.priority} priority</div>
          </div>
          <div className="shrink-0">{getStatusBadge(job.status)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── By-Customer Grouped View ─────────────────────────────────────────────────

interface CustomerGroup {
  customerId: number;
  customerName: string;
  jobs: ApiJob[];
  totalRevenue: number;
  completedCount: number;
}

function ByCustomerView({ jobs, onNavigate, onNC }: {
  jobs: ApiJob[];
  onNavigate: (id: number) => void;
  onNC: (job: ApiJob) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const groups = useMemo<CustomerGroup[]>(() => {
    const map: Record<number, CustomerGroup> = {};
    for (const job of jobs) {
      if (!map[job.customerId]) {
        map[job.customerId] = { customerId: job.customerId, customerName: job.customerName, jobs: [], totalRevenue: 0, completedCount: 0 };
      }
      map[job.customerId].jobs.push(job);
      map[job.customerId].totalRevenue += job.revenue;
      if (job.status === "completed") map[job.customerId].completedCount++;
    }
    return Object.values(map).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [jobs]);

  function toggle(customerId: number) {
    setCollapsed(prev => ({ ...prev, [customerId]: !prev[customerId] }));
  }

  // Group a customer's jobs by location
  function byLocation(jobs: ApiJob[]) {
    const locs: Record<string, { name: string; jobs: ApiJob[] }> = {};
    for (const job of jobs) {
      const key = job.locationName ?? "Main Location";
      if (!locs[key]) locs[key] = { name: key, jobs: [] };
      locs[key].jobs.push(job);
    }
    return Object.values(locs);
  }

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No jobs match your filters.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const isOpen = !collapsed[group.customerId];
        const locations = byLocation(group.jobs);
        return (
          <div key={group.customerId} className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Customer header */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              onClick={() => toggle(group.customerId)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="size-4 text-primary" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-bold text-sm text-foreground truncate">{group.customerName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {group.jobs.length} job{group.jobs.length !== 1 ? "s" : ""} across {locations.length} location{locations.length !== 1 ? "s" : ""}
                    {" · "}<span className="text-emerald-600 font-medium">${group.totalRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-[10px]">{group.completedCount}/{group.jobs.length} done</Badge>
                {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Jobs by location */}
            {isOpen && (
              <div className="border-t border-border/50">
                {locations.map((loc, li) => (
                  <div key={loc.name} className={li > 0 ? "border-t border-border/30" : ""}>
                    {/* Location sub-header */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/20">
                      <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-semibold text-muted-foreground">{loc.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{loc.jobs.length} job{loc.jobs.length !== 1 ? "s" : ""}</span>
                    </div>
                    {/* Job rows */}
                    {loc.jobs.map(job => (
                      <div
                        key={job.id}
                        className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer border-t border-border/20 group
                          ${job.status === "non_compliant" ? "bg-destructive/5" : ""}`}
                        onClick={() => onNavigate(job.id)}
                      >
                        <span className="text-sm shrink-0">{jobStatusIcon(job.status)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {getPriorityBadge(job.priority)}
                            <span className="text-xs font-medium truncate">{serviceTypeLabel(job.serviceType)}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {job.employeeName ?? "Unassigned"}
                            {job.scheduledDate && ` · Sched: ${job.scheduledDate}`}
                            {job.dueDate && ` · Due: ${job.dueDate}`}
                          </div>
                          {job.status === "non_compliant" && job.nonComplianceReason && (
                            <div className="text-[10px] text-destructive italic truncate">⚠ {job.nonComplianceReason}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-emerald-600">${job.revenue.toLocaleString()}</span>
                          {getStatusBadge(job.status)}
                          {job.status !== "non_compliant" && job.status !== "completed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                              title="Mark non-compliant"
                              onClick={e => { e.stopPropagation(); onNC(job); }}
                            >
                              <ShieldX className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Service Types ─────────────────────────────────────────────────────────────

const SERVICE_TYPE_OPTIONS = [
  { value: "hood_suppression", label: "Hood Suppression" },
  { value: "extinguisher_inspection", label: "Extinguisher Inspection" },
  { value: "sprinkler_test", label: "Sprinkler Test" },
  { value: "exit_light_check", label: "Exit Light Check" },
  { value: "full_inspection", label: "Full Fire Safety Inspection" },
  { value: "standpipe_test", label: "Standpipe Test" },
  { value: "fire_alarm", label: "Fire Alarm Inspection" },
  { value: "emergency", label: "Emergency Service" },
  { value: "mixed", label: "Mixed Services" },
];

type SortKey = "date_asc" | "date_desc" | "customer_az" | "revenue_desc" | "priority" | "status";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date_asc",     label: "Sched Date ↑" },
  { value: "date_desc",    label: "Sched Date ↓" },
  { value: "customer_az",  label: "Customer A–Z" },
  { value: "revenue_desc", label: "Revenue (High–Low)" },
  { value: "priority",     label: "Priority (High first)" },
  { value: "status",       label: "Status" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export function JobsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [allJobs, setAllJobs]           = useState<ApiJob[]>([]);
  const [returnJobs, setReturnJobs]     = useState<ApiJob[]>([]);
  const [rescheduleJobs, setRescheduleJobs] = useState<ApiJob[]>([]);
  const [customers, setCustomers]       = useState<ApiCustomer[]>([]);
  const [employees, setEmployees]       = useState<ApiEmployee[]>([]);
  const [loading, setLoading]           = useState(true);

  // Filters
  const [search, setSearch]             = useState("");
  const [techFilter, setTechFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [sortBy, setSortBy]             = useState<SortKey>("date_asc");

  // Dialogs
  const [createOpen, setCreateOpen]     = useState(false);
  const [ncDialog, setNcDialog]         = useState<{ open: boolean; job: ApiJob | null }>({ open: false, job: null });
  const [ncReason, setNcReason]         = useState("");
  const [ncSendNotice, setNcSendNotice] = useState(true);
  const [ncSaving, setNcSaving]         = useState(false);

  // Create Job form
  const emptyForm = {
    customerId: "", locationId: "", locationName: "",
    employeeId: "", serviceType: "extinguisher_inspection",
    scheduledDate: "", dueDate: "", scheduledTime: "",
    revenue: "", priority: "medium", notes: "",
  };
  const [form, setForm]                 = useState(emptyForm);
  const [formSaving, setFormSaving]     = useState(false);
  const [isOpenJob, setIsOpenJob]       = useState(false);
  const [locations, setLocations]       = useState<ApiCustomerLocation[]>([]);
  const [locsLoading, setLocsLoading]   = useState(false);

  useEffect(() => {
    Promise.all([
      getJobs().then(setAllJobs),
      getReturnJobs().then(setReturnJobs),
      getRescheduleJobs().then(setRescheduleJobs),
      getCustomers().then(setCustomers),
      getEmployees().then(setEmployees),
    ]).finally(() => setLoading(false));
  }, []);

  // Load locations when customer selected
  useEffect(() => {
    if (!form.customerId) {
      setLocations([]);
      setForm(prev => ({ ...prev, locationId: "", locationName: "" }));
      return;
    }
    setLocsLoading(true);
    getCustomerLocations(Number(form.customerId))
      .then(locs => {
        setLocations(locs);
        const primary = locs.find(l => l.isPrimary) ?? locs[0];
        if (primary) {
          setForm(prev => ({ ...prev, locationId: String(primary.id), locationName: primary.name }));
        }
      })
      .catch(() => {})
      .finally(() => setLocsLoading(false));
  }, [form.customerId]);

  function setField(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function handleLocationChange(locId: string) {
    const loc = locations.find(l => String(l.id) === locId);
    setForm(prev => ({ ...prev, locationId: locId, locationName: loc?.name ?? "" }));
  }

  // ─── Mark Non-Compliant ─────────────────────────────────────────────────────

  async function handleMarkNonCompliant() {
    if (!ncDialog.job || !ncReason.trim()) return;
    setNcSaving(true);
    try {
      const updated = await updateJob(ncDialog.job.id, { status: "non_compliant", nonComplianceReason: ncReason.trim() });
      setAllJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
      if (ncSendNotice) {
        const customer = customers.find(c => c.id === ncDialog.job!.customerId);
        saveNCNotice({
          jobId: ncDialog.job.id,
          customerId: ncDialog.job.customerId,
          location: customer?.name ?? ncDialog.job.customerName,
          address: customer?.address ?? ncDialog.job.customerAddress,
          serviceType: ncDialog.job.serviceType,
          reason: ncReason.trim(),
          sentBy: user?.name ?? "Staff",
          sentByRole: user?.role === "manager" ? "Manager" : "Supervisor",
          scheduledDate: ncDialog.job.scheduledDate,
        });
        toast.success("Job marked non-compliant and notice sent to customer");
      } else {
        toast.success("Job marked as non-compliant");
      }
      setNcDialog({ open: false, job: null });
      setNcReason("");
      setNcSendNotice(true);
    } catch {
      toast.error("Failed to update job");
    } finally {
      setNcSaving(false);
    }
  }

  // ─── Create Job ─────────────────────────────────────────────────────────────

  async function handleCreateJob() {
    if (!form.customerId || !form.serviceType) {
      toast.error("Customer and service type are required");
      return;
    }
    setFormSaving(true);
    try {
      if (isOpenJob) {
        const customer = customers.find(c => String(c.id) === form.customerId);
        const location = locations.find(l => String(l.id) === form.locationId);
        await createOpenJob({
          title: serviceTypeLabel(form.serviceType),
          clientName: customer?.name ?? "Unknown",
          clientAddress: location?.address ?? customer?.address ?? null,
          zipCode: null,
          certRequired: "any",
          priority: form.priority,
          notes: form.notes || null,
        });
        toast.success("Posted to Open Jobs queue");
      } else {
        const newJob = await createJob({
          customerId: Number(form.customerId),
          locationId: form.locationId ? Number(form.locationId) : null,
          locationName: form.locationName || null,
          employeeId: form.employeeId ? Number(form.employeeId) : null,
          serviceType: form.serviceType,
          priority: form.priority,
          scheduledDate: form.scheduledDate || null,
          dueDate: form.dueDate || null,
          scheduledTime: form.scheduledTime || null,
          revenue: Number(form.revenue) || 0,
          status: "pending",
          notes: form.notes || null,
        });
        setAllJobs(prev => [newJob, ...prev]);
        toast.success("Job created");
      }
      setCreateOpen(false);
      setForm(emptyForm);
      setIsOpenJob(false);
      setLocations([]);
    } catch {
      toast.error(isOpenJob ? "Failed to post open job" : "Failed to create job");
    } finally {
      setFormSaving(false);
    }
  }

  // ─── Filtering & Sorting ────────────────────────────────────────────────────

  const filteredJobs = useMemo(() => allJobs.filter(j => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      j.customerName.toLowerCase().includes(q) ||
      (j.employeeName ?? "").toLowerCase().includes(q) ||
      j.serviceType.toLowerCase().includes(q) ||
      (j.locationName ?? "").toLowerCase().includes(q);
    const matchTech     = techFilter === "all" || j.employeeName === techFilter;
    const matchStatus   = statusFilter === "all" || j.status === statusFilter;
    const matchCustomer = customerFilter === "all" || String(j.customerId) === customerFilter;
    return matchSearch && matchTech && matchStatus && matchCustomer;
  }), [allJobs, search, techFilter, statusFilter, customerFilter]);

  const sortedJobs = useMemo(() => [...filteredJobs].sort((a, b) => {
    switch (sortBy) {
      case "customer_az":  return a.customerName.localeCompare(b.customerName);
      case "revenue_desc": return b.revenue - a.revenue;
      case "priority": {
        const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
      }
      case "status": return a.status.localeCompare(b.status);
      case "date_desc": return (b.scheduledDate ?? "").localeCompare(a.scheduledDate ?? "");
      default: return (a.scheduledDate ?? "9999").localeCompare(b.scheduledDate ?? "9999");
    }
  }), [filteredJobs, sortBy]);

  const uniqueTechs     = [...new Set(allJobs.map(j => j.employeeName).filter(Boolean))] as string[];
  const uniqueCustomers = [...new Set(allJobs.map(j => ({ id: j.customerId, name: j.customerName }))
    .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)
    .sort((a, b) => a.name.localeCompare(b.name)))];
  const totalRevenue    = allJobs.reduce((s, j) => s + j.revenue, 0);
  const completedCount  = allJobs.filter(j => j.status === "completed").length;
  const hasFilters      = search || techFilter !== "all" || statusFilter !== "all" || customerFilter !== "all";

  function openNC(job: ApiJob) {
    setNcDialog({ open: true, job });
    setNcReason("");
    setNcSendNotice(true);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="size-6 text-primary shrink-0" /> Job Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {allJobs.length} jobs · ${totalRevenue.toLocaleString()} revenue · {completedCount} completed
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) { setForm(emptyForm); setIsOpenJob(false); setLocations([]); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 self-start sm:self-auto">
              <Plus className="size-3.5" /> Create Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Job</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

              {/* Step 1 — Customer */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="size-3.5" /> Step 1 — Select Customer
                </p>
                <div>
                  <Label className="text-xs">Customer *</Label>
                  <Select value={form.customerId} onValueChange={v => setField("customerId", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a customer…" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2 — Location (shown after customer selected) */}
                {form.customerId && (
                  <div>
                    <Label className="text-xs flex items-center gap-1"><MapPin className="size-3" /> Service Location</Label>
                    {locsLoading ? (
                      <div className="mt-1 h-9 rounded-md border bg-muted/30 flex items-center px-3 text-xs text-muted-foreground animate-pulse">Loading locations…</div>
                    ) : (
                      <Select value={form.locationId} onValueChange={handleLocationChange}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={locations.length ? "Choose location…" : "No locations on file"} />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map(loc => (
                            <SelectItem key={loc.id} value={String(loc.id)}>
                              <div className="flex items-center gap-1.5">
                                {loc.isPrimary && <span className="text-[9px] bg-primary/10 text-primary rounded px-1 font-semibold">PRIMARY</span>}
                                <span>{loc.name}</span>
                                <span className="text-muted-foreground text-[10px] truncate max-w-[160px]">· {loc.address}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {locations.length === 0 && !locsLoading && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        No locations set up for this customer yet. The job will use the customer's primary address.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Job details */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Briefcase className="size-3.5" /> Step 2 — Job Details
                </p>
                <div>
                  <Label className="text-xs">Service Type *</Label>
                  <Select value={form.serviceType} onValueChange={v => setField("serviceType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPE_OPTIONS.map(st => (
                        <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Assigned Tech</Label>
                  <Select value={form.employeeId || "__none__"} onValueChange={v => setField("employeeId", v === "__none__" ? "" : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {employees.filter(e => e.isActive).map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name} — {roleLabel(e.role)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select value={form.priority} onValueChange={v => setField("priority", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Revenue ($)</Label>
                    <Input type="number" placeholder="0" className="mt-1" value={form.revenue} onChange={e => setField("revenue", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Scheduling */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> Step 3 — Schedule & Due Date
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Scheduled Date</Label>
                    <Input type="date" className="mt-1" value={form.scheduledDate} onChange={e => setField("scheduledDate", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Scheduled Time</Label>
                    <Input type="time" className="mt-1" value={form.scheduledTime} onChange={e => setField("scheduledTime", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Due Date (deadline)</Label>
                  <Input type="date" className="mt-1" value={form.dueDate} onChange={e => setField("dueDate", e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea placeholder="Job notes…" rows={2} className="mt-1" value={form.notes} onChange={e => setField("notes", e.target.value)} />
              </div>

              {/* Post as Open Job toggle */}
              <div className={`rounded-lg border p-3 flex items-start gap-3 cursor-pointer transition-colors ${isOpenJob ? "border-primary/50 bg-primary/5" : "border-border/60 bg-muted/20"}`}
                onClick={() => setIsOpenJob(v => !v)}
              >
                <Checkbox
                  id="post-as-open-job"
                  checked={isOpenJob}
                  onCheckedChange={checked => setIsOpenJob(!!checked)}
                  onClick={e => e.stopPropagation()}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="post-as-open-job" className="text-sm font-medium cursor-pointer">Post as Open Job</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Instead of scheduling immediately, add this to the Open Jobs queue for a tech to be assigned later. Scheduling fields will be ignored.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateJob} disabled={formSaving || !form.customerId}>
                  {formSaving
                    ? (isOpenJob ? "Posting…" : "Creating…")
                    : (isOpenJob ? "Post to Open Jobs" : "Create Job")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Non-Compliance Dialog */}
      <Dialog open={ncDialog.open} onOpenChange={open => { if (!open) { setNcDialog({ open: false, job: null }); setNcReason(""); setNcSendNotice(true); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="size-5" /> Mark Job Non-Compliant
            </DialogTitle>
          </DialogHeader>
          {ncDialog.job && (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                <div className="font-semibold">{ncDialog.job.customerName}</div>
                {ncDialog.job.locationName && <div className="text-xs text-primary/70 flex items-center gap-1"><MapPin className="size-3" />{ncDialog.job.locationName}</div>}
                <div className="text-xs text-muted-foreground">{serviceTypeLabel(ncDialog.job.serviceType)} · {ncDialog.job.scheduledDate ?? "No date"}</div>
              </div>
              <div>
                <Label className="text-xs">Non-Compliance Reason *</Label>
                <Textarea placeholder="Describe the violation or compliance issue…" rows={3} className="mt-1" value={ncReason} onChange={e => setNcReason(e.target.value)} />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" className="rounded border accent-primary size-4" checked={ncSendNotice} onChange={e => setNcSendNotice(e.target.checked)} />
                <span className="text-sm">
                  Send notice to customer portal
                  <span className="block text-xs text-muted-foreground">Customer will see this on their Non-Compliance page</span>
                </span>
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setNcDialog({ open: false, job: null }); setNcReason(""); setNcSendNotice(true); }}>Cancel</Button>
                <Button variant="destructive" onClick={handleMarkNonCompliant} disabled={ncSaving || !ncReason.trim()} className="gap-1.5">
                  {ncSaving ? "Saving…" : (<><Send className="size-3.5" /> {ncSendNotice ? "Mark & Notify Customer" : "Mark Non-Compliant"}</>)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all" className="text-xs">
                <Briefcase className="size-3 mr-1" /> All ({allJobs.length})
              </TabsTrigger>
              <TabsTrigger value="bycustomer" className="text-xs">
                <Building2 className="size-3 mr-1" /> By Customer
              </TabsTrigger>
              <TabsTrigger value="dispatch" className="text-xs">
                <Users className="size-3 mr-1" /> Dispatch
              </TabsTrigger>
              <TabsTrigger value="returns" className="gap-1 text-xs">
                <RefreshCw className="size-3" /> Returns
                <span className="ml-0.5 rounded-full bg-amber-600 text-white text-[10px] size-4 inline-flex items-center justify-center">{returnJobs.length}</span>
              </TabsTrigger>
              <TabsTrigger value="reschedule" className="gap-1 text-xs">
                <Calendar className="size-3" /> Reschd
                <span className="ml-0.5 rounded-full bg-primary text-white text-[10px] size-4 inline-flex items-center justify-center">{rescheduleJobs.length}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Search jobs, locations…" className="pl-8 h-9" value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="h-9 w-44 text-xs">
                <Building2 className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Customers</SelectItem>
                {uniqueCustomers.map(c => <SelectItem key={c.id} value={String(c.id)} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <Filter className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All techs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Techs</SelectItem>
                {uniqueTechs.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <Clock className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                <SelectItem value="in-progress" className="text-xs">In Progress</SelectItem>
                <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                <SelectItem value="return" className="text-xs">Return</SelectItem>
                <SelectItem value="reschedule" className="text-xs">Reschedule</SelectItem>
                <SelectItem value="emergency" className="text-xs">Emergency</SelectItem>
                <SelectItem value="non_compliant" className="text-xs">Non-Compliant</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SortAsc className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
                onClick={() => { setSearch(""); setTechFilter("all"); setStatusFilter("all"); setCustomerFilter("all"); }}>
                <X className="size-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* Result count */}
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {sortedJobs.length} of {allJobs.length} jobs
            </p>
          )}
        </div>

        {/* All Jobs Tab */}
        <TabsContent value="all">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading jobs…</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="rounded-lg border hidden md:block overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setSortBy(sortBy === "date_asc" ? "date_desc" : "date_asc")}>
                          Date <ArrowUpDown className="size-3" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Pri</th>
                      <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setSortBy("customer_az")}>
                          Customer / Location <ArrowUpDown className="size-3" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tech</th>
                      <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Due Date</th>
                      <th className="text-right py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        <button className="flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => setSortBy("revenue_desc")}>
                          Revenue <ArrowUpDown className="size-3" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="py-3 px-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedJobs.map(job => (
                      <tr
                        key={job.id}
                        className={`border-b border-muted/50 hover:bg-muted/20 transition-colors cursor-pointer group ${job.status === "non_compliant" ? "bg-destructive/5" : ""}`}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <td className="py-3 px-3 text-xs text-muted-foreground">{job.scheduledDate ?? "—"}</td>
                        <td className="py-3 px-3">{getPriorityBadge(job.priority)}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-xs text-primary">{job.customerName}</div>
                          {job.locationName && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                              <MapPin className="size-2.5 shrink-0" />{job.locationName}
                            </div>
                          )}
                          <div className="text-[11px] text-muted-foreground">{serviceTypeLabel(job.serviceType)}</div>
                          {job.status === "non_compliant" && job.nonComplianceReason && (
                            <div className="text-[10px] text-destructive mt-0.5 italic truncate max-w-[200px]">⚠ {job.nonComplianceReason}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">{job.employeeName ?? "Unassigned"}</td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">{job.dueDate ?? "—"}</td>
                        <td className="py-3 px-3 text-right text-xs font-bold text-emerald-600">${job.revenue.toLocaleString()}</td>
                        <td className="py-3 px-3">{getStatusBadge(job.status)}</td>
                        <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                          {job.status !== "non_compliant" && job.status !== "completed" && (
                            <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                              title="Mark non-compliant" onClick={() => openNC(job)}>
                              <ShieldX className="size-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {sortedJobs.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No jobs match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-2">
                {sortedJobs.map(job => (
                  <div
                    key={job.id}
                    className={`rounded-lg border p-3 hover:bg-muted/20 transition-colors cursor-pointer ${job.status === "non_compliant" ? "border-destructive/30 bg-destructive/5" : ""}`}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span>{jobStatusIcon(job.status)}</span>
                          <span className="font-bold text-sm text-primary truncate">{job.customerName}</span>
                        </div>
                        {job.locationName && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mb-0.5">
                            <MapPin className="size-2.5" />{job.locationName}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">{serviceTypeLabel(job.serviceType)}</div>
                        {job.status === "non_compliant" && job.nonComplianceReason && (
                          <div className="text-[10px] text-destructive mt-0.5 italic">⚠ {job.nonComplianceReason}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-sm font-bold text-emerald-600">${job.revenue.toLocaleString()}</div>
                        {getPriorityBadge(job.priority)}
                        {job.status !== "non_compliant" && job.status !== "completed" && (
                          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 gap-1"
                            onClick={e => { e.stopPropagation(); openNC(job); }}>
                            <ShieldX className="size-3" /> NC
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{job.employeeName ?? "Unassigned"} · {job.scheduledDate ?? "No date"}{job.dueDate ? ` · Due ${job.dueDate}` : ""}</span>
                      {getStatusBadge(job.status)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* By Customer Tab */}
        <TabsContent value="bycustomer">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading jobs…</p>
          ) : (
            <ByCustomerView
              jobs={sortedJobs}
              onNavigate={id => navigate(`/jobs/${id}`)}
              onNC={openNC}
            />
          )}
        </TabsContent>

        {/* Dispatch Board */}
        <TabsContent value="dispatch">
          <DispatchBoard jobs={allJobs} />
        </TabsContent>

        {/* Returns */}
        <TabsContent value="returns">
          <JobQueue jobs={returnJobs} emptyMsg="No return jobs. 🎉" />
        </TabsContent>

        {/* Reschedules */}
        <TabsContent value="reschedule">
          <JobQueue jobs={rescheduleJobs} emptyMsg="No jobs pending reschedule. 🎉" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
