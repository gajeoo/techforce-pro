import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Cpu,
  Edit3,
  MapPin,
  Navigation,
  Plus,
  Radio,
  RefreshCw,
  Signal,
  SignalZero,
  Trash2,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Van {
  id: number;
  name: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  assignedEmployeeId: number | null;
  gpsTrackerId: string | null;
  gpsTrackerSerial: string | null;
  gpsTrackerModel: string | null;
  gpsTrackerInstalledAt: string | null;
  lat: string | null;
  lng: string | null;
  speed: number;
  heading: number;
  lastLocationUpdate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

// ─── Leaflet icon fix ───────────────────────────────────────────────────────
// Vite/webpack strips the default icon URLs — use explicit asset URLs
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function vanDivIcon(van: Van, selected: boolean) {
  const speed = van.speed ?? 0;
  const hasGps = !!van.gpsTrackerId;
  let color = "#6b7280"; // gray = no tracker
  if (hasGps) {
    if (van.status === "inactive") color = "#6b7280";
    else if (speed > 5) color = "#2563eb";       // moving = blue
    else if (speed > 0) color = "#f59e0b";       // creeping = amber
    else color = "#16a34a";                       // parked = green
  }
  const size = selected ? 42 : 34;
  const html = `
    <div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      transition:all .2s;
    ">
      <svg xmlns='http://www.w3.org/2000/svg' width='${Math.round(size*0.52)}' height='${Math.round(size*0.52)}' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>
        <path d='M1 3h15l4 5v4H1V3z'/><path d='M1 12v4h1'/><path d='M16 16h4'/><circle cx='5.5' cy='18.5' r='2.5'/><circle cx='18.5' cy='18.5' r='2.5'/>
      </svg>
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

// ─── Map auto-pan to selected van ─────────────────────────────────────────
function MapPanner({ van }: { van: Van | null }) {
  const map = useMap();
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (!van?.lat || !van?.lng) return;
    if (van.id === prev.current) return;
    prev.current = van.id;
    map.panTo([parseFloat(van.lat), parseFloat(van.lng)], { animate: true });
  }, [van, map]);
  return null;
}

// ─── API helpers ────────────────────────────────────────────────────────────
const API = "/api";
async function fetchVans(): Promise<Van[]> {
  const r = await fetch(`${API}/vans`);
  return r.json();
}
async function pollLocations(): Promise<Van[]> {
  const r = await fetch(`${API}/vans/locations`);
  return r.json();
}
async function createVan(body: Partial<Van>): Promise<Van> {
  const r = await fetch(`${API}/vans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
async function updateVan(id: number, body: Partial<Van>): Promise<Van> {
  const r = await fetch(`${API}/vans/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
async function deleteVan(id: number): Promise<void> {
  await fetch(`${API}/vans/${id}`, { method: "DELETE" });
}
async function installTracker(id: number, body: { serial: string; model: string }): Promise<Van> {
  const r = await fetch(`${API}/vans/${id}/install-tracker`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
async function removeTracker(id: number): Promise<Van> {
  const r = await fetch(`${API}/vans/${id}/tracker`, { method: "DELETE" });
  return r.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function vanStatus(van: Van): "moving" | "idle" | "parked" | "offline" {
  if (!van.gpsTrackerId) return "offline";
  if (van.status === "inactive") return "offline";
  if (van.speed > 5) return "moving";
  if (van.speed > 0) return "idle";
  return "parked";
}
function statusMeta(s: ReturnType<typeof vanStatus>) {
  switch (s) {
    case "moving":  return { label: "Moving",  dot: "bg-blue-500",    text: "text-blue-600",    badge: "border-blue-400 text-blue-600" };
    case "idle":    return { label: "Idle",    dot: "bg-amber-400",   text: "text-amber-600",   badge: "border-amber-400 text-amber-600" };
    case "parked":  return { label: "Parked",  dot: "bg-emerald-500", text: "text-emerald-600", badge: "border-emerald-500 text-emerald-600" };
    case "offline": return { label: "No GPS",  dot: "bg-gray-400",    text: "text-gray-500",    badge: "border-gray-300 text-gray-500" };
  }
}
function fmtUpdate(ts: string | null) {
  if (!ts) return "—";
  const diff = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 10) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  return `${Math.round(diff / 60)}m ago`;
}

// ─── Dialogs ────────────────────────────────────────────────────────────────

function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

// ─── Add Van Dialog ────────────────────────────────────────────────────────
function AddVanDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (v: Van) => void }) {
  const [form, setForm] = useState({ name: "", licensePlate: "", make: "Ford", model: "Transit 250", year: "2023", color: "White", notes: "" });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name || !form.licensePlate) return;
    setSaving(true);
    try {
      const v = await createVan({ ...form, year: parseInt(form.year) || 2023 });
      onSave(v);
      onClose();
      setForm({ name: "", licensePlate: "", make: "Ford", model: "Transit 250", year: "2023", color: "White", notes: "" });
    } finally { setSaving(false); }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onClose={onClose} title="Add New Van">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Van Name / Label *">
            <Input value={form.name} onChange={set("name")} placeholder="e.g. Van 7 — Smith" className="h-9 text-sm" />
          </Field>
        </div>
        <Field label="License Plate *">
          <Input value={form.licensePlate} onChange={set("licensePlate")} placeholder="MD-XXXX-FC" className="h-9 text-sm" />
        </Field>
        <Field label="Year">
          <Input value={form.year} onChange={set("year")} type="number" min="2000" max="2030" className="h-9 text-sm" />
        </Field>
        <Field label="Make">
          <Input value={form.make} onChange={set("make")} placeholder="Ford" className="h-9 text-sm" />
        </Field>
        <Field label="Model">
          <Input value={form.model} onChange={set("model")} placeholder="Transit 250" className="h-9 text-sm" />
        </Field>
        <div className="col-span-2">
          <Field label="Color">
            <Input value={form.color} onChange={set("color")} placeholder="White" className="h-9 text-sm" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Notes (optional)">
            <Input value={form.notes} onChange={set("notes")} placeholder="Any additional info…" className="h-9 text-sm" />
          </Field>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 text-sm h-9" onClick={onClose}>Cancel</Button>
        <Button className="flex-1 text-sm h-9" onClick={submit} disabled={saving || !form.name || !form.licensePlate}>
          {saving ? "Adding…" : "Add Van"}
        </Button>
      </div>
    </Dialog>
  );
}

// ─── Edit Van Dialog ────────────────────────────────────────────────────────
function EditVanDialog({ van, open, onClose, onSave }: { van: Van | null; open: boolean; onClose: () => void; onSave: (v: Van) => void }) {
  const [form, setForm] = useState({ name: "", licensePlate: "", make: "", model: "", year: "", color: "", status: "active", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (van) setForm({
      name: van.name, licensePlate: van.licensePlate,
      make: van.make, model: van.model, year: String(van.year),
      color: van.color, status: van.status, notes: van.notes ?? "",
    });
  }, [van]);

  async function submit() {
    if (!van) return;
    setSaving(true);
    try {
      const v = await updateVan(van.id, { ...form, year: parseInt(form.year) });
      onSave(v);
      onClose();
    } finally { setSaving(false); }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onClose={onClose} title={`Edit — ${van?.name ?? ""}`}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Van Name / Label">
            <Input value={form.name} onChange={set("name")} className="h-9 text-sm" />
          </Field>
        </div>
        <Field label="License Plate">
          <Input value={form.licensePlate} onChange={set("licensePlate")} className="h-9 text-sm" />
        </Field>
        <Field label="Year">
          <Input value={form.year} onChange={set("year")} type="number" className="h-9 text-sm" />
        </Field>
        <Field label="Make">
          <Input value={form.make} onChange={set("make")} className="h-9 text-sm" />
        </Field>
        <Field label="Model">
          <Input value={form.model} onChange={set("model")} className="h-9 text-sm" />
        </Field>
        <Field label="Color">
          <Input value={form.color} onChange={set("color")} className="h-9 text-sm" />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={set("status")} className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Notes">
            <Input value={form.notes} onChange={set("notes")} className="h-9 text-sm" />
          </Field>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 text-sm h-9" onClick={onClose}>Cancel</Button>
        <Button className="flex-1 text-sm h-9" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </Dialog>
  );
}

// ─── Install Tracker Dialog ─────────────────────────────────────────────────
function InstallTrackerDialog({ van, open, onClose, onSave }: { van: Van | null; open: boolean; onClose: () => void; onSave: (v: Van) => void }) {
  const [serial, setSerial] = useState("");
  const [model, setModel] = useState("CalAmp LMU-4230");
  const [saving, setSaving] = useState(false);
  const autoSerial = `GPS-FC-${String(van?.id ?? "").padStart(3, "0")}-${Date.now().toString().slice(-4)}`;

  async function submit() {
    if (!van) return;
    setSaving(true);
    try {
      const v = await installTracker(van.id, { serial: serial || autoSerial, model });
      onSave(v);
      onClose();
    } finally { setSaving(false); }
  }

  const MODELS = ["CalAmp LMU-4230", "Samsara VG34", "Verizon Connect Reveal", "Geotab GO9", "Spireon FleetLocate", "LynxFM Fleet Tracker"];

  return (
    <Dialog open={open} onClose={onClose} title={`Install GPS Tracker — ${van?.name ?? ""}`}>
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20 p-3 flex gap-2.5 items-start">
        <Cpu className="size-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          After physically mounting the tracker in the van, enter the serial number from the device label and select the model. The tracker will begin transmitting live location within 60 seconds.
        </p>
      </div>
      <Field label="Tracker Serial Number">
        <Input
          value={serial}
          onChange={e => setSerial(e.target.value)}
          placeholder={`Auto-assign: ${autoSerial}`}
          className="h-9 text-sm font-mono"
        />
        <p className="text-[10px] text-muted-foreground mt-1">Leave blank to auto-assign a serial number.</p>
      </Field>
      <Field label="Tracker Model">
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="w-full h-9 text-sm rounded-md border border-input bg-background px-3"
        >
          {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
        <p className="text-xs font-semibold text-foreground">Installation checklist</p>
        {["Mount tracker in OBD-II port or hardwire under dashboard", "Verify solid LED indicator (green = connected)", "Enter serial number above and click Activate"].map(item => (
          <div key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3 text-emerald-500 mt-0.5 shrink-0" />
            {item}
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 text-sm h-9" onClick={onClose}>Cancel</Button>
        <Button className="flex-1 text-sm h-9 gap-1.5" onClick={submit} disabled={saving}>
          <Zap className="size-3.5" />
          {saving ? "Activating…" : "Activate Tracker"}
        </Button>
      </div>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ─────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, onConfirm, onClose, danger }: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onClose: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-xl border border-border bg-card shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">{title}</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <Button variant="outline" className="flex-1 text-sm h-9" onClick={onClose}>Cancel</Button>
          <Button
            className={`flex-1 text-sm h-9 ${danger ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
            onClick={() => { onConfirm(); onClose(); }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function GPSTrackingPage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const [vans, setVans] = useState<Van[]>([]);
  const [selected, setSelected] = useState<Van | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showAddVan, setShowAddVan] = useState(false);
  const [editVan, setEditVan] = useState<Van | null>(null);
  const [installTrackerVan, setInstallTrackerVan] = useState<Van | null>(null);
  const [removeTrackerVan, setRemoveTrackerVan] = useState<Van | null>(null);
  const [deleteVanTarget, setDeleteVanTarget] = useState<Van | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchVans();
      setVans(data);
      setSelected(prev => prev ? data.find(v => v.id === prev.id) ?? prev : null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const poll = useCallback(async () => {
    setPolling(true);
    try {
      const data = await pollLocations();
      setVans(data);
      setSelected(prev => prev ? data.find(v => v.id === prev.id) ?? prev : null);
      setLastPoll(new Date());
    } finally {
      setPolling(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Wait for initial load then start polling
    const t = setTimeout(() => {
      poll();
      intervalRef.current = setInterval(poll, 5000);
    }, 1500);
    return () => {
      clearTimeout(t);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load, poll]);

  const tracked = vans.filter(v => v.gpsTrackerId && v.lat && v.lng);
  const moving = vans.filter(v => v.gpsTrackerId && (v.speed ?? 0) > 5);
  const noTracker = vans.filter(v => !v.gpsTrackerId);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] -m-4 md:-m-6 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Navigation className="size-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground">Fleet Live Tracking</h1>
            <p className="text-[11px] text-muted-foreground">
              {tracked.length} tracked · {moving.length} moving · {noTracker.length} without GPS
            </p>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <span className={`size-2 rounded-full ${polling ? "bg-blue-500 animate-pulse" : "bg-emerald-500"}`} />
            <span className="text-[10px] text-muted-foreground">
              {polling ? "Updating…" : lastPoll ? `Updated ${fmtUpdate(lastPoll.toISOString())}` : "Live"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={poll}
            disabled={polling}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-accent/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 text-muted-foreground ${polling ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {isManager && (
            <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowAddVan(true)}>
              <Plus className="size-3.5" /> Add Van
            </Button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Van List Sidebar ── */}
        <div className="w-64 shrink-0 border-r border-border bg-card/80 overflow-y-auto flex flex-col">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {vans.map(van => {
                const st = vanStatus(van);
                const meta = statusMeta(st);
                const isSelected = selected?.id === van.id;
                return (
                  <button
                    key={van.id}
                    onClick={() => setSelected(isSelected ? null : van)}
                    className={`w-full text-left rounded-lg p-2.5 transition-colors border ${
                      isSelected
                        ? "border-primary/30 bg-primary/5"
                        : "border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 size-2 rounded-full shrink-0 ${meta.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-foreground truncate">{van.name}</span>
                          {isSelected && <ChevronRight className="size-3 text-primary shrink-0" />}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{van.licensePlate} · {van.year} {van.make}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {van.gpsTrackerId ? (
                            <>
                              <Signal className="size-2.5 text-emerald-500" />
                              <span className={`text-[10px] font-medium ${meta.text}`}>{meta.label}</span>
                              {(van.speed ?? 0) > 0 && (
                                <span className="text-[10px] text-muted-foreground">{van.speed} mph</span>
                              )}
                            </>
                          ) : (
                            <>
                              <SignalZero className="size-2.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">No tracker</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Summary footer */}
          <div className="mt-auto border-t border-border/50 p-3 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Total vans</span><span className="font-semibold text-foreground">{vans.length}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-1.5 bg-blue-500 rounded-full inline-block" /> Moving</span>
              <span className="font-semibold text-blue-600">{moving.length}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-1.5 bg-emerald-500 rounded-full inline-block" /> Parked</span>
              <span className="font-semibold text-emerald-600">{vans.filter(v => v.gpsTrackerId && (v.speed ?? 0) === 0 && v.lat).length}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-1.5 bg-gray-400 rounded-full inline-block" /> No GPS</span>
              <span className="font-semibold">{noTracker.length}</span>
            </div>
          </div>
        </div>

        {/* ── Map + Detail ── */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* ── Leaflet Map ── */}
          <div className="flex-1 overflow-hidden relative">
            <MapContainer
              center={[39.2037, -76.8610]}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapPanner van={selected} />
              {vans.map(van => {
                if (!van.lat || !van.lng) return null;
                const lat = parseFloat(van.lat);
                const lng = parseFloat(van.lng);
                if (isNaN(lat) || isNaN(lng)) return null;
                const st = vanStatus(van);
                const meta = statusMeta(st);
                return (
                  <Marker
                    key={van.id}
                    position={[lat, lng]}
                    icon={vanDivIcon(van, selected?.id === van.id)}
                    eventHandlers={{ click: () => setSelected(van) }}
                  >
                    <Popup>
                      <div className="min-w-36">
                        <div className="font-bold text-sm">{van.name}</div>
                        <div className="text-xs text-gray-500">{van.licensePlate} · {van.year} {van.make} {van.model}</div>
                        <div className={`text-xs font-semibold mt-1 ${meta.text}`}>{meta.label} {van.speed > 0 ? `· ${van.speed} mph` : ""}</div>
                        {van.lastLocationUpdate && (
                          <div className="text-[10px] text-gray-400 mt-0.5">Updated {fmtUpdate(van.lastLocationUpdate)}</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Legend overlay */}
            <div className="absolute bottom-4 right-4 z-[1000] rounded-lg border border-border bg-card/95 backdrop-blur shadow-lg p-2.5 text-[10px] space-y-1">
              {[
                { dot: "bg-blue-500", label: "Moving" },
                { dot: "bg-amber-400", label: "Idle (<5 mph)" },
                { dot: "bg-emerald-500", label: "Parked" },
                { dot: "bg-gray-400", label: "No GPS tracker" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={`size-2.5 rounded-full ${item.dot}`} />
                  {item.label}
                </div>
              ))}
            </div>

            {/* "No vans on map" hint */}
            {!loading && tracked.length === 0 && (
              <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
                <div className="bg-card/90 backdrop-blur border border-border rounded-xl p-5 text-center shadow-lg pointer-events-auto max-w-xs">
                  <MapPin className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">No vans with GPS trackers yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isManager ? "Select a van from the list and install a GPS tracker to see it on the map." : "GPS trackers have not been installed on any vans yet."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Van Detail Panel ── */}
          {selected && (
            <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur overflow-x-auto">
              <div className="flex items-start gap-4 p-4 min-w-[600px]">
                {/* Icon */}
                <div className="size-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Truck className="size-6 text-muted-foreground" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-foreground">{selected.name}</h3>
                    <Badge variant="outline" className={`text-[10px] ${statusMeta(vanStatus(selected)).badge}`}>
                      {statusMeta(vanStatus(selected)).label}
                    </Badge>
                    {selected.status === "inactive" && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    <span>{selected.year} {selected.make} {selected.model} · {selected.color}</span>
                    <span>Plate: <span className="font-mono font-medium text-foreground">{selected.licensePlate}</span></span>
                    {selected.speed > 0 && <span>Speed: <span className="font-medium text-foreground">{selected.speed} mph</span></span>}
                    {selected.lat && selected.lng && (
                      <span>
                        GPS: <span className="font-mono text-[10px] text-foreground">{parseFloat(selected.lat).toFixed(4)}°N, {Math.abs(parseFloat(selected.lng)).toFixed(4)}°W</span>
                      </span>
                    )}
                    {selected.lastLocationUpdate && (
                      <span>Last update: <span className="text-foreground">{fmtUpdate(selected.lastLocationUpdate)}</span></span>
                    )}
                  </div>
                  {selected.gpsTrackerId ? (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                      <Radio className="size-3 text-emerald-500" />
                      <span className="text-emerald-600 font-medium">Tracker active</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground font-mono text-[10px]">{selected.gpsTrackerSerial}</span>
                      {selected.gpsTrackerModel && <span className="text-muted-foreground">· {selected.gpsTrackerModel}</span>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                      <AlertCircle className="size-3 text-amber-500" />
                      <span className="text-amber-600 font-medium">No GPS tracker installed</span>
                    </div>
                  )}
                  {selected.notes && <p className="text-xs text-muted-foreground mt-1">{selected.notes}</p>}
                </div>

                {/* Manager actions */}
                {isManager && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setEditVan(selected)}>
                      <Edit3 className="size-3.5" /> Edit
                    </Button>
                    {selected.gpsTrackerId ? (
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-amber-600 border-amber-400 hover:bg-amber-50" onClick={() => setRemoveTrackerVan(selected)}>
                        <SignalZero className="size-3.5" /> Remove Tracker
                      </Button>
                    ) : (
                      <Button size="sm" className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setInstallTrackerVan(selected)}>
                        <Cpu className="size-3.5" /> Install Tracker
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => setDeleteVanTarget(selected)}>
                      <Trash2 className="size-3.5" /> Remove Van
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialogs ── */}
      <AddVanDialog
        open={showAddVan}
        onClose={() => setShowAddVan(false)}
        onSave={v => setVans(prev => [...prev, v])}
      />
      <EditVanDialog
        van={editVan}
        open={!!editVan}
        onClose={() => setEditVan(null)}
        onSave={v => {
          setVans(prev => prev.map(p => p.id === v.id ? v : p));
          setSelected(v);
        }}
      />
      <InstallTrackerDialog
        van={installTrackerVan}
        open={!!installTrackerVan}
        onClose={() => setInstallTrackerVan(null)}
        onSave={v => {
          setVans(prev => prev.map(p => p.id === v.id ? v : p));
          setSelected(v);
        }}
      />
      <ConfirmDialog
        open={!!removeTrackerVan}
        title="Remove GPS Tracker"
        message={`This will deactivate the GPS tracker on ${removeTrackerVan?.name ?? "this van"} and remove it from the live map. You can reinstall a tracker later.`}
        onConfirm={async () => {
          if (!removeTrackerVan) return;
          const v = await removeTracker(removeTrackerVan.id);
          setVans(prev => prev.map(p => p.id === v.id ? v : p));
          setSelected(v);
          setRemoveTrackerVan(null);
        }}
        onClose={() => setRemoveTrackerVan(null)}
        danger
      />
      <ConfirmDialog
        open={!!deleteVanTarget}
        title="Remove Van from Fleet"
        message={`This will permanently remove ${deleteVanTarget?.name ?? "this van"} and all its data from the fleet. This cannot be undone.`}
        onConfirm={async () => {
          if (!deleteVanTarget) return;
          await deleteVan(deleteVanTarget.id);
          setVans(prev => prev.filter(v => v.id !== deleteVanTarget.id));
          if (selected?.id === deleteVanTarget.id) setSelected(null);
          setDeleteVanTarget(null);
        }}
        onClose={() => setDeleteVanTarget(null)}
        danger
      />
    </div>
  );
}
