import { useEffect, useState } from "react";
import { Camera, Check, Mail, Phone, Save, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { customers, employees } from "@/lib/mockData";

const PROFILE_KEY = "tfpro_profile_overrides";

type ProfileOverride = {
  name?: string;
  phone?: string;
  email?: string;
  title?: string;
};

function loadOverrides(): Record<string, ProfileOverride> {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}"); } catch { return {}; }
}

function saveOverrides(overrides: Record<string, ProfileOverride>) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(overrides));
}

const ROLE_COLORS: Record<string, string> = {
  manager:    "bg-primary/10 text-primary",
  supervisor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  technician: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  customer:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

const ROLE_LABELS: Record<string, string> = {
  manager:    "Manager / Admin",
  supervisor: "Supervisor",
  technician: "Technician",
  customer:   "Customer",
};

export function ProfilePage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const userRole = user?.role ?? "manager";

  // Pull base info from mock data
  const empBase = employees.find(e => e.id === userId);
  const custBase = customers.find(c => c.id === userId);

  const baseName  = empBase?.name  ?? custBase?.name  ?? user?.name ?? "User";
  const basePhone = empBase?.phone ?? custBase?.phone ?? "";
  const baseTitle = empBase?.role  ?? custBase?.type  ?? "";
  const baseEmail = empBase
    ? `${empBase.name.toLowerCase().replace(" ", ".")}@multicorp.com`
    : custBase
    ? `${custBase.contact.toLowerCase().replace(" ", ".")}@${custBase.name.toLowerCase().replace(/\s+/g, "")}.com`
    : "";

  const [overrides, setOverrides] = useState<Record<string, ProfileOverride>>({});
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const all = loadOverrides();
    setOverrides(all);
    const mine = all[userId] ?? {};
    setName(mine.name   ?? baseName);
    setPhone(mine.phone ?? basePhone);
    setEmail(mine.email ?? baseEmail);
    setTitle(mine.title ?? baseTitle);
  }, [userId]);

  function handleSave() {
    const updated = {
      ...overrides,
      [userId]: { name: name.trim(), phone: phone.trim(), email: email.trim(), title: title.trim() },
    };
    saveOverrides(updated);
    setOverrides(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "U";

  const hireDate = empBase?.hireDate ?? "";
  const revenueYTD = empBase?.revenueYTD ?? custBase?.revenueYTD ?? 0;
  const certLabels = empBase?.certs ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <UserRound className="size-6 text-primary shrink-0" />
          My Profile
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Edit your contact information and display name
        </p>
      </div>

      {/* Avatar card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="size-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-1 -right-1 size-7 rounded-full bg-background border-2 border-border flex items-center justify-center hover:bg-muted transition-colors">
                <Camera className="size-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{name || baseName}</h2>
              <p className="text-sm text-muted-foreground truncate">{title || baseTitle}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="secondary" className={`text-xs ${ROLE_COLORS[userRole]}`}>
                  {ROLE_LABELS[userRole]}
                </Badge>
                {certLabels.map(c => (
                  <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Stats row for employees */}
          {empBase && (
            <div className={`grid gap-3 mt-5 pt-5 border-t ${userRole === "technician" ? "grid-cols-2" : "grid-cols-3"}`}>
              {userRole !== "technician" && (
                <div className="text-center">
                  <div className="text-lg font-extrabold text-emerald-600">
                    ${revenueYTD.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Revenue YTD</div>
                </div>
              )}
              {userRole !== "technician" && (
                <div className="text-center">
                  <div className="text-lg font-extrabold">{empBase.utilization}%</div>
                  <div className="text-[10px] text-muted-foreground">Utilization</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-lg font-extrabold">
                  {hireDate ? new Date(hireDate).getFullYear() : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">Member Since</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-extrabold">{certLabels.length}</div>
                <div className="text-[10px] text-muted-foreground">Certifications</div>
              </div>
            </div>
          )}

          {/* Stats row for customers */}
          {custBase && (
            <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t">
              <div className="text-center">
                <div className="text-lg font-extrabold text-emerald-600">
                  ${revenueYTD.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">Account Value</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-extrabold">{custBase.locations.length}</div>
                <div className="text-[10px] text-muted-foreground">Locations</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-extrabold capitalize">{custBase.contractStatus}</div>
                <div className="text-[10px] text-muted-foreground">Contract</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Contact Information</CardTitle>
          <CardDescription>Update your name, phone number, and email address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Display Name</Label>
              <div className="relative">
                <UserRound className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Your full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Job Title / Type</Label>
              <Input
                placeholder="Your role or title"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="(410) 555-0000"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button className="gap-1.5" onClick={handleSave}>
              {saved ? (
                <><Check className="size-3.5" /> Saved!</>
              ) : (
                <><Save className="size-3.5" /> Save Changes</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Read-only system info */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Account Information</CardTitle>
          <CardDescription>These details are managed by your administrator</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-0.5">Portal Role</span>
            <span>{ROLE_LABELS[userRole]}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-0.5">User ID</span>
            <span className="font-mono text-xs">{userId}</span>
          </div>
          {empBase && (
            <>
              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-0.5">Hire Date</span>
                <span>{hireDate ? new Date(hireDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-0.5">Certifications</span>
                <span>{certLabels.length > 0 ? certLabels.join(", ") : "None"}</span>
              </div>
            </>
          )}
          {custBase && (
            <>
              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-0.5">Company</span>
                <span>{custBase.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-0.5">Account Type</span>
                <span>{custBase.type}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
