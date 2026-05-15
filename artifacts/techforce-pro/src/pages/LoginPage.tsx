import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, ChevronRight, Shield, Wrench, UserCircle, Users } from "lucide-react";
import { useAuth, type Role } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEmployees, getCustomers, initials, roleLabel, type ApiEmployee, type ApiCustomer } from "@/lib/api";

interface RoleOption {
  role: Role;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  requiresPicker: "employee" | "customer" | null;
  defaultId?: string;
  defaultName?: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: "manager",
    label: "Manager / Admin",
    description: "Full access — dashboard, employees, jobs, P&L engine, scheduling",
    icon: Users,
    color: "bg-primary",
    requiresPicker: null,
    defaultId: "admin",
    defaultName: "Admin",
  },
  {
    role: "supervisor",
    label: "Supervisor",
    description: "Team oversight — live schedule, GPS, returns & reschedules",
    icon: Shield,
    color: "bg-blue-600",
    requiresPicker: "employee",
  },
  {
    role: "technician",
    label: "Technician",
    description: "Personal schedule, job status updates, time-off requests",
    icon: Wrench,
    color: "bg-emerald-600",
    requiresPicker: "employee",
  },
  {
    role: "customer",
    label: "Customer",
    description: "Upcoming visits, inspection history, open invoices",
    icon: UserCircle,
    color: "bg-amber-600",
    requiresPicker: "customer",
  },
];

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1582714032534-6a3dfb5e4e66?auto=format&fit=crop&w=1400&q=80";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<RoleOption | null>(null);
  const [pickedId, setPickedId] = useState<string>("");
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    getEmployees().then(setEmployees).catch(() => {});
    getCustomers().then(setCustomers).catch(() => {});
  }, []);

  function getRedirectPath(role: string) {
    if (role === "technician") return "/tech-portal";
    if (role === "customer") return "/customer-portal";
    if (role === "supervisor") return "/supervisor";
    return "/dashboard";
  }

  function handleEnter(option: RoleOption) {
    if (option.requiresPicker === null) {
      login({ role: option.role, name: option.defaultName!, id: option.defaultId! });
      navigate(getRedirectPath(option.role));
      return;
    }
    setSelected(option);
    setPickedId("");
  }

  function handleConfirm() {
    if (!selected || !pickedId) return;
    if (selected.requiresPicker === "employee") {
      const emp = employees.find(e => String(e.id) === pickedId);
      if (!emp) return;
      login({ role: selected.role, name: emp.name, id: String(emp.id) });
      navigate(getRedirectPath(selected.role));
    } else {
      const cust = customers.find(c => String(c.id) === pickedId);
      if (!cust) return;
      login({ role: selected.role, name: cust.name, id: String(cust.id) });
      navigate(getRedirectPath(selected.role));
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative min-h-screen">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-xl space-y-5">
        {/* ── Hero Image ─────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden h-44 sm:h-52 shadow-lg">
          {!imgError && (
            <img
              src={HERO_IMAGE}
              alt="Fire protection technician at work"
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          )}
          {/* Gradient overlay — always rendered */}
          <div
            className={`absolute inset-0 flex flex-col justify-end p-5 ${
              imgError
                ? "bg-gradient-to-br from-primary/90 via-primary/70 to-red-900"
                : "bg-gradient-to-t from-black/80 via-black/40 to-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-primary shadow-lg flex items-center justify-center shrink-0">
                <Flame className="size-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">TechForce Pro</h1>
                <p className="text-xs text-white/80 mt-0.5">Multicorp Fire Protection Services</p>
              </div>
            </div>
            <p className="text-[11px] text-white/60 mt-2 ml-0.5">
              Keeping facilities safe — scheduling, inspections &amp; compliance
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">Select your portal to continue</p>

        {!selected ? (
          <div className="grid gap-3">
            {ROLE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.role}
                  onClick={() => handleEnter(opt)}
                  className="w-full text-left rounded-xl border border-border bg-card hover:bg-accent/50 p-4 transition-all group flex items-center gap-4"
                >
                  <div className={`size-11 rounded-lg ${opt.color} flex items-center justify-center shrink-0`}>
                    <Icon className="size-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-foreground">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(() => { const Icon = selected.icon; return <Icon className="size-5" />; })()}
                {selected.label}
              </CardTitle>
              <CardDescription>
                {selected.requiresPicker === "employee"
                  ? "Select your employee profile to continue"
                  : "Select your customer account to continue"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                {selected.requiresPicker === "employee"
                  ? employees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => setPickedId(String(emp.id))}
                      className={`w-full text-left rounded-lg border p-3 transition-all flex items-center gap-3 ${pickedId === String(emp.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                    >
                      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                        {initials(emp.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{roleLabel(emp.role)}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{emp.certifications.slice(0, 2).join(", ") || "General"}</Badge>
                    </button>
                  ))
                  : customers.map(cust => (
                    <button
                      key={cust.id}
                      onClick={() => setPickedId(String(cust.id))}
                      className={`w-full text-left rounded-lg border p-3 transition-all flex items-center gap-3 ${pickedId === String(cust.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                    >
                      <div className="size-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300 text-sm">
                        {cust.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{cust.name}</div>
                        <div className="text-xs text-muted-foreground">{cust.facilityType} · {cust.inspectionFrequency} inspection</div>
                      </div>
                    </button>
                  ))}
              </div>
              {employees.length === 0 && selected.requiresPicker === "employee" && (
                <p className="text-xs text-muted-foreground text-center py-2">Loading employees…</p>
              )}
              {customers.length === 0 && selected.requiresPicker === "customer" && (
                <p className="text-xs text-muted-foreground text-center py-2">Loading customers…</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>Back</Button>
                <Button className="flex-1" disabled={!pickedId} onClick={handleConfirm}>
                  Enter Portal <ChevronRight className="size-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Multicorp Fire Protection Services · 9693 Gerwig Lane, Columbia MD 21046 · (410) 876-5000
        </p>
      </div>
    </div>
  );
}
