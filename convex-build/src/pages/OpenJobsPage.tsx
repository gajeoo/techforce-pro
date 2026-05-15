import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ListTodo, Plus, Zap, X } from "lucide-react";
import { toast } from "sonner";

const CERTS = ["suppression","sprinkler","extinguisher","helper","admin"];
const PRIORITIES = ["low","medium","high","urgent"];

export function OpenJobsPage() {
  const openJobs = (useQuery(api.openJobs.list) ?? []) as any[];
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", clientName: "", clientAddress: "", zipCode: "", certRequired: "suppression", priority: "medium", notes: "" });

  const createJob = useMutation(api.openJobs.create);
  const removeJob = useMutation(api.openJobs.remove);
  const autoAssign = useMutation(api.openJobs.autoAssign);
  const fillShopDays = useMutation(api.openJobs.fillShopDays);

  async function handleCreate() {
    if (!form.title || !form.clientName) { toast.error("Title and client required"); return; }
    try {
      await createJob({ title: form.title, clientName: form.clientName, clientAddress: form.clientAddress || undefined, zipCode: form.zipCode || undefined, certRequired: form.certRequired, priority: form.priority as any, notes: form.notes || undefined });
      toast.success("Open job added");
      setShowForm(false);
      setForm({ title: "", clientName: "", clientAddress: "", zipCode: "", certRequired: "suppression", priority: "medium", notes: "" });
    } catch (e) { toast.error(String(e)); }
  }

  async function handleAutoAssign() {
    try {
      const r = await autoAssign({});
      toast.success(`Auto-assigned ${(r as any).assigned} jobs`);
    } catch (e) { toast.error(String(e)); }
  }

  async function handleFillShopDays() {
    try {
      const r = await fillShopDays({});
      toast.success(`Filled ${(r as any).assigned} shop day slots`);
    } catch (e) { toast.error(String(e)); }
  }

  const priorityColor: Record<string,string> = { urgent: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-gray-100 text-gray-600" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><ListTodo className="size-6" /> Open Jobs</h1><p className="text-sm text-gray-500">{openJobs.length} unscheduled</p></div>
        <div className="flex items-center gap-2">
          <button onClick={handleFillShopDays} className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm hover:bg-gray-50"><Zap className="size-4 text-amber-500" /> Fill Shop Days</button>
          <button onClick={handleAutoAssign} className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm hover:bg-gray-50"><Zap className="size-4 text-blue-500" /> Auto-Assign</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus className="size-4" /> Add Job</button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {openJobs.map((job: any) => {
          const emp = employees.find((e: any) => e._id === job.assignedEmployeeId);
          return (
            <div key={job._id} className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{job.title}</p>
                  <p className="text-xs text-gray-500">{job.clientName}</p>
                </div>
                <button onClick={() => removeJob({ id: job._id })} className="text-gray-400 hover:text-red-500"><X className="size-4" /></button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor[job.priority] ?? ""}`}>{job.priority}</span>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{job.certRequired}</span>
              </div>
              {emp && <p className="text-xs text-gray-600">Assigned: <span className="font-medium">{emp.name}</span></p>}
              {job.notes && <p className="text-xs text-gray-500 italic">{job.notes}</p>}
            </div>
          );
        })}
        {openJobs.length === 0 && <p className="text-gray-400 text-sm col-span-3 text-center py-12">No open jobs</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">New Open Job</h2><button onClick={() => setShowForm(false)}><X className="size-5" /></button></div>
            {[["title","Title *"],["clientName","Client Name *"],["clientAddress","Client Address"],["zipCode","ZIP Code"]].map(([k,l]) => (
              <div key={k}><label className="text-xs font-medium text-gray-600">{l}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={(form as any)[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} /></div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-600">Cert Required</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.certRequired} onChange={e => setForm(f => ({...f, certRequired: e.target.value}))}>{CERTS.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs font-medium text-gray-600">Priority</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
            </div>
            <div><label className="text-xs font-medium text-gray-600">Notes</label><textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
            <div className="flex gap-2 pt-2"><button onClick={handleCreate} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Create</button><button onClick={() => setShowForm(false)} className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
