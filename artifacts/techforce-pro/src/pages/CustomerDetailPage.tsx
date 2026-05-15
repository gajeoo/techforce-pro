import {
  ArrowLeft,
  Building2,
  Calendar,
  Camera,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Image as ImageIcon,
  MapPin,
  Paperclip,
  Phone,
  Plus,
  Upload,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type Job,
  type JobDocument,
  allCustomerJobs,
  customers,
  serviceCategoryColors,
} from "@/lib/mockData";

// ─── Helpers ────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-emerald-600",
    "in-progress": "bg-blue-600",
    pending: "bg-slate-500",
    return: "bg-amber-600",
    reschedule: "bg-red-600",
    emergency: "bg-red-700",
  };
  return (
    <Badge className={`${map[status] || "bg-slate-500"} text-[10px] capitalize`}>
      {status.replace("-", " ")}
    </Badge>
  );
}

function getServiceBadge(category: string) {
  const info = serviceCategoryColors[category] || serviceCategoryColors["mixed"];
  return (
    <Badge variant="secondary" className={`${info.bg} ${info.text} text-[10px]`}>
      {info.label}
    </Badge>
  );
}

function getContractBadge(status: string) {
  if (status === "active") return <Badge variant="default" className="bg-emerald-600 text-[10px]">Active</Badge>;
  if (status === "expiring") return <Badge variant="default" className="bg-amber-600 text-[10px]">Expiring</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDateGroup(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date("2026-06-10T00:00:00");
  const diffDays = Math.round((d.getTime() - today.getTime()) / (86400000));

  let label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (diffDays === 0) label = `Today — ${label}`;
  else if (diffDays === 1) label = `Tomorrow — ${label}`;
  else if (diffDays < 0) label = `${label} (Past)`;
  else if (diffDays <= 7) label = `This Week — ${label}`;

  const isPast = diffDays < 0;
  const isToday = diffDays === 0;
  const isSoon = diffDays > 0 && diffDays <= 3;
  return { label, isPast, isToday, isSoon };
}

function DocumentItem({ doc }: { doc: JobDocument }) {
  const iconMap = {
    photo: <Camera className="size-3.5 text-blue-600" />,
    pdf: <FileText className="size-3.5 text-red-600" />,
    document: <FileText className="size-3.5 text-emerald-600" />,
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 bg-muted/40 rounded-lg text-xs">
      {iconMap[doc.type]}
      <span className="font-medium truncate flex-1">{doc.name}</span>
      <span className="text-muted-foreground shrink-0">{doc.size}</span>
    </div>
  );
}

// ─── Job Card (used in grouped views) ───────────────────────────────────

function JobCard({ job, onToggleDocs }: { job: Job; onToggleDocs: (id: string) => void }) {
  const [showDocs, setShowDocs] = useState(false);
  const hasDocuments = job.documents.length > 0;

  return (
    <div className="border rounded-xl p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm">{job.type}</span>
            {getServiceBadge(job.serviceCategory)}
            {getStatusBadge(job.status)}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{job.address}</span>
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="size-3" /> {job.techName}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" /> {formatDate(job.scheduledDate)} · {job.scheduledTime}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" /> Due: {formatDate(job.dueDate)}
            </span>
          </div>
          {job.notes && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 bg-amber-50/50 dark:bg-amber-950/20 rounded px-2 py-1">
              📝 {job.notes}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-emerald-600">${job.revenue.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">{job.priority} priority</div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setShowDocs(!showDocs); onToggleDocs(job.id); }}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Paperclip className="size-3" />
            {hasDocuments ? `${job.documents.length} document${job.documents.length > 1 ? "s" : ""}` : "No documents"}
            {hasDocuments && (showDocs ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
          </button>
          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-primary hover:text-primary">
            <Upload className="size-3" /> Add File
          </Button>
        </div>
        {showDocs && hasDocuments && (
          <div className="mt-2 space-y-1.5">
            {job.documents.map(doc => (
              <DocumentItem key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customer = customers.find(c => c.id === id);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"dueDate" | "serviceType">("dueDate");
  const [_expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  const customerJobs = useMemo(() => {
    if (!customer) return [];
    let jobs = allCustomerJobs.filter(j => j.customerId === customer.id);
    // dedupe by job id
    const seen = new Set<string>();
    jobs = jobs.filter(j => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    });
    if (selectedLocation !== "all") {
      jobs = jobs.filter(j => j.locationId === selectedLocation);
    }
    return jobs;
  }, [customer, selectedLocation]);

  const groupedJobs = useMemo(() => {
    if (groupBy === "dueDate") {
      const groups = new Map<string, Job[]>();
      customerJobs.forEach(j => {
        const key = j.dueDate;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(j);
      });
      return Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, jobs]) => ({
          key: date,
          ...formatDateGroup(date),
          jobs: jobs.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
        }));
    } else {
      const categories = ["suppression", "extinguisher", "sprinkler", "exit-light", "mixed"];
      return categories
        .map(cat => {
          const jobs = customerJobs.filter(j => j.serviceCategory === cat);
          if (jobs.length === 0) return null;
          const info = serviceCategoryColors[cat];
          return {
            key: cat,
            label: `${info.label} Jobs`,
            isPast: false,
            isToday: false,
            isSoon: false,
            jobs: jobs.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
          };
        })
        .filter(Boolean) as { key: string; label: string; isPast: boolean; isToday: boolean; isSoon: boolean; jobs: Job[] }[];
    }
  }, [customerJobs, groupBy]);

  // Stats
  const totalRevenue = customerJobs.reduce((s, j) => s + j.revenue, 0);
  const completedCount = customerJobs.filter(j => j.status === "completed").length;
  const pendingCount = customerJobs.filter(j => j.status === "pending").length;
  const totalDocs = customerJobs.reduce((s, j) => s + j.documents.length, 0);

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-bold">Customer not found</h2>
        <Link to="/customers" className="text-primary underline text-sm mt-2 inline-block">
          ← Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/customers"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-3 transition-colors"
        >
          <ArrowLeft className="size-3" /> Back to Customers
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="size-6 text-primary shrink-0" />
              {customer.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{customer.type}</Badge>
              {getContractBadge(customer.contractStatus)}
              <span className="text-xs text-muted-foreground">{customer.locations.length} location{customer.locations.length > 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><User className="size-3" /> {customer.contact}</span>
              <span className="flex items-center gap-1"><Phone className="size-3" /> {customer.phone}</span>
            </div>
          </div>
          <Button size="sm" className="gap-1.5 self-start">
            <Plus className="size-3.5" /> New Job
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="size-4 text-emerald-600 mx-auto mb-1" />
            <div className="text-xl font-extrabold text-emerald-600">${totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Revenue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Building2 className="size-4 text-primary mx-auto mb-1" />
            <div className="text-xl font-extrabold">{customerJobs.length}</div>
            <div className="text-xs text-muted-foreground">Total Jobs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="size-4 text-blue-600 mx-auto mb-1" />
            <div className="text-xl font-extrabold">{completedCount}<span className="text-muted-foreground font-normal text-sm"> / {pendingCount} pending</span></div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Paperclip className="size-4 text-amber-600 mx-auto mb-1" />
            <div className="text-xl font-extrabold">{totalDocs}</div>
            <div className="text-xs text-muted-foreground">Documents</div>
          </CardContent>
        </Card>
      </div>

      {/* Locations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedLocation("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                selectedLocation === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted/50 border-muted"
              }`}
            >
              All Locations ({customerJobs.length})
            </button>
            {customer.locations.map(loc => {
              const locJobCount = allCustomerJobs.filter(j => j.customerId === customer.id && j.locationId === loc.id).length;
              return (
                <button
                  key={loc.id}
                  onClick={() => setSelectedLocation(loc.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedLocation === loc.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted/50 border-muted"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {loc.isPrimary && <span className="text-[9px]">★</span>}
                    {loc.name} ({locJobCount})
                  </div>
                </button>
              );
            })}
          </div>
          {selectedLocation !== "all" && (
            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3" />
              {customer.locations.find(l => l.id === selectedLocation)?.address}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Group By Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Jobs ({customerJobs.length})</h2>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => setGroupBy("dueDate")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              groupBy === "dueDate" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            By Due Date
          </button>
          <button
            onClick={() => setGroupBy("serviceType")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              groupBy === "serviceType" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            By Service Type
          </button>
        </div>
      </div>

      {/* Grouped Jobs */}
      {groupedJobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No jobs found for this location.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedJobs.map(group => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-6 w-1 rounded-full ${
                  group.isToday ? "bg-primary" : group.isSoon ? "bg-amber-500" : group.isPast ? "bg-muted-foreground/40" : "bg-muted-foreground/20"
                }`} />
                <h3 className={`text-sm font-bold ${group.isPast ? "text-muted-foreground" : ""}`}>
                  {group.label}
                </h3>
                <Badge variant="secondary" className="text-[10px]">{group.jobs.length} job{group.jobs.length > 1 ? "s" : ""}</Badge>
                <span className="text-xs text-emerald-600 font-semibold ml-auto">
                  ${group.jobs.reduce((s, j) => s + j.revenue, 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-3 ml-3">
                {group.jobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onToggleDocs={(id) => {
                      setExpandedDocs(prev => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pricing Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-600" />
            Service Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-muted-foreground mb-1">Extinguisher</div>
              <div className="text-sm font-bold">{customer.extinguisher}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-muted-foreground mb-1">Suppression</div>
              <div className="text-sm font-bold">{customer.suppression}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-muted-foreground mb-1">Sprinkler</div>
              <div className="text-sm font-bold">{customer.sprinkler}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-muted-foreground mb-1">Exit Light</div>
              <div className="text-sm font-bold">{customer.exitLight}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ImageIcon className="size-5 text-primary" />
            </div>
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="size-5 text-primary" />
            </div>
            <div className="p-2 rounded-lg bg-primary/10">
              <Camera className="size-5 text-primary" />
            </div>
          </div>
          <p className="text-sm font-semibold mb-1">Upload Documents & Photos</p>
          <p className="text-xs text-muted-foreground mb-3">
            Drag and drop files here, or click to browse. Supports photos, PDFs, and documents.
          </p>
          <Button size="sm" className="gap-1.5">
            <Upload className="size-3.5" /> Browse Files
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
