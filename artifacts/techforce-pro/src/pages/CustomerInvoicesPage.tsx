import { useEffect, useState } from "react";
import type { ConvexInvoice, ConvexCustomer } from "@/lib/convex-types";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock, Download,
  Eye, FileCheck, FileText, Image, ReceiptText, Send, Sparkles,
  FolderOpen, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  loadCustomerDocuments,
  markDocumentViewed,
  type CustomerDocument,
} from "@/lib/customerDocuments";
import { downloadInvoicePdf, downloadDocument } from "@/lib/docDownload";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return fmtDate(iso);
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  sent:    { label: "Awaiting Payment",    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",       icon: Send },
  paid:    { label: "Paid",               className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  overdue: { label: "Overdue",            className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",             icon: AlertTriangle },
  draft:   { label: "Draft",              className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",           icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.className}`}>
      <Icon className="size-3" /> {cfg.label}
    </span>
  );
}

// ─── Invoice Detail Dialog ─────────────────────────────────────────────────────

function InvoiceDetailDialog({ inv, open, onClose }: { inv: any | null; open: boolean; onClose: () => void }) {
  if (!inv) return null;
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" /> {inv.invoiceNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Summary grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {([
              ["Invoice #", inv.invoiceNumber],
              ["Date", fmtDate(inv.generatedAt)],
              ["Status", <StatusBadge key="s" status={inv.status} />],
              ["Service Provider", "Multicorp Fire Protection Services"],
              ["Technician", inv.techName ?? "—"],
              ["Amount Due", <span key="a" className={`font-bold text-sm ${inv.status === "paid" ? "text-emerald-600" : "text-primary"}`}>{fmt(inv.totalAmount)}</span>],
            ] as [string, React.ReactNode][]).map(([k, v]) => (
              <div key={k as string} className="bg-muted/40 rounded-lg p-2.5">
                <div className="text-muted-foreground mb-0.5 text-[10px] uppercase tracking-wide">{k}</div>
                <div className="font-semibold">{v}</div>
              </div>
            ))}
          </div>

          {/* Company from/to block */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border p-3 space-y-0.5">
              <p className="font-bold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">From</p>
              <p className="font-semibold">Multicorp Fire Protection Services</p>
              <p className="text-muted-foreground">9693 Gerwig Lane, Columbia MD 21046</p>
              <p className="text-muted-foreground">(410) 876-5000</p>
            </div>
            <div className="rounded-lg border p-3 space-y-0.5">
              <p className="font-bold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Bill To</p>
              <p className="font-semibold">{inv.customerName}</p>
            </div>
          </div>

          {/* Line items */}
          {inv.lineItems.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Service</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Rate</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {inv.lineItems.map((l: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium">{l.service}</td>
                      <td className="px-3 py-2.5 text-center text-xs">{l.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-xs">{fmt(l.rate)}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{fmt(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/20 border-t">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-right font-bold text-sm">Total Due</td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-base text-primary">{fmt(inv.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {inv.status === "sent" || inv.status === "overdue" ? (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm space-y-1">
              <p className="font-semibold text-primary">Payment Instructions</p>
              <p className="text-muted-foreground text-xs">Please remit payment via check, ACH, or Zelle. Make checks payable to <strong>Multicorp Fire Protection Services</strong>.</p>
              <p className="text-muted-foreground text-xs">Questions? Call us at (410) 876-5000 or reply via the Messages section.</p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" className="gap-1.5" onClick={() => { downloadInvoicePdf(inv); toast.success("Invoice PDF downloaded"); }}>
            <Download className="size-3.5" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document type icons/colors ───────────────────────────────────────────────

const DOC_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice:     ReceiptText,
  certificate: FileCheck,
  report:      FileText,
  photo:       Image,
  signature:   FileText,
  other:       FileText,
};

const DOC_COLOR: Record<string, string> = {
  invoice:     "text-primary bg-primary/10",
  certificate: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  report:      "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  photo:       "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  signature:   "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
  other:       "text-gray-600 bg-gray-50 dark:bg-gray-900/20",
};

// ─── Documents Panel ───────────────────────────────────────────────────────────

function DocumentsPanel({ docs, onView }: { docs: CustomerDocument[]; onView: (doc: CustomerDocument) => void }) {
  const [expanded, setExpanded] = useState(true);

  if (docs.length === 0) return null;

  return (
    <Card>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="size-4 text-primary" /> Documents & Files
          <Badge variant="secondary" className="text-[10px]">{docs.length}</Badge>
          {docs.some(d => !d.viewed) && (
            <Badge variant="destructive" className="text-[9px] px-1.5">
              {docs.filter(d => !d.viewed).length} new
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <CardContent className="pt-0 pb-3">
          <div className="divide-y divide-border/50 rounded-lg border overflow-hidden">
            {docs.map(doc => {
              const Icon = DOC_ICON[doc.type] ?? FileText;
              const color = DOC_COLOR[doc.type] ?? DOC_COLOR.other;
              return (
                <div key={doc.id} className={`flex items-center gap-3 px-3 py-3 hover:bg-muted/20 transition-colors ${!doc.viewed ? "bg-primary/5" : ""}`}>
                  <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${color.split(" ").slice(1).join(" ")}`}>
                    <Icon className={`size-4 ${color.split(" ")[0]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{doc.name}</span>
                      {!doc.viewed && <Badge variant="secondary" className="text-[9px] px-1.5 bg-primary/10 text-primary shrink-0">New</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Sent by {doc.sentBy} ({doc.sentByRole}) · {timeAgo(doc.sentAt)}
                      {doc.description && ` · ${doc.description}`}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => onView(doc)}
                    >
                      <Eye className="size-3" /> View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        downloadDocument(doc.name, { issuedBy: "Multicorp Fire Protection Services", date: fmtDate(doc.sentAt) });
                        markDocumentViewed(doc.id);
                      }}
                    >
                      <Download className="size-3" /> Save
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function CustomerInvoicesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const allInvoices = (useQuery(api.invoices.list) ?? []) as ConvexInvoice[];
  const allCustomers = (useQuery(api.customers.list) ?? []) as ConvexCustomer[];
  // Sort by creation time for deterministic ordering, then index by numeric auth ID
  const custId = parseInt((user?.id ?? "").replace(/\D/g, "")) || 1;
  const sortedCustomers = [...allCustomers].sort((a, b) => a._creationTime - b._creationTime);
  const myCust: ConvexCustomer | undefined = sortedCustomers[custId - 1];
  // Never fall back to showing all invoices — show nothing while loading or if lookup fails
  const invoices = myCust ? allInvoices.filter(i => i.customerId === myCust._id) : [];
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
    const [tab, setTab] = useState<"all" | "open" | "paid">("all");
  const [selectedInv, setSelectedInv] = useState<ConvexInvoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<CustomerDocument | null>(null);
  const [docViewOpen, setDocViewOpen] = useState(false);

  const customerId = myCust?._id ?? null;


  function openInvoice(inv: ConvexInvoice) {
    setSelectedInv(inv);
    setDetailOpen(true);
    // Mark the corresponding document as viewed
    const doc = docs.find(d => d.invoiceId === inv._id);
    if (doc && !doc.viewed) {
      markDocumentViewed(doc.id);
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, viewed: true } : d));
    }
  }

  function openDocView(doc: CustomerDocument) {
    setViewingDoc(doc);
    setDocViewOpen(true);
    if (!doc.viewed) {
      markDocumentViewed(doc.id);
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, viewed: true } : d));
    }
  }

  const displayed = invoices.filter(i => {
    if (tab === "open") return i.status === "sent" || i.status === "overdue";
    if (tab === "paid") return i.status === "paid";
    return true;
  });

  const totalDue = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((s: number, i: any) => s + i.totalAmount, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s: number, i: any) => s + i.totalAmount, 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;
  const unviewedDocs = docs.filter(d => !d.viewed).length;

  const nonInvoiceDocs = docs.filter(d => d.type !== "invoice");

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customer-portal")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ReceiptText className="size-6 text-primary" /> My Invoices & Documents
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              View, download, and track invoices from Multicorp Fire Protection
            </p>
          </div>
        </div>
        {(overdueCount > 0 || unviewedDocs > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="gap-1.5 px-3 py-1.5 text-sm">
                <AlertTriangle className="size-3.5" /> {overdueCount} overdue
              </Badge>
            )}
            {unviewedDocs > 0 && (
              <Badge className="gap-1.5 px-3 py-1.5 text-sm bg-primary">
                <Sparkles className="size-3.5" /> {unviewedDocs} new item{unviewedDocs > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={overdueCount > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Amount Due</div>
            <div className={`text-2xl font-extrabold ${totalDue > 0 ? "text-primary" : "text-foreground"}`}>{fmt(totalDue)}</div>
            {overdueCount > 0 && <div className="text-[10px] text-destructive mt-0.5">{overdueCount} overdue</div>}
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Total Paid</div>
            <div className="text-2xl font-extrabold text-emerald-600">{fmt(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">All Invoices</div>
            <div className="text-2xl font-extrabold">{invoices.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Documents panel — non-invoice docs from manager */}
      <DocumentsPanel docs={nonInvoiceDocs} onView={openDocView} />

      {/* Invoices */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <ReceiptText className="size-4 text-primary" /> Invoices
            </CardTitle>
            <div className="flex gap-1">
              {(["all", "open", "paid"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 text-muted-foreground"}`}
                >
                  {t === "all" ? `All (${invoices.length})` : t === "open" ? `Open (${invoices.filter(i => i.status === "sent" || i.status === "overdue").length})` : `Paid (${invoices.filter(i => i.status === "paid").length})`}
                </button>
              ))}
            </div>
          </div>
          <CardDescription>Click any invoice to view the full breakdown and download it</CardDescription>
        </CardHeader>
        <CardContent>
          {displayed.length === 0 ? (
            <div className="py-12 text-center">
              <ReceiptText className="size-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-semibold text-muted-foreground">No invoices yet</p>
              <p className="text-xs text-muted-foreground mt-1">Invoices sent by Multicorp will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.sort((a, b) => {
                const order = { overdue: 0, sent: 1, paid: 2, draft: 3 };
                return (order[a.status as keyof typeof order] ?? 9) - (order[b.status as keyof typeof order] ?? 9);
              }).map(inv => {
                const isUnread = docs.some(d => d.invoiceId === inv._id && !d.viewed);
                return (
                  <div
                    key={inv.id}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer hover:bg-muted/20 transition-colors group ${
                      inv.status === "overdue" ? "border-destructive/30 bg-destructive/5" :
                      isUnread ? "border-primary/30 bg-primary/5" : ""
                    }`}
                    onClick={() => openInvoice(inv)}
                  >
                    <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                      inv.status === "paid" ? "bg-emerald-50 dark:bg-emerald-900/20" :
                      inv.status === "overdue" ? "bg-red-50 dark:bg-red-900/20" :
                      "bg-primary/10"
                    }`}>
                      <ReceiptText className={`size-5 ${
                        inv.status === "paid" ? "text-emerald-600" :
                        inv.status === "overdue" ? "text-red-600" : "text-primary"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{inv.invoiceNumber}</span>
                        {isUnread && <Badge className="text-[9px] px-1.5 bg-primary shrink-0">New</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(inv.generatedAt)}
                        {inv.lineItems.length > 0 && ` · ${inv.lineItems[0].service}`}
                        {inv.lineItems.length > 1 && ` +${inv.lineItems.length - 1} more`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className={`font-bold text-sm ${inv.status === "paid" ? "text-emerald-600" : inv.status === "overdue" ? "text-destructive" : "text-primary"}`}>
                          {fmt(inv.totalAmount)}
                        </div>
                        <div className="mt-0.5"><StatusBadge status={inv.status} /></div>
                      </div>
                      <Eye className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {invoices.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          To dispute an invoice or request a copy, contact us at (410) 876-5000 or send a message through the portal.
        </p>
      )}

      {/* Invoice Detail Dialog */}
      <InvoiceDetailDialog inv={selectedInv} open={detailOpen} onClose={() => setDetailOpen(false)} />

      {/* Document View Dialog */}
      {viewingDoc && (
        <Dialog open={docViewOpen} onOpenChange={o => !o && setDocViewOpen(false)}>
          <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                {(() => { const Icon = DOC_ICON[viewingDoc.type] ?? FileText; return <Icon className="size-5 text-primary" />; })()}
                {viewingDoc.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="rounded-xl border p-6 flex flex-col items-center gap-4 bg-muted/20">
                {(() => { const Icon = DOC_ICON[viewingDoc.type] ?? FileText; const color = DOC_COLOR[viewingDoc.type] ?? DOC_COLOR.other; return (
                  <div className={`size-16 rounded-full flex items-center justify-center ${color.split(" ").slice(1).join(" ")}`}>
                    <Icon className={`size-8 ${color.split(" ")[0]}`} />
                  </div>
                ); })()}
                <div className="text-center">
                  <p className="font-semibold">{viewingDoc.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sent by {viewingDoc.sentBy} · {fmtDate(viewingDoc.sentAt)}</p>
                  {viewingDoc.description && <p className="text-xs text-muted-foreground mt-0.5">{viewingDoc.description}</p>}
                </div>
                <div className="w-full rounded-lg bg-background border p-4 space-y-2">
                  {[1, 0.85, 1, 0.7, 0.9, 0.6].map((w, i) => (
                    <div key={i} className="h-2 bg-muted rounded-full" style={{ width: `${w * 100}%` }} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Generated by TechForce Pro · Multicorp Fire Protection Services
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setDocViewOpen(false)}>Close</Button>
                <Button size="sm" className="gap-1.5" onClick={() => { downloadDocument(viewingDoc.name, { issuedBy: "Multicorp Fire Protection Services", date: fmtDate(viewingDoc.sentAt) }); toast.success("Document downloaded"); }}>
                  <Download className="size-3.5" /> Download
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
