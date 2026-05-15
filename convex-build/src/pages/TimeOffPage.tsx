import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../contexts/AuthContext";
import { Clock, Plus, X, Check, XCircle } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["vacation","sick","personal","training","other"];

const statusColor: Record<string,string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
};

export function TimeOffPage() {
  const { user } = useAuth();
  const requests = (useQuery(api.timeoff.list) ?? []) as any[];
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: "", requestedDate: "", endDate: "", type: "vacation", reason: "", notes: "" });

  const create = useMutation(api.timeoff.create);
  const review = useMutation(api.timeoff.review);

  const isManager = user?.role === "manager";

  async function handleSubmit() {
    if (!form.employeeId || !form.requestedDate) { toast.error("Employee and date required"); return; }
    try {
      await create({ employeeId: form.employeeId as Id<"employees">, requestedDate: form.requestedDate, endDate: form.endDate || undefined, type: form.type, reason: form.reason || undefined, notes: form.notes || undefined });
      toast.success("Request submitted");
      setShowForm(false);
      setForm({ employeeId: "", requestedDate: "", endDate: "", type: "vacation", reason: "", notes: "" });
    } catch (e) { toast.error(String(e)); }
  }

  async function handleReview(id: Id<"timeOffRequests">, status: "approved" | "denied") {
    try {
      await review({ id, status, reviewedBy: user?.name ?? "Manager" });
      toast.success(`Request ${status}`);
    } catch (e) { toast.error(String(e)); }
  }

  const empMap = Object.fromEntries(employees.map((e: any) => [e._id, e.name]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Clock className="size-6" /> Time Off</h1><p className="text-sm text-gray-500">{requests.filter((r: any) => r.status === "pending").length} pending requests</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus className="size-4" /> New Request</button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Date(s)</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-center">Status</th>
              {isManager && <th className="px-4 py-3 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.map((r: any) => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{empMap[r.employeeId] ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{r.type}</td>
                <td className="px-4 py-3 text-gray-600">{r.requestedDate}{r.endDate ? ` → ${r.endDate}` : ""}</td>
                <td className="px-4 py-3 text-gray-500">{r.reason ?? "—"}</td>
                <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] ?? ""}`}>{r.status}</span></td>
                {isManager && (
                  <td className="px-4 py-3 text-center">
                    {r.status === "pending" && (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleReview(r._id, "approved")} className="text-green-600 hover:text-green-700"><Check className="size-4" /></button>
                        <button onClick={() => handleReview(r._id, "denied")} className="text-red-500 hover:text-red-700"><XCircle className="size-4" /></button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No requests</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">New Time Off Request</h2><button onClick={() => setShowForm(false)}><X className="size-5" /></button></div>
            <div><label className="text-xs font-medium text-gray-600">Employee *</label>
              <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.employeeId} onChange={e => setForm(f => ({...f, employeeId: e.target.value}))}>
                <option value="">Select employee</option>
                {employees.map((e: any) => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-600">Start Date *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.requestedDate} onChange={e => setForm(f => ({...f, requestedDate: e.target.value}))} /></div>
              <div><label className="text-xs font-medium text-gray-600">End Date</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.endDate} onChange={e => setForm(f => ({...f, endDate: e.target.value}))} /></div>
            </div>
            <div><label className="text-xs font-medium text-gray-600">Type</label>
              <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium text-gray-600">Reason</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} /></div>
            <div className="flex gap-2 pt-2"><button onClick={handleSubmit} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Submit</button><button onClick={() => setShowForm(false)} className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
