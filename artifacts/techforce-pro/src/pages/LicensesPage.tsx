import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  Clock,
  FileBadge,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  clearLicenses,
  deleteLicense,
  daysUntilExpiry,
  generateLicenseId,
  getExpiryStatus,
  getLicensesForEmp,
  loadLicenses,
  seedLicensesIfNeeded,
  upsertLicense,
  type ExpiryStatus,
  type License,
} from "@/lib/licenses";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join("")
    .slice(0, 2);
}

const ROLE_LABELS: Record<string, string> = {
  suppression_lead: "Suppression Lead",
  sprinkler_tech:   "Sprinkler Tech",
  extinguisher_tech: "Extinguisher Tech",
  helper:           "Helper",
  admin:            "Admin",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

const ISSUER_OPTIONS = [
  "State of Maryland",
  "NICET",
  "NFPA",
  "State of Virginia",
  "State of Pennsylvania",
  "State of Delaware",
  "Other",
];

const LICENSE_TYPE_OPTIONS = [
  "MD Fire Suppression License",
  "MD Sprinkler Fitter License",
  "MD Portable Extinguisher License",
  "MD Exit Light Inspector Cert",
  "MD Apprentice Fire Protection",
  "NICET Level I Certification",
  "NICET Level II Certification",
  "NICET Level III Certification",
  "NICET Level IV Certification",
  "Journeyman Fire Protection",
  "Master Fire Protection",
  "Other",
];

function expiryBadge(status: ExpiryStatus) {
  if (status === "expired")  return { label: "Expired",        cls: "bg-destructive/10 text-destructive border-destructive/30" };
  if (status === "critical") return { label: "Expires < 30 d", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200" };
  if (status === "warning")  return { label: "Expires < 60 d", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200" };
  return                            { label: "Active",          cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200" };
}

function ExpiryIcon({ status }: { status: ExpiryStatus }) {
  if (status === "expired")  return <ShieldAlert  className="size-4 text-destructive" />;
  if (status === "critical") return <AlertTriangle className="size-4 text-red-600"    />;
  if (status === "warning")  return <Clock         className="size-4 text-amber-600"  />;
  return                            <BadgeCheck    className="size-4 text-emerald-600"/>;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── License card ─────────────────────────────────────────────────────────────

function LicenseCard({
  license,
  canEdit,
  onEdit,
  onDelete,
}: {
  license: License;
  canEdit: boolean;
  onEdit: (l: License) => void;
  onDelete: (id: string) => void;
}) {
  const status = getExpiryStatus(license.expiryDate);
  const days   = daysUntilExpiry(license.expiryDate);
  const badge  = expiryBadge(status);

  return (
    <Card className={`transition-all ${status !== "ok" ? "ring-1 ring-amber-400/40" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <ExpiryIcon status={status} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight break-words">{license.type}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                #{license.licenseNumber} · {license.issuedBy}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" /> Issued {formatDate(license.issueDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" /> Expires {formatDate(license.expiryDate)}
                </span>
              </div>
              {license.notes && (
                <p className="text-xs text-muted-foreground italic mt-1.5">"{license.notes}"</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant="outline" className={`text-[9px] px-1.5 ${badge.cls}`}>
              {badge.label}
            </Badge>
            {status !== "ok" && (
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
              </span>
            )}
            {canEdit && (
              <div className="flex gap-1 mt-1">
                <Button
                  variant="ghost" size="sm" className="h-6 w-6 p-0"
                  onClick={() => onEdit(license)}
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(license.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Add / Edit dialog ────────────────────────────────────────────────────────

const EMPTY_FORM = {
  type: "", licenseNumber: "", issuedBy: "State of Maryland",
  issueDate: "", expiryDate: "", notes: "",
};

function LicenseDialog({
  open, initial, empId, onClose, onSave,
}: {
  open: boolean;
  initial: License | null;
  empId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [customType, setCustomType] = useState("");

  useEffect(() => {
    if (initial) {
      setForm({
        type: initial.type, licenseNumber: initial.licenseNumber,
        issuedBy: initial.issuedBy, issueDate: initial.issueDate,
        expiryDate: initial.expiryDate, notes: initial.notes ?? "",
      });
      setCustomType(LICENSE_TYPE_OPTIONS.includes(initial.type) ? "" : initial.type);
    } else {
      setForm(EMPTY_FORM);
      setCustomType("");
    }
  }, [initial, open]);

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })); }

  function handleSave() {
    const finalType = form.type === "Other" ? customType.trim() : form.type;
    if (!finalType || !form.licenseNumber.trim() || !form.issuedBy || !form.issueDate || !form.expiryDate) return;
    upsertLicense({
      id: initial?.id ?? generateLicenseId(),
      empId,
      type: finalType,
      licenseNumber: form.licenseNumber.trim(),
      issuedBy: form.issuedBy,
      issueDate: form.issueDate,
      expiryDate: form.expiryDate,
      notes: form.notes.trim(),
    });
    onSave();
    onClose();
  }

  const valid =
    (form.type && form.type !== "Other" ? true : !!customType.trim()) &&
    !!form.licenseNumber.trim() && !!form.issuedBy && !!form.issueDate && !!form.expiryDate;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBadge className="size-5 text-primary" />
            {initial ? "Edit License" : "Add License"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">License / Certification Type</Label>
            <Select value={form.type} onValueChange={v => set("type", v)}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {LICENSE_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.type === "Other" && (
              <Input
                className="mt-1.5"
                placeholder="Enter custom type..."
                value={customType}
                onChange={e => setCustomType(e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">License Number</Label>
              <Input
                placeholder="e.g. FSL-2024-1234"
                value={form.licenseNumber}
                onChange={e => set("licenseNumber", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Issuing Authority</Label>
              <Select value={form.issuedBy} onValueChange={v => set("issuedBy", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ISSUER_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Issue Date</Label>
              <Input type="date" value={form.issueDate} onChange={e => set("issueDate", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={e => set("expiryDate", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              placeholder="Any notes about this license..."
              rows={2}
              className="resize-none"
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!valid} onClick={handleSave}>
              {initial ? "Save Changes" : "Add License"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tech license panel ───────────────────────────────────────────────────────

function TechLicenses({
  empId, canEdit, onRefresh,
}: {
  empId: string;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [editTarget, setEditTarget] = useState<License | null>(null);
  const [addOpen, setAddOpen]     = useState(false);

  function load() { setLicenses(getLicensesForEmp(empId)); }
  useEffect(() => { load(); }, [empId]);

  function handleDelete(id: string) {
    deleteLicense(id);
    load();
    onRefresh();
  }

  const expiring = licenses.filter(l => getExpiryStatus(l.expiryDate) !== "ok");

  return (
    <div className="space-y-3">
      {expiring.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/40 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            {expiring.length} license{expiring.length > 1 ? "s" : ""} need{expiring.length === 1 ? "s" : ""} attention
          </p>
        </div>
      )}

      {licenses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <FileBadge className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No licenses on file.</p>
            {canEdit && (
              <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => setAddOpen(true)}>
                Add a license →
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {licenses.map(l => (
            <LicenseCard
              key={l.id}
              license={l}
              canEdit={canEdit}
              onEdit={lic => setEditTarget(lic)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <Button
          variant="outline" size="sm" className="gap-1.5 text-xs w-full"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-3.5" /> Add License / Certification
        </Button>
      )}

      <LicenseDialog
        open={addOpen || !!editTarget}
        initial={editTarget}
        empId={empId}
        onClose={() => { setAddOpen(false); setEditTarget(null); }}
        onSave={() => { load(); onRefresh(); }}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function LicensesPage() {
  const { user } = useAuth();
  const role   = user?.role ?? "manager";
  const userId = user?.id ?? "";

  const allEmployees  = (useQuery(api.employees.list) ?? []) as any[];
  const apiEmployees  = allEmployees.filter((e: any) => e.isActive);
  const [, setTick]   = useState(0);
  function refresh() { setTick(t => t + 1); }

  // Seed licenses when employees load
  if (apiEmployees.length > 0) {
    seedLicensesIfNeeded(apiEmployees.map((e: any) => String(e._id ?? e.id)));
  } else if (allEmployees.length > 0 && apiEmployees.length === 0) {
    clearLicenses();
  }

  // Only count licenses for employees that actually exist in the DB.
  // This prevents orphaned localStorage entries from inflating KPI numbers
  // when the system has been cleared.
  const knownEmpIds  = new Set(apiEmployees.map((e: any) => String(e._id ?? e.id)));
  const allLicenses  = apiEmployees.length === 0
    ? []
    : loadLicenses().filter(l => knownEmpIds.has(l.empId));
  const allExpiring  = allLicenses.filter(l => getExpiryStatus(l.expiryDate) !== "ok");

  // Technician view — show their own licenses only
  if (role === "technician") {
    const empId = String(userId);
    const me = apiEmployees.find(e => String(e._id ?? e.id) === empId);
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileBadge className="size-6 text-primary shrink-0" /> My Licenses
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {me?.name ?? "Your profile"} — track and manage your certifications
            </p>
          </div>
        </div>
        <TechLicenses empId={empId} canEdit onRefresh={refresh} />
      </div>
    );
  }

  // Manager / Supervisor: see all employees
  const techs = apiEmployees;
  const firstId = techs[0] ? String(techs[0].id) : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileBadge className="size-6 text-primary shrink-0" /> Team Licenses
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage technician certifications and track expiry dates
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Total Licenses</div>
            <div className="text-2xl font-extrabold">{allLicenses.length}</div>
            <div className="text-[10px] text-muted-foreground">
              across {(!apiEmployees.length) ? "…" : techs.length} techs
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Expiring Soon</div>
            <div className={`text-2xl font-extrabold ${allExpiring.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {allExpiring.length}
            </div>
            <div className="text-[10px] text-muted-foreground">within 60 days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Critical</div>
            <div className={`text-2xl font-extrabold ${
              allExpiring.filter(l => {
                const s = getExpiryStatus(l.expiryDate);
                return s === "critical" || s === "expired";
              }).length > 0 ? "text-destructive" : "text-emerald-600"
            }`}>
              {allExpiring.filter(l => {
                const s = getExpiryStatus(l.expiryDate);
                return s === "critical" || s === "expired";
              }).length}
            </div>
            <div className="text-[10px] text-muted-foreground">within 30 days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">All Current</div>
            <div className="text-2xl font-extrabold text-emerald-600">
              {allLicenses.length - allExpiring.length}
            </div>
            <div className="text-[10px] text-muted-foreground">fully valid</div>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {(!apiEmployees.length) && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading employees…</span>
        </div>
      )}

      {/* Per-tech tabs */}
      {apiEmployees.length > 0 && techs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileBadge className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No employees found. Add employees first.</p>
          </CardContent>
        </Card>
      )}

      {techs.length > 0 && (
        <Tabs defaultValue={firstId} className="w-full">
          <div className="overflow-x-auto">
            <TabsList className="h-9 w-max min-w-full sm:w-auto">
              {techs.map(emp => {
                const empId    = String(emp._id ?? emp._id ?? emp.id);
                const empLicenses = getLicensesForEmp(empId);
                const expCount    = empLicenses.filter(l => getExpiryStatus(l.expiryDate) !== "ok").length;
                return (
                  <TabsTrigger key={empId} value={empId} className="text-xs gap-1.5 px-3">
                    <span className="size-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                      {initials(emp.name)}
                    </span>
                    <span className="truncate max-w-[80px] sm:max-w-none">
                      {emp.name.split(" ")[0]}
                    </span>
                    {expCount > 0 && (
                      <span className="size-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {expCount}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {techs.map(emp => {
            const empId = String(emp._id ?? emp._id ?? emp.id);
            return (
              <TabsContent key={empId} value={empId} className="mt-4">
                <Card className="mb-4">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {initials(emp.name)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{emp.name}</CardTitle>
                        <CardDescription className="text-xs">{roleLabel(emp.role)}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                <TechLicenses empId={empId} canEdit onRefresh={refresh} />
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
