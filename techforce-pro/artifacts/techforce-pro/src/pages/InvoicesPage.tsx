import { useState, useEffect, useRef, useCallback } from "react";
import { downloadDocument, downloadInvoicePdf } from "@/lib/docDownload";
import {
  FileText, DollarSign, CheckCircle2, Clock, AlertTriangle,
  Send, Download, Plus, Search, Eye, TrendingUp,
  CreditCard, Landmark, Banknote, Receipt, Trash2,
  FolderOpen, FileCheck, Image, ChevronDown, ChevronUp, X as XIcon,
  ScanLine, Upload, Sparkles, RotateCcw, FileImage, FileScan,
  CheckCheck, Pencil,
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
import {
  getInvoices, createInvoice, updateInvoice, getCustomers, getEmployees,
  type ApiInvoice, type ApiCustomer, type ApiEmployee,
} from "@/lib/api";
import { saveCustomerDocument } from "@/lib/customerDocuments";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
type PaymentMethod = "check" | "ach" | "credit_card" | "cash" | "zelle";

interface LineItem {
  id: string;
  service: string;
  description: string;
  qty: number;
  unitPrice: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  "Hood Suppression Inspection",
  "Extinguisher Annual",
  "Sprinkler Annual Test",
  "Exit Light Inspection",
  "Full Fire Safety Inspection",
  "Standpipe Test",
  "Fire Alarm Inspection",
  "Kitchen Hood Cleaning",
  "Emergency Service",
  "Parts & Materials",
  "Labor (hourly)",
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "check", label: "Check", icon: Receipt },
  { value: "ach", label: "ACH / Bank Transfer", icon: Landmark },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "zelle", label: "Zelle", icon: DollarSign },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: FileText },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: Send },
  paid: { label: "Paid", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: AlertTriangle },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function lineTotal(li: LineItem) {
  return li.qty * li.unitPrice;
}

// ─── Line Item Row ────────────────────────────────────────────────────────────

function LineItemRow({
  item, onChange, onRemove,
}: {
  item: LineItem;
  onChange: (id: string, key: keyof LineItem, val: string | number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-1.5 pr-2 min-w-[150px]">
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
      <td className="py-1.5 pr-2 text-right text-xs font-semibold w-20">{fmt(lineTotal(item))}</td>
      <td className="py-1.5 w-8 text-center">
        <button onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── Mark Paid Dialog ─────────────────────────────────────────────────────────

function MarkPaidDialog({
  inv, open, onClose, onConfirm,
}: {
  inv: ApiInvoice | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (id: number, method: PaymentMethod) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("check");
  const [saving, setSaving] = useState(false);

  if (!inv) return null;
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Record Payment — {inv.invoiceNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/40 rounded-lg p-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Amount</span>
            <span className="text-lg font-bold text-emerald-600">{fmt(inv.totalAmount)}</span>
          </div>
          <div>
            <Label className="text-xs font-semibold">Payment Method</Label>
            <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(pm => (
                  <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onConfirm(inv.id, method);
                setSaving(false);
                onClose();
              }}
            >
              <CheckCircle2 className="size-4" /> {saving ? "Saving…" : "Confirm Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Invoice Dialog ────────────────────────────────────────────────────

function CreateInvoiceDialog({
  open, onClose, onSave, customers, employees,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (inv: ApiInvoice) => void;
  customers: ApiCustomer[];
  employees: ApiEmployee[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [techId, setTechId] = useState("__none__");
  const [notes, setNotes] = useState("");
  const [taxPct, setTaxPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "li-new", service: SERVICE_TYPES[0], description: "", qty: 1, unitPrice: 0 },
  ]);

  function addLine() {
    setLineItems(prev => [...prev, { id: `li-${Date.now()}`, service: SERVICE_TYPES[0], description: "", qty: 1, unitPrice: 0 }]);
  }

  function changeLine(id: string, key: keyof LineItem, val: string | number) {
    setLineItems(prev => prev.map(l => l.id === id ? { ...l, [key]: val } : l));
  }

  function removeLine(id: string) {
    setLineItems(prev => prev.filter(l => l.id !== id));
  }

  const sub = lineItems.reduce((s, l) => s + lineTotal(l), 0);
  const tax = sub * (taxPct / 100);
  const total = sub + tax;

  async function handleSave() {
    if (!customerId || lineItems.length === 0) {
      toast.error("Select a customer and add at least one line item");
      return;
    }
    setSaving(true);
    try {
      const apiLineItems = lineItems.map(l => ({
        service: l.service,
        quantity: l.qty,
        rate: l.unitPrice,
        total: lineTotal(l),
      }));
      const inv = await createInvoice({
        customerId: Number(customerId),
        techId: techId === "__none__" ? null : Number(techId),
        lineItems: apiLineItems,
        notes: notes || undefined,
      });
      onSave(inv);
      onClose();
      setCustomerId(""); setTechId("__none__"); setNotes(""); setTaxPct(0);
      setLineItems([{ id: "li-new", service: SERVICE_TYPES[0], description: "", qty: 1, unitPrice: 0 }]);
      toast.success(`Invoice ${inv.invoiceNumber} created`);
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" /> New Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <Label className="text-xs font-semibold">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Select customer…" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={String(c.id)} className="text-xs">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Technician</Label>
              <Select value={techId} onValueChange={setTechId}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Assign technician…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs text-muted-foreground">Open / Unassigned</SelectItem>
                  {employees.filter(e => e.isActive).map(e => (
                    <SelectItem key={e.id} value={String(e.id)} className="text-xs">{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Tax %</Label>
              <Input type="number" className="mt-1 text-xs h-9" value={taxPct} min={0} max={20}
                onChange={e => setTaxPct(Number(e.target.value))} />
            </div>
          </div>

          {/* Line items */}
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
                <tbody>
                  {lineItems.map(item => (
                    <LineItemRow key={item.id} item={item} onChange={changeLine} onRemove={removeLine} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-1 text-xs text-right border-t pt-3">
              <div className="text-muted-foreground">Subtotal: <span className="font-medium text-foreground ml-2">{fmt(sub)}</span></div>
              {taxPct > 0 && <div className="text-muted-foreground">Tax ({taxPct}%): <span className="font-medium text-foreground ml-2">{fmt(tax)}</span></div>}
              <div className="text-lg font-bold text-primary">Total: {fmt(total)}</div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Notes</Label>
            <Textarea rows={2} className="text-xs resize-none mt-1" value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Payment terms, special instructions…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!customerId || lineItems.length === 0 || saving} onClick={handleSave}>
            {saving ? "Creating…" : "Save as Draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice Documents Section ────────────────────────────────────────────────

const SIMULATED_DOCS: Array<{
  id: string; name: string; type: "certificate" | "report" | "photo" | "signature";
  size: string; date: string;
}> = [
  { id: "d1", name: "Inspection Certificate.pdf",    type: "certificate", size: "124 KB", date: "2026-05-01" },
  { id: "d2", name: "Service Report.pdf",            type: "report",      size: "87 KB",  date: "2026-05-01" },
  { id: "d3", name: "Customer Signature.pdf",        type: "signature",   size: "32 KB",  date: "2026-05-01" },
  { id: "d4", name: "Site Photos.zip",               type: "photo",       size: "2.1 MB", date: "2026-05-01" },
];

const DOC_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  certificate: FileCheck,
  report:      FileText,
  photo:       Image,
  signature:   FileText,
};

const DOC_COLOR: Record<string, string> = {
  certificate: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  report:      "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  photo:       "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  signature:   "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
};

function DocViewerDialog({
  doc, open, onClose,
}: {
  doc: typeof SIMULATED_DOCS[0] | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!doc) return null;
  const Icon = DOC_ICON[doc.type] ?? FileText;
  const color = DOC_COLOR[doc.type] ?? "";

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon className={`size-5 ${color.split(" ")[0]}`}/>
            {doc.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className={`rounded-xl p-6 flex flex-col items-center gap-4 ${color.split(" ").slice(1).join(" ")} border border-border`}>
            <div className={`size-16 rounded-full flex items-center justify-center ${color.split(" ")[0]} bg-white/60 dark:bg-black/20`}>
              <Icon className="size-8"/>
            </div>
            <div className="text-center">
              <div className="font-semibold text-foreground">{doc.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {doc.size} · {fmtDate(doc.date)}
              </div>
            </div>
            <div className="w-full rounded-lg bg-white/80 dark:bg-black/20 border border-border p-4 space-y-2">
              <div className="h-2.5 bg-muted/60 rounded-full w-full"/>
              <div className="h-2.5 bg-muted/60 rounded-full w-4/5"/>
              <div className="h-2.5 bg-muted/60 rounded-full w-full"/>
              <div className="h-2.5 bg-muted/60 rounded-full w-3/5"/>
              <div className="h-2.5 bg-muted/60 rounded-full w-full"/>
              <div className="h-2.5 bg-muted/60 rounded-full w-2/3"/>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Document preview — {doc.name}
              <br/>Generated by TechForce Pro · Multicorp Fire Protection Services
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} className="gap-1.5 text-sm">
              <XIcon className="size-3.5"/> Close
            </Button>
            <Button className="gap-1.5 text-sm" onClick={() => downloadDocument(doc.name, { date: fmtDate(doc.date), issuedBy: "Multicorp Fire Protection Services" })}>
              <Download className="size-3.5"/> Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDocumentsSection({ inv }: { inv: ApiInvoice }) {
  const [open,       setOpen]       = useState(false);
  const [viewingDoc, setViewingDoc] = useState<typeof SIMULATED_DOCS[0] | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const docs = SIMULATED_DOCS.map(d => ({
    ...d,
    date: inv.generatedAt?.slice(0, 10) ?? d.date,
  }));

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
        >
          <div className="flex items-center gap-2 font-medium">
            <FolderOpen className="size-4 text-primary"/>
            Documents ({docs.length})
          </div>
          {open ? <ChevronUp className="size-4 text-muted-foreground"/> : <ChevronDown className="size-4 text-muted-foreground"/>}
        </button>
        {open && (
          <div className="divide-y divide-border/50">
            {docs.map(doc => {
              const Icon  = DOC_ICON[doc.type] ?? FileText;
              const color = DOC_COLOR[doc.type] ?? "";
              return (
                <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${color.split(" ").slice(1).join(" ")}`}>
                    <Icon className={`size-4 ${color.split(" ")[0]}`}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">{doc.size} · {fmtDate(doc.date)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => { setViewingDoc(doc); setViewerOpen(true); }}
                    >
                      <Eye className="size-3"/> View
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => downloadDocument(doc.name, { date: fmtDate(doc.date), issuedBy: "Multicorp Fire Protection Services" })}>
                      <Download className="size-3"/> Save
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DocViewerDialog
        doc={viewingDoc}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

// ─── Invoice Detail Dialog ────────────────────────────────────────────────────

function InvoiceDetailDialog({
  inv, open, onClose, onMarkSent, onOpenPaid,
}: {
  inv: ApiInvoice | null;
  open: boolean;
  onClose: () => void;
  onMarkSent: (id: number) => Promise<void>;
  onOpenPaid: (inv: ApiInvoice) => void;
}) {
  const [sending, setSending] = useState(false);
  if (!inv) return null;
  const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="size-5 text-primary" />
            {inv.invoiceNumber}
            <Badge variant="secondary" className={`text-xs gap-1 ${cfg.color}`}>
              <Icon className="size-3" />{cfg.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {([
              ["Customer", inv.customerName],
              ["Invoice #", inv.invoiceNumber],
              ["Date", fmtDate(inv.generatedAt)],
              ["Amount", fmt(inv.totalAmount)],
              ["Status", cfg.label],
              ["Technician", inv.techName ?? "Open / Unassigned"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="bg-muted/40 rounded-lg p-2.5">
                <div className="text-muted-foreground mb-0.5">{k}</div>
                <div className="font-semibold">{v}</div>
              </div>
            ))}
          </div>

          {/* Line items */}
          {inv.lineItems.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Service</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Rate</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {inv.lineItems.map((l, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium text-sm">{l.service}</td>
                      <td className="px-3 py-2.5 text-center text-xs">{l.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-xs">{fmt(l.rate)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-sm">{fmt(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/20 border-t border-border">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-right font-bold text-sm">Total</td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-base text-primary">{fmt(inv.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Documents Section */}
          <InvoiceDocumentsSection inv={inv} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-3 border-t">
          {inv.status === "draft" && (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={sending}
              onClick={async () => {
                setSending(true);
                await onMarkSent(inv.id);
                setSending(false);
                onClose();
              }}
            >
              <Send className="size-3.5" /> {sending ? "Sending…" : "Mark as Sent"}
            </Button>
          )}
          {(inv.status === "sent" || inv.status === "overdue") && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              onClick={() => { onOpenPaid(inv); onClose(); }}
            >
              <CheckCircle2 className="size-3.5" /> Record Payment
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadInvoicePdf(inv)}>
            <Download className="size-3.5" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Scan to Invoice Dialog ───────────────────────────────────────────────────

type ScanStep = "idle" | "uploading" | "scanning" | "review" | "done";

const SCAN_SERVICES = [
  "Hood Suppression Inspection",
  "Extinguisher Annual",
  "Sprinkler Annual Test",
  "Fire Alarm Inspection",
  "Kitchen Hood Cleaning",
  "Exit Light Inspection",
  "Standpipe Test",
];

const SCAN_MESSAGES = [
  "Reading document structure…",
  "Detecting invoice fields…",
  "Extracting line items…",
  "Identifying customer info…",
  "Calculating totals…",
  "Finalizing data extraction…",
];

type FieldConfidence = "high" | "medium" | "low";

function simulateExtraction(customers: ApiCustomer[]): {
  customerId: string;
  lineItems: LineItem[];
  notes: string;
  invoiceDate: string;
  poNumber: string;
  dueDate: string;
  confidence: {
    customer: FieldConfidence;
    lineItems: FieldConfidence;
    invoiceDate: FieldConfidence;
    poNumber: FieldConfidence;
  };
} {
  const cust = customers[Math.floor(Math.random() * customers.length)];
  const numLines = Math.floor(Math.random() * 2) + 1;
  const lineItems: LineItem[] = Array.from({ length: numLines }, (_, i) => {
    const service = SCAN_SERVICES[Math.floor(Math.random() * SCAN_SERVICES.length)];
    const unitPrice = Math.round((Math.random() * 300 + 120) / 5) * 5;
    return { id: `li-scan-${i}`, service, description: "Per inspection agreement", qty: 1, unitPrice };
  });
  const today = new Date();
  const invDate = new Date(today.getTime() - Math.random() * 7 * 86400000);
  const due = new Date(invDate.getTime() + 30 * 86400000);
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
  const poRand = `PO-${Math.floor(Math.random() * 90000 + 10000)}`;
  const confidenceLevels: FieldConfidence[] = ["high", "high", "medium", "low"];
  return {
    customerId: cust ? String(cust.id) : "",
    lineItems,
    notes: "Scanned from uploaded document. Please verify all fields before saving.",
    invoiceDate: toDateStr(invDate),
    poNumber: Math.random() > 0.4 ? poRand : "",
    dueDate: toDateStr(due),
    confidence: {
      customer: confidenceLevels[Math.floor(Math.random() * 2)] as FieldConfidence,
      lineItems: confidenceLevels[Math.floor(Math.random() * 3)] as FieldConfidence,
      invoiceDate: "high",
      poNumber: Math.random() > 0.4 ? "medium" : "low",
    },
  };
}

function ConfidenceBadge({ level }: { level: FieldConfidence }) {
  const map: Record<FieldConfidence, { label: string; className: string }> = {
    high:   { label: "High",   className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
    medium: { label: "Medium", className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
    low:    { label: "Low",    className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  };
  const { label, className } = map[level];
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${className}`}>
      <Sparkles className="size-2.5" /> {label}
    </span>
  );
}

function ScanToInvoiceDialog({
  open, onClose, onSave, customers,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (inv: ApiInvoice) => void;
  customers: ApiCustomer[];
}) {
  const [step, setStep] = useState<ScanStep>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState("");
  const [scanPct, setScanPct] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [taxPct, setTaxPct] = useState(0);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [confidence, setConfidence] = useState<ReturnType<typeof simulateExtraction>["confidence"] | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  function reset() {
    setStep("idle");
    setDragOver(false);
    setFile(null);
    setPreviewUrl(null);
    setScanMsg("");
    setScanPct(0);
    setCustomerId("");
    setLineItems([]);
    setNotes("");
    setTaxPct(0);
    setInvoiceDate("");
    setPoNumber("");
    setDueDate("");
    setConfidence(null);
    if (scanInterval.current) clearInterval(scanInterval.current);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const acceptFile = useCallback((f: File) => {
    setFile(f);
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
    setStep("uploading");
    // Short delay then start scanning
    setTimeout(() => startScan(f), 600);
  }, [customers]); // eslint-disable-line react-hooks/exhaustive-deps

  function startScan(_f: File) {
    setStep("scanning");
    setScanPct(0);
    let msgIdx = 0;
    setScanMsg(SCAN_MESSAGES[0]);
    let pct = 0;
    scanInterval.current = setInterval(() => {
      pct += Math.random() * 18 + 4;
      if (pct >= 100) pct = 100;
      setScanPct(Math.round(pct));
      msgIdx = Math.min(Math.floor((pct / 100) * SCAN_MESSAGES.length), SCAN_MESSAGES.length - 1);
      setScanMsg(SCAN_MESSAGES[msgIdx]);
      if (pct >= 100) {
        if (scanInterval.current) clearInterval(scanInterval.current);
        const extracted = simulateExtraction(customers);
        setCustomerId(extracted.customerId);
        setLineItems(extracted.lineItems);
        setNotes(extracted.notes);
        setInvoiceDate(extracted.invoiceDate);
        setPoNumber(extracted.poNumber);
        setDueDate(extracted.dueDate);
        setConfidence(extracted.confidence);
        setTimeout(() => setStep("review"), 300);
      }
    }, 280);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
    e.target.value = "";
  }

  function changeLine(id: string, key: keyof LineItem, val: string | number) {
    setLineItems(prev => prev.map(l => l.id === id ? { ...l, [key]: val } : l));
  }

  function removeLine(id: string) {
    setLineItems(prev => prev.filter(l => l.id !== id));
  }

  function addLine() {
    setLineItems(prev => [...prev, { id: `li-scan-${Date.now()}`, service: SERVICE_TYPES[0], description: "", qty: 1, unitPrice: 0 }]);
  }

  const sub = lineItems.reduce((s, l) => s + lineTotal(l), 0);
  const tax = sub * (taxPct / 100);
  const total = sub + tax;

  async function handleCreate() {
    if (!customerId || lineItems.length === 0) {
      toast.error("Select a customer and add at least one line item");
      return;
    }
    setSaving(true);
    try {
      const inv = await createInvoice({
        customerId: Number(customerId),
        lineItems: lineItems.map(l => ({ service: l.service, quantity: l.qty, rate: l.unitPrice, total: lineTotal(l) })),
        notes: notes || undefined,
      });
      onSave(inv);
      setStep("done");
      toast.success(`Invoice ${inv.invoiceNumber} created from scan`);
      setTimeout(handleClose, 1800);
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  const isImage = file?.type.startsWith("image/");
  const isPdf = file?.type === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <ScanLine className="size-4 text-primary-foreground" />
            </div>
            Scan to Invoice
            <Badge variant="secondary" className="gap-1 text-[10px] bg-primary/10 text-primary border-0 ml-1">
              <Sparkles className="size-3" /> AI-Powered
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload a photo or PDF of a service report, work order, or existing invoice — AI extracts the details automatically.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Step: idle / drop zone ── */}
          {(step === "idle" || step === "uploading") && (
            <div
              className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed transition-all min-h-[260px] cursor-pointer select-none
                ${dragOver ? "border-primary bg-primary/10 scale-[1.01]" : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={onInputChange}
              />
              <div className={`size-16 rounded-2xl flex items-center justify-center transition-colors ${dragOver ? "bg-primary/20" : "bg-muted"}`}>
                {dragOver
                  ? <FileScan className="size-8 text-primary animate-pulse" />
                  : <Upload className="size-8 text-muted-foreground" />}
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-sm text-foreground">
                  {dragOver ? "Drop to scan" : "Drop file here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports JPG, PNG, WebP, PDF · Max 20 MB
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {[
                  { icon: FileImage, label: "Photo" },
                  { icon: FileText, label: "PDF" },
                  { icon: Receipt, label: "Work Order" },
                  { icon: FileCheck, label: "Report" },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-[11px] bg-background border rounded-full px-2.5 py-1 text-muted-foreground">
                    <Icon className="size-3" /> {label}
                  </span>
                ))}
              </div>
              {step === "uploading" && (
                <div className="absolute inset-0 rounded-2xl bg-background/70 flex items-center justify-center backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2">
                    <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium text-primary">Uploading…</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step: scanning ── */}
          {step === "scanning" && file && (
            <div className="space-y-5">
              <div className="flex gap-4 p-4 rounded-xl border bg-muted/20">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="size-20 rounded-lg object-cover shrink-0 border" />
                ) : (
                  <div className="size-20 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
                    {isPdf ? <FileText className="size-8 text-red-500" /> : <FileImage className="size-8 text-muted-foreground" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · {isImage ? "Image" : isPdf ? "PDF" : "Document"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-primary">
                    <Sparkles className="size-3.5 animate-pulse" />
                    {scanMsg}
                  </span>
                  <span className="font-bold text-primary">{scanPct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-300"
                    style={{ width: `${scanPct}%` }}
                  />
                </div>

                {/* Animated scan lines preview */}
                <div className="rounded-xl border bg-muted/10 p-4 space-y-2.5 overflow-hidden">
                  {[1, 0.8, 1, 0.6, 0.9, 0.7, 1, 0.5].map((w, i) => (
                    <div
                      key={i}
                      className="h-2 rounded-full bg-muted animate-pulse"
                      style={{
                        width: `${w * 100}%`,
                        animationDelay: `${i * 0.12}s`,
                        opacity: scanPct / 100,
                      }}
                    />
                  ))}
                  <div
                    className="h-3 w-1 bg-primary/70 rounded-full animate-bounce ml-auto"
                    style={{ opacity: 0.6 + 0.4 * (scanPct / 100) }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step: review ── */}
          {(step === "review" || step === "done") && (
            <div className="space-y-4">
              {/* Extraction complete banner */}
              <div className="flex gap-3 items-center p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="size-14 rounded-lg object-cover shrink-0 border border-emerald-200" />
                ) : (
                  <div className="size-14 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    {isPdf ? <FileText className="size-7 text-red-500" /> : <FileImage className="size-7 text-emerald-700" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <CheckCheck className="size-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">Extraction complete</span>
                    {confidence && (
                      <Badge variant="secondary" className="text-[9px] gap-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-0">
                        <Sparkles className="size-2.5" /> AI confidence: {confidence.customer === "high" && confidence.lineItems !== "low" ? "High" : confidence.lineItems === "low" ? "Review carefully" : "Medium"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{file?.name}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground shrink-0" onClick={reset}>
                  <RotateCcw className="size-3" /> Rescan
                </Button>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Pencil className="size-3.5 shrink-0" />
                <span>AI-extracted fields are highlighted — verify and edit before creating the invoice</span>
              </div>

              {/* Split layout: left form / right document preview */}
              <div className="grid sm:grid-cols-5 gap-4">
                {/* ── Left: extracted fields form ── */}
                <div className="sm:col-span-3 space-y-3.5">

                  {/* Header fields: Customer, Date, PO, Due Date */}
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Document Header — AI Extracted</div>

                    {/* Customer */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs font-semibold">Customer *</Label>
                        <ConfidenceBadge level={confidence?.customer ?? "medium"} />
                      </div>
                      <Select value={customerId} onValueChange={setCustomerId}>
                        <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Select customer…" /></SelectTrigger>
                        <SelectContent>
                          {customers.map(c => <SelectItem key={c.id} value={String(c.id)} className="text-xs">{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Invoice Date */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-xs font-semibold">Invoice Date</Label>
                          <ConfidenceBadge level={confidence?.invoiceDate ?? "high"} />
                        </div>
                        <Input
                          type="date" value={invoiceDate} className="h-8 text-xs"
                          onChange={e => setInvoiceDate(e.target.value)}
                        />
                      </div>

                      {/* Due Date */}
                      <div>
                        <Label className="text-xs font-semibold block mb-1">Due Date</Label>
                        <Input
                          type="date" value={dueDate} className="h-8 text-xs"
                          onChange={e => setDueDate(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* PO Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs font-semibold">PO Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <ConfidenceBadge level={confidence?.poNumber ?? "low"} />
                      </div>
                      <Input
                        value={poNumber} placeholder="e.g. PO-12345"
                        className="h-8 text-xs"
                        onChange={e => setPoNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Line items */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-semibold">Line Items</Label>
                        <ConfidenceBadge level={confidence?.lineItems ?? "medium"} />
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addLine}>
                        <Plus className="size-3" /> Add Line
                      </Button>
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Service</th>
                            <th className="text-center px-2 py-2 font-medium text-muted-foreground w-12">Qty</th>
                            <th className="text-right px-2 py-2 font-medium text-muted-foreground w-20">Unit $</th>
                            <th className="text-right px-2 py-2 font-medium text-muted-foreground w-16">Total</th>
                            <th className="w-7" />
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map(item => (
                            <tr key={item.id} className="border-b border-border/40 last:border-0 bg-primary/[0.02]">
                              <td className="py-1.5 px-2">
                                <Select value={item.service} onValueChange={v => changeLine(item.id, "service", v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {SERVICE_TYPES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-1.5 px-2 w-12">
                                <Input className="h-7 text-xs text-center px-1" type="number" min={1} value={item.qty}
                                  onChange={e => changeLine(item.id, "qty", Math.max(1, Number(e.target.value)))} />
                              </td>
                              <td className="py-1.5 px-2 w-20">
                                <Input className="h-7 text-xs text-right px-1" type="number" min={0} value={item.unitPrice}
                                  onChange={e => changeLine(item.id, "unitPrice", Number(e.target.value))} />
                              </td>
                              <td className="py-1.5 px-2 text-right font-semibold w-16">{fmt(lineTotal(item))}</td>
                              <td className="py-1.5 px-2 w-7 text-center">
                                <button onClick={() => removeLine(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 text-xs text-right space-y-0.5 border-t pt-2">
                      <div className="text-muted-foreground">Subtotal: <span className="font-medium text-foreground ml-1">{fmt(sub)}</span></div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-muted-foreground">Tax %:</span>
                        <Input type="number" min={0} max={20} value={taxPct}
                          onChange={e => setTaxPct(Number(e.target.value))}
                          className="h-6 w-14 text-xs text-right px-1.5" />
                      </div>
                      {taxPct > 0 && <div className="text-muted-foreground">Tax ({taxPct}%): <span className="font-medium text-foreground ml-1">{fmt(tax)}</span></div>}
                      <div className="text-base font-extrabold text-primary">Total: {fmt(total)}</div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-xs font-semibold">Notes</Label>
                    <Textarea rows={2} value={notes} className="mt-1 text-xs resize-none"
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Additional notes or payment instructions…" />
                  </div>
                </div>

                {/* ── Right: document preview panel ── */}
                <div className="sm:col-span-2 hidden sm:flex flex-col gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Source Document</div>
                  <div className="flex-1 rounded-xl border bg-muted/20 overflow-hidden flex flex-col items-center justify-center min-h-[200px] relative">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Source document" className="w-full h-full object-contain max-h-[340px]" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 p-6 text-center">
                        {isPdf
                          ? <FileText className="size-14 text-red-400" />
                          : <FileImage className="size-14 text-muted-foreground/40" />}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">{file?.name}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{isPdf ? "PDF — preview not available" : "No preview"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Confidence legend */}
                  <div className="rounded-lg border p-2.5 bg-muted/10 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">AI Confidence Legend</div>
                    {([["high", "emerald", "Field extracted with high certainty"],
                       ["medium", "amber", "Verify before saving"],
                       ["low", "red", "May need manual correction"]] as const).map(([lvl, color, desc]) => (
                      <div key={lvl} className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-400`}>{lvl}</span>
                        <span className="text-[10px] text-muted-foreground">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step: done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <div className="size-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="size-8 text-emerald-600" />
              </div>
              <p className="font-bold text-lg">Invoice created!</p>
              <p className="text-sm text-muted-foreground">Saved as a draft. Closing…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === "review") && (
          <div className="px-6 pb-5 pt-3 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              disabled={!customerId || lineItems.length === 0 || saving}
              onClick={handleCreate}
              className="gap-1.5"
            >
              <FileText className="size-4" />
              {saving ? "Creating…" : "Save as Draft"}
            </Button>
          </div>
        )}
        {step === "idle" && (
          <div className="px-6 pb-5 pt-3 border-t shrink-0 flex justify-end">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [detailInv, setDetailInv] = useState<ApiInvoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paidInv, setPaidInv] = useState<ApiInvoice | null>(null);
  const [paidOpen, setPaidOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      getInvoices().then(setInvoices),
      getCustomers().then(setCustomers),
      getEmployees().then(setEmployees),
    ]).finally(() => setLoading(false));
  }, []);

  async function handleMarkSent(id: number) {
    try {
      const updated = await updateInvoice(id, { status: "sent" });
      setInvoices(prev => prev.map(i => i.id === id ? updated : i));
      // Deliver the invoice to the customer portal
      saveCustomerDocument({
        customerId: updated.customerId,
        customerName: updated.customerName,
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        name: `Invoice ${updated.invoiceNumber}.pdf`,
        type: "invoice",
        description: `Total: $${updated.totalAmount.toLocaleString()}`,
        sentBy: "Multicorp Manager",
        sentByRole: "Manager",
        amount: updated.totalAmount,
        invoiceStatus: "sent",
      });
      toast.success("Invoice sent to customer portal");
    } catch {
      toast.error("Failed to update invoice");
    }
  }

  async function handleMarkPaid(id: number, _method: PaymentMethod) {
    try {
      const updated = await updateInvoice(id, { status: "paid" });
      setInvoices(prev => prev.map(i => i.id === id ? updated : i));
      toast.success("Payment recorded");
    } catch {
      toast.error("Failed to record payment");
    }
  }

  async function handleMarkOverdue(id: number) {
    try {
      const updated = await updateInvoice(id, { status: "overdue" });
      setInvoices(prev => prev.map(i => i.id === id ? updated : i));
      toast.success("Invoice marked as overdue");
    } catch {
      toast.error("Failed to update invoice");
    }
  }

  function openDetail(inv: ApiInvoice) {
    setDetailInv(inv);
    setDetailOpen(true);
  }

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === byTab.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(byTab.map(i => i.id)));
    }
  }

  function getAgeDays(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  }

  function downloadCsv() {
    const rows = [["Invoice #", "Customer", "Status", "Amount", "Date", "Age (days)"]];
    byTab.forEach(inv => rows.push([inv.invoiceNumber, inv.customerName, inv.status, inv.totalAmount.toFixed(2), fmtDate(inv.generatedAt), getAgeDays(inv.generatedAt).toString()]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "invoices.csv" });
    a.click();
  }

  async function bulkMarkSent() {
    const drafts = byTab.filter(i => selectedIds.has(i.id) && i.status === "draft");
    await Promise.all(drafts.map(i => handleMarkSent(i.id)));
    setSelectedIds(new Set());
  }

  async function bulkMarkOverdue() {
    const sent = byTab.filter(i => selectedIds.has(i.id) && i.status === "sent");
    await Promise.all(sent.map(i => handleMarkOverdue(i.id)));
    setSelectedIds(new Set());
  }

  const statusOrder = ["overdue", "sent", "draft", "paid"];
  const sortedInvoices = [...invoices].sort((a, b) => {
    const ao = statusOrder.indexOf(a.status);
    const bo = statusOrder.indexOf(b.status);
    return (ao === -1 ? 99 : ao) - (bo === -1 ? 99 : bo);
  });

  const byTab = sortedInvoices.filter(i => {
    if (tab !== "all" && i.status !== tab) return false;
    const q = search.toLowerCase();
    return !q || i.customerName.toLowerCase().includes(q) || i.invoiceNumber.toLowerCase().includes(q);
  });

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.totalAmount, 0);
  const totalOutstanding = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.totalAmount, 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  const tabCounts = {
    all: invoices.length,
    draft: invoices.filter(i => i.status === "draft").length,
    sent: invoices.filter(i => i.status === "sent").length,
    overdue: invoices.filter(i => i.status === "overdue").length,
    paid: invoices.filter(i => i.status === "paid").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="size-6 text-primary shrink-0" /> Invoices
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {invoices.length} invoices · {fmt(totalPaid)} collected · {fmt(totalOutstanding)} outstanding
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCsv}>
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setScanOpen(true)}>
            <ScanLine className="size-3.5" />
            <span className="hidden sm:inline">Scan to Invoice</span>
            <span className="sm:hidden">Scan</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 bg-primary/10 text-primary border-0 -ml-0.5">AI</Badge>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /> New Invoice
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Invoiced", value: fmt(invoices.reduce((s, i) => s + i.totalAmount, 0)), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
          { label: "Collected", value: fmt(totalPaid), icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
          { label: "Outstanding", value: fmt(totalOutstanding), icon: Clock, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
          { label: "Overdue", value: String(overdueCount), icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <stat.icon className={`size-4 ${stat.color}`} />
                </div>
              </div>
              <div className="text-xl font-extrabold">{loading ? "—" : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={tab} onValueChange={v => { setTab(v); setSelectedIds(new Set()); }} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all" className="text-xs">All ({tabCounts.all})</TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs text-red-600">Overdue ({tabCounts.overdue})</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs">Sent ({tabCounts.sent})</TabsTrigger>
            <TabsTrigger value="draft" className="text-xs">Draft ({tabCounts.draft})</TabsTrigger>
            <TabsTrigger value="paid" className="text-xs">Paid ({tabCounts.paid})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search invoices…" className="pl-8 h-9 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <span className="text-xs font-semibold text-primary">{selectedIds.size} selected</span>
          <div className="flex gap-2 flex-wrap">
            {byTab.some(i => selectedIds.has(i.id) && i.status === "draft") && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={bulkMarkSent}>
                <Send className="size-3" /> Send All Drafts
              </Button>
            )}
            {byTab.some(i => selectedIds.has(i.id) && i.status === "sent") && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-200" onClick={bulkMarkOverdue}>
                <AlertTriangle className="size-3" /> Mark Overdue
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
          <div className="ml-auto">
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={toggleSelectAll}>
              {selectedIds.size === byTab.length ? "Deselect all" : "Select all"}
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Loading invoices…</p>}
        {byTab.map(inv => {
          const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft;
          const Icon = cfg.icon;
          const ageDays = getAgeDays(inv.generatedAt);
          const isSelected = selectedIds.has(inv.id);
          return (
            <div
              key={inv.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow cursor-pointer ${isSelected ? "border-primary/40 bg-primary/5" : ""}`}
              onClick={() => openDetail(inv)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div onClick={e => { e.stopPropagation(); toggleSelect(inv.id); }}
                  className={`size-5 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30 hover:border-primary/50"}`}>
                  {isSelected && <CheckCheck className="size-3 text-white" />}
                </div>
                <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{inv.invoiceNumber}</span>
                    <Badge variant="secondary" className={`text-[10px] gap-0.5 ${cfg.color}`}>
                      <Icon className="size-2.5" />{cfg.label}
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] ${ageDays > 60 ? "border-red-300 text-red-600" : ageDays > 30 ? "border-amber-300 text-amber-600" : "text-muted-foreground"}`}>
                      {ageDays}d ago
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{inv.customerName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtDate(inv.generatedAt)} · {inv.techName ?? <span className="italic">Open</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <div className="text-right">
                  <div className="font-extrabold text-base">{fmt(inv.totalAmount)}</div>
                  <div className="text-[10px] text-muted-foreground">{inv.lineItems.length} line item{inv.lineItems.length !== 1 ? "s" : ""}</div>
                </div>

                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openDetail(inv)}>
                    <Eye className="size-3.5" />
                  </Button>
                  {inv.status === "draft" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={async () => { await handleMarkSent(inv.id); }}>
                      <Send className="size-3" /> Send
                    </Button>
                  )}
                  {(inv.status === "sent" || inv.status === "overdue") && (
                    <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => { setPaidInv(inv); setPaidOpen(true); }}>
                      <CheckCircle2 className="size-3" /> Paid
                    </Button>
                  )}
                  {inv.status === "sent" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={async () => { await handleMarkOverdue(inv.id); }}>
                      <AlertTriangle className="size-3" /> Overdue
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!loading && byTab.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No invoices{tab !== "all" ? ` with status "${tab}"` : ""}.
          </div>
        )}
      </div>

      {/* Dialogs */}
      <InvoiceDetailDialog
        inv={detailInv} open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onMarkSent={handleMarkSent}
        onOpenPaid={inv => { setPaidInv(inv); setPaidOpen(true); }}
      />
      <MarkPaidDialog
        inv={paidInv} open={paidOpen}
        onClose={() => setPaidOpen(false)}
        onConfirm={handleMarkPaid}
      />
      <CreateInvoiceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={inv => setInvoices(prev => [inv, ...prev])}
        customers={customers}
        employees={employees}
      />
      <ScanToInvoiceDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onSave={inv => setInvoices(prev => [inv, ...prev])}
        customers={customers}
      />
    </div>
  );
}
