import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Award, Calendar, ChevronDown, ChevronUp,
  DollarSign, Pencil, Plus, Trash2, TrendingUp, Users, Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee, roleLabel, initials,
  type ApiEmployee,
} from "@/lib/api";
import { DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLES = [
  { value: "suppression_lead", label: "Suppression Lead" },
  { value: "sprinkler_tech", label: "Sprinkler Tech" },
  { value: "extinguisher_tech", label: "Extinguisher Tech" },
  { value: "helper", label: "Helper / Apprentice" },
  { value: "admin", label: "Admin" },
];

// Hourly = annual salary / 2080 work hours per year
function toHourly(salary: number): string {
  return (salary / 2080).toFixed(2);
}

// ─── Extra Day Types (localStorage) ──────────────────────────────────────────

const EXTRA_DAYS_KEY = "tfpro_employee_extra_days";

type ExtraDays = { trainingDays: number; maintenanceDays: number };

function loadExtraDays(): Record<number, ExtraDays> {
  try {
    return JSON.parse(localStorage.getItem(EXTRA_DAYS_KEY) ?? "{}") as Record<number, ExtraDays>;
  } catch { return {}; }
}

function saveExtraDays(data: Record<number, ExtraDays>) {
  localStorage.setItem(EXTRA_DAYS_KEY, JSON.stringify(data));
}

function getExtra(empId: number): ExtraDays {
  return loadExtraDays()[empId] ?? { trainingDays: 0, maintenanceDays: 0 };
}

// ─── Edit Employee Dialog ─────────────────────────────────────────────────────

function EditEmployeeDialog({
  emp, onSave, onClose,
}: {
  emp: ApiEmployee;
  onSave: (updated: ApiEmployee) => void;
  onClose: () => void;
}) {
  const extra = getExtra(emp.id);
  const [form, setForm] = useState({
    name: emp.name,
    role: emp.role,
    certs: emp.certifications.join(", "),
    salary: String(emp.salary),
    billRate: String(emp.billableRate),
    homeZip: emp.homeZip ?? "",
    shopDaysAllowed: String(emp.allowedShopDays),
    trainingDays: String(extra.trainingDays),
    maintenanceDays: String(extra.maintenanceDays),
  });
  const [saving, setSaving] = useState(false);

  function setField(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateEmployee(emp.id, {
        name: form.name.trim() || emp.name,
        role: form.role || emp.role,
        certifications: form.certs.split(",").map(c => c.trim()).filter(Boolean),
        salary: Number(form.salary) || emp.salary,
        billableRate: Number(form.billRate) || emp.billableRate,
        homeZip: form.homeZip.trim() || emp.homeZip,
        allowedShopDays: Number(form.shopDaysAllowed) || emp.allowedShopDays,
      });
      // Save training/maintenance days to localStorage
      const all = loadExtraDays();
      all[emp.id] = {
        trainingDays: Math.max(0, Number(form.trainingDays) || 0),
        maintenanceDays: Math.max(0, Number(form.maintenanceDays) || 0),
      };
      saveExtraDays(all);
      onSave(updated);
      toast.success("Employee updated");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" /> Edit Employee — {emp.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Full Name</Label>
              <Input value={form.name} onChange={e => setField("name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Home Zip</Label>
              <Input value={form.homeZip} onChange={e => setField("homeZip", e.target.value)} placeholder="21046" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={form.role} onValueChange={v => setField("role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Certifications (comma-separated)</Label>
            <Input value={form.certs} onChange={e => setField("certs", e.target.value)} placeholder="suppression, extinguisher" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Annual Salary ($)</Label>
              <Input type="number" value={form.salary} onChange={e => setField("salary", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Bill Rate ($/day)</Label>
              <Input type="number" value={form.billRate} onChange={e => setField("billRate", e.target.value)} />
            </div>
          </div>

          {/* Day allocations */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day Allocations / Year</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px]">Shop Days</Label>
                <Input type="number" value={form.shopDaysAllowed} onChange={e => setField("shopDaysAllowed", e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px]">Training Days</Label>
                <Input type="number" value={form.trainingDays} onChange={e => setField("trainingDays", e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px]">Maintenance Days</Label>
                <Input type="number" value={form.maintenanceDays} onChange={e => setField("maintenanceDays", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Employee Dialog ──────────────────────────────────────────────────────

function AddEmployeeDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (emp: ApiEmployee) => void }) {
  const [form, setForm] = useState({
    name: "", role: "extinguisher_tech", salary: "", billRate: "", certs: "", homeZip: "",
  });
  const [saving, setSaving] = useState(false);

  function setField(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleAdd() {
    if (!form.name.trim() || !form.salary || !form.billRate) {
      toast.error("Name, salary, and bill rate are required");
      return;
    }
    setSaving(true);
    try {
      const emp = await createEmployee({
        name: form.name.trim(),
        role: form.role,
        salary: Number(form.salary),
        billableRate: Number(form.billRate),
        certifications: form.certs.split(",").map(c => c.trim()).filter(Boolean),
        homeZip: form.homeZip.trim() || "00000",
        isActive: true,
      });
      onAdd(emp);
      onClose();
      setForm({ name: "", role: "extinguisher_tech", salary: "", billRate: "", certs: "", homeZip: "" });
      toast.success(`${emp.name} added`);
    } catch {
      toast.error("Failed to add employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Full Name *</Label><Input placeholder="John Smith" value={form.name} onChange={e => setField("name", e.target.value)} /></div>
            <div><Label className="text-xs">Home Zip</Label><Input placeholder="21046" value={form.homeZip} onChange={e => setField("homeZip", e.target.value)} /></div>
          </div>
          <div>
            <Label className="text-xs">Role *</Label>
            <Select value={form.role} onValueChange={v => setField("role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Annual Salary ($) *</Label><Input type="number" placeholder="55000" value={form.salary} onChange={e => setField("salary", e.target.value)} /></div>
            <div><Label className="text-xs">Bill Rate ($/day) *</Label><Input type="number" placeholder="900" value={form.billRate} onChange={e => setField("billRate", e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Certifications (comma-separated)</Label><Input placeholder="suppression, extinguisher" value={form.certs} onChange={e => setField("certs", e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Adding…" : "Add Employee"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmployeesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiEmployee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiEmployee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showHourly, setShowHourly] = useState(false);
  const [extraDaysMap, setExtraDaysMap] = useState<Record<number, ExtraDays>>({});

  useEffect(() => {
    setExtraDaysMap(loadExtraDays());
    getEmployees()
      .then(setEmployees)
      .finally(() => setLoading(false));
  }, []);

  const active = employees.filter(e => e.isActive);
  const avgUtil = active.length > 0
    ? Math.round(active.reduce((s, e) => s + e.utilizationPct, 0) / active.length)
    : 0;

  function handleSaveEdit(updated: ApiEmployee) {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
    setExtraDaysMap(loadExtraDays());
    setEditTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEmployee(deleteTarget.id);
      setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete employee");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="size-6 text-primary shrink-0" /> Employees
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {active.length} active technicians · Multicorp Fire Protection Services
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isManager && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-lg px-3 py-1.5 bg-muted/30">
              <span className={!showHourly ? "font-bold text-foreground" : ""}>Salary</span>
              <button
                role="switch"
                aria-checked={showHourly}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none ${showHourly ? "bg-primary" : "bg-muted-foreground/30"}`}
                onClick={() => setShowHourly(v => !v)}
              >
                <span className={`inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform ${showHourly ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              <span className={showHourly ? "font-bold text-foreground" : ""}>Hourly</span>
            </div>
          )}
          {isManager && (
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Techs</span>
              <Award className="size-4 text-primary" />
            </div>
            <div className="text-xl font-extrabold">{active.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Utilization</span>
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold">{avgUtil}%</div>
          </CardContent>
        </Card>
        {isManager && (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {showHourly ? "Avg Hourly Rate" : "Total Salary"}
                  </span>
                  <DollarSign className="size-4 text-emerald-600" />
                </div>
                <div className="text-xl font-extrabold">
                  {showHourly
                    ? `$${active.length > 0 ? (active.reduce((s, e) => s + e.salary, 0) / active.length / 2080).toFixed(2) : "—"}/hr`
                    : `$${(active.reduce((s, e) => s + e.salary, 0) / 1000).toFixed(0)}K`
                  }
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shop Days Used</span>
                  <Calendar className="size-4 text-blue-600" />
                </div>
                <div className="text-xl font-extrabold">
                  {active.reduce((s, e) => s + e.shopDaysUsedYtd, 0)}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Employee Cards */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading employees…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map(emp => {
            const utilColor = emp.utilizationPct >= 90 ? "text-emerald-600" : emp.utilizationPct >= 85 ? "text-amber-600" : "text-red-600";
            const isExpanded = expandedId === emp.id;
            const shopPct = emp.allowedShopDays > 0 ? (emp.shopDaysUsedYtd / emp.allowedShopDays) * 100 : 0;
            const extra = extraDaysMap[emp.id] ?? { trainingDays: 0, maintenanceDays: 0 };

            return (
              <Card key={emp.id} className="hover:shadow-md transition-shadow overflow-hidden">
                <div className={`h-1 ${emp.utilizationPct >= 90 ? "bg-emerald-500" : emp.utilizationPct >= 85 ? "bg-amber-500" : "bg-red-500"}`} />
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {initials(emp.name)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{emp.name}</CardTitle>
                        <CardDescription className="text-xs">{roleLabel(emp.role)}</CardDescription>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {emp.isActive ? (
                            <Badge variant="default" className="bg-emerald-600 text-[10px]">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {isManager && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                          onClick={() => setEditTarget(emp)}
                        >
                          <Pencil className="size-3" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(emp)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Certifications */}
                  <div className="flex flex-wrap gap-1.5">
                    {emp.certifications.map(cert => (
                      <Badge key={cert} variant="outline" className="text-[10px] px-2 py-0.5 text-primary border-primary/30 font-medium capitalize">
                        {cert.replace(/_/g, " ")}
                      </Badge>
                    ))}
                    {emp.certifications.length === 0 && (
                      <span className="text-[10px] text-muted-foreground">No certs on file</span>
                    )}
                  </div>

                  {/* Revenue & Pay — managers only */}
                  {isManager && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5">
                        <div className="text-[10px] text-emerald-600 font-medium">Bill Rate</div>
                        <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">${emp.billableRate}/day</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5">
                        <div className="text-[10px] text-blue-600 font-medium">Shop Days</div>
                        <div className="text-sm font-extrabold text-blue-700 dark:text-blue-400">{emp.shopDaysUsedYtd}/{emp.allowedShopDays}</div>
                      </div>
                      <div className="bg-muted rounded-lg p-2.5">
                        {showHourly ? (
                          <>
                            <div className="text-[10px] text-muted-foreground font-medium">Hourly</div>
                            <div className="text-sm font-extrabold">${toHourly(emp.salary)}/hr</div>
                          </>
                        ) : (
                          <>
                            <div className="text-[10px] text-muted-foreground font-medium">Salary</div>
                            <div className="text-sm font-extrabold">${(emp.salary / 1000).toFixed(0)}K</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Utilization */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-muted-foreground">Utilization</span>
                      <span className={`font-bold ${utilColor}`}>{emp.utilizationPct.toFixed(1)}%</span>
                    </div>
                    <Progress value={emp.utilizationPct} className="h-2.5" />
                  </div>

                  {/* Day Usage (collapsible) */}
                  <div>
                    <button
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary w-full justify-between hover:underline"
                      onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                    >
                      <span className="flex items-center gap-1"><Wrench className="size-3" /> Day Allocations</span>
                      {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        {/* Shop Days */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Shop Days Used</span>
                            <span className="font-semibold text-foreground">
                              {emp.shopDaysUsedYtd} / {emp.allowedShopDays} days
                            </span>
                          </div>
                          <Progress value={Math.min(shopPct, 100)} className="h-1.5" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {emp.allowedShopDays - emp.shopDaysUsedYtd > 0
                              ? `${emp.allowedShopDays - emp.shopDaysUsedYtd} remaining`
                              : "All shop days used this year"}
                          </p>
                        </div>
                        {/* Training Days */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Training Days Allotted</span>
                            <span className="font-semibold text-foreground">{extra.trainingDays} days</span>
                          </div>
                          <Progress value={extra.trainingDays > 0 ? 50 : 0} className="h-1.5 [&>div]:bg-purple-500" />
                        </div>
                        {/* Maintenance Days */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Maintenance Days Allotted</span>
                            <span className="font-semibold text-foreground">{extra.maintenanceDays} days</span>
                          </div>
                          <Progress value={extra.maintenanceDays > 0 ? 50 : 0} className="h-1.5 [&>div]:bg-amber-500" />
                        </div>
                        {isManager && (
                          <p className="text-[10px] text-primary/70 mt-1">
                            Edit employee to update day allocations.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer — managers only */}
                  {isManager && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                      <span>Zip: {emp.homeZip}</span>
                      <button
                        className="text-primary font-medium cursor-pointer hover:underline"
                        onClick={() => navigate("/profitability")}
                      >
                        View P&L →
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <AddEmployeeDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={emp => setEmployees(prev => [...prev, emp])} />
      {editTarget && (
        <EditEmployeeDialog emp={editTarget} onSave={handleSaveEdit} onClose={() => setEditTarget(null)} />
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-4" /> Remove Employee
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove <strong>{deleteTarget?.name}</strong>? This will also remove their associated jobs and records.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing…" : "Remove Employee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
