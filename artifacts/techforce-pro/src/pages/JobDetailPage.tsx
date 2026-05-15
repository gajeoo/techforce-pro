import { useNavigate, useParams } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeft, CalendarDays, Camera, CheckCircle2, Clock, Download,
  Edit3, Eye, FileText, History, Image, Map, MapPin, MessageSquare,
  Navigation, PenLine, Phone, Plus, RotateCcw, Save, Upload,
  User, Wrench, X, CalendarX, ChevronRight, AlertCircle,
  Timer, Trash2, ClipboardCheck, AlertTriangle, FolderOpen, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { JobDocument, PreviousYearJob } from "@/lib/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { getJob, getEmployees, createInvoice, initials as apiInitials, roleLabel as apiRoleLabel, type ApiEmployee, type ApiJob } from "@/lib/api";

// ─── Service category helpers (local, no mock dependency) ─────────────────────

const serviceCategoryColors: Record<string, { bg: string; text: string; label: string }> = {
  "suppression": { bg: "bg-red-100 dark:bg-red-900/30",    text: "text-red-700 dark:text-red-300",    label: "Suppression"  },
  "extinguisher":{ bg: "bg-blue-100 dark:bg-blue-900/30",  text: "text-blue-700 dark:text-blue-300",  label: "Extinguisher" },
  "sprinkler":   { bg: "bg-cyan-100 dark:bg-cyan-900/30",  text: "text-cyan-700 dark:text-cyan-300",  label: "Sprinkler"    },
  "exit-light":  { bg: "bg-amber-100 dark:bg-amber-900/30",text: "text-amber-700 dark:text-amber-300",label: "Exit Light"   },
  "mixed":       { bg: "bg-purple-100 dark:bg-purple-900/30",text:"text-purple-700 dark:text-purple-300",label:"Mixed"       },
};

function deriveCategory(serviceType: string): "suppression" | "extinguisher" | "sprinkler" | "exit-light" | "mixed" {
  const t = serviceType.toLowerCase();
  if (/suppression|hood/.test(t)) return "suppression";
  if (/extinguisher/.test(t))     return "extinguisher";
  if (/sprinkler|standpipe/.test(t)) return "sprinkler";
  if (/exit|light/.test(t))       return "exit-light";
  return "mixed";
}

interface NormalizedJob {
  id: string;
  client: string;
  customerId: string;
  locationId?: string;
  locationName?: string;
  address: string;
  type: string;
  serviceCategory: "suppression" | "extinguisher" | "sprinkler" | "exit-light" | "mixed";
  certRequired: string;
  revenue: number;
  status: string;
  priority: "high" | "medium" | "low";
  scheduledDate: string;
  scheduledTime: string;
  techName: string;
  techId: string;
  notes: string;
  dueDate: string;
  documents: JobDocument[];
}

function normalizeJob(j: ApiJob): NormalizedJob {
  return {
    id:           String(j.id),
    client:       j.customerName,
    customerId:   String(j.customerId),
    locationId:   j.locationId ? String(j.locationId) : undefined,
    locationName: j.locationName ?? undefined,
    address:      j.customerAddress,
    type:         j.serviceType,
    serviceCategory: deriveCategory(j.serviceType),
    certRequired: j.certificationRequired,
    revenue:      j.revenue,
    status:       j.status,
    priority:     (j.priority as "high" | "medium" | "low") ?? "medium",
    scheduledDate: j.scheduledDate ?? "",
    scheduledTime: j.scheduledTime ?? "",
    techName:     j.employeeName ?? "Unassigned",
    techId:       j.employeeId ? String(j.employeeId) : "",
    notes:        j.notes ?? "",
    dueDate:      j.dueDate ?? "",
    documents:    [],
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TechStatus = "pending" | "en-route" | "on-site" | "in-progress" | "completed" | "return" | "reschedule";
type Tab = "info" | "map" | "photo" | "sign";

interface SavedNote        { techNote: string; jobNote: string; savedAt: string }
interface JobPhoto         { id: string; jobId: string; dataUrl: string; caption: string; takenBy: string; takenAt: string }
interface RescheduleReq    { jobId: string; reason: string; preferredDate: string; preferredTime: string; requestedBy: string; requestedAt: string; status: "pending" | "approved" | "denied"; approvedBy?: string; approvedAt?: string; denialReason?: string }
interface ReturnRecord     { id: string; originalJobId: string; reason: string; reportedAt: string; reportedBy: string; status: "open" | "scheduled" | "completed"; scheduledDate?: string; linkedJobId?: string }
interface JobSignature     { dataUrl: string; signedAt: string; submittedBy: string }

// ─── Storage keys & helpers ───────────────────────────────────────────────────

const STATUS_KEY    = "tfpro_job_statuses";
const NOTES_KEY     = "tfpro_job_notes";
const PHOTOS_KEY    = "tfpro_job_photos";
const RESCHEDULE_KEY= "tfpro_reschedules";
const RETURNS_KEY   = "tfpro_returns";
const SIGNATURES_KEY= "tfpro_signatures";
const EDITS_KEY     = "tfpro_job_edits";

const load  = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "") ?? fallback; } catch { return fallback; } };
const store = (key: string, val: unknown) => localStorage.setItem(key, JSON.stringify(val));

const loadStatuses   = ()                            => load<Record<string, TechStatus>>(STATUS_KEY, {});
const saveStatuses   = (v: Record<string, TechStatus>) => store(STATUS_KEY, v);
const loadNotes      = ()                            => load<Record<string, SavedNote>>(NOTES_KEY, {});
const loadPhotos     = ()                            => load<Record<string, JobPhoto[]>>(PHOTOS_KEY, {});
const loadReschedule = ()                            => load<Record<string, RescheduleReq>>(RESCHEDULE_KEY, {});
const loadReturns    = ()                            => load<Record<string, ReturnRecord[]>>(RETURNS_KEY, {});
const loadSignatures = ()                            => load<Record<string, JobSignature>>(SIGNATURES_KEY, {});
const loadJobEdits   = ()                            => load<Record<string, JobEditFields>>(EDITS_KEY, {});

// ─── Job edit types ───────────────────────────────────────────────────────────

interface JobEditFields {
  type?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  techName?: string;
  techId?: string;
  priority?: "high" | "medium" | "low";
  notes?: string;
  revenue?: number;
  editedAt?: string;
  editedBy?: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "pending"     as TechStatus, label: "Scheduled",          icon: <CalendarDays className="size-6"/>,  color: "text-gray-600",    heroBg: "bg-primary"       },
  { value: "en-route"   as TechStatus, label: "On Way to Job",       icon: <Navigation className="size-6"/>,    color: "text-blue-600",    heroBg: "bg-blue-500"      },
  { value: "on-site"    as TechStatus, label: "Arrived at Job",      icon: <MapPin className="size-6"/>,        color: "text-amber-600",   heroBg: "bg-amber-500"     },
  { value: "in-progress"as TechStatus, label: "In Progress",         icon: <Wrench className="size-6"/>,        color: "text-primary",     heroBg: "bg-blue-600"      },
  { value: "completed"  as TechStatus, label: "Job Completed",       icon: <CheckCircle2 className="size-6"/>,  color: "text-emerald-600", heroBg: "bg-emerald-600"   },
  { value: "reschedule" as TechStatus, label: "Need to Reschedule",  icon: <CalendarX className="size-6"/>,     color: "text-red-600",     heroBg: "bg-red-600"       },
  { value: "return"     as TechStatus, label: "Return Visit Needed", icon: <RotateCcw className="size-6"/>,     color: "text-orange-600",  heroBg: "bg-orange-500"    },
];

const getStatusOpt = (val: TechStatus) => STATUS_OPTIONS.find(s => s.value === val) ?? STATUS_OPTIONS[0];

// ─── Signature Pad ────────────────────────────────────────────────────────────

function SignaturePad({ onSave, existingSig }: { onSave: (dataUrl: string) => void; existingSig: JobSignature | null }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const drawing    = useRef(false);
  const lastPos    = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  function coords(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width;
    const sy = c.height / r.height;
    const src = "touches" in e ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  }

  function start(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = coords(e);
    setHasDrawn(true);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!drawing.current || !lastPos.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = coords(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = p;
  }

  function stop() { drawing.current = false; lastPos.current = null; }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  }

  return (
    <div className="space-y-3">
      {existingSig ? (
        <div className="space-y-3">
          <div className="rounded-xl border overflow-hidden bg-white dark:bg-gray-900">
            <img src={existingSig.dataUrl} alt="Signature" className="w-full" />
          </div>
          <div className="text-xs text-muted-foreground text-center">
            Signed {new Date(existingSig.signedAt).toLocaleString()} by {existingSig.submittedBy}
          </div>
          <Badge variant="default" className="w-full justify-center bg-emerald-600 py-1.5">
            <CheckCircle2 className="size-3.5 mr-1.5" /> Signature Captured
          </Badge>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground text-center">
            Ask the customer to sign in the box below to confirm work was completed
          </p>
          <canvas
            ref={canvasRef}
            width={600} height={200}
            className="w-full rounded-xl border-2 border-dashed border-primary/40 cursor-crosshair bg-white dark:bg-gray-900 touch-none"
            style={{ height: 180 }}
            onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
            onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1.5" onClick={clear}>
              <Trash2 className="size-3.5" /> Clear
            </Button>
            <Button
              className="flex-1 gap-1.5"
              disabled={!hasDrawn}
              onClick={() => canvasRef.current && onSave(canvasRef.current.toDataURL("image/png"))}
            >
              <ClipboardCheck className="size-3.5" /> Submit Signature
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DocumentCard({ doc, onView }: { doc: JobDocument; onView: (d: JobDocument) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors group">
      <div className="size-10 rounded-lg bg-background border flex items-center justify-center shrink-0">
        {doc.type === "photo" ? <Image className="size-5 text-blue-500"/> : <FileText className="size-5 text-red-500"/>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{doc.name}</div>
        <div className="text-xs text-muted-foreground">{doc.uploadedBy} · {doc.uploadedAt} · {doc.size}</div>
      </div>
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={e => { e.stopPropagation(); onView(doc); }}>
          <Eye className="size-3"/> View
        </Button>
        <Button variant="ghost" size="sm" className="h-7" onClick={e => e.stopPropagation()}>
          <Download className="size-3"/>
        </Button>
      </div>
    </div>
  );
}

function PreviousYearJobCard({ job, onViewDoc }: { job: PreviousYearJob; onViewDoc: (d: JobDocument) => void }) {
  const catColor = serviceCategoryColors[job.serviceCategory] || serviceCategoryColors["mixed"];
  return (
    <div className="p-4 rounded-lg border bg-muted/20">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-semibold text-sm">{job.type}</div>
          <div className="text-xs text-muted-foreground">{job.client}</div>
        </div>
        <Badge className={`${catColor.bg} ${catColor.text} text-[10px] border-0`}>{catColor.label}</Badge>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><User className="size-3"/> {job.techName}</span>
        <span className="flex items-center gap-1"><CalendarDays className="size-3"/> {new Date(job.completedDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="size-3 text-emerald-500"/> Completed</span>
      </div>
      {job.documents.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {job.documents.map(doc => <DocumentCard key={doc.id} doc={doc} onView={onViewDoc}/>)}
        </div>
      )}
    </div>
  );
}

// ─── Status Picker Modal ──────────────────────────────────────────────────────

function StatusPickerModal({ current, open, onClose, onSelect }: {
  current: TechStatus; open: boolean; onClose: () => void; onSelect: (s: TechStatus) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Select Status</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 py-2">
          {STATUS_OPTIONS.map(opt => {
            const sel = opt.value === current;
            return (
              <button key={opt.value}
                onClick={() => { onSelect(opt.value); onClose(); }}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}
              >
                <div className={`size-14 rounded-full border-2 flex items-center justify-center ${sel ? "border-primary text-primary bg-primary/10" : `border-border ${opt.color} bg-muted/40`}`}>
                  {opt.icon}
                </div>
                <span className={`text-[10px] font-semibold text-center leading-tight uppercase tracking-wide ${sel ? "text-primary" : "text-muted-foreground"}`}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Job Dialog (Manager) ────────────────────────────────────────────────

function EditJobDialog({ open, job, onClose, onSave }: {
  open: boolean;
  job: { type?: string; scheduledDate?: string; scheduledTime?: string; techName?: string; techId?: string; priority?: string; notes?: string; revenue?: number };
  onClose: () => void;
  onSave: (fields: JobEditFields) => void;
}) {
  const [form, setForm] = useState<JobEditFields>({
    type: job.type ?? "",
    scheduledDate: job.scheduledDate ?? "",
    scheduledTime: job.scheduledTime ?? "",
    techName: job.techName ?? "",
    techId: job.techId ?? "",
    priority: (job.priority as "high" | "medium" | "low") ?? "medium",
    notes: job.notes ?? "",
    revenue: job.revenue ?? 0,
  });
  const [apiEmps, setApiEmps] = useState<ApiEmployee[]>([]);

  useEffect(() => {
    getEmployees().then(setApiEmps).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setForm({
        type: job.type ?? "",
        scheduledDate: job.scheduledDate ?? "",
        scheduledTime: job.scheduledTime ?? "",
        techName: job.techName ?? "",
        techId: job.techId ?? "",
        priority: (job.priority as "high" | "medium" | "low") ?? "medium",
        notes: job.notes ?? "",
        revenue: job.revenue ?? 0,
      });
    }
  }, [open, job.type, job.scheduledDate, job.scheduledTime, job.techName, job.techId, job.priority, job.notes, job.revenue]);

  function handleTechChange(techId: string) {
    const tech = apiEmps.find(e => String(e.id) === techId);
    setForm(f => ({ ...f, techId, techName: tech?.name ?? f.techName }));
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="size-5 text-primary"/> Edit Job Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Job Type / Service</Label>
            <Input
              className="text-sm"
              value={form.type ?? ""}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              placeholder="e.g. Hood Suppression Inspection"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Scheduled Date</Label>
              <Input
                type="date"
                className="text-sm"
                value={form.scheduledDate ?? ""}
                onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Scheduled Time</Label>
              <Input
                type="time"
                className="text-sm"
                value={form.scheduledTime?.replace(" AM","").replace(" PM","") ?? ""}
                onChange={e => {
                  const [h, m] = e.target.value.split(":");
                  const hour = parseInt(h, 10);
                  const suffix = hour >= 12 ? "PM" : "AM";
                  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                  setForm(f => ({ ...f, scheduledTime: `${h12}:${m} ${suffix}` }));
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Assigned Technician</Label>
            <Select value={form.techId ?? ""} onValueChange={handleTechChange}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select technician"/>
              </SelectTrigger>
              <SelectContent>
                {apiEmps.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name} — {apiRoleLabel(e.role)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority</Label>
              <Select value={form.priority ?? "medium"} onValueChange={v => setForm(f => ({ ...f, priority: v as "high" | "medium" | "low" }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔴 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Revenue ($)</Label>
              <Input
                type="number"
                className="text-sm"
                value={form.revenue ?? ""}
                onChange={e => setForm(f => ({ ...f, revenue: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Dispatcher Notes for Tech</Label>
            <Textarea
              rows={3}
              className="text-sm"
              value={form.notes ?? ""}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Special instructions, access info, what to watch out for..."
            />
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-400">
            Changes are saved locally and applied immediately. The tech will see updated info on their job view.
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 gap-1.5" onClick={() => onSave(form)}>
              <Save className="size-3.5"/> Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTech    = user?.role === "technician";
  const isManager = user?.role === "manager";
  const isSupervisor = user?.role === "supervisor";
  const canApprove = isManager || isSupervisor;

  // ── Fetch job from API ──
  const [apiJob, setApiJob] = useState<ApiJob | null>(null);
  const [jobLoading, setJobLoading] = useState(true);

  useEffect(() => {
    if (!id) { setJobLoading(false); return; }
    setJobLoading(true);
    getJob(Number(id))
      .then(j => setApiJob(j))
      .catch(() => setApiJob(null))
      .finally(() => setJobLoading(false));
  }, [id]);

  const job: NormalizedJob | null = apiJob ? normalizeJob(apiJob) : null;

  // ── Status ──
  const [status, setStatus] = useState<TechStatus>("pending");
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);

  useEffect(() => {
    if (!job || !id) return;
    const s = loadStatuses();
    setStatus((s[id] as TechStatus) ?? (job.status as TechStatus) ?? "pending");
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notes ──
  const initNotes = id ? loadNotes()[id] : null;
  const [techNote, setTechNote] = useState(initNotes?.techNote ?? "");
  const [jobNote,  setJobNote]  = useState(initNotes?.jobNote  ?? "");
  const [editingTechNote, setEditingTechNote] = useState(false);
  const [editingJobNote,  setEditingJobNote]  = useState(false);

  // ── Photos ──
  const [jobPhotos, setJobPhotos] = useState<JobPhoto[]>(() => id ? (loadPhotos()[id] ?? []) : []);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Signature ──
  const [savedSig, setSavedSig] = useState<JobSignature | null>(() => id ? (loadSignatures()[id] ?? null) : null);

  // ── Reschedule ──
  const [rescheduleOpen,  setRescheduleOpen]  = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleDate,   setRescheduleDate]   = useState("");
  const [rescheduleTime,   setRescheduleTime]   = useState("");
  const [rescheduleReq, setRescheduleReq] = useState<RescheduleReq | null>(() => id ? (loadReschedule()[id] ?? null) : null);

  // ── Return ──
  const [returnOpen,   setReturnOpen]   = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>(() => id ? (loadReturns()[id] ?? []) : []);

  // ── Manager edit ──
  const [editOpen, setEditOpen] = useState(false);
  const [jobEdits, setJobEdits] = useState<JobEditFields>(() => id ? (loadJobEdits()[id] ?? {}) : {});

  // ── Create Invoice (manager, completed jobs) ──
  const [invoiceOpen,   setInvoiceOpen]   = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceDone,   setInvoiceDone]   = useState(false);

  function handleSaveEdit(fields: JobEditFields) {
    if (!id) return;
    const withMeta = { ...fields, editedAt: new Date().toISOString(), editedBy: user?.name ?? "Manager" };
    const all = loadJobEdits(); all[id] = withMeta; store(EDITS_KEY, all);
    setJobEdits(withMeta);
    setEditOpen(false);
  }

  // ── Timer (elapsed while in-progress) ──
  const [elapsed, setElapsed] = useState(0);
  const [startedAt] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "in-progress") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status, startedAt]);

  // ── Doc viewer ──
  const [viewDocOpen,  setViewDocOpen]  = useState(false);
  const [viewingDoc,   setViewingDoc]   = useState<JobDocument | null>(null);

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<Tab>("info");

  // ── Helpers ──
  const persistStatus = useCallback((next: TechStatus) => {
    if (!id) return;
    setStatus(next);
    const all = loadStatuses(); all[id] = next; saveStatuses(all);
  }, [id]);

  function handleStatusSelect(next: TechStatus) {
    setStatusPickerOpen(false);
    if (next === "reschedule") { setRescheduleOpen(true); return; }
    if (next === "return")     { setReturnOpen(true);     return; }
    persistStatus(next);
  }

  function handleSaveNotes(tNote: string, jNote: string) {
    if (!id) return;
    const all = loadNotes();
    all[id] = { techNote: tNote, jobNote: jNote, savedAt: new Date().toISOString() };
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const reader = new FileReader();
    reader.onload = () => {
      const photo: JobPhoto = {
        id: `P-${Date.now()}`,
        jobId: id,
        dataUrl: reader.result as string,
        caption: file.name,
        takenBy: user?.name ?? "Tech",
        takenAt: new Date().toISOString(),
      };
      const all = loadPhotos();
      all[id] = [...(all[id] ?? []), photo];
      store(PHOTOS_KEY, all);
      setJobPhotos(prev => [...prev, photo]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleDeletePhoto(photoId: string) {
    if (!id) return;
    const all = loadPhotos();
    all[id] = (all[id] ?? []).filter(p => p.id !== photoId);
    store(PHOTOS_KEY, all);
    setJobPhotos(prev => prev.filter(p => p.id !== photoId));
  }

  function handleSaveSignature(dataUrl: string) {
    if (!id) return;
    const sig: JobSignature = { dataUrl, signedAt: new Date().toISOString(), submittedBy: user?.name ?? "Tech" };
    const all = loadSignatures(); all[id] = sig; store(SIGNATURES_KEY, all);
    setSavedSig(sig);
    persistStatus("completed");
  }

  function submitReschedule() {
    if (!id) return;
    const req: RescheduleReq = {
      jobId: id, reason: rescheduleReason,
      preferredDate: rescheduleDate, preferredTime: rescheduleTime,
      requestedBy: user?.name ?? "Tech",
      requestedAt: new Date().toISOString(),
      status: "pending",
    };
    const all = loadReschedule(); all[id] = req; store(RESCHEDULE_KEY, all);
    setRescheduleReq(req);
    persistStatus("reschedule");
    setRescheduleOpen(false);
    setRescheduleReason(""); setRescheduleDate(""); setRescheduleTime("");
  }

  function approveReschedule() {
    if (!id || !rescheduleReq) return;
    const updated = { ...rescheduleReq, status: "approved" as const, approvedBy: user?.name ?? "Manager", approvedAt: new Date().toISOString() };
    const all = loadReschedule(); all[id] = updated; store(RESCHEDULE_KEY, all);
    setRescheduleReq(updated);
  }

  function denyReschedule() {
    if (!id || !rescheduleReq) return;
    const updated = { ...rescheduleReq, status: "denied" as const, approvedBy: user?.name ?? "Manager", approvedAt: new Date().toISOString() };
    const all = loadReschedule(); all[id] = updated; store(RESCHEDULE_KEY, all);
    setRescheduleReq(updated);
    persistStatus("pending");
  }

  function submitReturn() {
    if (!id) return;
    const rec: ReturnRecord = {
      id: `R-${Date.now()}`, originalJobId: id,
      reason: returnReason,
      reportedAt: new Date().toISOString(),
      reportedBy: user?.name ?? "Tech",
      status: "open",
    };
    const all = loadReturns();
    all[id] = [...(all[id] ?? []), rec];
    store(RETURNS_KEY, all);
    setReturnRecords(prev => [...prev, rec]);
    persistStatus("return");
    setReturnOpen(false);
    setReturnReason("");
  }

  if (jobLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw className="size-8 animate-spin text-muted-foreground"/>
        <p className="text-sm text-muted-foreground">Loading job…</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <h2 className="text-xl font-bold">Job not found</h2>
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="size-4 mr-2"/> Go Back</Button>
      </div>
    );
  }

  // Apply manager edits on top of base job data
  const effectiveJob = { ...job, ...jobEdits };

  const catColor    = serviceCategoryColors[job.serviceCategory] || serviceCategoryColors["mixed"];
  const statusOpt   = getStatusOpt(status);
  const mapsUrl     = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`;

  // Schedule history and previous year jobs are not available from the API without a separate call
  const prevYearJobs: PreviousYearJob[]  = [];
  const scheduleHistory: NormalizedJob[] = [];

  const totalPhotos = jobPhotos.length;

  // All historical documents combined (for the All Documents section)
  const allHistoryDocs: { doc: JobDocument; source: string; date: string }[] = [
    ...jobPhotos.map(p => ({ doc: { id: p.id, name: p.caption || "Photo", type: "photo" as const, uploadedBy: p.takenBy, uploadedAt: new Date(p.takenAt).toLocaleDateString(), size: "" }, source: "Captured", date: new Date(p.takenAt).toLocaleDateString() })),
    ...savedSig ? [{ doc: { id: "sig-1", name: "Customer Signature", type: "pdf" as const, uploadedBy: savedSig.submittedBy, uploadedAt: new Date(savedSig.signedAt).toLocaleDateString(), size: "" }, source: "Signature", date: new Date(savedSig.signedAt).toLocaleDateString() }] : [],
    ...scheduleHistory.flatMap(sj => sj.documents.map(d => ({ doc: d, source: `${sj.type} (${new Date(sj.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`, date: d.uploadedAt }))),
    ...prevYearJobs.flatMap(pj => pj.documents.map(d => ({ doc: d, source: `${pj.type} (2025)`, date: d.uploadedAt }))),
  ];

  const fmtElapsed = (s: number) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const tabs: { id: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: "info",  icon: <FileText className="size-5"/>,  label: "Info"  },
    { id: "map",   icon: <Map className="size-5"/>,       label: "Map"   },
    { id: "photo", icon: <Camera className="size-5"/>,    label: "Photo", badge: totalPhotos || undefined },
    { id: "sign",  icon: <PenLine className="size-5"/>,   label: "Sign"  },
  ];

  return (
    <div className="pb-10 space-y-0">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4"/> Back
        </Button>
        <h2 className="text-sm font-semibold truncate max-w-[55%] text-center">{effectiveJob.client ?? job.client}</h2>
        <div className="flex items-center gap-1">
          {isManager && status === "completed" && !invoiceDone && (
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-600 text-xs gap-1"
              onClick={() => setInvoiceOpen(true)}
            >
              <FileText className="size-3.5"/> Invoice
            </Button>
          )}
          {isManager && status === "completed" && invoiceDone && (
            <span className="text-[10px] text-emerald-600 font-medium">✓ Invoiced</span>
          )}
          {isManager
            ? <Button variant="ghost" size="sm" className="text-primary text-xs gap-1" onClick={() => setEditOpen(true)}>
                <Edit3 className="size-3.5"/> Edit
              </Button>
            : <div className="w-12"/>}
        </div>
      </div>

      {/* ── Status hero ── */}
      <div className={`rounded-2xl p-5 text-center mb-4 ${statusOpt.heroBg}`}>
        <div className="flex justify-center mb-3">
          <button
            onClick={() => setStatusPickerOpen(true)}
            className="size-24 rounded-full border-4 border-white/40 bg-white/20 flex flex-col items-center justify-center gap-1 hover:bg-white/30 active:scale-95 transition-all"
          >
            <div className="text-white">{statusOpt.icon}</div>
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/90 leading-tight px-1 text-center">{statusOpt.label}</span>
          </button>
        </div>

        {/* In-progress timer */}
        {status === "in-progress" && (
          <div className="flex items-center justify-center gap-1.5 mb-2 text-white/90">
            <Timer className="size-4"/>
            <span className="text-sm font-mono font-bold">{fmtElapsed(elapsed)}</span>
            <span className="text-xs">on site</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white/90">
          <span className="flex items-center gap-1"><CalendarDays className="size-4"/>
            {new Date(effectiveJob.scheduledDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
          </span>
          <span className="flex items-center gap-1"><Clock className="size-4"/> {effectiveJob.scheduledTime}</span>
          <span className="flex items-center gap-1"><User className="size-4"/> {effectiveJob.techName}</span>
        </div>
        {jobEdits.editedAt && (
          <div className="mt-1 text-[10px] text-white/50">Edited by {jobEdits.editedBy} · {new Date(jobEdits.editedAt).toLocaleDateString()}</div>
        )}
        <button onClick={() => setStatusPickerOpen(true)} className="mt-2 text-xs text-white/60 hover:text-white transition-colors">
          Tap circle to change status
        </button>
      </div>

      {/* ── Reschedule approval banner (manager/supervisor only) ── */}
      {rescheduleReq && rescheduleReq.status === "pending" && canApprove && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 mb-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-red-700 dark:text-red-400">Reschedule Request — Pending Approval</div>
              <div className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">From {rescheduleReq.requestedBy} · {new Date(rescheduleReq.requestedAt).toLocaleString()}</div>
              <div className="text-sm mt-1"><strong>Reason:</strong> {rescheduleReq.reason}</div>
              {rescheduleReq.preferredDate && (
                <div className="text-xs text-muted-foreground mt-1">Preferred: {rescheduleReq.preferredDate} {rescheduleReq.preferredTime}</div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={approveReschedule}>
              <CheckCircle2 className="size-3.5 mr-1"/> Approve
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-red-600 border-red-300 hover:bg-red-50" onClick={denyReschedule}>
              <X className="size-3.5 mr-1"/> Deny
            </Button>
          </div>
        </div>
      )}

      {/* Approved/denied badge */}
      {rescheduleReq && rescheduleReq.status !== "pending" && (
        <div className={`rounded-xl p-3 mb-4 text-xs flex items-center gap-2 ${rescheduleReq.status === "approved" ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700" : "bg-gray-100 dark:bg-gray-800 text-muted-foreground"}`}>
          {rescheduleReq.status === "approved"
            ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600"/>
            : <X className="size-4 shrink-0"/>}
          Reschedule {rescheduleReq.status} by {rescheduleReq.approvedBy} · {rescheduleReq.approvedAt && new Date(rescheduleReq.approvedAt).toLocaleString()}
        </div>
      )}

      {/* Return tracking banner */}
      {returnRecords.length > 0 && (
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3 mb-4">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <RotateCcw className="size-4 shrink-0"/>
            <span className="text-sm font-semibold">{returnRecords.length} Return Visit{returnRecords.length !== 1 ? "s" : ""} Logged</span>
            <Badge variant="secondary" className="ml-auto text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30">$0 Revenue</Badge>
          </div>
          {returnRecords.map(r => (
            <div key={r.id} className="text-xs text-orange-600 dark:text-orange-400/80 mt-1.5 pl-6">
              {new Date(r.reportedAt).toLocaleDateString()} — {r.reason} · <span className="capitalize font-medium">{r.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${activeTab === tab.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40 text-muted-foreground"}`}
          >
            {tab.icon}
            <span className="text-[10px] font-semibold">{tab.label}</span>
            {tab.badge != null && (
              <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ════ INFO TAB ════ */}
      {activeTab === "info" && (
        <div className="space-y-3">
          {/* Location */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Location</div>
                  <div className="text-sm font-medium leading-snug">{job.address}</div>
                  {job.locationName && <div className="text-xs text-muted-foreground mt-0.5">{job.locationName}</div>}
                </div>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs text-primary border-primary/40 hover:bg-primary hover:text-primary-foreground">
                    <Navigation className="size-3.5"/> Directions
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardContent className="p-4">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</div>
              <div className="flex items-start gap-2 flex-wrap">
                <Badge className={`${catColor.bg} ${catColor.text} text-[10px] border-0 shrink-0`}>{catColor.label}</Badge>
                <div>
                  <div className="text-sm font-semibold">{effectiveJob.type}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Job #{job.id} · {job.certRequired} required</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span>Due: <strong>{new Date(job.dueDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</strong></span>
                <span>Priority: <strong className={effectiveJob.priority==="high"?"text-red-600":effectiveJob.priority==="medium"?"text-amber-600":""}>{effectiveJob.priority}</strong></span>
                {isManager && <span className="text-emerald-700 dark:text-emerald-400">Revenue: <strong>${(effectiveJob.revenue ?? job.revenue).toLocaleString()}</strong></span>}
              </div>
            </CardContent>
          </Card>

          {/* Assigned tech */}
          <Card>
            <CardContent className="p-4">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Assigned To</div>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {effectiveJob.techName.split(" ").map((w:string)=>w[0]).join("")}
                </div>
                <div>
                  <div className="text-sm font-semibold">{effectiveJob.techName}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardContent className="p-4">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Customer</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{job.client}</span>
              </div>
              {isManager && (
                <Button variant="link" size="sm" className="p-0 h-auto text-xs text-primary mt-1" onClick={() => navigate(`/customers/${job.customerId}`)}>
                  View all {job.client} jobs →
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Notes for Techs (dispatcher) */}
          <Card className={effectiveJob.notes ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10" : ""}>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <AlertCircle className="size-4 text-amber-600"/> Notes for Techs
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {effectiveJob.notes
                ? <p className="text-sm">{effectiveJob.notes}</p>
                : <p className="text-xs text-muted-foreground italic">No dispatcher notes for this job.</p>}
            </CardContent>
          </Card>

          {/* Completion Notes (editable by tech) */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5"><MessageSquare className="size-4 text-primary"/> Completion Notes</CardTitle>
                {!editingTechNote && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditingTechNote(true)}>
                    <Plus className="size-3"/> {techNote ? "Edit" : "Add"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {editingTechNote ? (
                <div className="space-y-2">
                  <Textarea rows={3} placeholder="Describe work performed, findings, units serviced..." value={techNote} onChange={e => setTechNote(e.target.value)} className="text-sm"/>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditingTechNote(false)}>Cancel</Button>
                    <Button size="sm" className="gap-1 text-xs" onClick={() => { handleSaveNotes(techNote, jobNote); setEditingTechNote(false); }}>
                      <Save className="size-3"/> Save
                    </Button>
                  </div>
                </div>
              ) : techNote
                ? <p className="text-sm">{techNote}</p>
                : <p className="text-xs text-muted-foreground italic">No completion notes yet. Tap Add to write notes.</p>}
            </CardContent>
          </Card>

          {/* Job Notes */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5"><FileText className="size-4 text-primary"/> Job Notes</CardTitle>
                {!editingJobNote && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditingJobNote(true)}>
                    <Plus className="size-3"/> {jobNote ? "Edit" : "Add"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {editingJobNote ? (
                <div className="space-y-2">
                  <Textarea rows={3} placeholder="Deficiencies, follow-ups, customer concerns..." value={jobNote} onChange={e => setJobNote(e.target.value)} className="text-sm"/>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditingJobNote(false)}>Cancel</Button>
                    <Button size="sm" className="gap-1 text-xs" onClick={() => { handleSaveNotes(techNote, jobNote); setEditingJobNote(false); }}>
                      <Save className="size-3"/> Save
                    </Button>
                  </div>
                </div>
              ) : jobNote
                ? <p className="text-sm">{jobNote}</p>
                : <p className="text-xs text-muted-foreground italic">No job notes yet.</p>}
            </CardContent>
          </Card>

          {/* ── All Documents & Photos (consolidated) ── */}
          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <FolderOpen className="size-4 text-primary"/> All Documents & Photos
                {allHistoryDocs.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{allHistoryDocs.length}</Badge>}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Current job + history at this customer</p>
            </CardHeader>
            <CardContent className="pb-4">
              {allHistoryDocs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">No documents or photos found.</p>
              ) : (
                <div className="space-y-2">
                  {allHistoryDocs.map((item, i) => (
                    <div key={`${item.doc.id}-${i}`} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group">
                      <div className="size-8 rounded-lg bg-background border flex items-center justify-center shrink-0">
                        {item.doc.type === "photo" ? <Image className="size-4 text-blue-500"/> : <FileText className="size-4 text-red-500"/>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{item.doc.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.source} · {item.doc.uploadedBy} · {item.date}</div>
                      </div>
                      <Button
                        variant="ghost" size="sm" className="h-7 gap-1 text-xs opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => { setViewingDoc(item.doc); setViewDocOpen(true); }}
                      >
                        <Eye className="size-3"/> View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Other jobs at customer (manager) */}
          {isManager && scheduleHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <History className="size-4 text-primary"/> Other Jobs at This Customer
                  <Badge variant="secondary" className="text-[10px] ml-1">{scheduleHistory.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-2">
                {scheduleHistory.map(sj => (
                  <div key={sj.id} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/jobs/${sj.id}`)}>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{sj.type}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(sj.scheduledDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})} · {sj.techName}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Badge variant={sj.status==="completed"?"default":"secondary"} className={`text-[9px] ${sj.status==="completed"?"bg-emerald-600":""}`}>{sj.status}</Badge>
                      <ChevronRight className="size-3.5 text-muted-foreground"/>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Previous year history */}
          {prevYearJobs.length > 0 && (
            <Card>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <History className="size-4 text-primary"/> Previous Year History (2025)
                  <Badge variant="secondary" className="text-[10px] ml-1">{prevYearJobs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-3">
                {prevYearJobs.map(pj => <PreviousYearJobCard key={pj.id} job={pj} onViewDoc={d => { setViewingDoc(d); setViewDocOpen(true); }}/>)}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ════ MAP TAB ════ */}
      {activeTab === "map" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Job Location</div>
              <div className="text-sm font-medium">{job.address}</div>
            </div>
            <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center border overflow-hidden">
              <div className="text-center space-y-3">
                <MapPin className="size-12 text-primary mx-auto"/>
                <div>
                  <p className="text-sm font-semibold">{job.client}</p>
                  <p className="text-xs text-muted-foreground">{job.address}</p>
                </div>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="gap-1.5"><Navigation className="size-4"/> Open in Google Maps</Button>
                </a>
              </div>
            </div>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" className="w-full gap-2">
                <Navigation className="size-4 text-primary"/> Get Directions
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      {/* ════ PHOTO TAB ════ */}
      {activeTab === "photo" && (
        <div className="space-y-3">
          {/* Hidden file input */}
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden"/>

          <Card>
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Camera className="size-4 text-primary"/> Photos & Documents
                  {totalPhotos > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{totalPhotos}</Badge>}
                </CardTitle>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="default" className="gap-1.5 text-xs h-8" onClick={() => photoInputRef.current?.click()}>
                    <Camera className="size-3"/> Take Photo
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => { if (photoInputRef.current) { photoInputRef.current.removeAttribute("capture"); photoInputRef.current.click(); setTimeout(() => photoInputRef.current?.setAttribute("capture","environment"), 100); } }}>
                    <Upload className="size-3"/> Upload
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {/* Captured photos grid */}
              {jobPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {jobPhotos.map(photo => (
                    <div key={photo.id} className="relative group rounded-lg overflow-hidden border aspect-square bg-muted">
                      <img src={photo.dataUrl} alt={photo.caption} className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <div className="text-white text-[10px] truncate flex-1">{photo.caption}</div>
                        <button onClick={() => handleDeletePhoto(photo.id)} className="text-white/80 hover:text-red-400 ml-1">
                          <Trash2 className="size-3.5"/>
                        </button>
                      </div>
                      <div className="absolute top-1 right-1">
                        <Badge className="text-[9px] bg-black/60 text-white border-0 px-1 py-0.5">New</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing job documents */}
              {job.documents.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {job.documents.map(doc => <DocumentCard key={doc.id} doc={doc} onView={d => { setViewingDoc(d); setViewDocOpen(true); }}/>)}
                </div>
              ) : jobPhotos.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Camera className="size-10 mx-auto mb-2 opacity-40"/>
                  <p className="text-sm font-medium">No photos yet</p>
                  <p className="text-xs mb-3">Tap "Take Photo" to capture with your camera</p>
                  <Button variant="outline" className="gap-1.5 text-xs" onClick={() => photoInputRef.current?.click()}>
                    <Camera className="size-3"/> Take First Photo
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════ SIGN TAB ════ */}
      {activeTab === "sign" && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <PenLine className="size-4 text-primary"/> Customer Signature
            </CardTitle>
            <p className="text-xs text-muted-foreground">Confirms that work was completed to the customer's satisfaction</p>
          </CardHeader>
          <CardContent className="pb-4">
            <SignaturePad onSave={handleSaveSignature} existingSig={savedSig}/>
            {savedSig && (
              <div className="mt-3 text-center">
                <p className="text-xs text-muted-foreground">Submitting signature automatically marks the job as completed.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Edit Job Dialog (manager only) ── */}
      {isManager && (
        <EditJobDialog
          open={editOpen}
          job={effectiveJob}
          onClose={() => setEditOpen(false)}
          onSave={handleSaveEdit}
        />
      )}

      {/* ── Create Invoice Dialog (manager, completed jobs) ── */}
      {isManager && (
        <Dialog open={invoiceOpen} onOpenChange={o => !o && setInvoiceOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="size-5 text-emerald-600"/> Create Invoice
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <p className="text-xs text-muted-foreground">
                Generate a draft invoice for this completed job. You can edit line items on the Invoices page.
              </p>
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{job.client}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{effectiveJob.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{new Date(effectiveJob.scheduledDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 mt-1.5">
                  <span className="font-semibold">Amount</span>
                  <span className="font-bold text-emerald-600">${(effectiveJob.revenue ?? job.revenue).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={invoiceSaving}
                  onClick={async () => {
                    setInvoiceSaving(true);
                    try {
                      await createInvoice({
                        customerId:  job.customerId ?? 1,
                        jobId:       null,
                        lineItems: [{
                          service:  effectiveJob.type ?? "Fire Inspection",
                          quantity: 1,
                          rate:     effectiveJob.revenue ?? job.revenue ?? 0,
                          total:    effectiveJob.revenue ?? job.revenue ?? 0,
                        }],
                        totalAmount: effectiveJob.revenue ?? job.revenue ?? 0,
                        status: "draft",
                      });
                      setInvoiceDone(true);
                      setInvoiceOpen(false);
                    } catch {
                      // silently ignore — invoice page has full error handling
                    } finally {
                      setInvoiceSaving(false);
                    }
                  }}
                >
                  {invoiceSaving ? "Creating…" : "Create Draft Invoice"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Status Picker ── */}
      <StatusPickerModal current={status} open={statusPickerOpen} onClose={() => setStatusPickerOpen(false)} onSelect={handleStatusSelect}/>

      {/* ── Reschedule Dialog ── */}
      <Dialog open={rescheduleOpen} onOpenChange={o => !o && setRescheduleOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarX className="size-5 text-red-600"/> Request Reschedule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">This job will be flagged for reschedule and sent to your manager for approval.</p>
            <div className="space-y-1.5">
              <Label htmlFor="rsch-reason" className="text-xs font-semibold">Reason for Reschedule *</Label>
              <Textarea id="rsch-reason" rows={3} placeholder="Explain why this job needs to be rescheduled..." value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} className="text-sm"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Preferred Follow-up Date</Label>
                <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} className="text-sm"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Preferred Time</Label>
                <Input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className="text-sm"/>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setRescheduleOpen(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={!rescheduleReason.trim()}
                onClick={submitReschedule}
              >
                <CalendarX className="size-3.5 mr-1.5"/> Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Return Visit Dialog ── */}
      <Dialog open={returnOpen} onOpenChange={o => !o && setReturnOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-5 text-orange-600"/> Log Return Visit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-3 text-xs text-orange-700 dark:text-orange-400">
              Return visits are logged as <strong>$0 revenue</strong> and tracked separately. A follow-up job should be scheduled to resolve the issue.
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for Return *</Label>
              <Textarea rows={3} placeholder="What issue requires a return visit? e.g. Parts unavailable, deficiency found, customer request..." value={returnReason} onChange={e => setReturnReason(e.target.value)} className="text-sm"/>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setReturnOpen(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                disabled={!returnReason.trim()}
                onClick={submitReturn}
              >
                <RotateCcw className="size-3.5 mr-1.5"/> Log Return
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Document Viewer ── */}
      <Dialog open={viewDocOpen} onOpenChange={setViewDocOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingDoc?.type==="photo" ? <Image className="size-5 text-blue-500"/> : <FileText className="size-5 text-red-500"/>}
              {viewingDoc?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="border rounded-lg bg-muted/30 overflow-hidden">
              {viewingDoc?.type === "photo"
                ? <div className="aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20"><div className="text-center"><Image className="size-16 mx-auto text-blue-400 mb-3"/><p className="text-sm font-medium text-blue-700 dark:text-blue-300">{viewingDoc?.name}</p></div></div>
                : <div className="aspect-[3/4] max-h-[400px] flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20"><div className="text-center"><FileText className="size-16 mx-auto text-red-400 mb-3"/><p className="text-sm font-medium text-red-700 dark:text-red-300">{viewingDoc?.name}</p></div></div>}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-muted/50 rounded-lg p-3"><div className="text-muted-foreground mb-0.5">Uploaded By</div><div className="font-semibold">{viewingDoc?.uploadedBy}</div></div>
              <div className="bg-muted/50 rounded-lg p-3"><div className="text-muted-foreground mb-0.5">Date</div><div className="font-semibold">{viewingDoc?.uploadedAt}</div></div>
              <div className="bg-muted/50 rounded-lg p-3"><div className="text-muted-foreground mb-0.5">Size</div><div className="font-semibold">{viewingDoc?.size}</div></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" className="gap-1.5 text-xs" onClick={() => setViewDocOpen(false)}><X className="size-3"/> Close</Button>
            <Button className="gap-1.5 text-xs"><Download className="size-3"/> Download</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
