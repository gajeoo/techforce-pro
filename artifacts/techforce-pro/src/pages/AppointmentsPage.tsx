import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarDays, Plus, X } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["meeting","inspection","training","site_visit","other"];

export function AppointmentsPage() {
  const { user } = useAuth();
  const appointments = (useQuery(api.appointments.list) ?? []) as any[];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", date: "", startTime: "09:00", endTime: "", type: "meeting", participants: "", location: "", notes: "" });

  const create = useMutation(api.appointments.create);
  const remove = useMutation(api.appointments.remove);

  async function handleCreate() {
    if (!form.title || !form.date || !form.startTime) { toast.error("Title, date, and start time required"); return; }
    try {
      await create({ ...form, endTime: form.endTime || undefined, description: form.description || undefined, participants: form.participants || undefined, location: form.location || undefined, notes: form.notes || undefined, createdBy: user?.name ?? "Unknown", calendarOwner: user?.name ?? "manager" });
      toast.success("Appointment added");
      setShowForm(false);
      setForm({ title: "", description: "", date: "", startTime: "09:00", endTime: "", type: "meeting", participants: "", location: "", notes: "" });
    } catch (e) { toast.error(String(e)); }
  }

  const today = new Date().toISOString().slice(0,10);
  const upcoming = [...appointments].filter((a: any) => a.date >= today).sort((a: any, b: any) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const past = [...appointments].filter((a: any) => a.date < today).sort((a: any, b: any) => b.date.localeCompare(a.date));

  const typeColor: Record<string,string> = { meeting:"bg-blue-100 text-blue-700", inspection:"bg-orange-100 text-orange-700", training:"bg-purple-100 text-purple-700", site_visit:"bg-green-100 text-green-700", other:"bg-gray-100 text-gray-600" };

  function ApptCard({ appt }: { appt: any }) {
    return (
      <div className="bg-white rounded-xl border p-4 flex items-start gap-4">
        <div className="shrink-0 text-center bg-gray-50 rounded-lg px-3 py-2 min-w-[56px]">
          <p className="text-xs text-gray-500">{appt.date.slice(5)}</p>
          <p className="text-sm font-bold">{appt.startTime}</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm">{appt.title}</p>
            <button onClick={() => remove({ id: appt._id })} className="text-gray-300 hover:text-red-500 shrink-0"><X className="size-4" /></button>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[appt.type] ?? ""}`}>{appt.type.replace("_"," ")}</span>
            {appt.location && <span className="text-xs text-gray-500">📍 {appt.location}</span>}
            {appt.endTime && <span className="text-xs text-gray-500">{appt.startTime}–{appt.endTime}</span>}
          </div>
          {appt.participants && <p className="text-xs text-gray-500 mt-1">With: {appt.participants}</p>}
          {appt.description && <p className="text-xs text-gray-400 mt-1">{appt.description}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><CalendarDays className="size-6" /> Appointments</h1><p className="text-sm text-gray-500">{upcoming.length} upcoming</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus className="size-4" /> Add</button>
      </div>

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Upcoming</h2>
          {upcoming.map((a: any) => <ApptCard key={a._id} appt={a} />)}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Past</h2>
          {past.slice(0,5).map((a: any) => <ApptCard key={a._id} appt={a} />)}
        </div>
      )}

      {appointments.length === 0 && <p className="text-gray-400 text-sm text-center py-12">No appointments yet</p>}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">New Appointment</h2><button onClick={() => setShowForm(false)}><X className="size-5" /></button></div>
            <div><label className="text-xs font-medium text-gray-600">Title *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3"><label className="text-xs font-medium text-gray-600">Date *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} /></div>
              <div><label className="text-xs font-medium text-gray-600">Start *</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} /></div>
              <div><label className="text-xs font-medium text-gray-600">End</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} /></div>
              <div><label className="text-xs font-medium text-gray-600">Type</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            </div>
            <div><label className="text-xs font-medium text-gray-600">Location</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} /></div>
            <div><label className="text-xs font-medium text-gray-600">Participants</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.participants} onChange={e => setForm(f => ({...f, participants: e.target.value}))} /></div>
            <div><label className="text-xs font-medium text-gray-600">Description</label><textarea rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
            <div className="flex gap-2 pt-2"><button onClick={handleCreate} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Save</button><button onClick={() => setShowForm(false)} className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
