import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  AlertCircle, Building2, ChevronDown, ChevronRight, ChevronUp,
  DollarSign, MapPin, Pencil, Plus, Search, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

const FACILITY_TYPES = [
  { value: "restaurant",  label: "Restaurant" },
  { value: "school",      label: "School" },
  { value: "commercial",  label: "Commercial" },
  { value: "condo",       label: "Condo" },
  { value: "government",  label: "Government" },
  { value: "group_home",  label: "Group Home" },
  { value: "fleet",       label: "Fleet Depot" },
  { value: "retail",      label: "Retail" },
  { value: "office",      label: "Office" },
  { value: "industrial",  label: "Industrial" },
  { value: "hospital",    label: "Hospital" },
  { value: "warehouse",   label: "Warehouse" },
  { value: "church",      label: "Church" },
  { value: "other",       label: "Other" },
];

const TYPE_COLORS: Record<string, string> = {
  restaurant: "bg-orange-100 text-orange-700",
  school:     "bg-blue-100 text-blue-700",
  commercial: "bg-slate-100 text-slate-700",
  group_home: "bg-purple-100 text-purple-700",
  condo:      "bg-cyan-100 text-cyan-700",
  government: "bg-green-100 text-green-700",
  fleet:      "bg-yellow-100 text-yellow-700",
};

function facilityLabel(type: string) {
  return FACILITY_TYPES.find(f => f.value === type)?.label
    ?? type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

type Customer = {
  _id: Id<"customers">;
  name: string; facilityType: string; address: string;
  contactName: string; contactPhone: string; contactEmail?: string;
  inspectionFrequency: string; isActive: boolean;
};

const BLANK = {
  name: "", facilityType: "commercial", address: "", contactName: "",
  contactPhone: "", contactEmail: "", inspectionFrequency: "annual", isActive: true,
};

function CustomerLocations({ customerId }: { customerId: Id<"customers"> }) {
  const locations = (useQuery(api.customers.listLocations, { customerId }) ?? []) as any[];
  return (
    <div className="border-t bg-gray-50 px-5 py-3">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
        Service Locations ({locations.length})
      </p>
      <div className="space-y-1">
        {locations.map((loc: any) => (
          <div key={loc._id} className="flex items-center gap-2 text-sm">
            <MapPin className="size-3 text-gray-400 shrink-0" />
            <span className="font-medium">{loc.name}</span>
            <span className="text-gray-400">—</span>
            <span className="text-gray-500 text-xs">{loc.address}</span>
            {loc.isPrimary && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded">Primary</span>}
          </div>
        ))}
        {locations.length === 0 && <p className="text-xs text-gray-400">No locations on file</p>}
      </div>
    </div>
  );
}

export function CustomersPage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const customers = (useQuery(api.customers.list) ?? []) as Customer[];
  const createCustomer = useMutation(api.customers.create);
  const updateCustomer = useMutation(api.customers.update);
  const deleteCustomer = useMutation(api.customers.remove);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.facilityType.toLowerCase().includes(search.toLowerCase()) ||
    c.contactName.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = customers.filter(c => c.isActive).length;

  function openAdd() {
    setForm({ ...BLANK }); setEditing(null); setShowForm(true);
  }
  function openEdit(c: Customer) {
    setForm({ name: c.name, facilityType: c.facilityType, address: c.address, contactName: c.contactName, contactPhone: c.contactPhone, contactEmail: c.contactEmail ?? "", inspectionFrequency: c.inspectionFrequency, isActive: c.isActive });
    setEditing(c); setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.address.trim() || !form.contactName.trim()) {
      toast.error("Name, address, and contact name are required"); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, contactEmail: form.contactEmail || undefined };
      if (editing) {
        await updateCustomer({ id: editing._id, ...payload });
        toast.success("Customer updated");
      } else {
        await createCustomer(payload);
        toast.success(`${form.name} added`);
      }
      setShowForm(false);
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomer({ id: deleteTarget._id });
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
    } catch (e) { toast.error(String(e)); }
    finally { setDeleting(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="size-6 text-red-600 shrink-0" /> Customers
          </h1>
          <p className="text-gray-500 mt-1 text-sm">{customers.length} clients · manage accounts and service locations</p>
        </div>
        {isManager && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium self-start sm:self-auto"
          >
            <Plus className="size-3.5" /> Add Customer
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-3">
        <div className="bg-white rounded-xl border p-4 text-center">
          <Building2 className="size-4 text-red-600 mx-auto mb-1" />
          <div className="text-xl font-extrabold">{customers.length}</div>
          <div className="text-xs text-gray-500">Total Clients</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <DollarSign className="size-4 text-emerald-600 mx-auto mb-1" />
          <div className="text-xl font-extrabold text-emerald-700">{activeCount}</div>
          <div className="text-xs text-gray-500">Active</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <AlertCircle className="size-4 text-amber-600 mx-auto mb-1" />
          <div className="text-xl font-extrabold text-amber-600">{customers.length - activeCount}</div>
          <div className="text-xs text-gray-500">Inactive</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-gray-400" />
        <input
          placeholder="Search customers…"
          className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3.5 border-b">
          <span className="text-sm font-semibold text-gray-700">Customer Directory</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                {["Customer", "Type", "Contact", "Phone", "Address", "Frequency", "Status", ""].map(h => (
                  <th key={h} className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-400">No customers — load demo data from Data Management</td></tr>
              )}
              {filtered.map(cust => (
                <tr key={cust._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-semibold text-gray-900">{cust.name}</td>
                  <td className="py-3 px-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", TYPE_COLORS[cust.facilityType] ?? "bg-gray-100 text-gray-700")}>
                      {facilityLabel(cust.facilityType)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500">{cust.contactName}</td>
                  <td className="py-3 px-3 text-xs text-gray-500">{cust.contactPhone}</td>
                  <td className="py-3 px-3 text-xs text-gray-500 max-w-[180px] truncate">
                    <span className="flex items-center gap-1"><MapPin className="size-3 shrink-0" />{cust.address}</span>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500 capitalize">{cust.inspectionFrequency}</td>
                  <td className="py-3 px-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", cust.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                      {cust.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 justify-end">
                      {isManager && (
                        <>
                          <button onClick={() => openEdit(cust)} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
                            <Pencil className="size-3.5 text-gray-500" />
                          </button>
                          <button onClick={() => setDeleteTarget(cust)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                            <Trash2 className="size-3.5 text-red-500" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setExpanded(expanded === cust._id ? null : cust._id)}
                        className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        <ChevronRight className={cn("size-4 text-gray-400 transition-transform", expanded === cust._id && "rotate-90")} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && customers.length > 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-400">No customers match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Expanded locations — shown inline below row */}
        {expanded && (() => {
          const cust = customers.find(c => c._id === expanded);
          return cust ? <CustomerLocations customerId={cust._id} /> : null;
        })()}
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {customers.length === 0 && (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400 text-sm">No customers — load demo data</div>
        )}
        {filtered.map(cust => (
          <div key={cust._id} className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900">{cust.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", TYPE_COLORS[cust.facilityType] ?? "bg-gray-100 text-gray-700")}>
                      {facilityLabel(cust.facilityType)}
                    </span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", cust.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                      {cust.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isManager && (
                    <>
                      <button onClick={() => openEdit(cust)} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
                        <Pencil className="size-3.5 text-gray-500" />
                      </button>
                      <button onClick={() => setDeleteTarget(cust)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                        <Trash2 className="size-3.5 text-red-500" />
                      </button>
                    </>
                  )}
                  <button onClick={() => setExpanded(expanded === cust._id ? null : cust._id)} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
                    {expanded === cust._id ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-1">{cust.contactName} · {cust.contactPhone}</div>
              <div className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="size-3 shrink-0" /> {cust.address}</div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t text-[11px] text-gray-400">
                <span>Frequency: {cust.inspectionFrequency}</span>
                {cust.contactEmail && <span>{cust.contactEmail}</span>}
              </div>
            </div>
            {expanded === cust._id && <CustomerLocations customerId={cust._id} />}
          </div>
        ))}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editing ? "Edit Customer" : "Add New Customer"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100"><X className="size-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Company Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="Acme Corp" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Facility Type</label>
                  <select value={form.facilityType} onChange={e => setForm(f => ({ ...f, facilityType: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {FACILITY_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Contact Name *</label>
                  <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="John Smith" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Phone</label>
                  <input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="(410) 555-0000" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Primary Address *</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="123 Main St, Columbia, MD 21044" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                  <input value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="contact@example.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Inspection Frequency</label>
                  <select value={form.inspectionFrequency} onChange={e => setForm(f => ({ ...f, inspectionFrequency: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {["annual", "semi-annual", "quarterly", "monthly"].map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                Active account
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2 text-red-700">
              <Trash2 className="size-5" /> Remove Customer
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to permanently remove <strong>{deleteTarget.name}</strong>? This will also remove their locations and associated records.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? "Removing…" : "Remove Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
