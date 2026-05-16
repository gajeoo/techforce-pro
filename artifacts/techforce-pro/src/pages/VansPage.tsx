import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Truck, Plus, X, MapPin } from "lucide-react";
import { toast } from "sonner";

function statusColor(van: any) {
  if (!van.gpsTrackerId) return "bg-gray-100 text-gray-500";
  if (van.speed > 5) return "bg-blue-100 text-blue-700";
  if (van.speed > 0) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}
function statusLabel(van: any) {
  if (!van.gpsTrackerId) return "No tracker";
  if (van.speed > 5) return `Moving ${van.speed} mph`;
  if (van.speed > 0) return "Idle";
  return "Parked";
}

export function VansPage() {
  const vans = (useQuery(api.vans.list) ?? []) as any[];
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", licensePlate: "", make: "Ford", model: "Transit", year: 2022, color: "White", assignedEmployeeId: "", notes: "" });

  const createVan = useMutation(api.vans.create);
  const removeVan = useMutation(api.vans.remove);
  const pollLocations = useMutation(api.vans.locations);

  useEffect(() => {
    const id = setInterval(() => pollLocations({}), 5000);
    return () => clearInterval(id);
  }, [pollLocations]);

  async function handleCreate() {
    if (!form.name || !form.licensePlate) { toast.error("Name and plate required"); return; }
    try {
      await createVan({ name: form.name, licensePlate: form.licensePlate, make: form.make, model: form.model, year: form.year, color: form.color, assignedEmployeeId: form.assignedEmployeeId ? form.assignedEmployeeId as Id<"employees"> : undefined, notes: form.notes || undefined });
      toast.success("Van added");
      setShowForm(false);
    } catch (e) { toast.error(String(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="size-6" /> Fleet / GPS</h1><p className="text-sm text-gray-500">{vans.length} vehicles · polling every 5s</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus className="size-4" /> Add Van</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vans.map((van: any) => (
          <div key={van._id} className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{van.name}</p>
                <p className="text-xs text-gray-500">{van.year} {van.make} {van.model} · {van.licensePlate}</p>
              </div>
              <button onClick={() => { if (confirm("Remove this van?")) removeVan({ id: van._id }); }} className="text-gray-400 hover:text-red-500"><X className="size-4" /></button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(van)}`}>{statusLabel(van)}</span>
              {van.color && <span className="text-xs text-gray-500">{van.color}</span>}
            </div>
            {van.assignedEmployeeName && <p className="text-xs text-gray-600">Driver: <span className="font-medium">{van.assignedEmployeeName}</span></p>}
            {van.lat && van.lng && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="size-3" />
                {van.lat.toFixed(4)}, {van.lng.toFixed(4)}
              </div>
            )}
            {van.gpsTrackerId && <p className="text-xs text-green-600">GPS: {van.gpsTrackerSerial ?? van.gpsTrackerId}</p>}
          </div>
        ))}
        {vans.length === 0 && <p className="text-gray-400 text-sm col-span-3 text-center py-12">No vans in fleet</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Add Van</h2><button onClick={() => setShowForm(false)}><X className="size-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              {([["name","Van Name *"],["licensePlate","License Plate *"],["make","Make"],["model","Model"],["color","Color"]] as [string,string][]).map(([k,l]) => (
                <div key={k} className={k === "name" || k === "licensePlate" ? "col-span-2" : ""}><label className="text-xs font-medium text-gray-600">{l}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={(form as any)[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} /></div>
              ))}
              <div><label className="text-xs font-medium text-gray-600">Year</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.year} onChange={e => setForm(f => ({...f, year: Number(e.target.value)}))} /></div>
              <div><label className="text-xs font-medium text-gray-600">Assigned Driver</label>
                <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.assignedEmployeeId} onChange={e => setForm(f => ({...f, assignedEmployeeId: e.target.value}))}>
                  <option value="">Unassigned</option>
                  {employees.map((e: any) => <option key={e._id} value={e._id}>{e.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2"><button onClick={handleCreate} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Add Van</button><button onClick={() => setShowForm(false)} className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
