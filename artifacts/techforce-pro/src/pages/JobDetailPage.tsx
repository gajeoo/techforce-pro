import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft, Briefcase, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { statusColor, formatCurrency } from "@/lib/utils";

const STATUSES = ["pending","in_progress","completed","return","reschedule","will_return"];

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const job = useQuery(api.jobs.get, id ? { id: id as Id<"jobs"> } : "skip") as any;
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const updateJob = useMutation(api.jobs.update);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, any>>({});

  if (!job) return <div className="flex items-center justify-center h-64"><div className="animate-spin size-8 border-4 border-red-600 border-t-transparent rounded-full" /></div>;

  const val = (key: string) => edits[key] !== undefined ? edits[key] : (job as any)[key];
  const set = (key: string, v: any) => setEdits(e => ({...e, [key]: v}));

  async function handleSave() {
    setSaving(true);
    try { await updateJob({ id: id as Id<"jobs">, ...edits }); toast.success("Job updated"); setEdits({}); }
    catch (e) { toast.error(String(e)); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/jobs")} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="size-4" /></button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Briefcase className="size-5" /> Job Detail</h1>
          <p className="text-sm text-gray-500">{job.customerName}</p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${statusColor(job.status)}`}>{job.status.replace(/_/g, " ")}</span>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><p className="text-xs text-gray-500 mb-1">Service Type</p><p className="font-medium">{job.serviceType.replace(/_/g, " ")}</p></div>
          <div><p className="text-xs text-gray-500 mb-1">Revenue</p><p className="font-medium">{formatCurrency(job.revenue ?? 0)}</p></div>
          <div><p className="text-xs text-gray-500 mb-1">Scheduled Date</p><p className="font-medium">{job.scheduledDate ?? "—"}</p></div>
          <div><p className="text-xs text-gray-500 mb-1">Scheduled Time</p><p className="font-medium">{job.scheduledTime ?? "—"}</p></div>
          <div><p className="text-xs text-gray-500 mb-1">Priority</p><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${job.priority === "high" ? "bg-red-100 text-red-700" : job.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{job.priority}</span></div>
          <div><p className="text-xs text-gray-500 mb-1">Location</p><p className="font-medium">{job.locationName ?? "—"}</p></div>
        </div>
        {job.notes && <div><p className="text-xs text-gray-500 mb-1">Notes</p><p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{job.notes}</p></div>}
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-sm">Update Job</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500 block mb-1">Status</label>
          <select value={val("status")} onChange={e => set("status", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></div>
          <div><label className="text-xs text-gray-500 block mb-1">Assigned Technician</label>
          <select value={val("employeeId") ?? ""} onChange={e => set("employeeId", e.target.value || undefined)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
            <option value="">Unassigned</option>
            {employees.filter((e: any) => e.isActive).map((e: any) => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select></div>
          <div><label className="text-xs text-gray-500 block mb-1">Scheduled Date</label><input type="date" value={val("scheduledDate") ?? ""} onChange={e => set("scheduledDate", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Revenue ($)</label><input type="number" value={val("revenue") ?? 0} onChange={e => set("revenue", Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
        </div>
        <div><label className="text-xs text-gray-500 block mb-1">Notes</label><textarea value={val("notes") ?? ""} onChange={e => set("notes", e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
        {Object.keys(edits).length > 0 && <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"><Save className="size-4" />{saving ? "Saving…" : "Save Changes"}</button>}
      </div>
    </div>
  );
}
