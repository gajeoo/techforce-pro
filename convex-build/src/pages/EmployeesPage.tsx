import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Award, Calendar, ChevronDown, ChevronUp, DollarSign,
  Pencil, Plus, Trash2, TrendingUp, Users, Wrench, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, roleLabel, initials, formatCurrency } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

const ROLES = [
  { value: "suppression_lead",  label: "Suppression Lead" },
  { value: "sprinkler_tech",    label: "Sprinkler Tech" },
  { value: "extinguisher_tech", label: "Extinguisher Tech" },
  { value: "helper",            label: "Helper / Apprentice" },
  { value: "admin",             label: "Admin" },
];
const CERTS = ["suppression", "sprinkler", "extinguisher", "standpipe", "exit_lights", "alarm"];

type Emp = {
  _id: Id<"employees">;
  name: string; role: string; salary: number; billableRate: number;
  homeZip: string; certifications: string[]; allowedShopDays: number;
  shopDaysUsedYtd: number; allowedTrainingDays: number; trainingDaysUsedYtd: number;
  utilizationPct: number; isActive: boolean;
};

const BLANK = {
  name: "", role: "extinguisher_tech", salary: 55000, billableRate: 900,
  homeZip: "21046", certifications: [] as string[], allowedShopDays: 5,
  shopDaysUsedYtd: 0, allowedTrainingDays: 3, trainingDaysUsedYtd: 0,
  utilizationPct: 85, isActive: true,
};

function toHourly(salary: number) { return (salary / 2080).toFixed(2); }

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={cn("h-2 rounded-full transition-all bg-red-600", className)} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function EmployeeModal({
  editing, form, setForm, saving, onSave, onClose,
}: {
  editing: Emp | null;
  form: typeof BLANK;
  setForm: React.Dispatch<React.SetStateAction<typeof BLANK>>;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const toggleCert = (c: string) =>
    setForm(f => ({ ...f, certifications: f.certifications.includes(c) ? f.certifications.filter(x => x !== c) : [...f.certifications, c] }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{editing ? "Edit Employee" : "Add Employee"}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="size-5 text-gray-500" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="John Smith" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Home Zip</label>
              <input value={form.homeZip} onChange={e => setForm(f => ({ ...f, homeZip: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="21046" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Role *</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Annual Salary ($)</label>
              <input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Bill Rate ($/day)</label>
              <input type="number" value={form.billableRate} onChange={e => setForm(f => ({ ...f, billableRate: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Shop Days Allowed/yr</label>
              <input type="number" value={form.allowedShopDays} onChange={e => setForm(f => ({ ...f, allowedShopDays: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Shop Days Used YTD</label>
              <input type="number" value={form.shopDaysUsedYtd} onChange={e => setForm(f => ({ ...f, shopDaysUsedYtd: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Training Days Allowed</label>
              <input type="number" value={form.allowedTrainingDays} onChange={e => setForm(f => ({ ...f, allowedTrainingDays: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Utilization %</label>
              <input type="number" value={form.utilizationPct} onChange={e => setForm(f => ({ ...f, utilizationPct: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Certifications</label>
            <div className="flex flex-wrap gap-2">
              {CERTS.map(c => (
                <button
                  key={c} type="button" onClick={() => toggleCert(c)}
                  className={cn("px-2.5 py-1 rounded-lg text-xs border transition-colors font-medium",
                    form.certifications.includes(c)
                      ? "bg-red-600 text-white border-red-600"
                      : "border-gray-300 text-gray-600 hover:border-red-400"
                  )}
                >{c}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
            Active employee
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.name} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmployeesPage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const employees = (useQuery(api.employees.list) ?? []) as Emp[];
  const createEmployee = useMutation(api.employees.create);
  const updateEmployee = useMutation(api.employees.update);
  const deleteEmployee = useMutation(api.employees.remove);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Emp | null>(null);
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK });
  const [deleteTarget, setDeleteTarget] = useState<Emp | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showHourly, setShowHourly] = useState(false);

  const active = employees.filter(e => e.isActive);
  const avgUtil = active.length > 0
    ? Math.round(active.reduce((s, e) => s + e.utilizationPct, 0) / active.length) : 0;

  function openAdd() { setForm({ ...BLANK }); setEditing(null); setShowForm(true); }
  function openEdit(e: Emp) {
    setForm({ name: e.name, role: e.role, salary: e.salary, billableRate: e.billableRate, homeZip: e.homeZip, certifications: [...e.certifications], allowedShopDays: e.allowedShopDays, shopDaysUsedYtd: e.shopDaysUsedYtd, allowedTrainingDays: e.allowedTrainingDays, trainingDaysUsedYtd: e.trainingDaysUsedYtd, utilizationPct: e.utilizationPct, isActive: e.isActive });
    setEditing(e); setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        await updateEmployee({ id: editing._id, ...form });
        toast.success("Employee updated");
      } else {
        await createEmployee(form);
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
      await deleteEmployee({ id: deleteTarget._id });
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
            <Users className="size-6 text-red-600 shrink-0" /> Employees
          </h1>
          <p className="text-gray-500 mt-1 text-sm">{active.length} active technicians · Multicorp Fire Protection Services</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isManager && (
            <div className="flex items-center gap-2 text-xs text-gray-500 border rounded-lg px-3 py-1.5 bg-gray-50">
              <span className={!showHourly ? "font-bold text-gray-900" : ""}>Salary</span>
              <button
                role="switch"
                aria-checked={showHourly}
                onClick={() => setShowHourly(v => !v)}
                className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", showHourly ? "bg-red-600" : "bg-gray-300")}
              >
                <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform", showHourly ? "translate-x-4" : "translate-x-0.5")} />
              </button>
              <span className={showHourly ? "font-bold text-gray-900" : ""}>Hourly</span>
            </div>
          )}
          {isManager && (
            <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium">
              <Plus className="size-3.5" /> Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Techs</span>
            <Award className="size-4 text-red-600" />
          </div>
          <div className="text-xl font-extrabold">{active.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Utilization</span>
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold">{avgUtil}%</div>
        </div>
        {isManager && (
          <>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {showHourly ? "Avg Hourly" : "Total Salary"}
                </span>
                <DollarSign className="size-4 text-emerald-600" />
              </div>
              <div className="text-xl font-extrabold">
                {showHourly
                  ? `$${active.length > 0 ? (active.reduce((s, e) => s + e.salary / 2080, 0) / active.length).toFixed(2) : "—"}/hr`
                  : `$${(active.reduce((s, e) => s + e.salary, 0) / 1000).toFixed(0)}K`}
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop Days Used</span>
                <Calendar className="size-4 text-blue-600" />
              </div>
              <div className="text-xl font-extrabold">{active.reduce((s, e) => s + e.shopDaysUsedYtd, 0)}</div>
            </div>
          </>
        )}
      </div>

      {/* Employee Cards */}
      {employees.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400 text-sm">
          No employees yet — load demo data from Data Management
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map(emp => {
            const isExpanded = expandedId === emp._id;
            const shopPct = emp.allowedShopDays > 0 ? (emp.shopDaysUsedYtd / emp.allowedShopDays) * 100 : 0;
            const utilColor = emp.utilizationPct >= 90 ? "text-emerald-600" : emp.utilizationPct >= 85 ? "text-amber-600" : "text-red-600";

            return (
              <div key={emp._id} className="bg-white rounded-xl border hover:shadow-md transition-shadow overflow-hidden">
                <div className={cn("h-1", emp.utilizationPct >= 90 ? "bg-emerald-500" : emp.utilizationPct >= 85 ? "bg-amber-500" : "bg-red-500")} />
                <div className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-700">
                        {initials(emp.name)}
                      </div>
                      <div>
                        <div className="text-base font-bold text-gray-900">{emp.name}</div>
                        <div className="text-xs text-gray-500">{roleLabel(emp.role)}</div>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block",
                          emp.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        )}>{emp.isActive ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                    {isManager && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openEdit(emp)} className="flex items-center gap-0.5 px-2 py-1 text-[10px] text-gray-500 hover:text-red-600 rounded transition-colors">
                          <Pencil className="size-3" /> Edit
                        </button>
                        <button onClick={() => setDeleteTarget(emp)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-4 space-y-4">
                  {/* Certifications */}
                  <div className="flex flex-wrap gap-1.5">
                    {emp.certifications.map(cert => (
                      <span key={cert} className="text-[10px] px-2 py-0.5 rounded-full border border-red-200 text-red-700 font-medium capitalize">
                        {cert.replace(/_/g, " ")}
                      </span>
                    ))}
                    {emp.certifications.length === 0 && (
                      <span className="text-[10px] text-gray-400">No certs on file</span>
                    )}
                  </div>

                  {/* Finance stats — managers only */}
                  {isManager && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-emerald-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-emerald-600 font-medium">Hourly Rate</div>
                        <div className="text-sm font-extrabold text-emerald-700">${toHourly(emp.salary)}/hr</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-blue-600 font-medium">Shop Days</div>
                        <div className="text-sm font-extrabold text-blue-700">{emp.shopDaysUsedYtd}/{emp.allowedShopDays}</div>
                      </div>
                      <div className="bg-gray-100 rounded-lg p-2.5">
                        {showHourly ? (
                          <>
                            <div className="text-[10px] text-gray-500 font-medium">Hourly</div>
                            <div className="text-sm font-extrabold">${toHourly(emp.salary)}/hr</div>
                          </>
                        ) : (
                          <>
                            <div className="text-[10px] text-gray-500 font-medium">Salary</div>
                            <div className="text-sm font-extrabold">{formatCurrency(emp.salary)}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Utilization bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-gray-500">Utilization</span>
                      <span className={cn("font-bold", utilColor)}>{emp.utilizationPct.toFixed(1)}%</span>
                    </div>
                    <Bar value={emp.utilizationPct} />
                  </div>

                  {/* Day Allocations — collapsible */}
                  <div>
                    <button
                      className="flex items-center gap-1.5 text-xs font-semibold text-red-600 w-full justify-between hover:underline"
                      onClick={() => setExpandedId(isExpanded ? null : emp._id)}
                    >
                      <span className="flex items-center gap-1"><Wrench className="size-3" /> Day Allocations</span>
                      {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500">Shop Days Used</span>
                            <span className="font-semibold">{emp.shopDaysUsedYtd} / {emp.allowedShopDays} days</span>
                          </div>
                          <Bar value={Math.min(shopPct, 100)} />
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {emp.allowedShopDays - emp.shopDaysUsedYtd > 0
                              ? `${emp.allowedShopDays - emp.shopDaysUsedYtd} remaining`
                              : "All shop days used this year"}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500">Training Days</span>
                            <span className="font-semibold">{emp.trainingDaysUsedYtd} / {emp.allowedTrainingDays} used</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(emp.allowedTrainingDays > 0 ? (emp.trainingDaysUsedYtd / emp.allowedTrainingDays) * 100 : 0, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {isManager && (
                    <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t">
                      <span>Zip: {emp.homeZip}</span>
                      <span className="text-red-600 font-medium">Billable: ${emp.billableRate}/day</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <EmployeeModal
          editing={editing}
          form={form}
          setForm={setForm}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2 text-red-700">
              <Trash2 className="size-5" /> Remove Employee
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to permanently remove <strong>{deleteTarget.name}</strong>? This will also remove their associated jobs and records.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? "Removing…" : "Remove Employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
