import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Briefcase, Plus, Filter, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { statusColor, formatCurrency } from "../lib/utils";

const STATUSES = ["pending","in_progress","completed","return","reschedule"];

export function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const jobs = (useQuery(api.jobs.list, statusFilter ? { status: statusFilter } : {}) ?? []) as any[];
  const customers = (useQuery(api.customers.list) ?? []) as any[];
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const createJob = useMutation(api.jobs.create);

  const [form, setForm] = useState({ customerId: "" as string, serviceType: "", scheduledDate: "", scheduledTime: "09:00", priority: "medium", revenue: 0, notes: "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.customerId || !form.serviceType || !form.scheduledDate) { toast.error("Fill in required fields"); return; }
    setSaving(true);
    try {
      const id = await createJob({ customerId: form.customerId as Id<"customers">, serviceType: form.serviceType, scheduledDate: form.scheduledDate, scheduledTime: form.scheduledTime, priority: form.priority as any, revenue: form.revenue, notes: form.notes || undefined });
      toast.success("Job created");
      setShowForm(false);
      navigate(`/jobs/${id}`);
    } catch (e) { toast.error(String(e)); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="size-6" /> Jobs</h1><p className="text-sm text-gray-500">{jobs.length} jobs</p></div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-lg px-2 bg-white">
            <Filter className="size-3.5 text-gray-400" />
            <select value={statusFilter ?? ""} onChange={e => setStatusFilter(e.target.value || undefined)} className="text-sm py-1.5 focus:outline-none bg-transparent">
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus className="size-4" /> New Job</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr>
            <th className="px-4 py-3 text-left">Customer</th>
            <th className="px-4 py-3 text-left">Service</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Assigned To</th>
            <th className="px-4 py-3 text-right">Revenue</th>
            <th className="px-4 py-3 text-center">Status</th>
          </tr></thead>
          <tbody className="divide-y">
            {jobs.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">No jobs found</td></tr>}
            {jobs.map((job: any) => (
              <tr key={job._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/jobs/${job._id}`)}>
                <td className="px-4 py-3 font-medium">{job.customerName}</td>
                <td className="px-4 py-3 text-gray-600">{job.serviceType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-gray-500">{job.scheduledDate ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{job.employeeName ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(job.revenue ?? 0)}</td>
                <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(job.status)}`}>{job.status.replace(/_/g, " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-lg">New Job</h2><button onClick={() => setShowForm(false)}><X className="size-5" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-600 block mb-1">Customer *</label>
              <select value={form.customerId} onChange={e => setForm(f => ({...f, customerId: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Select customer…</option>
                {customers.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select></div>
              <div><label className="text-xs font-medium text-gray-600 block mb-1">Service Type *</label>
              <input value={form.serviceType} onChange={e => setForm(f => ({...f, serviceType: e.target.value}))} placeholder="e.g. extinguisher_inspection" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 block mb-1">Date *</label><input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({...f, scheduledDate: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
                <div><label className="text-xs font-medium text-gray-600 block mb-1">Time</label><input type="time" value={form.scheduledTime} onChange={e => setForm(f => ({...f, scheduledTime: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 block mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {["low","medium","high"].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600 block mb-1">Revenue ($)</label><input type="number" value={form.revenue} onChange={e => setForm(f => ({...f, revenue: Number(e.target.value)}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 block mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">{saving ? "Creating…" : "Create Job"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
