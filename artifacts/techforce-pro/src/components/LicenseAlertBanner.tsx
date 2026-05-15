import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getEmployees, type ApiEmployee } from "@/lib/api";
import {
  daysUntilExpiry,
  getExpiringLicenses,
  getExpiryStatus,
  type License,
} from "@/lib/licenses";

export function LicenseAlertBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expiring, setExpiring]   = useState<License[]>([]);
  const [empMap,   setEmpMap]     = useState<Record<string, string>>({});

  useEffect(() => {
    const role  = user?.role ?? "manager";
    const empId = user?.id ?? "";
    // Read licenses from localStorage (no seed call — seeding is done on the Licenses page)
    if (role === "manager" || role === "supervisor") {
      setExpiring(getExpiringLicenses());
    } else if (role === "technician") {
      setExpiring(getExpiringLicenses(empId));
    }
  }, [user]);

  // Fetch employee names so the banner can display "Tyler: MD Fire Suppression…"
  useEffect(() => {
    if (user?.role !== "manager" && user?.role !== "supervisor") return;
    getEmployees()
      .then((emps: ApiEmployee[]) => {
        const map: Record<string, string> = {};
        emps.forEach(e => { map[String(e.id)] = e.name; });
        setEmpMap(map);
      })
      .catch(() => {});
  }, [user?.role]);

  if (expiring.length === 0) return null;

  const critical = expiring.filter(l => {
    const s = getExpiryStatus(l.expiryDate);
    return s === "expired" || s === "critical";
  });
  const urgent = critical.length > 0;
  const isManagerOrSup = user?.role === "manager" || user?.role === "supervisor";

  function getEmpName(id: string) {
    return empMap[id] ?? null;
  }

  return (
    <Alert
      className={urgent
        ? "border-destructive/50 bg-destructive/5"
        : "border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-600/40"}
    >
      <AlertTriangle className={`size-4 ${urgent ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`} />
      <AlertTitle className={`${urgent ? "text-destructive" : "text-amber-800 dark:text-amber-400"} text-sm`}>
        {urgent
          ? `${critical.length} license${critical.length > 1 ? "s" : ""} expiring within 30 days`
          : `${expiring.length} license${expiring.length > 1 ? "s" : ""} expiring within 60 days`}
      </AlertTitle>
      <AlertDescription className="flex items-start justify-between gap-3 flex-wrap mt-1">
        <ul className={`space-y-0.5 ${urgent ? "text-destructive/80" : "text-amber-700 dark:text-amber-300"}`}>
          {expiring.slice(0, 3).map(l => {
            const days   = daysUntilExpiry(l.expiryDate);
            const name   = isManagerOrSup ? getEmpName(l.empId) : null;
            const prefix = name ? `${name}: ` : "";
            return (
              <li key={l.id} className="text-xs">
                {prefix}<strong>{l.type}</strong>
                {" — "}
                {days < 0
                  ? <span className="font-semibold">{Math.abs(days)}d overdue</span>
                  : <span>{days}d left</span>}
              </li>
            );
          })}
          {expiring.length > 3 && (
            <li className="text-xs opacity-70">+{expiring.length - 3} more</li>
          )}
        </ul>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7 shrink-0"
          onClick={() => navigate("/licenses")}
        >
          Manage Licenses →
        </Button>
      </AlertDescription>
    </Alert>
  );
}
