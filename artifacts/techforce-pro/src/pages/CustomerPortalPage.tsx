import { serviceTypeLabel } from "@/lib/utils";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { downloadDocument } from "@/lib/docDownload";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileText,
  FileUp,
  History,
  Mail,
  MapPin,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  Receipt,
  Reply,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  countUnread,
  deleteMessage,
  loadMessages,
  markAsRead,
  seedMessagesIfNeeded,
  sendMessage,
  type Attachment,
  type Message,
} from "@/lib/messaging";
import { useQuery, useMutation } from "convex/react";
import type { ConvexJob, ConvexCustomer, ConvexInvoice, ConvexEmployee, ConvexServiceRequest } from "@/lib/convex-types";
import { api } from "@/convex/_generated/api";

import { downloadInvoicePdf } from "@/lib/docDownload";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// ─── Static customer data ─────────────────────────────────────────────────

const customerLocations = [
  { id: "L-001", name: "Wilde Lake High School",    address: "5460 Trumpeter Rd, Columbia, MD",           lastService: "Apr 15, 2026", nextService: "Oct 15, 2026", status: "current" },
  { id: "L-002", name: "Oakland Mills Middle",       address: "9540 Kilimanjaro Rd, Columbia, MD",         lastService: "Apr 16, 2026", nextService: "Oct 16, 2026", status: "current" },
  { id: "L-003", name: "Talbott Springs Elementary", address: "9550 Basket Ring Rd, Columbia, MD",         lastService: "Mar 22, 2026", nextService: "Sep 22, 2026", status: "current" },
  { id: "L-004", name: "Harper's Choice Middle",    address: "5450 Beaverkill Rd, Columbia, MD",           lastService: "May 1, 2026",  nextService: "Nov 1, 2026",  status: "current" },
  { id: "L-005", name: "Hammond High School",        address: "8800 Guilford Rd, Columbia, MD",            lastService: "Feb 10, 2026", nextService: "Aug 10, 2026", status: "due-soon" },
  { id: "L-006", name: "Admin Building",             address: "10910 Clarksville Pike, Ellicott City, MD", lastService: "Jan 20, 2026", nextService: "Jul 20, 2026", status: "overdue" },
];

const upcomingServices = [
  { id: "S-001", location: "Hammond High School",   type: "Extinguisher Annual + Suppression", date: "Jun 18, 2026", tech: "Marcus Taylor",  status: "scheduled", time: "8:00 AM – 12:00 PM" },
  { id: "S-002", location: "Admin Building",         type: "Full Fire Safety Inspection",       date: "Jun 25, 2026", tech: "Sarah Johnson",  status: "scheduled", time: "9:00 AM – 2:00 PM"  },
  { id: "S-003", location: "Wilde Lake High School", type: "Sprinkler System Test",             date: "Jul 10, 2026", tech: "TBD",            status: "pending",   time: "7:00 AM – 11:00 AM" },
];

const pastInspections = [
  { id: "I-001", locationId: "L-003", location: "Talbott Springs Elementary", type: "Extinguisher Annual",         date: "Mar 22, 2026", tech: "Kevin Park",    result: "pass", units: 24, deficiencies: 0, certFile: "cert_talbott_2026.pdf",   invoiceId: "INV-2026-003", invoiceAmt: "$1,200", reportFile: "report_talbott_2026.pdf", managerNote: "All 24 extinguishers serviced and tagged. Zero deficiencies — great compliance record! Certificate valid through March 2027." },
  { id: "I-002", locationId: "L-004", location: "Harper's Choice Middle",     type: "Suppression + Extinguisher", date: "May 1, 2026",  tech: "Sarah Johnson", result: "pass", units: 18, deficiencies: 1, certFile: "cert_harpers_2026.pdf",   invoiceId: "INV-2026-007", invoiceAmt: "$2,850", reportFile: "report_harpers_2026.pdf", managerNote: "1 extinguisher requires follow-up replacement within 30 days. All suppression systems passed." },
  { id: "I-003", locationId: "L-001", location: "Wilde Lake High School",     type: "Full Fire Safety",           date: "Apr 15, 2026", tech: "Angela Davis",  result: "pass", units: 32, deficiencies: 2, certFile: "cert_wildelake_2026.pdf", invoiceId: "INV-2026-005", invoiceAmt: "$3,400", reportFile: "report_wildelake_2026.pdf", managerNote: "2 exit lights need bulb replacement within 60 days — non-urgent. Certificate issued and emailed separately." },
  { id: "I-004", locationId: "L-002", location: "Oakland Mills Middle",       type: "Extinguisher Annual",         date: "Apr 16, 2026", tech: "Marcus Taylor", result: "pass", units: 20, deficiencies: 0, certFile: "cert_oakland_2026.pdf",   invoiceId: "INV-2026-006", invoiceAmt: "$1,800", reportFile: "report_oakland_2026.pdf", managerNote: "Clean inspection — all 20 units pass. No deficiencies. See you next April!" },
  { id: "I-005", locationId: "L-005", location: "Hammond High School",        type: "Suppression Inspection",      date: "Feb 10, 2026", tech: "Angela Davis",  result: "fail", units: 14, deficiencies: 3, certFile: "",                         invoiceId: "INV-2026-002", invoiceAmt: "$2,100", reportFile: "report_hammond_2026.pdf", managerNote: "3 deficiencies require corrective action before next inspection. Re-inspection needed within 30 days." },
];

const locationComms: Record<string, { date: string; from: string; subject: string; body: string; attachments: string[] }[]> = {
  "L-001": [
    { date: "Apr 15, 2026", from: "James Rodriguez (Manager)", subject: "Inspection Complete — Wilde Lake", body: "Wilde Lake full fire safety inspection complete. 2 exit lights need bulb replacement within 60 days — non-urgent. Certificate issued and emailed separately.", attachments: ["cert_wildelake_2026.pdf"] },
  ],
  "L-003": [
    { date: "Mar 22, 2026", from: "James Rodriguez (Manager)", subject: "Talbott Springs — Annual complete", body: "All 24 extinguishers serviced and tagged. Zero deficiencies — great compliance record! Certificate is valid through March 2027.", attachments: ["cert_talbott_2026.pdf", "inspection_report_talbott.pdf"] },
  ],
  "L-005": [
    { date: "Feb 10, 2026", from: "James Rodriguez (Manager)", subject: "Hammond High — Follow-up Required", body: "The suppression system at Hammond High School has 3 deficiencies that require corrective action before your next inspection. A re-inspection is needed within 30 days. Please contact our office to schedule.", attachments: [] },
    { date: "Feb 12, 2026", from: "James Rodriguez (Manager)", subject: "Hammond re-inspection scheduled for Mar 5", body: "We've scheduled the return visit for March 5, 2026. Derek Williams will be on-site at 9 AM. Please ensure the boiler room is accessible.", attachments: [] },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function inferAttachType(filename: string): Attachment["type"] {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "heic"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "document";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Inline document viewer ───────────────────────────────────────────────

function DocViewerDialog({
  open,
  fileName,
  onClose,
}: {
  open: boolean;
  fileName: string;
  onClose: () => void;
}) {
  const isPdf = fileName.endsWith(".pdf");
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileText className="size-4 text-red-500" />
            {fileName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Simulated PDF viewer */}
          <div className="rounded-lg border bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-8 gap-3 min-h-40">
            <div className="size-14 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <FileText className="size-8 text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">{fileName}</p>
              <p className="text-xs text-muted-foreground mt-1">Multicorp Fire Protection Services</p>
              <p className="text-xs text-muted-foreground">Issued May 2026</p>
            </div>
            <Badge variant="default" className="bg-emerald-600 gap-1 text-xs">
              <ShieldCheck className="size-3" /> Official Document
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button className="gap-1.5" onClick={() => downloadDocument(fileName, { date: "May 2026", issuedBy: "Multicorp Fire Protection Services" })}>
            <Download className="size-3.5" /> Download {isPdf ? "PDF" : "File"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AI Invoice Scanner ───────────────────────────────────────────────────────

type ScannedService = { name: string; description: string; qty: number; unitPrice: number };
type ScannedData = { companyName: string; address: string; services: ScannedService[]; notes: string };

function ScanInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"upload" | "analyzing" | "review" | "done">("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState("");
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [scannedData, setScannedData] = useState<ScannedData | null>(null);
  const [items, setItems] = useState<ScannedService[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setImagePreview(null);
    setImageBase64("");
    setScannedData(null);
    setItems([]);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      setImageBase64(result.split(",")[1]);
      setMimeType(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  }

  async function analyze() {
    setStep("analyzing");
    try {
      const resp = await fetch("/api/invoice-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      if (!resp.ok) throw new Error("unavailable");
      const result = await resp.json();
      if (result.success && result.data) {
        setScannedData(result.data);
        setItems((result.data.services ?? []).map((s: ScannedService) => ({
          name: s.name || "",
          description: s.description || "",
          qty: Number(s.qty) || 1,
          unitPrice: Number(s.unitPrice) || 0,
        })));
        setStep("review");
      } else {
        toast.error("Could not read the invoice. Please try a clearer photo.");
        setStep("upload");
      }
    } catch {
      toast.error("AI invoice scanning is not available on this deployment.");
      setStep("upload");
    }
  }

  function updateItem(i: number, field: keyof ScannedService, value: string | number) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  function addItem() {
    setItems(prev => [...prev, { name: "", description: "", qty: 1, unitPrice: 0 }]);
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit() {
    toast.success("Invoice submitted! Your team will review and process the items.");
    setStep("done");
  }

  const total = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5 text-primary" /> Scan Invoice Template
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <>
            <div className="flex-1 overflow-y-auto space-y-4">
              <p className="text-sm text-muted-foreground">
                Take a photo of your paper invoice. AI will extract the template structure so you can confirm or edit the line items before submitting.
              </p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border">
                  <img src={imagePreview} alt="Invoice preview" className="w-full max-h-64 object-contain bg-muted/30" />
                  <button
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                    onClick={() => { setImagePreview(null); setImageBase64(""); if (fileRef.current) fileRef.current.value = ""; }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  className="rounded-xl border-2 border-dashed border-border p-10 flex flex-col items-center gap-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="size-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">Take a photo or upload an image</p>
                    <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or HEIC — camera supported on mobile</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 mt-1" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                    <FileUp className="size-3.5" /> Choose File
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => { onClose(); reset(); }}>Cancel</Button>
              <Button disabled={!imageBase64} onClick={analyze} className="gap-1.5">
                <Sparkles className="size-4" /> Analyze Invoice
              </Button>
            </div>
          </>
        )}

        {step === "analyzing" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-5">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Sparkles className="size-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Analyzing your invoice…</p>
              <p className="text-xs text-muted-foreground mt-1">AI is reading the template structure</p>
            </div>
            <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-3/5 bg-primary rounded-full animate-pulse" />
            </div>
          </div>
        )}

        {step === "review" && scannedData && (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {scannedData.companyName && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">Template Detected</p>
                  <p className="text-sm font-bold mt-0.5">{scannedData.companyName}</p>
                  {scannedData.address && <p className="text-xs text-muted-foreground mt-0.5">{scannedData.address}</p>}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold">Line Items — Edit as Needed</Label>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addItem}>
                    <Plus className="size-3" /> Add Row
                  </Button>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Service / Item</th>
                        <th className="text-center px-2 py-2 font-medium text-muted-foreground w-14">Qty</th>
                        <th className="text-right px-2 py-2 font-medium text-muted-foreground w-24">Unit $</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item, i) => (
                        <tr key={i} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <input
                              className="w-full text-xs bg-transparent outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 py-0.5"
                              value={item.name}
                              onChange={e => updateItem(i, "name", e.target.value)}
                              placeholder="Service name…"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              className="w-full text-xs text-center bg-transparent outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 py-0.5"
                              value={item.qty}
                              min={1}
                              onChange={e => updateItem(i, "qty", Number(e.target.value))}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              className="w-full text-xs text-right bg-transparent outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 py-0.5"
                              value={item.unitPrice}
                              min={0}
                              onChange={e => updateItem(i, "unitPrice", Number(e.target.value))}
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-4 text-muted-foreground text-xs">No items extracted — add them manually</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-muted/20 border-t">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-right font-bold text-xs">Total</td>
                        <td className="px-3 py-2 text-right font-extrabold text-sm text-primary">
                          ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {scannedData.notes && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs">
                  <span className="font-semibold">Notes: </span>
                  <span className="text-muted-foreground">{scannedData.notes}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 pt-3 border-t">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={reset}>
                <Camera className="size-3.5" /> Re-scan
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { onClose(); reset(); }}>Cancel</Button>
                <Button disabled={items.length === 0} onClick={handleSubmit} className="gap-1.5">
                  <CheckCircle2 className="size-4" /> Submit Invoice
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
            <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">Invoice Submitted!</p>
              <p className="text-xs text-muted-foreground mt-1">Your team will review and process the invoice items.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { onClose(); reset(); }}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Component ───────────────────────────────────────────────────────────

export function CustomerPortalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId   = user?.id ?? "cust-1";
  const userName = user?.name ?? "Customer";

  // ── Real data from Convex ──
  const allEmployees   = (useQuery(api.employees.list) ?? []) as ConvexEmployee[];
  const allCustomers   = (useQuery(api.customers.list) ?? []) as ConvexCustomer[];
  const apiJobs        = (useQuery(api.jobs.list)       ?? []) as ConvexJob[];
  const apiInvoices    = (useQuery(api.invoices.list)   ?? []) as ConvexInvoice[];
  const convexRequests = (useQuery(api.serviceRequests.list, {}) ?? []) as ConvexServiceRequest[];
  const createServiceRequest = useMutation(api.serviceRequests.create);
  const staffList      = allEmployees.filter(e => e.role === "admin" || e.role === "suppression_lead");

  // Parse numeric customer ID from auth userId (e.g. "cust-1" → 1, "1" → 1)
  const customerId = parseInt(userId.replace(/\D/g, "")) || 1;
  // Sort by creation time for deterministic ordering, then index by numeric auth ID
  const sortedCustomers = [...allCustomers].sort((a, b) => a._creationTime - b._creationTime);
  const myCust: ConvexCustomer | undefined = sortedCustomers[customerId - 1];

  // Derived: jobs + invoices scoped to this customer — never fall back to all data while loading
  const myJobs     = myCust ? apiJobs.filter(j     => j.customerId    === myCust._id) : [];
  const myInvoices = myCust ? apiInvoices.filter(inv => inv.customerId === myCust._id) : [];
  const upcomingJobs = myJobs
    .filter(j => j.status !== "completed")
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""));
  const completedJobs = myJobs.filter(j => j.status === "completed");
  const unpaidInvoices = myInvoices.filter(inv => inv.status !== "paid");
  const totalOutstanding = unpaidInvoices.reduce((s, inv) => s + inv.totalAmount, 0);

  // ── Service request form state ──
  const [reqLocation, setReqLocation] = useState("");
  const [reqServiceType, setReqServiceType] = useState("");
  const [reqUrgency, setReqUrgency] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [reqNotes, setReqNotes] = useState("");
  const [reqSaving, setReqSaving] = useState(false);

  // Compose recipients — only manager and supervisor
  const empRecipients = staffList.map(e => ({
    id: String(e.id),
    name: e.name,
    role: e.role === "admin" ? "Manager" : "Supervisor",
    subtitle: e.role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
  }));

  // ── Overview state ──
  const [requestOpen, setRequestOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [searchLoc, setSearchLoc] = useState("");

  // ── Job History state ──
  const [historyLocation, setHistoryLocation] = useState<string>("");

  // ── Doc viewer state ──
  const [docViewOpen, setDocViewOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState("");

  function openDoc(fileName: string) {
    setViewingFile(fileName);
    setDocViewOpen(true);
  }

  // ── Messaging state ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [toId, setToId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileAttachRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    seedMessagesIfNeeded();
    setMessages(loadMessages());
  }, []);

  function refreshMsgs() { setMessages(loadMessages()); }

  const inbox  = messages.filter(m => m.toId === userId && !m.deletedByRecipient);
  const sent   = messages.filter(m => m.fromId === userId && !m.deletedBySender);
  const unread = countUnread(userId);

  function canDeleteMsg(msg: Message): boolean {
    return msg.fromId === userId;
  }

  function openMessage(msg: Message) {
    if (msg.toId === userId && !msg.readByRecipient) { markAsRead(msg.id); refreshMsgs(); }
    setSelectedMsg(msg);
  }

  function handleDeleteMsg(msg: Message) {
    if (!canDeleteMsg(msg)) return;
    deleteMessage(msg.id, userId);
    if (selectedMsg?.id === msg.id) setSelectedMsg(null);
    refreshMsgs();
  }

  function handleSend() {
    const recipient = empRecipients.find(r => r.id === toId);
    if (!recipient || !subject.trim() || !body.trim()) return;
    sendMessage({
      fromId: userId, fromName: userName, fromRole: "customer",
      toId: recipient.id, toName: recipient.name, toRole: "manager",
      subject: subject.trim(), body: body.trim(), attachments,
    });
    setToId(""); setSubject(""); setBody(""); setAttachments([]);
    setComposeOpen(false);
    refreshMsgs();
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newAtts: Attachment[] = files.map(f => ({
      name: f.name,
      type: inferAttachType(f.name),
      size: formatFileSize(f.size),
    }));
    setAttachments(prev => [...prev, ...newAtts]);
    if (fileAttachRef.current) fileAttachRef.current.value = "";
  }

  const filteredLocations = customerLocations.filter(l =>
    l.name.toLowerCase().includes(searchLoc.toLowerCase()) ||
    l.address.toLowerCase().includes(searchLoc.toLowerCase())
  );

  const selectedLocationData = historyLocation
    ? customerLocations.find(l => l.id === historyLocation)
    : null;

  const locationInspections = historyLocation
    ? pastInspections.filter(i => i.locationId === historyLocation)
    : pastInspections;

  const locationCommsData = historyLocation ? (locationComms[historyLocation] ?? []) : [];

  // ── My service requests (live from Convex) ──
  // convexRequests is already loaded above in the hooks block

  const requestStatusConfig: Record<string, { label: string; color: string }> = {
    pending:    { label: "Pending",    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    "in-review":{ label: "In Review", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    scheduled:  { label: "Scheduled", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    completed:  { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    declined:   { label: "Declined",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  };

  // ── Handle service request submission ──
  async function handleServiceRequest() {
    if (!reqServiceType) return;
    const custDocId = myCust?._id ?? allCustomers[0]?._id;
    if (!custDocId) { toast.error("Unable to identify your account. Please reload."); return; }
    setReqSaving(true);
    try {
      const urgencyMap: Record<string, string> = { routine: "normal", soon: "normal", urgent: "urgent", emergency: "urgent" };
      await createServiceRequest({
        customerId: custDocId,
        serviceType: reqServiceType,
        urgency: urgencyMap[reqUrgency] ?? "normal",
        description: reqNotes || undefined,
      });
      toast.success("Service request submitted! We'll be in touch shortly.");
      setRequestOpen(false);
      setReqLocation(""); setReqServiceType(""); setReqUrgency(""); setReqDate(""); setReqNotes("");
    } catch {
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setReqSaving(false);
    }
  }

  // Customer info (static for portal view)
  const customerInfo = {
    name: "Howard County Public Schools",
    contactName: userName,
    locationCount: customerLocations.length,
    contractExpiry: "Dec 31, 2026",
    annualValue: "$28,500",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="size-6 text-primary shrink-0" />
            Customer Portal
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Welcome, {customerInfo.contactName} — {customerInfo.name}
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href="tel:4108765000"><Phone className="size-3.5" /> (410) 876-5000</a>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setComposeOpen(true)}>
            <Mail className="size-3.5" /> Message Us
          </Button>
        </div>
      </div>

      {/* Account Summary */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Open Balance</div>
          <div className="text-xl font-extrabold text-amber-600">
            {`$${totalOutstanding.toLocaleString()}`}
          </div>
          <div className="text-[10px] text-muted-foreground">{unpaidInvoices.length} unpaid invoice{unpaidInvoices.length !== 1 ? "s" : ""}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Scheduled Jobs</div>
          <div className="text-xl font-extrabold text-primary">
            {upcomingJobs.length}
          </div>
          <div className="text-[10px] text-muted-foreground">{completedJobs.length} completed YTD</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Contract Status</div>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="default" className="bg-emerald-600 text-xs">Active</Badge>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Expires {customerInfo.contractExpiry}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Locations</div>
          <div className="text-xl font-extrabold">{customerInfo.locationCount}</div>
          <div className="text-[10px] text-muted-foreground">service sites</div>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="h-9 w-max min-w-full sm:w-auto">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs gap-1.5">
              <Receipt className="size-3.5" />
              Invoices
              {unpaidInvoices.length > 0 && (
                <Badge className="text-[9px] h-4 min-w-4 px-1 bg-amber-600">{unpaidInvoices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5">
              <History className="size-3.5" /> Job History
            </TabsTrigger>
            <TabsTrigger value="messages" className="text-xs gap-1.5">
              <Mail className="size-3.5" />
              Messages
              {unread > 0 && (
                <Badge className="text-[9px] h-4 min-w-4 px-1 bg-primary">{unread}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests" className="text-xs gap-1.5">
              <ClipboardList className="size-3.5" />
              My Requests
              {convexRequests.filter(r => r.status === "in-review" || r.status === "scheduled").length > 0 && (
                <Badge className="text-[9px] h-4 min-w-4 px-1 bg-primary">
                  {convexRequests.filter(r => r.status === "in-review" || r.status === "scheduled").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab: Overview ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Upcoming Services */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="size-4 text-primary" /> Upcoming Services
                  </CardTitle>
                  <CardDescription>
                    {`${upcomingJobs.length} scheduled job${upcomingJobs.length !== 1 ? "s" : ""}`}
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setRequestOpen(true)}>
                  <Plus className="size-3.5" /> Request Service
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingJobs.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming scheduled services.</p>
                  <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => setRequestOpen(true)}>
                    Request a service visit →
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingJobs.map(job => {
                    const statusColor = job.status === "completed" ? "bg-emerald-600" : job.status === "in-progress" || job.status === "in_progress" ? "bg-blue-600" : job.status === "return" || job.status === "will_return" ? "bg-amber-600" : "bg-gray-500";
                    const statusLabel = job.status === "completed" ? "Completed" : job.status === "in-progress" || job.status === "in_progress" ? "In Progress" : job.status === "return" || job.status === "will_return" ? "Return Visit" : "Pending";
                    return (
                      <div key={job.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Calendar className="size-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold truncate">{job.customerAddress || job.customerName}</h3>
                            <Badge className={`text-[10px] shrink-0 text-white ${statusColor}`}>{statusLabel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{serviceTypeLabel(job.serviceType)}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {job.scheduledDate ?? "TBD"} {job.scheduledTime ? `· ${job.scheduledTime}` : ""}
                            </span>
                            {job.employeeName && <span>Tech: {job.employeeName}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Locations Grid */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="size-4 text-primary" /> Your Locations
                  </CardTitle>
                  <CardDescription>{customerLocations.length} service sites</CardDescription>
                </div>
                <div className="relative max-w-xs">
                  <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
                  <Input placeholder="Search locations..." className="pl-7 h-8 text-xs" value={searchLoc} onChange={e => setSearchLoc(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredLocations.map(loc => {
                  const statusColor = loc.status === "current" ? "border-emerald-200 dark:border-emerald-800" : loc.status === "due-soon" ? "border-amber-200 dark:border-amber-800" : "border-red-200 dark:border-red-800";
                  const statusBadge = loc.status === "current"
                    ? <Badge variant="default" className="bg-emerald-600 text-[9px]">Current</Badge>
                    : loc.status === "due-soon"
                    ? <Badge variant="default" className="bg-amber-600 text-[9px]">Due Soon</Badge>
                    : <Badge variant="destructive" className="text-[9px]">Overdue</Badge>;
                  return (
                    <div
                      key={loc.id}
                      className={`rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-all ${statusColor} ${selectedLocation === loc.id ? "ring-2 ring-primary" : ""}`}
                      onClick={() => setSelectedLocation(selectedLocation === loc.id ? null : loc.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-bold leading-tight">{loc.name}</h3>
                        {statusBadge}
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
                        <MapPin className="size-3 shrink-0" /> {loc.address}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Last: {loc.lastService}</span>
                        <span className="font-medium">Next: {loc.nextService}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* My Jobs link card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] cursor-pointer hover:shadow-sm transition-shadow" onClick={() => navigate("/customer-jobs")}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="size-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">My Jobs &amp; Locations</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    View all your scheduled and completed jobs. Sort by location, date, zip code, or status.
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground shrink-0" />
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── Tab: Job History ── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          {/* Location picker */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="size-4 text-primary" /> Service History
                  </CardTitle>
                  <CardDescription>Full history of inspections, reports, invoices, and communications</CardDescription>
                </div>
                <Select value={historyLocation || "__all__"} onValueChange={v => setHistoryLocation(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-52 h-8 text-xs">
                    <SelectValue placeholder="Filter by location..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Locations</SelectItem>
                    {customerLocations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            {selectedLocationData && (
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-3">
                  <MapPin className="size-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{selectedLocationData.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedLocationData.address}</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Inspections */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Inspection Records & Certificates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {locationInspections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No inspections found for this location.</p>
              ) : (
                <div className="space-y-4">
                  {locationInspections.map(ins => (
                    <div key={ins.id} className="rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="text-sm font-bold">{ins.location}</h3>
                          <p className="text-xs text-muted-foreground">{ins.type}</p>
                        </div>
                        {ins.result === "pass" ? (
                          <Badge variant="default" className="bg-emerald-600 text-xs gap-1 shrink-0">
                            <CheckCircle2 className="size-3" /> Pass
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs shrink-0">Fail</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-muted-foreground mb-3">
                        <div><span className="font-semibold text-foreground block">Date</span>{ins.date}</div>
                        <div><span className="font-semibold text-foreground block">Technician</span>{ins.tech}</div>
                        <div><span className="font-semibold text-foreground block">Units Serviced</span>{ins.units}</div>
                        <div><span className={`font-semibold block ${ins.deficiencies > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                          {ins.deficiencies > 0 ? `${ins.deficiencies} Deficiencies` : "No Deficiencies"}
                        </span>
                          <span>{ins.deficiencies > 0 ? "Requires attention" : "All clear"}</span>
                        </div>
                      </div>

                      {/* Manager note */}
                      {ins.managerNote && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                          <p className="text-[10px] font-semibold text-blue-600 uppercase mb-1 flex items-center gap-1">
                            <MessageSquare className="size-3" /> Manager Note
                          </p>
                          <p className="text-xs leading-relaxed">{ins.managerNote}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {ins.certFile && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1.5 h-7"
                            onClick={() => openDoc(ins.certFile)}
                          >
                            <ShieldCheck className="size-3 text-emerald-600" /> Certificate PDF
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5 h-7"
                          onClick={() => openDoc(ins.reportFile)}
                        >
                          <FileText className="size-3" /> Full Report
                        </Button>
                        <div className="ml-auto flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs gap-1.5 h-7 text-primary"
                            onClick={() => openDoc(`${ins.invoiceId}.pdf`)}
                          >
                            Invoice {ins.invoiceId} · {ins.invoiceAmt}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Communications about this location */}
          {historyLocation && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" /> Communications About This Location
                </CardTitle>
                <CardDescription>Messages and updates from Multicorp regarding {selectedLocationData?.name}</CardDescription>
              </CardHeader>
              <CardContent>
                {locationCommsData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No communications on record for this location.</p>
                ) : (
                  <div className="space-y-3">
                    {locationCommsData.map((comm, i) => (
                      <div key={i} className="rounded-xl border p-4 bg-muted/20">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-bold">{comm.subject}</span>
                          <span className="text-[10px] text-muted-foreground">{comm.date}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-1">From: {comm.from}</p>
                        <p className="text-xs leading-relaxed">{comm.body}</p>
                        {comm.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            {comm.attachments.map((a, j) => (
                              <Button
                                key={j}
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-6 px-2 gap-1"
                                onClick={() => openDoc(a)}
                              >
                                <FileText className="size-3 text-red-500" /> {a}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={() => { setSubject(`Question about ${selectedLocationData?.name ?? "location"}`); setComposeOpen(true); }}
                >
                  <Mail className="size-3" /> Message Manager About This Location
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Invoices ── */}
        <TabsContent value="invoices" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="size-4 text-primary" /> Your Invoices
                  </CardTitle>
                  <CardDescription>
                    {`${myInvoices.length} invoice${myInvoices.length !== 1 ? "s" : ""} · $${totalOutstanding.toLocaleString()} outstanding`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {myInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No invoices on file yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myInvoices.map(inv => {
                    const isPaid = inv.status === "paid";
                    const isDraft = inv.status === "draft";
                    const statusColor = isPaid ? "bg-emerald-600" : isDraft ? "bg-gray-500" : inv.status === "overdue" ? "bg-red-600" : "bg-amber-600";
                    const statusLabel = isPaid ? "Paid" : isDraft ? "Processing" : inv.status === "overdue" ? "Overdue" : "Pending";
                    return (
                      <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="size-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold">{inv.invoiceNumber}</p>
                            <Badge className={`text-[10px] text-white shrink-0 ${statusColor}`}>{statusLabel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{inv.techName ? `Tech: ${inv.techName}` : "Multicorp Fire Protection Services"}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[11px] text-muted-foreground">{new Date(inv.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            <span className="text-sm font-extrabold text-emerald-600">${inv.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-8 shrink-0"
                          onClick={() => downloadInvoicePdf({ ...inv, customerName: inv.customerName, lineItems: inv.lineItems })}
                        >
                          <Download className="size-3" /> PDF
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          {totalOutstanding > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Receipt className="size-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    Balance Due: ${totalOutstanding.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length !== 1 ? "s" : ""}. Contact us to arrange payment.
                  </p>
                </div>
                <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setSubject("Payment Inquiry"); setComposeOpen(true); }}>
                  <Mail className="size-3.5" /> Contact Us
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Messages ── */}
        <TabsContent value="messages" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-5">

            {/* Message list */}
            <div className={`lg:col-span-2 space-y-3 ${selectedMsg ? "hidden lg:block" : "block"}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  All Messages
                  {unread > 0 && (
                    <Badge className="ml-2 text-[9px] h-4 px-1 bg-primary">{unread} new</Badge>
                  )}
                </p>
                <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setComposeOpen(true)}>
                  <Plus className="size-3" /> New
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  {inbox.length === 0 && sent.length === 0 ? (
                    <div className="py-10 text-center">
                      <Mail className="size-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                      <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => setComposeOpen(true)}>
                        Send us a message →
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {[...inbox, ...sent.filter(s => !inbox.some(i => i.id === s.id))].map(msg => {
                        const isReceived = msg.toId === userId;
                        const isUnread   = isReceived && !msg.readByRecipient;
                        const counterpart = isReceived ? msg.fromName : `To: ${msg.toName}`;
                        const deletable   = canDeleteMsg(msg);
                        return (
                          <div
                            key={msg.id}
                            className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors group
                              ${selectedMsg?.id === msg.id ? "bg-primary/5" : ""}
                              ${isUnread ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                            onClick={() => openMessage(msg)}
                          >
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                              {counterpart.replace("To: ", "").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-xs truncate ${isUnread ? "font-bold" : "font-medium"}`}>{counterpart}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(msg.timestamp)}</span>
                              </div>
                              <p className={`text-xs truncate mt-0.5 ${isUnread ? "font-semibold" : "text-muted-foreground"}`}>{msg.subject}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {!isReceived && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">Sent</span>
                                )}
                                {msg.attachments.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Paperclip className="size-2.5" />{msg.attachments.length}
                                  </span>
                                )}
                                {isUnread && <div className="size-2 rounded-full bg-primary ml-auto" />}
                              </div>
                            </div>
                            {deletable && (
                              <button
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded shrink-0"
                                title="Delete"
                                onClick={e => { e.stopPropagation(); handleDeleteMsg(msg); }}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detail */}
            <div className={`lg:col-span-3 ${selectedMsg ? "block" : "hidden lg:flex lg:items-start"}`}>
              {selectedMsg ? (
                <div className="w-full space-y-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden gap-1.5 text-xs -ml-1"
                    onClick={() => setSelectedMsg(null)}
                  >
                    <ArrowLeft className="size-3.5" /> Back to messages
                  </Button>

                  <Card>
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base leading-snug break-words">{selectedMsg.subject}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            From <strong>{selectedMsg.fromName}</strong> · {timeAgo(selectedMsg.timestamp)}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
                            onClick={() => {
                              setToId(selectedMsg.fromId);
                              setSubject(`Re: ${selectedMsg.subject.startsWith("Re: ") ? selectedMsg.subject.slice(4) : selectedMsg.subject}`);
                              setBody(""); setComposeOpen(true);
                            }}
                          >
                            <Reply className="size-3.5" />
                            <span className="hidden sm:inline">Reply</span>
                          </Button>
                          {canDeleteMsg(selectedMsg) && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteMsg(selectedMsg)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-5 space-y-4">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedMsg.body}</p>
                      {selectedMsg.attachments.length > 0 && (
                        <div className="border-t pt-4 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Attachments ({selectedMsg.attachments.length})</p>
                          {selectedMsg.attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
                              <FileText className="size-3.5 text-red-500 shrink-0" />
                              <span className="text-xs flex-1 truncate">{att.name}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{att.size}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-6 px-2 gap-1 shrink-0"
                                onClick={() => openDoc(att.name)}
                              >
                                <FileText className="size-3" /> View
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="hidden lg:flex w-full h-48 items-center justify-center">
                  <div className="text-center">
                    <Mail className="size-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Select a message to read it</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: My Requests ── */}
        <TabsContent value="requests" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">My Service Requests</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Track the status of requests you've submitted</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setRequestOpen(true)}>
              <Plus className="size-3.5" /> New Request
            </Button>
          </div>

          {convexRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No requests submitted yet.</p>
                <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => setRequestOpen(true)}>
                  Submit a service request →
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {convexRequests.map((req: any) => {
                const cfg = requestStatusConfig[req.status] ?? { label: req.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <Card key={req._id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{req.serviceType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                            <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                            {req.urgency === "urgent" && (
                              <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Urgent</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                            {req.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{req.location}</span>}
                            {req.preferredDate && <span className="flex items-center gap-1"><Calendar className="size-3" />Preferred: {req.preferredDate}</span>}
                            <span>Submitted {new Date(req._creationTime).toLocaleDateString()}</span>
                          </div>
                          {req.managerMessage && (
                            <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
                              <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                                <MessageSquare className="size-3" /> Message from Multicorp:
                              </p>
                              <p className="text-sm">{req.managerMessage}</p>
                            </div>
                          )}
                          {!req.managerMessage && req.status === "pending" && (
                            <p className="text-xs text-muted-foreground mt-2 italic">Awaiting review from our team…</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Service Request Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" /> Request Service
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <Label className="text-xs">Location</Label>
              <Select value={reqLocation} onValueChange={setReqLocation}>
                <SelectTrigger><SelectValue placeholder="Select location..." /></SelectTrigger>
                <SelectContent>
                  {customerLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Service Type *</Label>
                <Select value={reqServiceType} onValueChange={setReqServiceType}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="extinguisher_inspection">Extinguisher Annual</SelectItem>
                    <SelectItem value="hood_suppression">Suppression Inspection</SelectItem>
                    <SelectItem value="sprinkler_test">Sprinkler Test</SelectItem>
                    <SelectItem value="exit_light_check">Exit Light Inspection</SelectItem>
                    <SelectItem value="full_inspection">Full Fire Safety</SelectItem>
                    <SelectItem value="emergency">Emergency Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Urgency</Label>
                <Select value={reqUrgency} onValueChange={setReqUrgency}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="soon">Within 2 Weeks</SelectItem>
                    <SelectItem value="urgent">Urgent (24-48 hrs)</SelectItem>
                    <SelectItem value="emergency">Emergency (ASAP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Preferred Date (optional)</Label>
              <Input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Any additional details..." rows={3} value={reqNotes} onChange={e => setReqNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button
              disabled={!reqServiceType || reqSaving}
              onClick={handleServiceRequest}
              className="gap-1.5"
            >
              {reqSaving ? "Submitting…" : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={open => { setComposeOpen(open); if (!open) setAttachments([]); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-5 text-primary" /> New Message
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <Label className="text-xs">To</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger><SelectValue placeholder="Select recipient..." /></SelectTrigger>
                <SelectContent>
                  {empRecipients.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} · {r.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                You can message the Manager or Supervisor directly.
              </p>
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input placeholder="Message subject..." value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea placeholder="Write your message..." rows={4} value={body} onChange={e => setBody(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Attachments</Label>
              <div className="flex gap-2 mt-1">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => fileAttachRef.current?.click()}>
                  <Paperclip className="size-3" /> Choose Files
                </Button>
                <input ref={fileAttachRef} type="file" className="hidden" multiple onChange={handleFileSelect} />
              </div>
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <FileText className="size-3.5 text-red-500 shrink-0" />
                      <span className="text-xs flex-1 truncate">{att.name}</span>
                      <span className="text-[10px] text-muted-foreground">{att.size}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => { setComposeOpen(false); setAttachments([]); }}>Cancel</Button>
            <Button className="gap-1.5" disabled={!toId || !subject.trim() || !body.trim()} onClick={handleSend}>
              <Send className="size-3.5" /> Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Doc Viewer */}
      <DocViewerDialog
        open={docViewOpen}
        fileName={viewingFile}
        onClose={() => setDocViewOpen(false)}
      />

      {/* AI Invoice Scanner */}
      <ScanInvoiceDialog open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  );
}
