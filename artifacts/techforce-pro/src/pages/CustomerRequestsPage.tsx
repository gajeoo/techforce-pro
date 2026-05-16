import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck, CheckCircle2, Clock, XCircle, MessageSquare,
  Plus, Eye, Send, CalendarDays, MapPin, Wrench, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const API = "/api";

type ReqStatus = "pending" | "in-review" | "scheduled" | "completed" | "declined";

interface ServiceRequest {
  id: number;
  customerId: number;
  customerName: string;
  serviceType: string;
  description: string | null;
  location: string | null;
  preferredDate: string | null;
  urgency: string;
  status: ReqStatus;
  managerMessage: string | null;
  fulfilledJobId: number | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<ReqStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:    { label: "Pending",    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",     icon: Clock },
  "in-review":{ label: "In Review", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",         icon: Eye },
  scheduled:  { label: "Scheduled", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: CalendarDays },
  completed:  { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  declined:   { label: "Declined",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",             icon: XCircle },
};

const URGENCY_COLOR: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  normal: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const SERVICE_TYPES = [
  "Fire Extinguisher Inspection", "Suppression System Inspection", "Sprinkler System Test",
  "Exit Light Inspection", "Annual Fire Safety Inspection", "Follow-up Inspection",
  "Emergency Service", "Equipment Repair", "Other",
];

export function CustomerRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests]   = useState<ServiceRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"all" | ReqStatus>("all");
  const [reviewing, setReviewing] = useState<ServiceRequest | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const customers = (useQuery(api.customers.list) ?? []) as any[];
  const [saving, setSaving]       = useState(false);
  const [reviewForm, setReviewForm] = useState({ status: "in-review" as ReqStatus, managerMessage: "" });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/service-requests`);
      if (r.ok) setRequests(await r.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();  }, [load]);

  function openReview(req: ServiceRequest) {
    setReviewing(req);
    setReviewForm({ status: req.status === "pending" ? "in-review" : req.status, managerMessage: req.managerMessage ?? "" });
    setReviewOpen(true);
  }

  async function handleReview() {
    if (!reviewing) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/service-requests/${reviewing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewForm),
      });
      if (!r.ok) throw new Error();
      toast.success("Request updated.");
      setReviewOpen(false);
      await load();
    } catch {
      toast.error("Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  const displayed = tab === "all" ? requests : requests.filter(r => r.status === tab);
  const pending   = requests.filter(r => r.status === "pending").length;
  const inReview  = requests.filter(r => r.status === "in-review").length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="size-6 text-primary shrink-0" /> Customer Requests
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Service requests submitted by customers — review, respond, and fulfill
          </p>
        </div>
      </div>

      {/* Alert */}
      {(pending + inReview) > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 flex items-center gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {pending} new · {inReview} in review — requires attention
            </p>
            <p className="text-xs text-amber-600/80 mt-0.5">Update status and post a message for the customer</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = requests.filter(r => r.status === status).length;
          const Icon = cfg.icon;
          return (
            <Card key={status} className="cursor-pointer hover:shadow-sm" onClick={() => setTab(status === tab ? "all" : status as ReqStatus)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">{cfg.label}</span>
                  <Icon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="text-xl font-extrabold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
            <TabsTrigger key={status} value={status}>
              {cfg.label} ({requests.filter(r => r.status === status).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Request list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading requests…</div>
      ) : displayed.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No requests in this category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map(req => {
            const StatusIcon = STATUS_CONFIG[req.status].icon;
            return (
              <Card key={req.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Wrench className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-sm">{req.serviceType}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{req.customerName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {req.urgency === "urgent" && (
                            <Badge variant="secondary" className={`text-[10px] ${URGENCY_COLOR.urgent}`}>
                              <AlertTriangle className="size-2.5 mr-1" /> Urgent
                            </Badge>
                          )}
                          <Badge variant="secondary" className={`text-[10px] ${STATUS_CONFIG[req.status].color}`}>
                            <StatusIcon className="size-3 mr-1" />
                            {STATUS_CONFIG[req.status].label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                        {req.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" /> {req.location}
                          </span>
                        )}
                        {req.preferredDate && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3" /> Preferred: {req.preferredDate}
                          </span>
                        )}
                        <span>Submitted {new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      {req.description && (
                        <p className="text-sm mt-2 text-muted-foreground">{req.description}</p>
                      )}
                      {req.managerMessage && (
                        <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                          <p className="text-xs font-semibold text-primary mb-0.5">Your Response:</p>
                          <p className="text-xs">{req.managerMessage}</p>
                        </div>
                      )}
                      <div className="mt-3">
                        <Button size="sm" className="gap-1.5 text-xs" onClick={() => openReview(req)}>
                          <MessageSquare className="size-3.5" />
                          {req.status === "pending" ? "Review & Respond" : "Update Status"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" /> Respond to Request
            </DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="overflow-y-auto flex-1 pr-1">
              <div className="space-y-4 py-2">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium">{reviewing.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{reviewing.serviceType}</span>
                  </div>
                  {reviewing.location && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium text-right max-w-[60%]">{reviewing.location}</span>
                    </div>
                  )}
                  {reviewing.preferredDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preferred Date</span>
                      <span className="font-medium">{reviewing.preferredDate}</span>
                    </div>
                  )}
                  {reviewing.description && (
                    <div>
                      <p className="text-muted-foreground mb-1">Details:</p>
                      <p className="text-xs">{reviewing.description}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Update Status</Label>
                  <Select value={reviewForm.status} onValueChange={v => setReviewForm(f => ({ ...f, status: v as ReqStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
                        <SelectItem key={s} value={s}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Message to Customer</Label>
                  <Textarea
                    placeholder="e.g. We've received your request and will schedule within 5 business days…"
                    rows={4}
                    value={reviewForm.managerMessage}
                    onChange={e => setReviewForm(f => ({ ...f, managerMessage: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t mt-2 shrink-0">
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={saving}>Cancel</Button>
            <Button disabled={saving} onClick={handleReview}>
              <Send className="size-3.5 mr-1.5" />
              {saving ? "Sending…" : "Send Update"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
