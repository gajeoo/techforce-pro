import { useState, useEffect } from "react";
import {
  FileCheck, Plus, Search, Send, CheckCircle2, XCircle,
  ArrowRight, FileText, DollarSign, TrendingUp, Clock,
  Trash2, Eye, RefreshCw, Edit3, Briefcase, Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { customers, employees } from "@/lib/mockData";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { downloadEstimatePdf } from "@/lib/docDownload";

// ─── Types ────────────────────────────────────────────────────────────────────

type EstimateStatus = "draft" | "sent" | "accepted" | "declined" | "converted";

interface LineItem {
  id: string;
  service: string;
  description: string;
  qty: number;
  unitPrice: number;
}

interface Estimate {
  id: string;
  customerId: string;
  customerName: string;
  contact: string;
  techName: string;
  status: EstimateStatus;
  created: string;
  validUntil: string;
  lineItems: LineItem[];
  notes: string;
  taxPct: number;
  sentDate?: string;
  acceptedDate?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  "Hood Suppression Inspection",
  "Hood Suppression Service",
  "Extinguisher Annual",
  "Sprinkler Annual Test",
  "Exit Light Inspection",
  "Full Fire Safety Inspection",
  "Standpipe Test",
  "Fire Alarm Inspection",
  "Kitchen Hood Cleaning",
  "Emergency Service",
];

const STATUS_CONFIG: Record<EstimateStatus, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  sent:      { label: "Sent",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  accepted:  { label: "Accepted",  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  declined:  { label: "Declined",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  converted: { label: "Converted", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
};

const INIT_ESTIMATES: Estimate[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function estimateSubtotal(est: Estimate) {
  return est.lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0);
}

function estimateTotal(est: Estimate) {
  const sub = estimateSubtotal(est);
  return sub + sub * (est.taxPct / 100);
}

// ─── Line Item Row (in form) ──────────────────────────────────────────────────

function LineItemRow({
  item, onChange, onRemove,
}: {
  item: LineItem;
  onChange: (id: string, key: keyof LineItem, val: string | number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-1.5 pr-2 min-w-[160px]">
        <Select value={item.service} onValueChange={v => onChange(item.id, "service", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SERVICE_TYPES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1.5 pr-2">
        <Input className="h-8 text-xs" value={item.description}
          onChange={e => onChange(item.id, "description", e.target.value)} placeholder="Description…" />
      </td>
      <td className="py-1.5 pr-2 w-16">
        <Input className="h-8 text-xs text-center" type="number" value={item.qty} min={1}
          onChange={e => onChange(item.id, "qty", Math.max(1, Number(e.target.value)))} />
      </td>
      <td className="py-1.5 pr-2 w-24">
        <Input className="h-8 text-xs text-right" type="number" value={item.unitPrice} min={0}
          onChange={e => onChange(item.id, "unitPrice", Number(e.target.value))} />
      </td>
      <td className="py-1.5 text-right text-xs font-semibold text-foreground w-20 pr-2">
        {fmt(item.qty * item.unitPrice)}
      </td>
      <td className="py-1.5 w-8 text-center">
        <button onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── Create / Edit Dialog ─────────────────────────────────────────────────────

function EstimateFormDialog({
  open, onClose, onSave, edit,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (est: Estimate) => void;
  edit?: Estimate;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const blankEst: Estimate = {
    id: `EST-${1010 + Math.floor(Math.random() * 100)}`,
    customerId: "", customerName: "", contact: "", techName: "",
    status: "draft", created: today, validUntil: in30,
    lineItems: [{ id: "li-new", service: SERVICE_TYPES[2], description: "", qty: 1, unitPrice: 0 }],
    notes: "", taxPct: 6,
  };

  const [form, setForm] = useState<Estimate>(edit ?? blankEst);

  function upd<K extends keyof Estimate>(key: K, val: Estimate[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function selectCustomer(id: string) {
    const c = customers.find(x => x.id === id);
    if (c) setForm(prev => ({ ...prev, customerId: id, customerName: c.name, contact: c.contact }));
  }

  function addLine() {
    setForm(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { id: `li-${Date.now()}`, service: SERVICE_TYPES[0], description: "", qty: 1, unitPrice: 0 }],
    }));
  }

  function changeLine(id: string, key: keyof LineItem, val: string | number) {
    setForm(prev => ({ ...prev, lineItems: prev.lineItems.map(l => l.id === id ? { ...l, [key]: val } : l) }));
  }

  function removeLine(id: string) {
    setForm(prev => ({ ...prev, lineItems: prev.lineItems.filter(l => l.id !== id) }));
  }

  const sub = form.lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const tax = sub * (form.taxPct / 100);
  const total = sub + tax;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="size-5 text-primary" />
            {edit ? `Edit ${edit.id}` : "New Estimate"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Header fields */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <Label className="text-xs font-semibold">Customer *</Label>
              <Select value={form.customerId} onValueChange={selectCustomer}>
                <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Select customer…" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Contact</Label>
              <Input className="text-xs mt-1" value={form.contact}
                onChange={e => upd("contact", e.target.value)} placeholder="Contact name" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Assigned Tech</Label>
              <Select value={form.techName} onValueChange={v => upd("techName", v)}>
                <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Select tech…" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.name} className="text-xs">{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Valid Until</Label>
              <Input type="date" className="text-xs h-9 mt-1" value={form.validUntil}
                onChange={e => upd("validUntil", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Tax Rate %</Label>
              <Input type="number" className="text-xs h-9 mt-1" value={form.taxPct} min={0} max={20}
                onChange={e => upd("taxPct", Number(e.target.value))} />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Line Items</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addLine}>
                <Plus className="size-3" /> Add Line
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Service</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground w-16">Qty</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground w-24">Unit $</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground w-20">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="px-3">
                  {form.lineItems.map(item => (
                    <LineItemRow key={item.id} item={item} onChange={changeLine} onRemove={removeLine} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-1 text-xs text-right border-t pt-3">
              <div className="text-muted-foreground">Subtotal: <span className="font-medium text-foreground ml-2">{fmt(sub)}</span></div>
              {form.taxPct > 0 && (
                <div className="text-muted-foreground">Tax ({form.taxPct}%): <span className="font-medium text-foreground ml-2">{fmt(tax)}</span></div>
              )}
              <div className="text-lg font-bold text-primary">Total: {fmt(total)}</div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold">Notes / Terms</Label>
            <Textarea rows={2} className="text-xs resize-none mt-1" value={form.notes}
              onChange={e => upd("notes", e.target.value)}
              placeholder="Payment terms, scope notes, special conditions, validity period…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!form.customerId || form.lineItems.length === 0}
            onClick={() => { onSave(form); onClose(); }}
          >
            {edit ? "Save Changes" : "Save as Draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

function EstimateDetailDialog({
  est, open, onClose, onAction,
}: {
  est: Estimate | null;
  open: boolean;
  onClose: () => void;
  onAction: (id: string, action: "send" | "accept" | "decline" | "convert") => void;
}) {
  if (!est) return null;
  const sub  = estimateSubtotal(est);
  const tax  = sub * (est.taxPct / 100);
  const total = sub + tax;
  const cfg  = STATUS_CONFIG[est.status];

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileCheck className="size-5 text-primary" />
            {est.id}
            <Badge variant="secondary" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {([
              ["Customer",   est.customerName],
              ["Contact",    est.contact],
              ["Tech",       est.techName],
              ["Valid Until",est.validUntil],
              ...(est.sentDate     ? [["Sent",     est.sentDate]]     : []),
              ...(est.acceptedDate ? [["Accepted", est.acceptedDate]] : []),
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="bg-muted/40 rounded-lg p-2.5">
                <div className="text-muted-foreground mb-0.5">{k}</div>
                <div className="font-semibold">{v}</div>
              </div>
            ))}
          </div>

          {/* Line items */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Service</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Description</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Qty</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Unit</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {est.lineItems.map(l => (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium text-sm">{l.service}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{l.description}</td>
                    <td className="px-3 py-2.5 text-center text-sm">{l.qty}</td>
                    <td className="px-3 py-2.5 text-right text-sm">{fmt(l.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-sm">{fmt(l.qty * l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-muted/20">
                <tr>
                  <td colSpan={3} />
                  <td className="px-3 py-2 text-xs text-muted-foreground text-right">Subtotal</td>
                  <td className="px-3 py-2 text-sm font-medium text-right">{fmt(sub)}</td>
                </tr>
                {est.taxPct > 0 && (
                  <tr>
                    <td colSpan={3} />
                    <td className="px-3 py-1.5 text-xs text-muted-foreground text-right">Tax ({est.taxPct}%)</td>
                    <td className="px-3 py-1.5 text-sm font-medium text-right">{fmt(tax)}</td>
                  </tr>
                )}
                <tr className="border-t border-border">
                  <td colSpan={3} />
                  <td className="px-3 py-3 text-sm font-bold text-right">Total</td>
                  <td className="px-3 py-3 text-base font-bold text-primary text-right">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {est.notes && (
            <div className="text-xs bg-muted/30 rounded-lg p-3">
              <span className="font-semibold">Notes: </span>{est.notes}
            </div>
          )}

        </div>

        <div className="flex flex-wrap justify-between gap-2 pt-3 border-t shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => downloadEstimatePdf({
              estimateNumber: est.id,
              customerName:   est.customerName,
              contactName:    est.contact,
              techName:       est.techName,
              created:        est.created,
              validUntil:     est.validUntil,
              lineItems:      est.lineItems.map(l => ({ service: l.service, description: l.description, qty: l.qty, unitPrice: l.unitPrice })),
              notes:          est.notes,
              taxPct:         est.taxPct,
              status:         est.status,
            })}
          >
            <Download className="size-3.5" /> Download Quote
          </Button>
          <div className="flex flex-wrap gap-2">
            {est.status === "draft" && (
              <Button className="gap-1.5" onClick={() => { onAction(est.id, "send"); onClose(); }}>
                <Send className="size-4" /> Send to Customer
              </Button>
            )}
            {est.status === "sent" && (
              <>
                <Button variant="outline" className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={() => { onAction(est.id, "decline"); onClose(); }}>
                  <XCircle className="size-4" /> Mark Declined
                </Button>
                <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => { onAction(est.id, "accept"); onClose(); }}>
                  <CheckCircle2 className="size-4" /> Mark Accepted
                </Button>
              </>
            )}
            {est.status === "accepted" && (
              <Button className="gap-1.5 bg-purple-600 hover:bg-purple-700"
                onClick={() => { onAction(est.id, "convert"); onClose(); }}>
                <ArrowRight className="size-4" /> Convert to Job
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Convert to Job Dialog ────────────────────────────────────────────────────

function ConvertToJobDialog({
  est, open, onClose, onConverted, employees,
}: {
  est: Estimate | null;
  open: boolean;
  onClose: () => void;
  onConverted: (estId: string) => void;
  employees: any[];
}) {
  const createJobFn = useMutation(api.jobs.create);
  const [employeeId, setEmployeeId] = useState("");
  const [jobDate,    setJobDate]    = useState("");
  const [notes,      setNotes]      = useState("");
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (open) { setEmployeeId(""); setJobDate(""); setNotes(""); }
  }, [open]);

  if (!est) return null;
  const safeEst = est;
  const total = estimateTotal(safeEst);
  const primaryService = safeEst.lineItems[0]?.service ?? "Fire Safety Service";

  async function handleConvert() {
    if (!jobDate) { toast.error("Please select a scheduled date"); return; }
    setSaving(true);
    try {
      await createJobFn({
        customerId:        Number(safeEst.customerId) || 1,
        employeeId:        employeeId ? Number(employeeId) : null,
        serviceType:       primaryService,
        scheduledDate:     jobDate,
        scheduledTime:     "08:00",
        priority:          "medium",
        revenue:           total,
        quantity:          safeEst.lineItems.reduce((s, l) => s + l.qty, 0),
        notes:             notes || safeEst.notes || null,
        status:            "pending",
        requiresFollowUp:  false,
        followUpConfirmed: false,
        certRequired:      "any",
      });
      toast.success(`Job created from ${safeEst.id}`);
      onConverted(safeEst.id);
      onClose();
    } catch {
      toast.error("Failed to create job from estimate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="size-5 text-purple-600"/> Convert to Job
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1 flex-1 overflow-y-auto">
          {/* Summary */}
          <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{est.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Services</span>
              <span className="font-medium text-right max-w-[60%]">{est.lineItems.map(l => l.service).join(", ")}</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 mt-1.5">
              <span className="font-semibold">Total Value</span>
              <span className="font-bold text-purple-600">{fmt(total)}</span>
            </div>
          </div>

          {/* Tech + Date */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Scheduled Date *</Label>
              <Input
                type="date" value={jobDate}
                onChange={e => setJobDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assign Technician</Label>
              <Select value={employeeId || "__none__"} onValueChange={v => setEmployeeId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Unassigned — assign later"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Job Notes</Label>
              <Textarea
                rows={2}
                className="text-xs resize-none"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional instructions for the technician…"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1 border-t">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              disabled={saving || !jobDate}
              onClick={handleConvert}
            >
              {saving ? "Creating Job…" : "Create Job"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function EstimatesPage() {
  const createJobFn = useMutation(api.jobs.create);
  const [estimates, setEstimates] = useState<Estimate[]>(INIT_ESTIMATES);
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailEst, setDetailEst] = useState<Estimate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editEst, setEditEst] = useState<Estimate | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [convertEst, setConvertEst] = useState<Estimate | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const apiEmployees = (useQuery(api.employees.list) ?? []) as any[];


  const filtered = estimates.filter(e => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.customerName.toLowerCase().includes(q) && !e.id.toLowerCase().includes(q) && !e.techName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function handleAction(id: string, action: "send" | "accept" | "decline" | "convert") {
    const today = new Date().toISOString().slice(0, 10);
    setEstimates(prev => prev.map(e => {
      if (e.id !== id) return e;
      if (action === "send")    return { ...e, status: "sent"      as EstimateStatus, sentDate: today };
      if (action === "accept")  return { ...e, status: "accepted"  as EstimateStatus, acceptedDate: today };
      if (action === "decline") return { ...e, status: "declined"  as EstimateStatus };
      if (action === "convert") return { ...e, status: "converted" as EstimateStatus, notes: `${e.notes ? e.notes + " — " : ""}Converted to Job` };
      return e;
    }));
  }

  function handleSave(est: Estimate) {
    setEstimates(prev => {
      const exists = prev.find(e => e.id === est.id);
      return exists ? prev.map(e => e.id === est.id ? est : e) : [est, ...prev];
    });
  }

  const counts = {
    all:       estimates.length,
    draft:     estimates.filter(e => e.status === "draft").length,
    sent:      estimates.filter(e => e.status === "sent").length,
    accepted:  estimates.filter(e => e.status === "accepted").length,
    declined:  estimates.filter(e => e.status === "declined").length,
    converted: estimates.filter(e => e.status === "converted").length,
  };

  const totalValue      = estimates.reduce((s, e) => s + estimateTotal(e), 0);
  const pendingValue    = estimates.filter(e => e.status === "sent").reduce((s, e) => s + estimateTotal(e), 0);
  const wonCount        = estimates.filter(e => e.status === "accepted" || e.status === "converted").length;
  const decidedCount    = estimates.filter(e => e.status !== "draft").length;
  const acceptanceRate  = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileCheck className="size-6 text-primary shrink-0" />
            Estimates & Quotes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create itemized estimates, send to customers, track acceptance, and convert to jobs
          </p>
        </div>
        <Button size="sm" className="gap-1.5 self-start sm:self-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" /> New Estimate
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Est. Value",    val: fmt(totalValue),        icon: DollarSign,  color: "text-foreground",      bg: "bg-muted/50" },
          { label: "Awaiting Decision",   val: fmt(pendingValue),       icon: Clock,       color: "text-blue-600",        bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Acceptance Rate",     val: `${acceptanceRate}%`,    icon: TrendingUp,  color: "text-emerald-600",     bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Won This Period",     val: String(wonCount),        icon: CheckCircle2,color: "text-purple-600",      bg: "bg-purple-50 dark:bg-purple-900/20" },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`size-5 ${kpi.color}`} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{kpi.label}</div>
                    <div className={`text-xl font-bold ${kpi.color}`}>{kpi.val}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search customer, tech, or estimate #…" className="pl-9"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Tabs value={statusFilter} onValueChange={v => setStatusFilter(v as EstimateStatus | "all")}>
            <TabsList className="h-9">
              <TabsTrigger value="all"       className="text-xs">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="draft"     className="text-xs">Draft ({counts.draft})</TabsTrigger>
              <TabsTrigger value="sent"      className="text-xs">Sent ({counts.sent})</TabsTrigger>
              <TabsTrigger value="accepted"  className="text-xs">Accepted ({counts.accepted})</TabsTrigger>
              <TabsTrigger value="declined"  className="text-xs">Declined ({counts.declined})</TabsTrigger>
              <TabsTrigger value="converted" className="text-xs">Converted ({counts.converted})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Estimate</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Tech</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground">Items</th>
                <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground">Total</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Valid Until</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(est => {
                const cfg   = STATUS_CONFIG[est.status];
                const total = estimateTotal(est);
                return (
                  <tr key={est.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-sm text-foreground">{est.id}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{est.created}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-sm">{est.customerName}</div>
                      <div className="text-[10px] text-muted-foreground">{est.contact}</div>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell text-xs text-muted-foreground">{est.techName}</td>
                    <td className="px-3 py-3 text-center text-xs text-muted-foreground">{est.lineItems.length}</td>
                    <td className="px-3 py-3 text-right font-semibold">{fmt(total)}</td>
                    <td className="px-3 py-3 hidden md:table-cell text-xs text-muted-foreground">{est.validUntil}</td>
                    <td className="px-3 py-3">
                      <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" title="View"
                          onClick={() => { setDetailEst(est); setDetailOpen(true); }}>
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2" title="Download Quote"
                          onClick={() => downloadEstimatePdf({
                            estimateNumber: est.id,
                            customerName:   est.customerName,
                            contactName:    est.contact,
                            techName:       est.techName,
                            created:        est.created,
                            validUntil:     est.validUntil,
                            lineItems:      est.lineItems.map(l => ({ service: l.service, description: l.description, qty: l.qty, unitPrice: l.unitPrice })),
                            notes:          est.notes,
                            taxPct:         est.taxPct,
                            status:         est.status,
                          })}
                        >
                          <Download className="size-3.5" />
                        </Button>
                        {est.status === "draft" && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Edit"
                            onClick={() => { setEditEst(est); setEditOpen(true); }}>
                            <Edit3 className="size-3.5" />
                          </Button>
                        )}
                        {est.status === "draft" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleAction(est.id, "send")}>
                            <Send className="size-3" /> Send
                          </Button>
                        )}
                        {est.status === "sent" && (
                          <Button size="sm" className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleAction(est.id, "accept")}>
                            <CheckCircle2 className="size-3" /> Accept
                          </Button>
                        )}
                        {est.status === "accepted" && (
                          <Button size="sm" className="h-7 px-2 text-xs gap-1 bg-purple-600 hover:bg-purple-700"
                            onClick={() => { setConvertEst(est); setConvertOpen(true); }}>
                            <RefreshCw className="size-3" /> Convert
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No estimates match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workflow info banner */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 flex gap-3 items-start">
        <FileText className="size-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <span className="font-semibold">Estimate Workflow: </span>
          Draft → Send to Customer → Customer Accepts → Convert to Job → Job Completed → Invoice Auto-Generated
        </p>
      </div>

      <EstimateFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleSave} />
      <EstimateFormDialog open={editOpen}   onClose={() => { setEditOpen(false); setEditEst(null); }} onSave={handleSave} edit={editEst ?? undefined} />
      <EstimateDetailDialog est={detailEst} open={detailOpen} onClose={() => { setDetailOpen(false); setDetailEst(null); }} onAction={handleAction} />
      <ConvertToJobDialog
        est={convertEst}
        open={convertOpen}
        onClose={() => { setConvertOpen(false); setConvertEst(null); }}
        onConverted={id => handleAction(id, "convert")}
        employees={apiEmployees}
      />
    </div>
  );
}
