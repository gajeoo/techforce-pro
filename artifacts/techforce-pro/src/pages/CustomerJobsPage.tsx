import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ConvexJob, ConvexCustomer } from "@/lib/convex-types";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FilterX,
  MapPin,
  Receipt,
  Search,
  ShieldX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type SortKey = "scheduledDate" | "serviceType" | "status" | "revenue";
type SortDir = "asc" | "desc";
type FilterStatus = "all" | "done" | "upcoming" | "non_compliant" | "invoiced";

const SORT_LABELS: Record<SortKey, string> = {
  scheduledDate: "Date",
  serviceType:   "Service Type",
  status:        "Status",
  revenue:       "Revenue",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:       { label: "Pending",         className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300" },
  in_progress:   { label: "In Progress",     className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300" },
  completed:     { label: "Completed",       className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" },
  return:        { label: "Return Visit",    className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300" },
  will_return:   { label: "Will Return",     className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300" },
  reschedule:    { label: "Rescheduled",     className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300" },
  non_compliant: { label: "Non-Compliant",   className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300" },
  emergency:     { label: "Emergency",       className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300" },
  cancelled:     { label: "Cancelled",       className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400" },
};

function statusPriority(s: string) {
  const order: Record<string, number> = {
    non_compliant: 0, pending: 1, in_progress: 2, emergency: 3,
    return: 4, will_return: 5, reschedule: 6, completed: 7, cancelled: 8,
  };
  return order[s] ?? 99;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(n: number) {
  return n > 0 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "—";
}

export function CustomerJobsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const allJobs = (useQuery(api.jobs.list) ?? []) as ConvexJob[];
  const allCustomers = (useQuery(api.customers.list) ?? []) as ConvexCustomer[];
  // Sort by creation time for deterministic ordering, then index by numeric auth ID
  // (demo app — no real auth; customer role maps to a sequential picker ID)
  const customerId = parseInt((user?.id ?? "").replace(/\D/g, "")) || 1;
  const sortedCustomers = [...allCustomers].sort((a, b) => a._creationTime - b._creationTime);
  const myCust: ConvexCustomer | undefined = sortedCustomers[customerId - 1];
  // Never fall back to showing all jobs — show nothing while loading or if lookup fails
  const jobs = myCust ? allJobs.filter(j => j.customerId === myCust._id) : [];
    const [search, setSearch] = useState("");
  const [filterStatus, setFilter] = useState<FilterStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("scheduledDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    let list = [...jobs];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(j =>
        j.serviceType.toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        j.customerAddress.toLowerCase().includes(q) ||
        (j.employeeName ?? "").toLowerCase().includes(q) ||
        j.status.toLowerCase().includes(q) ||
        (j.notes ?? "").toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus === "done") {
      list = list.filter(j => j.status === "completed");
    } else if (filterStatus === "upcoming") {
      list = list.filter(j => j.status === "pending" || j.status === "in_progress");
    } else if (filterStatus === "non_compliant") {
      list = list.filter(j => j.status === "non_compliant");
    } else if (filterStatus === "invoiced") {
      list = list.filter(j => j.revenue > 0 && j.status === "completed");
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "scheduledDate") {
        cmp = (a.scheduledDate ?? "9999").localeCompare(b.scheduledDate ?? "9999");
      } else if (sortKey === "serviceType") {
        cmp = a.serviceType.localeCompare(b.serviceType);
      } else if (sortKey === "status") {
        cmp = statusPriority(a.status) - statusPriority(b.status);
      } else if (sortKey === "revenue") {
        cmp = a.revenue - b.revenue;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [jobs, search, filterStatus, sortKey, sortDir]);

  const done         = jobs.filter(j => j.status === "completed").length;
  const upcoming     = jobs.filter(j => j.status === "pending" || j.status === "in_progress").length;
  const nonCompliant = jobs.filter(j => j.status === "non_compliant").length;

  function SortBtn({ col }: { col: SortKey }) {
    const active = sortKey === col;
    return (
      <button
        className={`flex items-center gap-1 text-xs font-semibold transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => toggleSort(col)}
      >
        {SORT_LABELS[col]}
        {active
          ? sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
          : <ArrowUpDown className="size-3 opacity-50" />}
      </button>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customer-portal")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="size-6 text-primary" />
              My Jobs
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Service history and upcoming visits
            </p>
          </div>
        </div>
        {nonCompliant > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="self-start sm:self-auto gap-1.5"
            onClick={() => navigate("/customer-non-compliance")}
          >
            <AlertTriangle className="size-3.5" /> {nonCompliant} Non-Compliance Notice{nonCompliant > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Total Jobs</div>
          <div className="text-2xl font-extrabold">{jobs.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Completed</div>
          <div className="text-2xl font-extrabold text-emerald-600">{done}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Upcoming</div>
          <div className="text-2xl font-extrabold text-primary">{upcoming}</div>
        </CardContent></Card>
        <Card className={nonCompliant > 0 ? "border-destructive/40 bg-destructive/5" : ""}>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Non-Compliant</div>
            <div className={`text-2xl font-extrabold ${nonCompliant > 0 ? "text-destructive" : "text-muted-foreground"}`}>{nonCompliant}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="size-4 text-primary" /> All Jobs
          </CardTitle>
          <CardDescription>
            {`${filtered.length} of ${jobs.length} jobs shown`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search + filter row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search service, address, tech…"
                className="pl-8 h-9 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={v => setFilter(v as FilterStatus)}>
              <SelectTrigger className="w-48 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="upcoming">Upcoming / Pending</SelectItem>
                <SelectItem value="done">Completed</SelectItem>
                <SelectItem value="invoiced">Invoiced (completed with revenue)</SelectItem>
                <SelectItem value="non_compliant">Non-Compliant</SelectItem>
              </SelectContent>
            </Select>
            {(search || filterStatus !== "all") && (
              <Button variant="ghost" size="sm" className="gap-1.5 h-9 shrink-0" onClick={() => { setSearch(""); setFilter("all"); }}>
                <FilterX className="size-3.5" /> Clear
              </Button>
            )}
          </div>

          {/* Sort pills */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground font-medium">Sort:</span>
            {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${sortKey === key ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"}`}
              >
                {SORT_LABELS[key]}
                {sortKey === key && (sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {jobs.length === 0 ? "No jobs on record for your account." : "No jobs match your filters."}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map(job => {
                  const badge = STATUS_BADGE[job.status] ?? { label: job.status, className: "bg-gray-100 text-gray-600 border-gray-200" };
                  const isDone = job.status === "completed";
                  const isNC   = job.status === "non_compliant";

                  return (
                    <div
                      key={job.id}
                      className={`p-4 hover:bg-muted/20 transition-colors ${isNC ? "bg-destructive/5 border-l-4 border-l-destructive" : ""}`}
                    >
                      {/* Mobile layout */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-sm">{job.serviceType}</div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${badge.className}`}>{badge.label}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3 shrink-0" /> {job.customerAddress || "—"}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="size-3" /> {formatDate(job.scheduledDate)}</span>
                          {job.employeeName && <span>Tech: {job.employeeName}</span>}
                        </div>
                        {job.revenue > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Receipt className="size-3" /> {formatCurrency(job.revenue)}
                            {isDone && <span className="text-emerald-600 font-medium ml-1">· Invoiced</span>}
                          </div>
                        )}
                        {isNC && job.nonComplianceReason && (
                          <div className="text-xs p-2 rounded bg-destructive/10 border border-destructive/20">
                            <ShieldX className="size-3 inline mr-1 text-destructive" />
                            <span className="font-semibold text-destructive">Reason: </span>
                            {job.nonComplianceReason}
                          </div>
                        )}
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden md:grid grid-cols-[2fr_1.5fr_auto_auto_auto] gap-4 items-start">
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {isNC && <ShieldX className="size-4 text-destructive shrink-0" />}
                            {job.serviceType}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="size-3 shrink-0" /> {job.customerAddress || "—"}
                          </div>
                          {isNC && job.nonComplianceReason && (
                            <div className="text-xs mt-1 p-1.5 rounded bg-destructive/10 border border-destructive/20 text-destructive">
                              <span className="font-semibold">Reason: </span>{job.nonComplianceReason}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm">
                            {job.employeeName ? `Tech: ${job.employeeName}` : <span className="text-muted-foreground">Unassigned</span>}
                          </div>
                          {job.notes && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{job.notes}</div>
                          )}
                          {isDone && job.revenue > 0 && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-emerald-600 font-medium">
                              <Receipt className="size-3" /> Invoiced · {formatCurrency(job.revenue)}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium whitespace-nowrap">{formatDate(job.scheduledDate)}</div>
                          {job.revenue > 0 && !isDone && (
                            <div className="text-xs text-muted-foreground">{formatCurrency(job.revenue)}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${badge.className}`}>{badge.label}</Badge>
                          {isDone && (
                            <div className="mt-1 flex justify-end">
                              <CheckCircle2 className="size-3.5 text-emerald-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
