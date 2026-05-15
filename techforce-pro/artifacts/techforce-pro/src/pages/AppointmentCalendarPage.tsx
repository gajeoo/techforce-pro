import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock, MapPin,
  Users, Trash2, Pencil, Phone, Video, Building2, Briefcase, Share2,
} from "lucide-react";
import { toast } from "sonner";

const API = "/api";

interface Appointment {
  id: number;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  type: string;
  participants: string | null;
  location: string | null;
  notes: string | null;
  createdBy: string | null;
  calendarOwner: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  meeting:      { label: "Meeting",    color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",     icon: Users },
  "site-visit": { label: "Site Visit", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: Building2 },
  call:         { label: "Call",       color: "text-violet-700",  bg: "bg-violet-50 border-violet-200", icon: Phone },
  internal:     { label: "Internal",   color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   icon: Briefcase },
  other:        { label: "Other",      color: "text-slate-700",   bg: "bg-slate-50 border-slate-200",   icon: Calendar },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmt12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDow(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const EMPTY_FORM = {
  title: "", description: "", date: "", startTime: "09:00", endTime: "10:00",
  type: "meeting", participants: "", location: "", notes: "",
  sendToSupervisor: false,
};

export function AppointmentCalendarPage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string>(now.toISOString().slice(0, 10));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  async function loadAppointments() {
    try {
      const owner = isManager ? "manager" : "supervisor";
      const r = await fetch(`${API}/appointments?owner=${owner}`);
      if (r.ok) setAppointments(await r.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAppointments(); }, []);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function goToday() {
    setYear(now.getFullYear()); setMonth(now.getMonth());
    setSelected(now.toISOString().slice(0, 10));
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDow(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function aptsForDate(d: string) {
    return appointments.filter(a => a.date === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function openNew(date?: string) {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, date: date ?? selected });
    setDialogOpen(true);
  }

  function openEdit(apt: Appointment) {
    setEditTarget(apt);
    setForm({
      title: apt.title,
      description: apt.description ?? "",
      date: apt.date,
      startTime: apt.startTime,
      endTime: apt.endTime ?? "",
      type: apt.type,
      participants: apt.participants ?? "",
      location: apt.location ?? "",
      notes: apt.notes ?? "",
      sendToSupervisor: apt.calendarOwner === "shared",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title || !form.date || !form.startTime || !form.type) {
      toast.error("Title, date, start time, and type are required.");
      return;
    }
    setSaving(true);
    try {
      const calendarOwner = isManager
        ? (form.sendToSupervisor ? "shared" : "manager")
        : "supervisor";
      const payload = {
        title: form.title,
        description: form.description || undefined,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime || undefined,
        type: form.type,
        participants: form.participants || undefined,
        location: form.location || undefined,
        notes: form.notes || undefined,
        calendarOwner,
      };
      if (editTarget) {
        const r = await fetch(`${API}/appointments/${editTarget.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("Failed to update");
        toast.success("Appointment updated.");
      } else {
        const r = await fetch(`${API}/appointments`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("Failed to create");
        toast.success("Appointment created.");
      }
      setDialogOpen(false);
      await loadAppointments();
    } catch {
      toast.error("Failed to save appointment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this appointment?")) return;
    try {
      await fetch(`${API}/appointments/${id}`, { method: "DELETE" });
      toast.success("Appointment deleted.");
      await loadAppointments();
    } catch {
      toast.error("Failed to delete.");
    }
  }

  async function handleSendToSupervisor(apt: Appointment) {
    setSendingId(apt.id);
    try {
      const payload = {
        title: apt.title,
        description: apt.description ?? undefined,
        date: apt.date,
        startTime: apt.startTime,
        endTime: apt.endTime ?? undefined,
        type: apt.type,
        participants: apt.participants ?? undefined,
        location: apt.location ?? undefined,
        notes: apt.notes ?? undefined,
        calendarOwner: "supervisor",
      };
      const r = await fetch(`${API}/appointments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      toast.success("Sent to Supervisor's calendar.");
    } catch {
      toast.error("Failed to send to supervisor.");
    } finally {
      setSendingId(null);
    }
  }

  const selectedApts = aptsForDate(selected);
  const todayStr = now.toISOString().slice(0, 10);
  const upcomingToday = appointments.filter(a => a.date === todayStr).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="size-6 text-primary" /> Appointment Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manager's calendar — toggle "Share with Supervisor" when creating to push to their view
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button size="sm" className="gap-1.5" onClick={() => openNew()}>
            <Plus className="size-4" /> New Appointment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{MONTHS[month]} {year}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={prevMonth}><ChevronLeft className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={nextMonth}><ChevronRight className="size-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 mb-1">
                {DOW_SHORT.map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, idx) => {
                  if (day === null) return <div key={idx} />;
                  const ds = dateStr(day);
                  const dayApts = aptsForDate(ds);
                  const isToday = ds === todayStr;
                  const isSelected = ds === selected;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelected(ds)}
                      className={`min-h-[64px] rounded-lg p-1 cursor-pointer border transition-all
                        ${isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/30"}
                      `}
                    >
                      <div className={`text-xs font-semibold mb-0.5 w-5 h-5 flex items-center justify-center rounded-full mx-auto
                        ${isToday ? "bg-primary text-primary-foreground" : isSelected ? "text-primary" : "text-foreground"}
                      `}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayApts.slice(0, 3).map(a => {
                          const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.other;
                          return (
                            <div key={a.id} className={`text-[9px] leading-tight rounded px-1 py-0.5 border truncate font-medium ${cfg.bg} ${cfg.color}`}>
                              {a.startTime && fmt12(a.startTime).replace(" AM","a").replace(" PM","p")} {a.title}
                            </div>
                          );
                        })}
                        {dayApts.length > 3 && (
                          <div className="text-[9px] text-muted-foreground pl-1">+{dayApts.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected day detail */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {new Date(selected + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openNew(selected)}>
                  <Plus className="size-3" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedApts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No appointments this day.</p>
                  <Button variant="ghost" size="sm" className="mt-2 text-primary" onClick={() => openNew(selected)}>+ Schedule one</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedApts.map(apt => {
                    const cfg = TYPE_CONFIG[apt.type] ?? TYPE_CONFIG.other;
                    const Icon = cfg.icon;
                    const isShared = apt.calendarOwner === "shared";
                    return (
                      <div key={apt.id} className={`rounded-xl border p-3 ${cfg.bg}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Icon className={`size-4 mt-0.5 shrink-0 ${cfg.color}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-semibold text-sm ${cfg.color}`}>{apt.title}</span>
                                {isShared && (
                                  <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0">
                                    <Share2 className="size-2.5" /> Shared
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="size-3" /> {fmt12(apt.startTime)}{apt.endTime ? ` – ${fmt12(apt.endTime)}` : ""}
                                </span>
                                {apt.location && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="size-3" /> {apt.location}
                                  </span>
                                )}
                                {apt.participants && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="size-3" /> {apt.participants}
                                  </span>
                                )}
                              </div>
                              {apt.description && <p className="text-xs text-muted-foreground mt-1">{apt.description}</p>}
                              {apt.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{apt.notes}</p>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {isManager && !isShared && (
                              <Button
                                variant="ghost" size="icon" className="size-7"
                                title="Share with Supervisor's calendar"
                                disabled={sendingId === apt.id}
                                onClick={() => handleSendToSupervisor(apt)}
                              >
                                <Share2 className="size-3.5 text-primary" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(apt)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(apt.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Today's schedule */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Clock className="size-4 text-primary" /> Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingToday.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nothing scheduled for today.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingToday.map(apt => {
                    const cfg = TYPE_CONFIG[apt.type] ?? TYPE_CONFIG.other;
                    const Icon = cfg.icon;
                    return (
                      <div key={apt.id} className={`rounded-lg border p-2.5 ${cfg.bg} cursor-pointer`} onClick={() => openEdit(apt)}>
                        <div className={`text-xs font-semibold ${cfg.color} flex items-center gap-1.5`}>
                          <Icon className="size-3" /> {apt.title}
                          {apt.calendarOwner === "shared" && <Share2 className="size-2.5 ml-auto opacity-60" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="size-3" /> {fmt12(apt.startTime)}{apt.endTime ? ` – ${fmt12(apt.endTime)}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming appointments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Calendar className="size-4 text-primary" /> Upcoming (Next 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : (() => {
                const next7: Appointment[] = [];
                for (let i = 1; i <= 7; i++) {
                  const d = new Date(now);
                  d.setDate(now.getDate() + i);
                  const ds = d.toISOString().slice(0, 10);
                  next7.push(...aptsForDate(ds));
                }
                next7.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
                if (next7.length === 0) return <p className="text-xs text-muted-foreground py-2">Nothing in the next 7 days.</p>;
                return (
                  <div className="space-y-2">
                    {next7.map(apt => {
                      const cfg = TYPE_CONFIG[apt.type] ?? TYPE_CONFIG.other;
                      const Icon = cfg.icon;
                      const aptDate = new Date(apt.date + "T12:00:00");
                      return (
                        <div key={apt.id} className="flex gap-2.5 items-start p-2 rounded-lg hover:bg-muted/30 cursor-pointer" onClick={() => { setSelected(apt.date); openEdit(apt); }}>
                          <div className={`size-7 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 border`}>
                            <Icon className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold truncate">{apt.title}</span>
                              {apt.calendarOwner === "shared" && <Share2 className="size-2.5 shrink-0 text-muted-foreground" />}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {aptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {fmt12(apt.startTime)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Appointment Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <div key={key} className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 border ${cfg.bg} ${cfg.color}`}>
                      <Icon className="size-3.5 shrink-0" />
                      <span className="font-medium">{cfg.label}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 text-xs rounded-md px-2 py-1.5 border bg-slate-50 border-slate-200 text-slate-700 mt-2">
                  <Share2 className="size-3.5 shrink-0" />
                  <span className="font-medium">Shared with Supervisor</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editTarget ? "Edit Appointment" : "New Appointment"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1">
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Site visit — Hammond High School" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type <span className="text-destructive">*</span></Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_CONFIG).map(([k, c]) => (
                        <SelectItem key={k} value={k}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Time <span className="text-destructive">*</span></Label>
                  <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time</Label>
                  <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="e.g. 123 Main St or Zoom" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Participants</Label>
                <Input placeholder="e.g. James R., Sarah J." value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea placeholder="What is this appointment about?" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea placeholder="Any additional notes..." rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {isManager && (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Share2 className="size-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Share with Supervisor</p>
                      <p className="text-xs text-muted-foreground">Adds this to the supervisor's calendar view</p>
                    </div>
                  </div>
                  <Switch
                    checked={form.sendToSupervisor}
                    onCheckedChange={v => setForm(f => ({ ...f, sendToSupervisor: v }))}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editTarget ? "Save Changes" : "Create Appointment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
