import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ConvexJob, ConvexInvoice, ConvexEmployee, ConvexCustomer } from "@/lib/convex-types";
import {
  AlertTriangle, ArrowRight, CalendarOff, Clock,
  DollarSign, Flame, TrendingDown, TrendingUp, Users, Wrench, Zap,
  FileText, Receipt, PlusCircle, ClipboardList, Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { toast } from "sonner";

function getStatusColor(status: string) {
  if (status === "completed") return "bg-emerald-600";
  if (status === "in-progress" || status === "in_progress") return "bg-blue-600";
  if (status === "return" || status === "will_return") return "bg-amber-600";
  if (status === "reschedule") return "bg-red-600";
  return "bg-gray-400";
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencySaving, setEmergencySaving] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({
    customerId: "", employeeId: "", description: "", revenue: "",
  });

  const summary = useQuery(api.dashboard.summary);
  const employees = (useQuery(api.employees.list) ?? []) as ConvexEmployee[];
  const jobs = (useQuery(api.jobs.list, {}) ?? []) as ConvexJob[];
  const invoices = (useQuery(api.invoices.list, {}) ?? []) as ConvexInvoice[];
  const leaks = (useQuery(api.dashboard.profitLeaks) ?? []) as { title: string; description: string; impact?: number }[];
  const customers = (useQuery(api.customers.list) ?? []) as ConvexCustomer[];
  const createJob = useMutation(api.jobs.create);

  const loading = summary === undefined;

  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const activeJobs    = jobs.filter(j => j.status === "in-progress" || j.status === "in_progress").length;
  const pendingJobs   = jobs.filter(j => j.status === "pending").length;
  const issueJobs     = jobs.filter(j => j.status === "return" || j.status === "will_return" || j.status === "reschedule").length;
  const totalJobs     = jobs.length || 1;

  const pendingInvoices = invoices.filter(inv => inv.status === "draft" || inv.status === "pending");
  const overdueInvoices = invoices.filter(inv => inv.status === "overdue");
  const pendingInvoiceTotal = pendingInvoices.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0);

  const activeEmployees = employees.filter(e => e.isActive);

  const stats = [
    {
      title: "Revenue YTD",
      value: summary ? formatCurrency(summary.revenueYtd) : "—",
      sub: `${completedJobs} jobs completed`,
      icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100", link: "/profitability",
    },
    {
      title: "Team Utilization",
      value: summary ? `${summary.teamUtilizationPct.toFixed(1)}%` : "—",
      sub: `${summary?.activeTechCount ?? activeEmployees.length} active technicians`,
      icon: Users, color: "text-blue-600", bg: "bg-blue-100", link: "/employees",
    },
    {
      title: "Open Jobs",
      value: summary ? String(summary.openJobCount) : "—",
      sub: `${summary?.returnJobCount ?? 0} returns · ${summary?.rescheduleJobCount ?? 0} reschedules`,
      icon: DollarSign, color: "text-amber-600", bg: "bg-amber-100", link: "/open-jobs",
    },
    {
      title: "Lost to Shop Days",
      value: summary ? `$${Math.round(summary.shopDayCostYtd).toLocaleString()}` : "—",
      sub: summary ? `Save: $${Math.round(summary.projectedAnnualSavings).toLocaleString()}/yr projected` : "—",
      icon: TrendingDown, color: "text-red-600", bg: "bg-red-100", link: "/profitability",
    },
  ];

  async function handleEmergencyDispatch() {
    if (!emergencyForm.customerId) return;
    setEmergencySaving(true);
    try {
      const custId = customers.find(c => c._id === emergencyForm.customerId)?._id;
      if (!custId) { toast.error("Customer not found"); return; }
      await createJob({
        customerId: custId,
        employeeId: emergencyForm.employeeId ? emergencyForm.employeeId as Id<"employees"> : undefined,
        serviceType: "emergency",
        status: "pending",
        priority: "high",
        scheduledDate: new Date().toISOString().split("T")[0],
        certificationRequired: "any",
        notes: emergencyForm.description || "Emergency dispatch",
        revenue: Number(emergencyForm.revenue) || 0,
        quantity: 1,
      });
      setEmergencyOpen(false);
      setEmergencyForm({ customerId: "", employeeId: "", description: "", revenue: "" });
      toast.success("Emergency job dispatched");
    } catch {
      toast.error("Failed to dispatch emergency");
    } finally {
      setEmergencySaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Flame className="size-7 text-red-600 shrink-0" /> Dashboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Multicorp Fire Protection Services — Columbia, MD</p>
        </div>
        <button
          onClick={() => setEmergencyOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors self-start sm:self-auto"
        >
          <Zap className="size-3.5" /> Emergency Override
        </button>
      </div>

      {emergencyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
              <Zap className="size-5" /> Emergency Job Override
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Creates an emergency job and immediately queues it for dispatch.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Customer *</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={emergencyForm.customerId}
                  onChange={e => setEmergencyForm(f => ({ ...f, customerId: e.target.value }))}
                >
                  <option value="">Select customer</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Override Tech</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={emergencyForm.employeeId}
                  onChange={e => setEmergencyForm(f => ({ ...f, employeeId: e.target.value }))}
                >
                  <option value="">Auto — Nearest Available</option>
                  {activeEmployees.map(e => (
                    <option key={e._id} value={e._id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Emergency Description</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Describe the emergency..."
                value={emergencyForm.description}
                onChange={e => setEmergencyForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Estimated Revenue ($)</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="0"
                value={emergencyForm.revenue}
                onChange={e => setEmergencyForm(f => ({ ...f, revenue: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEmergencyOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                disabled={!emergencyForm.customerId || emergencySaving}
                onClick={handleEmergencyDispatch}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Zap className="size-3.5" /> {emergencySaving ? "Dispatching…" : "Dispatch Emergency"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "New Job", icon: PlusCircle, href: "/jobs" },
          { label: "Open Jobs", icon: ClipboardList, href: "/open-jobs" },
          { label: "Invoices", icon: Receipt, href: "/invoices" },
          { label: "Customers", icon: Building2, href: "/customers" },
        ].map(a => (
          <button
            key={a.href}
            onClick={() => navigate(a.href)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors font-medium",
              a.label === "New Job"
                ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                : "bg-white text-gray-700 hover:bg-gray-50"
            )}
          >
            <a.icon className="size-3.5" /> {a.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <div
            key={stat.title}
            className="bg-white rounded-xl border p-4 sm:p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(stat.link)}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">{stat.title}</span>
              <div className={cn("rounded-lg p-2 shrink-0", stat.bg)}>
                <stat.icon className={cn("size-4", stat.color)} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900">
              {loading ? <span className="text-gray-400">—</span> : stat.value}
            </div>
            <div className="text-xs text-gray-500 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Job Status Overview */}
      <div
        className="bg-white rounded-xl border p-4 sm:p-5 cursor-pointer hover:shadow-sm transition-shadow"
        onClick={() => navigate("/jobs")}
      >
        <div className="flex items-center gap-2 mb-3">
          <Clock className="size-4 text-red-600" />
          <span className="text-sm font-bold">Job Status Overview</span>
          <ArrowRight className="size-3 text-gray-400 ml-auto" />
        </div>
        <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3 bg-gray-100">
          {completedJobs > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${(completedJobs / totalJobs) * 100}%` }} />}
          {activeJobs > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${(activeJobs / totalJobs) * 100}%` }} />}
          {pendingJobs > 0 && <div className="bg-gray-300 transition-all" style={{ width: `${(pendingJobs / totalJobs) * 100}%` }} />}
          {issueJobs > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${(issueJobs / totalJobs) * 100}%` }} />}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" /> {completedJobs} Completed</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-500" /> {activeJobs} In Progress</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-gray-400" /> {pendingJobs} Pending</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500" /> {issueJobs} Needs Attention</span>
        </div>
      </div>

      {/* Invoice Overview */}
      <div
        className="bg-white rounded-xl border p-4 sm:p-5 cursor-pointer hover:shadow-sm transition-shadow"
        onClick={() => navigate("/invoices")}
      >
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="size-4 text-red-600" />
          <span className="text-sm font-bold">Invoice Overview</span>
          <ArrowRight className="size-3 text-gray-400 ml-auto" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Pending</div>
            <div className="text-xl font-extrabold text-amber-600">{loading ? "—" : pendingInvoices.length}</div>
            <div className="text-[10px] text-gray-400">${loading ? "—" : pendingInvoiceTotal.toLocaleString()} total</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Overdue</div>
            <div className="text-xl font-extrabold text-red-600">{loading ? "—" : overdueInvoices.length}</div>
            <div className="text-[10px] text-gray-400">{overdueInvoices.length > 0 ? "Action needed" : "All clear"}</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Total</div>
            <div className="text-xl font-extrabold">{loading ? "—" : invoices.length}</div>
            <div className="text-[10px] text-gray-400">${loading ? "—" : invoices.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0).toLocaleString()} billed</div>
          </div>
        </div>
      </div>

      {/* Profit Leak Alerts */}
      {leaks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-red-600" />
            <span className="text-sm font-bold text-red-700">Profit Leak Alerts</span>
            <button onClick={() => navigate("/profitability")} className="ml-auto text-xs text-red-600 hover:underline">
              Open P&L →
            </button>
          </div>
          <div className="space-y-2">
            {leaks.map((leak, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 border-b border-red-200/50 last:border-0 text-sm cursor-pointer"
                onClick={() => navigate("/employees")}
              >
                <div>
                  <span className="font-semibold text-red-700">{leak.title}: </span>
                  <span className="text-gray-600">{leak.description}</span>
                </div>
                {leak.impact && (
                  <span className="text-xs font-bold text-red-600 shrink-0">
                    {formatCurrency(leak.impact)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shop Day Tracker */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-red-600" />
            <h2 className="font-semibold text-sm">Shop Day Tracker — YTD</h2>
          </div>
          <button onClick={() => navigate("/profitability")} className="text-xs text-red-600 hover:underline flex items-center gap-1">
            P&L Engine <ArrowRight className="size-3" />
          </button>
        </div>
        <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeEmployees.length === 0 && (
            <p className="text-sm text-gray-400 col-span-3 text-center py-4">No employees — load demo data</p>
          )}
          {activeEmployees.map(emp => {
            const pct = emp.allowedShopDays > 0 ? (emp.shopDaysUsedYtd / emp.allowedShopDays) * 100 : 0;
            const remaining = emp.allowedShopDays - emp.shopDaysUsedYtd;
            const isWarning = pct >= 80;
            const isDanger = pct >= 100;
            return (
              <div
                key={emp._id}
                className={cn(
                  "rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-all",
                  isDanger ? "border-red-300 bg-red-50/50" : isWarning ? "border-amber-200 bg-amber-50/30" : "hover:border-red-600/30"
                )}
                onClick={() => navigate("/employees")}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-bold text-red-700">
                      {initials(emp.name)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold leading-tight">{emp.name.split(" ")[0]}</div>
                      <div className="text-[11px] text-gray-500 capitalize">{emp.role.replace(/_/g, " ")}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-lg font-extrabold", isDanger ? "text-red-600" : isWarning ? "text-amber-600" : "text-gray-900")}>
                      {emp.shopDaysUsedYtd}/{emp.allowedShopDays}
                    </div>
                    <div className="text-[10px] text-gray-400">{remaining > 0 ? `${remaining} left` : "maxed out"}</div>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={cn("h-2 rounded-full transition-all", isDanger ? "bg-red-600" : isWarning ? "bg-amber-500" : "bg-red-600")}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-red-600" />
            <h2 className="font-semibold text-sm">Recent Jobs</h2>
          </div>
          <button onClick={() => navigate("/jobs")} className="text-xs text-red-600 hover:underline flex items-center gap-1">
            All jobs <ArrowRight className="size-3" />
          </button>
        </div>
        <div className="divide-y">
          {jobs.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No jobs yet — load demo data</p>
          )}
          {[...jobs].sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0)).slice(0, 6).map(job => (
            <div key={job._id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate("/jobs")}>
              <div>
                <p className="text-sm font-medium text-gray-900">{job.customerName ?? "Unknown"}</p>
                <p className="text-xs text-gray-500">{job.serviceType?.replace(/_/g, " ")} · {job.scheduledDate ?? "TBD"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(job.revenue ?? 0)}</span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  job.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                  job.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                  job.status === "return" || job.status === "will_return" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-600"
                )}>
                  {job.status?.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
