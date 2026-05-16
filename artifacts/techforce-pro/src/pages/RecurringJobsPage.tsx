import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ConvexRecurringSchedule, ConvexCustomer, ConvexEmployee } from "@/lib/convex-types";
import { RefreshCw, Plus, X, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

const SERVICE_TYPES = ["Kitchen Suppression","Sprinkler Inspection","Fire Extinguisher","Backflow Testing","Alarm Inspection"];
const INTERVALS = ["monthly","quarterly","biannual","annual","custom"] as const;
type IntervalType = typeof INTERVALS[number];

export function RecurringJobsPage() {
  const schedules = (useQuery(api.recurringSchedules.list) ?? []) as ConvexRecurringSchedule[];
  const customers = (useQuery(api.customers.list) ?? []) as ConvexCustomer[];
  const employees = (useQuery(api.employees.list) ?? []) as ConvexEmployee[];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerId: "", employeeId: "", serviceType: SERVICE_TYPES[0], intervalType: "quarterly", customDays: "", startDate: "", revenue: 0, notes: "" });

  const create = useMutation(api.recurringSchedules.create);
  const remove = useMutation(api.recurringSchedules.remove);
  const pause = useMutation(api.recurringSchedules.pause);
  const resume = useMutation(api.recurringSchedules.resume);

  async function handleCreate() {
    if (!form.customerId || !form.startDate) { toast.error("Customer and start date required"); return; }
    try {
      await create({ customerId: form.customerId as Id<"customers">, employeeId: form.employeeId ? form.employeeId as Id<"employees"> : undefined, serviceType: form.serviceType, intervalType: form.intervalType as IntervalType, customDays: form.customDays ? Number(form.customDays) : undefined, startDate: form.startDate, revenue: form.revenue, notes: form.notes || undefined });
      toast.success("Schedule created");
      setShowForm(false);
    } catch (e) { toast.error(String(e)); }
  }

  const custMap = Object.fromEntries(customers.map(c => [c._id, c.name]));
  const empMap = Object.fromEntries(employees.map(e => [e._id, e.name]));

  const statusColor: Record<string,string> = { active:"bg-green-100 text-green-700", paused:"bg-yellow-100 text-yellow-700", completed:"bg-gray-100 text-gray-600" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><RefreshCw className="size-6" /> Recurring Schedules</h1><p className="text-sm text-gray-500">{schedules.filter(s => s.status === "active").length} active</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus className="size-4" /> New Schedule</button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Service</th>
              <th className="px-4 py-3 text-left">Interval</th>
              <th className="px-4 py-3 text-left">Next</th>
              <th className="px-4 py-3 text-left">Technician</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {schedules.map(s => (
              <tr key={s._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{custMap[s.customerId] ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{s.serviceType}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{s.intervalType}{s.customDays ? ` (${s.customDays}d)` : ""}</td>
                <td className="px-4 py-3 text-gray-600">{s.nextOccurrence}</td>
                <td className="px-4 py-3 text-gray-500">{s.employeeId ? empMap[s.employeeId] ?? "—" : "Unassigned"}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(s.revenue)}</td>
                <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[s.status] ?? ""}`}>{s.status}</span></td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {s.status === "active" ? <button onClick={() => pause({ id: s._id })} className="text-gray-400 hover:text-amber-500"><Pause className="size-4" /></button> : <button onClick={() => resume({ id: s._id })} className="text-gray-400 hover:text-green-500"><Play className="size-4" /></button>}
                    <button onClick={() => { if(confirm("Delete schedule?")) remove({ id: s._id }); }} className="text-gray-400 hover:text-red-500"><X className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No recurring schedules</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">New Recurring Schedule</h2><button onClick={() => setShowForm(false)}><X className="size-5" /></button></div>
            <div><label className="text-xs font-medium text-gray-600">Customer *</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.customerId} onChange={e => setForm(f => ({...f, customerId: e.target.value}))}><option value="">Select customer</option>{customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600">Technician</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.employeeId} onChange={e => setForm(f => ({...f, employeeId: e.target.value}))}><option value="">Unassigned</option>{employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600">Service Type</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.serviceType} onChange={e => setForm(f => ({...f, serviceType: e.target.value}))}>{SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-600">Interval</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.intervalType} onChange={e => setForm(f => ({...f, intervalType: e.target.value}))}>{INTERVALS.map(i => <option key={i}>{i}</option>)}</select></div>
              {form.intervalType === "custom" && <div><label className="text-xs font-medium text-gray-600">Days</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.customDays} onChange={e => setForm(f => ({...f, customDays: e.target.value}))} /></div>}
              <div><label className="text-xs font-medium text-gray-600">Start Date *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.startDate} onChange={e => setForm(f => ({...f, startDate: e.target.value}))} /></div>
              <div><label className="text-xs font-medium text-gray-600">Revenue ($)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.revenue} onChange={e => setForm(f => ({...f, revenue: Number(e.target.value)}))} /></div>
            </div>
            <div className="flex gap-2 pt-2"><button onClick={handleCreate} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Create</button><button onClick={() => setShowForm(false)} className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
