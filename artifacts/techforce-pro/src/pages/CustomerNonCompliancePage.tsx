import { useEffect, useState } from "react";
import type { ConvexJob, ConvexCustomer } from "@/lib/convex-types";
import {
  AlertTriangle, ArrowLeft, Building2, Calendar, CheckCircle2,
  Clock, FileText, MapPin, ShieldX, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  loadNCNotices,
  acknowledgeNCNotice,
  type NCNotice,
} from "@/lib/nonCompliance";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CustomerNonCompliancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notices, setNotices] = useState<NCNotice[]>([]);
  const rawJobs = (useQuery(api.jobs.list) ?? []) as ConvexJob[];
  const allCustomers = (useQuery(api.customers.list) ?? []) as ConvexCustomer[];
  // Sort by creation time for deterministic ordering, then index by numeric auth ID
  const custId = parseInt((user?.id ?? "").replace(/\D/g, "")) || 1;
  const sortedCustomers = [...allCustomers].sort((a, b) => a._creationTime - b._creationTime);
  const myCust: ConvexCustomer | undefined = sortedCustomers[custId - 1];
  // Never fall back to showing all jobs — show nothing while loading or if lookup fails
  const allJobs = myCust ? rawJobs.filter(j => j.customerId === myCust._id) : [];
  const ncJobs = allJobs.filter(j => j.status === "non_compliant");
  

  function handleAcknowledge(id: string) {
    acknowledgeNCNotice(id);
    setNotices(prev => prev.map(n => n.id === id ? { ...n, acknowledged: true } : n));
  }

  const unacknowledged = notices.filter(n => !n.acknowledged).length;
  const total = notices.length + ncJobs.length;
  const pending = unacknowledged + ncJobs.length;

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
              <ShieldX className="size-6 text-destructive" /> Non-Compliance Notices
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Official non-compliance notifications from Multicorp Fire Protection
            </p>
          </div>
        </div>
        {unacknowledged > 0 && (
          <Badge variant="destructive" className="self-start sm:self-auto gap-1.5 px-3 py-1.5 text-sm">
            <AlertTriangle className="size-4" /> {unacknowledged} requiring acknowledgment
          </Badge>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Total Notices</div>
            <div className="text-2xl font-extrabold text-destructive">{total}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Pending Review</div>
            <div className="text-2xl font-extrabold text-amber-600">{pending}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Acknowledged</div>
            <div className="text-2xl font-extrabold text-emerald-600">{notices.filter(n => n.acknowledged).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Non-compliant jobs from API */}
      {ncJobs.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" /> Active Non-Compliance Jobs
            </CardTitle>
            <CardDescription>These jobs have been flagged as non-compliant in our system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ncJobs.map(job => (
              <div key={job.id} className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-destructive flex items-center gap-2">
                      <ShieldX className="size-4 shrink-0" />
                      {job.serviceType}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {job.scheduledDate && (
                        <div className="flex items-center gap-1"><Calendar className="size-3" /> {job.scheduledDate}</div>
                      )}
                      {job.customerAddress && (
                        <div className="flex items-center gap-1"><MapPin className="size-3" /> {job.customerAddress}</div>
                      )}
                      {job.notes && (
                        <div className="flex items-start gap-1"><FileText className="size-3 mt-0.5 shrink-0" /> {job.notes}</div>
                      )}
                    </div>
                    {job.nonComplianceReason && (
                      <div className="mt-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs">
                        <span className="font-semibold text-destructive">Reason: </span>
                        {job.nonComplianceReason}
                      </div>
                    )}
                  </div>
                  <Badge variant="destructive" className="shrink-0 text-[10px]">Non-Compliant</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notices from messaging system */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="size-4 text-primary" /> Compliance Notices
          </CardTitle>
          <CardDescription>
            {notices.length === 0
              ? "No compliance notices have been sent to you yet."
              : `${notices.length} notice${notices.length > 1 ? "s" : ""} on record`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notices.length === 0 && ncJobs.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="size-10 mx-auto mb-3 text-emerald-500" />
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">All Clear!</p>
              <p className="text-sm text-muted-foreground mt-1">No non-compliance notices on file. You're in good standing.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map(notice => (
                <div
                  key={notice.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    notice.acknowledged
                      ? "border-border bg-muted/20"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`font-semibold text-sm ${notice.acknowledged ? "text-foreground" : "text-destructive"}`}>
                          {notice.serviceType}
                        </div>
                        {!notice.acknowledged && (
                          <Badge variant="destructive" className="text-[9px] px-1.5">New</Badge>
                        )}
                        {notice.acknowledged && (
                          <Badge variant="outline" className="text-[9px] px-1.5 text-emerald-600 border-emerald-200">Acknowledged</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                        {notice.location && (
                          <span className="flex items-center gap-1"><Building2 className="size-3" /> {notice.location}</span>
                        )}
                        {notice.address && (
                          <span className="flex items-center gap-1"><MapPin className="size-3" /> {notice.address}</span>
                        )}
                        {notice.scheduledDate && (
                          <span className="flex items-center gap-1"><Calendar className="size-3" /> {notice.scheduledDate}</span>
                        )}
                        <span className="flex items-center gap-1"><Users className="size-3" /> {notice.sentBy} ({notice.sentByRole})</span>
                        <span className="flex items-center gap-1"><Clock className="size-3" /> {timeAgo(notice.sentAt)}</span>
                      </div>

                      <div className="mt-2 p-2.5 rounded-lg bg-background border text-xs">
                        <span className="font-semibold text-destructive">Non-Compliance Reason: </span>
                        {notice.reason}
                      </div>
                    </div>

                    {!notice.acknowledged && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-8 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => handleAcknowledge(notice.id)}
                      >
                        <CheckCircle2 className="size-3.5" /> Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {notices.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          To dispute a notice or request re-inspection, please contact us at (410) 876-5000 or send a message through the portal.
        </p>
      )}
    </div>
  );
}
