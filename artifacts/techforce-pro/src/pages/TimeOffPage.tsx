import { useState, useEffect, useCallback } from "react";
import {
  CalendarOff, CheckCircle2, XCircle, Clock, Plus, Wrench,
  Plane, Stethoscope, GraduationCap, Truck, MoreHorizontal, User,
  CalendarDays,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { getEmployees, type ApiEmployee } from "@/lib/api";
import { toast } from "sonner";

const API = "/api";

type RequestType = "shop-day" | "vacation" | "sick" | "training" | "truck-maintenance" | "other";
type RequestStatus = "pending" | "approved" | "denied";

interface TimeOffRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  type: RequestType;
  startDate: string;
  endDate: string;
  reason: string;
  notes: string;
  status: RequestStatus;
  denialReason: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

const TYPE_CONFIG: Record<RequestType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  "shop-day":          { label: "Shop Day",          icon: Wrench },
  "vacation":          { label: "Vacation",           icon: Plane },
  "sick":              { label: "Sick Leave",         icon: Stethoscope },
  "training":          { label: "Training / Cert",   icon: GraduationCap },
  "truck-maintenance": { label: "Truck Maintenance",  icon: Truck },
  "other":             { label: "Other",              icon: MoreHorizontal },
};

const STATUS_COLOR: Record<RequestStatus, string> = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  denied:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const EMPTY_FORM = {
  employeeId: "",
  type: "shop-day" as RequestType,
  startDate: "",
  endDate: "",
  reason: "",
  notes: "",
  approveImmediately: false,
};

export function TimeOffPage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const [requests, setRequests]     = useState<TimeOffRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"all" | RequestStatus>("all");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewing, setReviewing]   = useState<TimeOffRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"approved" | "denied">("approved");
  const [saving, setSaving]         = useState(false);
  const [employees, setEmployees]   = useState<ApiEmployee[]>([]);
  const [form, setForm]             = useState({ ...EMPTY_FORM });

  const loadRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (!isManager && user?.id) params.set("employeeId", user.id);
      const r = await fetch(`${API}/time-off?${params}`);
      if (r.ok) setRequests(await r.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [isManager, user?.id]);

  useEffect(() => {
    loadRequests();
    getEmployees().then(setEmployees).catch(() => {});
  }, [loadRequests]);

  function openSubmit() {
    setForm({
      ...EMPTY_FORM,
      employeeId: isManager ? "" : (user?.id ?? ""),
    });
    setSubmitOpen(true);
  }

  async function handleSubmit() {
    if (!form.startDate || !form.reason || (!isManager && !user?.id)) return;
    const empId = isManager ? form.employeeId : (user?.id ?? "");
    if (!empId) { toast.error("Please select an employee."); return; }
    setSaving(true);
    try {
      const payload = {
        employeeId: Number(empId),
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        reason: form.reason,
        notes: form.notes,
        ...(isManager && form.approveImmediately ? { initialStatus: "approved", reviewedBy: user?.name ?? "Manager" } : {}),
      };
      const r = await fetch(`${API}/time-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Failed to submit");
      toast.success(form.approveImmediately ? "Request submitted and approved." : "Request submitted.");
      setSubmitOpen(false);
      await loadRequests();
    } catch {
      toast.error("Failed to submit request.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(decision: "approved" | "denied") {
    if (!reviewing) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/time-off/${reviewing.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: decision,
          reviewedBy: user?.name ?? "Manager",
          reviewNote,
          denialReason: decision === "denied" ? (reviewNote || "Request denied.") : null,
        }),
      });
      if (!r.ok) throw new Error("Failed to review");
      toast.success(decision === "approved" ? "Request approved." : "Request denied.");
      setReviewOpen(false);
      setReviewing(null);
      setReviewNote("");
      await loadRequests();
    } catch {
      toast.error("Failed to save review.");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickDecision(req: TimeOffRequest, decision: "approved" | "denied") {
    try {
      await fetch(`${API}/time-off/${req.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: decision,
          reviewedBy: user?.name ?? "Manager",
          reviewNote: "",
          denialReason: decision === "denied" ? "Request denied." : null,
        }),
      });
      toast.success(decision === "approved" ? "Approved." : "Denied.");
      await loadRequests();
    } catch {
      toast.error("Failed.");
    }
  }

  async function handleDelete(req: TimeOffRequest) {
    if (!confirm(`Delete this request for ${req.employeeName}?`)) return;
    try {
      await fetch(`${API}/time-off/${req.id}`, { method: "DELETE" });
      toast.success("Request deleted.");
      await loadRequests();
    } catch {
      toast.error("Failed to delete.");
    }
  }

  const pending  = requests.filter(r => r.status === "pending");
  const displayed = tab === "all" ? requests : requests.filter(r => r.status === tab);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarOff className="size-6 text-primary shrink-0" />
            {isManager ? "Time-Off & Shop Day Requests" : "My Requests"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isManager
              ? `${pending.length} pending approval · ${requests.length} total requests`
              : "Submit shop day, vacation, training, and leave requests"}
          </p>
        </div>
        <Button className="gap-1.5 self-start sm:self-auto" onClick={openSubmit}>
          <Plus className="size-4" /> {isManager ? "Request for Employee" : "New Request"}
        </Button>
      </div>

      {/* Pending alert for manager */}
      {isManager && pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 p-4 flex items-center gap-3">
          <Clock className="size-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {pending.length} request{pending.length !== 1 ? "s" : ""} pending your review
            </p>
            <p className="text-xs text-amber-600/80 mt-0.5">Review and approve or deny below</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({requests.filter(r => r.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({requests.filter(r => r.status === "approved").length})</TabsTrigger>
          <TabsTrigger value="denied">Denied ({requests.filter(r => r.status === "denied").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Request list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading requests…</div>
      ) : displayed.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CalendarOff className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No {tab === "all" ? "" : tab} requests found.</p>
            <Button variant="link" size="sm" className="mt-2" onClick={openSubmit}>
              {isManager ? "Request time off for an employee →" : "Submit a request →"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map(req => {
            const TypeIcon = TYPE_CONFIG[req.type]?.icon ?? MoreHorizontal;
            return (
              <Card key={req.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <TypeIcon className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="font-semibold text-sm">{TYPE_CONFIG[req.type]?.label ?? req.type}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{req.employeeName}</div>
                        </div>
                        <Badge className={`text-[10px] ${STATUS_COLOR[req.status]}`} variant="secondary">
                          {req.status === "approved" && <CheckCircle2 className="size-3 mr-1" />}
                          {req.status === "denied"   && <XCircle className="size-3 mr-1" />}
                          {req.status === "pending"  && <Clock className="size-3 mr-1" />}
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3" />
                          {req.startDate}{req.endDate !== req.startDate ? ` – ${req.endDate}` : ""}
                        </span>
                        <span>Submitted {new Date(req.createdAt).toLocaleDateString()}</span>
                        {req.reviewedBy && <span>Reviewed by {req.reviewedBy}</span>}
                      </div>

                      <p className="text-sm mt-2">{req.reason}</p>
                      {req.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{req.notes}"</p>}
                      {req.denialReason && (
                        <p className="text-xs mt-1.5 rounded bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 px-2 py-1 text-red-700 dark:text-red-400">
                          <span className="font-medium">Denial reason:</span> {req.denialReason}
                        </p>
                      )}
                      {req.reviewNote && (
                        <p className="text-xs mt-1.5 rounded bg-muted/50 px-2 py-1">
                          <span className="font-medium">Manager note:</span> {req.reviewNote}
                        </p>
                      )}

                      {isManager && req.status === "pending" && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => { setReviewing(req); setReviewNote(""); setReviewDecision("approved"); setReviewOpen(true); }}
                          >
                            <CheckCircle2 className="size-3.5" /> Review
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs text-emerald-600"
                            onClick={() => handleQuickDecision(req, "approved")}
                          >
                            Quick Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs text-red-600"
                            onClick={() => handleQuickDecision(req, "denied")}
                          >
                            Quick Deny
                          </Button>
                        </div>
                      )}

                      {isManager && (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] text-muted-foreground hover:text-red-600 px-1"
                            onClick={() => handleDelete(req)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Submit / Request Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              {isManager ? "Request Time Off for Employee" : "Submit Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1">
            <div className="space-y-4 py-2">
              {isManager && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Employee *</Label>
                  <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee…" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.filter(e => e.isActive).map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          <span className="flex items-center gap-2">
                            <User className="size-3.5" />
                            {e.name}
                            <span className="text-[10px] text-muted-foreground">
                              ({e.certifications[0]?.replace(/_/g, " ") ?? "General"})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Request Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as RequestType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Start Date *</Label>
                  <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">End Date</Label>
                  <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reason *</Label>
                <Input
                  placeholder="Brief reason for this request"
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Additional Notes</Label>
                <Textarea
                  placeholder="Any additional details (optional)"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              {isManager && (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Approve Immediately</p>
                    <p className="text-xs text-muted-foreground">Skip pending — mark approved right away</p>
                  </div>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary cursor-pointer"
                    checked={form.approveImmediately}
                    onChange={e => setForm(f => ({ ...f, approveImmediately: e.target.checked }))}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t mt-2 shrink-0">
            <Button variant="outline" onClick={() => setSubmitOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              disabled={saving || !form.startDate || !form.reason || (isManager && !form.employeeId)}
              onClick={handleSubmit}
            >
              {saving ? "Submitting…" : form.approveImmediately ? "Submit & Approve" : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Request — {reviewing?.employeeName}</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{TYPE_CONFIG[reviewing.type]?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dates</span>
                  <span className="font-medium">
                    {reviewing.startDate}{reviewing.endDate !== reviewing.startDate ? ` – ${reviewing.endDate}` : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reason</span>
                  <span className="font-medium text-right max-w-[60%]">{reviewing.reason}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Review Note (optional)</Label>
                <Textarea
                  placeholder="Add a note for the employee..."
                  rows={2}
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setReviewOpen(false)} disabled={saving}>Cancel</Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={saving}
                  onClick={() => handleReview("denied")}
                >
                  <XCircle className="size-3.5 mr-1.5" /> Deny
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={saving}
                  onClick={() => handleReview("approved")}
                >
                  <CheckCircle2 className="size-3.5 mr-1.5" /> Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
