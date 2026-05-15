import { useState, useEffect, useRef } from "react";
import { Bell, AlertTriangle, Info, CheckCircle2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { getInvoices, getJobs } from "@/lib/api";

type AlertSeverity = "danger" | "warning" | "info";

interface AlertItem {
  id: string;
  type: AlertSeverity;
  title: string;
  desc: string;
  href: string;
  time?: string;
}

export function NotificationsBell() {
  const [open, setOpen]   = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getInvoices(), getJobs()]).then(([invs, jobs]) => {
      const items: AlertItem[] = [];

      // ── Overdue invoices ─────────────────────────────────────────────
      const overdueInvs = invs.filter(i => i.status === "overdue");
      if (overdueInvs.length > 0) {
        items.push({
          id:    "inv-overdue",
          type:  "danger",
          title: `${overdueInvs.length} overdue invoice${overdueInvs.length > 1 ? "s" : ""}`,
          desc:  `$${overdueInvs.reduce((s, i) => s + i.totalAmount, 0).toLocaleString()} outstanding`,
          href:  "/invoices",
          time:  "Finance",
        });
      }

      // ── Unpaid / draft invoices ──────────────────────────────────────
      const pendingInvs = invs.filter(i => i.status === "draft" || i.status === "pending" || i.status === "sent");
      if (pendingInvs.length > 0) {
        items.push({
          id:    "inv-pending",
          type:  "warning",
          title: `${pendingInvs.length} unpaid invoice${pendingInvs.length > 1 ? "s" : ""}`,
          desc:  `$${pendingInvs.reduce((s, i) => s + i.totalAmount, 0).toLocaleString()} awaiting payment`,
          href:  "/invoices",
          time:  "Finance",
        });
      }

      // ── Jobs needing attention ───────────────────────────────────────
      const needsAttn = jobs.filter(
        j => j.status === "return" || j.status === "will_return" || j.status === "reschedule",
      );
      if (needsAttn.length > 0) {
        items.push({
          id:    "jobs-attention",
          type:  "warning",
          title: `${needsAttn.length} job${needsAttn.length > 1 ? "s" : ""} need attention`,
          desc:  "Returns and reschedules require follow-up",
          href:  "/jobs",
          time:  "Operations",
        });
      }

      // ── Emergency jobs ───────────────────────────────────────────────
      const emergencyJobs = jobs.filter(j => j.priority === "high" && j.status === "pending");
      if (emergencyJobs.length > 0) {
        items.push({
          id:    "jobs-emergency",
          type:  "danger",
          title: `${emergencyJobs.length} high-priority job${emergencyJobs.length > 1 ? "s" : ""} pending`,
          desc:  "Immediate dispatch required",
          href:  "/jobs",
          time:  "Operations",
        });
      }

      // ── Pending time-off requests ────────────────────────────────────
      fetch("/api/time-off?status=pending")
        .then(r => r.ok ? r.json() : [])
        .then((pending: unknown[]) => {
          if (!isMounted) return;
          if (pending.length > 0) {
            items.push({
              id:    "timeoff-pending",
              type:  "info",
              title: `${pending.length} time-off request${pending.length > 1 ? "s" : ""} pending`,
              desc:  "Awaiting your review and approval",
              href:  "/time-off",
              time:  "HR",
            });
          }
          setAlerts([...items]);
        })
        .catch(() => { if (isMounted) setAlerts([...items]); });
    }).catch(() => {});

    return () => { isMounted = false; };
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dangerCount  = alerts.filter(a => a.type === "danger").length;
  const warningCount = alerts.filter(a => a.type === "warning").length;
  const badgeColor   = dangerCount > 0 ? "bg-red-500" : warningCount > 0 ? "bg-amber-500" : alerts.length > 0 ? "bg-blue-500" : "";

  function AlertIcon({ type }: { type: AlertSeverity }) {
    if (type === "info") return <Info className="size-3.5 shrink-0 mt-0.5 text-blue-400" />;
    if (type === "danger") return <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-red-400" />;
    return <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-400" />;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Notifications"
        className={`relative size-8 rounded-lg flex items-center justify-center transition-colors
          ${open ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/8"}`}
      >
        <Bell className="size-4" />
        {badgeColor && (
          <span className={`absolute top-1.5 right-1.5 size-2 rounded-full ${badgeColor} ring-1 ring-[oklch(0.13_0.015_260)]`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-80 rounded-xl border border-white/10 bg-[oklch(0.13_0.015_260)] shadow-2xl shadow-black/40 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Bell className="size-3.5 text-white/60" />
              <span className="text-xs font-bold text-white">Notifications</span>
            </div>
            {alerts.length > 0 && (
              <span className="text-[9px] bg-primary text-white rounded-full px-1.5 py-0.5 font-bold">
                {alerts.length} alert{alerts.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Body */}
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-white/40">
              <CheckCircle2 className="size-7" />
              <span className="text-xs">All clear — no alerts</span>
            </div>
          ) : (
            <div className="py-1.5 max-h-80 overflow-y-auto">
              {alerts.map(alert => (
                <Link
                  key={alert.id}
                  to={alert.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/6 transition-colors"
                >
                  <AlertIcon type={alert.type} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white leading-tight">{alert.title}</div>
                    <div className="text-[10px] text-white/45 mt-0.5">{alert.desc}</div>
                  </div>
                  {alert.time && (
                    <div className="flex items-center gap-1 text-[9px] text-white/30 shrink-0 mt-0.5">
                      <Clock className="size-2.5" />
                      {alert.time}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-white/8 px-4 py-2">
            <Link
              to="/reports"
              onClick={() => setOpen(false)}
              className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
            >
              View full reports & analytics →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
