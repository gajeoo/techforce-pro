import { useState, useEffect } from "react";
import {
  Link2, Copy, CheckCheck, UserCircle, Shield, Wrench, ExternalLink,
  ChevronDown, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateInviteToken } from "./InvitePage";
import type { Role } from "@/contexts/AuthContext";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBase(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL ?? "/"}`.replace(/\/$/, "");
}

function buildLink(role: Role, id: string, name: string, days = 30): string {
  const token = generateInviteToken({ role, id, name, daysValid: days });
  return `${getBase()}/invite?token=${token}`;
}

const ROLE_LABELS: Record<Role, string> = {
  manager:    "Manager / Admin",
  supervisor: "Supervisor",
  technician: "Technician",
  customer:   "Customer",
};

const ROLE_COLORS: Record<Role, string> = {
  manager:    "bg-primary",
  supervisor: "bg-blue-600",
  technician: "bg-emerald-600",
  customer:   "bg-amber-600",
};

const STAFF_ROLES: Role[] = ["technician", "supervisor"];

// ─── CopyableLink ─────────────────────────────────────────────────────────────

function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="flex gap-2 mt-2">
      <Input value={url} readOnly className="text-xs font-mono h-8 bg-muted" />
      <Button size="sm" variant="outline" className="h-8 px-3 shrink-0" onClick={copy}>
        {copied ? <CheckCheck className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      </Button>
      <Button size="sm" variant="outline" className="h-8 px-3 shrink-0" asChild>
        <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /></a>
      </Button>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
      <div className="opacity-30">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Staff Card ───────────────────────────────────────────────────────────────

function StaffInviteCard({ emp }: { emp: any }) {
  const [selectedRole, setSelectedRole] = useState<Role>(
    emp.role?.toLowerCase().includes("lead") || emp.role?.toLowerCase().includes("suppression")
      ? "supervisor"
      : "technician"
  );

  const initials = emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const link = buildLink(selectedRole, String(emp._id), emp.name);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {/* Avatar linked to directory record */}
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
              {initials}
            </div>
            <div>
              <CardTitle className="text-base">{emp.name}</CardTitle>
              <CardDescription className="text-xs">{emp.role} · Employee #{emp._id}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Directory tags */}
            <Badge variant="outline" className="text-[10px] font-mono">ID #{emp.id}</Badge>
            <Badge variant="secondary" className="text-[10px]">
              ${emp.salary.toLocaleString()}/yr
            </Badge>
            <Badge variant={emp.isActive ? "default" : "secondary"} className={`text-[10px] ${emp.isActive ? "bg-emerald-600" : ""}`}>
              {emp.isActive ? "active" : "inactive"}
            </Badge>

            {/* Portal role selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className={`h-7 text-[11px] gap-1.5 text-white ${ROLE_COLORS[selectedRole]}`}>
                  {ROLE_LABELS[selectedRole]}
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {STAFF_ROLES.map(r => (
                  <DropdownMenuItem key={r} onClick={() => setSelectedRole(r)} className="gap-2 text-xs">
                    <div className={`size-2 rounded-full ${ROLE_COLORS[r]}`} />
                    {ROLE_LABELS[r]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Directory info strip */}
        <div className="rounded-lg bg-muted/40 px-3 py-2 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px]">
          <div>
            <div className="text-muted-foreground">Role</div>
            <div className="font-medium truncate">{emp.role}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Bill Rate</div>
            <div className="font-medium">${emp.billableRate.toLocaleString()}/wk</div>
          </div>
          <div>
            <div className="text-muted-foreground">Utilization</div>
            <div className="font-medium">{emp.utilizationPct}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Certifications</div>
            <div className="font-medium truncate">{emp.certifications.length > 0 ? emp.certifications.slice(0, 2).join(", ") + (emp.certifications.length > 2 ? "…" : "") : "—"}</div>
          </div>
        </div>
        <CopyableLink url={link} />
      </CardContent>
    </Card>
  );
}

// ─── Customer Card ────────────────────────────────────────────────────────────

function CustomerInviteCard({ cust }: { cust: any }) {
  const link = buildLink("customer", String(cust._id), cust.name);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300 shrink-0">
              {cust.name.charAt(0)}
            </div>
            <div>
              <CardTitle className="text-base">{cust.name}</CardTitle>
              <CardDescription className="text-xs">{cust.facilityType} · {cust.contactName}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono">ID #{cust.id}</Badge>
            <Badge variant={cust.isActive ? "default" : "secondary"} className={`text-[10px] ${cust.isActive ? "bg-amber-600" : ""}`}>
              {cust.isActive ? "active" : "inactive"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Directory info strip */}
        <div className="rounded-lg bg-muted/40 px-3 py-2 mb-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[10px]">
          <div>
            <div className="text-muted-foreground">Contact</div>
            <div className="font-medium">{cust.contactPhone}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Email</div>
            <div className="font-medium truncate">{cust.contactEmail ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Inspection</div>
            <div className="font-medium capitalize">{cust.inspectionFrequency}</div>
          </div>
        </div>
        <CopyableLink url={link} />
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function InvitesPage() {
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const customers = (useQuery(api.customers.list) ?? []) as any[];


  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Link2 className="size-6 text-primary shrink-0" />
          Portal Invite Links
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Share these links with your team and customers. Each link is pre-linked to their directory record — no account creation needed. Use the dropdown on each card to choose portal access level.
        </p>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff" className="gap-1.5">
            <Users className="size-3.5" /> Staff
          </TabsTrigger>
          <TabsTrigger value="supervisors" className="gap-1.5">
            <Shield className="size-3.5" /> Supervisors
          </TabsTrigger>
          <TabsTrigger value="technicians" className="gap-1.5">
            <Wrench className="size-3.5" /> Technicians
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5">
            <UserCircle className="size-3.5" /> Customers
          </TabsTrigger>
        </TabsList>

        {/* All Staff — with role selector */}
        <TabsContent value="staff" className="space-y-3 mt-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary flex gap-2">
            <Link2 className="size-4 shrink-0 mt-0.5" />
            <div>
              Each card is linked to the employee's full directory record (salary, certifications, utilization). Use the colored role button to choose whether they get <strong>Supervisor</strong> or <strong>Technician</strong> portal access. The link auto-fills their profile data throughout the app.
            </div>
          </div>
          {employees.length === 0 ? (
            <EmptyState icon={<Users className="size-8" />} message="No employees yet. Add employees to generate invite links." />
          ) : (
            employees.map(emp => <StaffInviteCard key={String(emp._id)} emp={emp} />)
          )}
        </TabsContent>

        {/* Supervisor-only filtered view */}
        <TabsContent value="supervisors" className="space-y-3 mt-4">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-300">
            Supervisor links provide access to the live schedule, GPS tracking, and team overview. Any employee can be given supervisor access.
          </div>
          {employees.length === 0 ? (
            <EmptyState icon={<Shield className="size-8" />} message="No employees yet. Add employees to generate supervisor invite links." />
          ) : (
            employees.map(emp => {
              const link = buildLink("supervisor", String(emp._id), emp.name);
              const initials = emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <Card key={String(emp._id)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center font-bold text-blue-700 dark:text-blue-300 text-sm shrink-0">{initials}</div>
                      <div>
                        <CardTitle className="text-base">{emp.name}</CardTitle>
                        <CardDescription className="text-xs">{emp.role} · Employee #{emp._id}</CardDescription>
                      </div>
                      <Badge className="ml-auto bg-blue-600 text-white text-[10px]">Supervisor Portal</Badge>
                    </div>
                  </CardHeader>
                  <CardContent><CopyableLink url={link} /></CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Technician-only filtered view */}
        <TabsContent value="technicians" className="space-y-3 mt-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            Each link logs the employee directly into their personal schedule portal. Links expire in 30 days.
          </div>
          {employees.length === 0 ? (
            <EmptyState icon={<Wrench className="size-8" />} message="No employees yet. Add employees to generate technician invite links." />
          ) : (
            employees.map(emp => {
              const link = buildLink("technician", String(emp._id), emp.name);
              const initials = emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <Card key={String(emp._id)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">{initials}</div>
                      <div>
                        <CardTitle className="text-base">{emp.name}</CardTitle>
                        <CardDescription className="text-xs">{emp.role} · Employee #{emp._id}</CardDescription>
                      </div>
                      <Badge className="ml-auto bg-emerald-600 text-white text-[10px]">Tech Portal</Badge>
                    </div>
                  </CardHeader>
                  <CardContent><CopyableLink url={link} /></CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Customers */}
        <TabsContent value="customers" className="space-y-3 mt-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
            Customer links provide read-only access to their service history, upcoming visits, and invoices. Each link is pre-linked to their customer record for auto-populated portals.
          </div>
          {customers.length === 0 ? (
            <EmptyState icon={<UserCircle className="size-8" />} message="No customers yet. Add customers to generate portal invite links." />
          ) : (
            customers.map(cust => <CustomerInviteCard key={String(cust._id)} cust={cust} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
