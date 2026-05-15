import {
  Bell,
  Bot,
  Calendar,
  Camera,
  FileImage,
  Moon,
  Palette,
  Save,
  Settings2,
  Shield,
  Sun,
  Trash2,
  Upload,
  User,
  Users,
  Wrench,
} from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getSupervisorPermissions,
  setSupervisorPermissions,
  SUPERVISOR_PERM_META,
  type SupervisorPermKey,
} from "@/lib/supervisorPermissions";

const defaultRules = {
  monthlyCap: 3,
  consecutiveLimit: 2,
  weekBalance: 1,
  autoConvertThreshold: 75,
  trainingExemption: true,
  overrideAuthority: "supervisor",
  minShopDayFloor: 1,
  fatiguePreventionDays: 5,
};

const defaultAutoDecline = {
  distanceLimit: 45,
  revenueFloor: 400,
  certMismatch: true,
};

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const navigate = useNavigate();

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [rules, setRules] = useState(defaultRules);
  const [autoDecline, setAutoDecline] = useState(defaultAutoDecline);
  const [notifications, setNotifications] = useState({
    shopDayAlerts: true,
    emergencyJobs: true,
    invoiceReady: true,
    utilizationWarning: true,
    weeklyDigest: false,
  });
  const [aiSettings, setAiSettings] = useState({
    autoSchedule: false,
    fillShopDays: true,
    emergencyDispatch: true,
  });
  const [supervisorPerms, setSupervisorPerms] = useState<Record<SupervisorPermKey, boolean>>(
    () => getSupervisorPermissions()
  );
  const [permsSaved, setPermsSaved] = useState(false);
  const [saved, setSaved] = useState(false);

  // Invoice templates (localStorage-backed)
  type InvoiceTemplateAnalysis = { companyName: string; address: string; services: { name: string; description: string; qty: number; unitPrice: number }[]; notes: string };
  type InvoiceTemplate = { name: string; dataUrl: string; uploadedAt: string; analysis?: InvoiceTemplateAnalysis };
  const [invoiceTemplates, setInvoiceTemplates] = useState<InvoiceTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem("invoiceTemplates") ?? "[]"); }
    catch { return []; }
  });
  const [analyzingIdx, setAnalyzingIdx] = useState<number | null>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef   = useRef<HTMLInputElement>(null);

  async function analyzeTemplate(dataUrl: string, base64: string, mimeType: string, templateIdx: number) {
    setAnalyzingIdx(templateIdx);
    try {
      const resp = await fetch("/api/invoice-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const result = await resp.json();
      if (result.success && result.data) {
        setInvoiceTemplates(prev => {
          const next = prev.map((tpl, i) => i === templateIdx ? { ...tpl, analysis: result.data } : tpl);
          localStorage.setItem("invoiceTemplates", JSON.stringify(next));
          return next;
        });
      }
    } catch { /* silent */ } finally {
      setAnalyzingIdx(null);
    }
  }

  function handleTemplateUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const mimeType = file.type || "image/jpeg";
        setInvoiceTemplates(prev => {
          const next = [...prev, { name: file.name, dataUrl, uploadedAt: new Date().toLocaleDateString() }];
          localStorage.setItem("invoiceTemplates", JSON.stringify(next));
          // Kick off AI analysis for image files
          if (file.type.startsWith("image/")) {
            setTimeout(() => analyzeTemplate(dataUrl, base64, mimeType, next.length - 1), 50);
          }
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
    if (templateInputRef.current) templateInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function removeTemplate(idx: number) {
    setInvoiceTemplates(prev => {
      const next = prev.filter((_, i) => i !== idx);
      localStorage.setItem("invoiceTemplates", JSON.stringify(next));
      return next;
    });
  }

  function saveSettings() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSignOut() {
    logout();
    navigate("/");
  }

  const initials = (user?.name ?? "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = user?.role === "manager" ? "Manager / Admin"
    : user?.role === "supervisor" ? "Supervisor"
    : user?.role === "technician" ? "Technician"
    : "Customer";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="size-6 text-primary shrink-0" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your account and system preferences</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="account" className="gap-1.5"><User className="size-3.5" />Account</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5"><Palette className="size-3.5" />Appearance</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="size-3.5" />Notifications</TabsTrigger>
          {user?.role === "manager" && (
            <>
              <TabsTrigger value="shop-rules" className="gap-1.5"><Wrench className="size-3.5" />Shop Rules</TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5"><Bot className="size-3.5" />AI Settings</TabsTrigger>
              <TabsTrigger value="scheduling" className="gap-1.5"><Calendar className="size-3.5" />Scheduling</TabsTrigger>
              <TabsTrigger value="supervisor-access" className="gap-1.5"><Users className="size-3.5" />Supervisor Access</TabsTrigger>
              <TabsTrigger value="security" className="gap-1.5"><Shield className="size-3.5" />Security</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Account */}
        <TabsContent value="account" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>Your identity in TechForce Pro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-lg">{user?.name ?? "User"}</div>
                  <Badge variant="secondary" className="text-xs mt-1">{roleLabel}</Badge>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium">{roleLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium">Multicorp Fire Protection Services</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address</span>
                  <span className="font-medium">9693 Gerwig Lane, Columbia MD 21046</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">(410) 876-5000</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Sign Out</CardTitle>
              <CardDescription>Sign out and return to the portal selector</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setSignOutOpen(true)}>Sign Out</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>Switch between light and dark mode</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-xl border border-border p-4 flex-1">
                  {theme === "light" ? (
                    <Sun className="size-5 text-amber-500" />
                  ) : (
                    <Moon className="size-5 text-blue-400" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{theme === "light" ? "Light Mode" : "Dark Mode"}</div>
                    <div className="text-xs text-muted-foreground">Currently active</div>
                  </div>
                  {switchable && (
                    <Button variant="outline" size="sm" onClick={toggleTheme}>
                      Switch to {theme === "light" ? "Dark" : "Light"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Preferences</CardTitle>
              <CardDescription>Configure what alerts you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(notifications).map(([key, value]) => {
                const labels: Record<string, string> = {
                  shopDayAlerts: "Shop Day Threshold Alerts",
                  emergencyJobs: "Emergency Job Notifications",
                  invoiceReady: "Invoice Ready Notifications",
                  utilizationWarning: "Utilization Drop Warnings",
                  weeklyDigest: "Weekly Performance Digest",
                };
                return (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={key} className="cursor-pointer">{labels[key]}</Label>
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={v => setNotifications(n => ({ ...n, [key]: v }))}
                    />
                  </div>
                );
              })}
              <Button className="mt-2" onClick={saveSettings}>
                <Save className="size-4 mr-2" />
                {saved ? "Saved!" : "Save Preferences"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shop Rules (manager only) */}
        <TabsContent value="shop-rules" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shop Day Rules</CardTitle>
              <CardDescription>Configure shop day caps, consecutive limits, and exemptions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "monthlyCap", label: "Monthly Cap (days)" },
                { key: "consecutiveLimit", label: "Consecutive Day Limit" },
                { key: "weekBalance", label: "Week Balance Minimum" },
                { key: "autoConvertThreshold", label: "Auto-Convert Threshold (% util)" },
                { key: "minShopDayFloor", label: "Minimum Shop Day Floor" },
                { key: "fatiguePreventionDays", label: "Fatigue Prevention Days" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <Select
                    value={String(rules[key as keyof typeof rules])}
                    onValueChange={v => setRules(r => ({ ...r, [key]: Number(v) }))}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,10,12,25,50,75,100].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <Label>Training Exemption</Label>
                <Switch
                  checked={rules.trainingExemption}
                  onCheckedChange={v => setRules(r => ({ ...r, trainingExemption: v }))}
                />
              </div>
              <Button onClick={saveSettings}>
                <Save className="size-4 mr-2" />
                {saved ? "Saved!" : "Save Rules"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auto-Decline Rules</CardTitle>
              <CardDescription>Jobs that fail these criteria are automatically flagged</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Distance Limit (miles)</Label>
                <Select
                  value={String(autoDecline.distanceLimit)}
                  onValueChange={v => setAutoDecline(r => ({ ...r, distanceLimit: Number(v) }))}
                >
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[20,30,45,60,75,100].map(n => <SelectItem key={n} value={String(n)}>{n} mi</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Revenue Floor ($)</Label>
                <Select
                  value={String(autoDecline.revenueFloor)}
                  onValueChange={v => setAutoDecline(r => ({ ...r, revenueFloor: Number(v) }))}
                >
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[200,300,400,500,750,1000].map(n => <SelectItem key={n} value={String(n)}>${n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Cert Mismatch Auto-Decline</Label>
                <Switch
                  checked={autoDecline.certMismatch}
                  onCheckedChange={v => setAutoDecline(r => ({ ...r, certMismatch: v }))}
                />
              </div>
              <Button onClick={saveSettings}>
                <Save className="size-4 mr-2" />
                {saved ? "Saved!" : "Save Rules"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Scheduling Settings</CardTitle>
              <CardDescription>Control what the AI can do automatically</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "autoSchedule", label: "Auto-Schedule New Jobs", desc: "AI assigns the best available tech automatically" },
                { key: "fillShopDays", label: "Fill Shop Days Automatically", desc: "AI converts open slots to shop days when utilization permits" },
                { key: "emergencyDispatch", label: "Emergency Auto-Dispatch", desc: "AI dispatches nearest certified tech on emergency jobs" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <div>
                    <Label>{label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <Switch
                    checked={aiSettings[key as keyof typeof aiSettings]}
                    onCheckedChange={v => setAiSettings(s => ({ ...s, [key]: v }))}
                  />
                </div>
              ))}
              <Button onClick={saveSettings}>
                <Save className="size-4 mr-2" />
                {saved ? "Saved!" : "Save AI Settings"}
              </Button>
            </CardContent>
          </Card>

          {/* Invoice Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileImage className="size-4 text-primary" />
                Invoice Templates
              </CardTitle>
              <CardDescription>
                Upload branded invoice templates that the AI will use when generating invoices. Supports PNG, JPG, and PDF files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => templateInputRef.current?.click()}
                >
                  <Upload className="size-4" /> Upload Template
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="size-4" /> Take Photo
                </Button>
                <input
                  ref={templateInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/jpg,application/pdf"
                  multiple
                  onChange={handleTemplateUpload}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleTemplateUpload}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                After uploading, AI will automatically analyze the invoice image and extract the template structure — company name, line items, and notes — so customers can fill in their details.
              </p>

              {invoiceTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <FileImage className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No templates uploaded yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload or photograph a paper invoice to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoiceTemplates.map((tpl, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="flex items-start gap-3 p-3">
                        {tpl.dataUrl.startsWith("data:image") ? (
                          <img src={tpl.dataUrl} alt={tpl.name} className="size-16 rounded-lg object-cover border border-border flex-shrink-0" />
                        ) : (
                          <div className="size-16 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0">
                            <FileImage className="size-7 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground">Uploaded {tpl.uploadedAt}</p>
                          {analyzingIdx === i ? (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className="size-3 rounded-full bg-primary animate-pulse" />
                              <span className="text-xs text-primary font-medium">AI analyzing…</span>
                            </div>
                          ) : tpl.analysis ? (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <Bot className="size-3 text-emerald-600" />
                              <span className="text-xs text-emerald-600 font-medium">Template analyzed</span>
                            </div>
                          ) : tpl.dataUrl.startsWith("data:image") ? (
                            <button
                              className="mt-1.5 text-xs text-primary underline-offset-2 hover:underline"
                              onClick={() => analyzeTemplate(tpl.dataUrl, tpl.dataUrl.split(",")[1], "image/jpeg", i)}
                            >
                              Analyze with AI
                            </button>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5"
                          onClick={() => removeTemplate(i)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      {/* AI-extracted template structure */}
                      {tpl.analysis && (
                        <div className="border-t bg-muted/20 px-3 py-2.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Bot className="size-3 text-primary" />
                            <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">AI Extracted Structure</span>
                          </div>
                          {tpl.analysis.companyName && (
                            <p className="text-xs font-medium">{tpl.analysis.companyName}</p>
                          )}
                          {tpl.analysis.services.length > 0 && (
                            <div className="space-y-0.5">
                              {tpl.analysis.services.slice(0, 4).map((svc, si) => (
                                <div key={si} className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span className="truncate max-w-[60%]">{svc.name || "Line item"}</span>
                                  <span className="font-mono">{svc.qty} × ${svc.unitPrice.toFixed(2)}</span>
                                </div>
                              ))}
                              {tpl.analysis.services.length > 4 && (
                                <p className="text-[10px] text-muted-foreground">+{tpl.analysis.services.length - 4} more items</p>
                              )}
                            </div>
                          )}
                          {tpl.analysis.notes && (
                            <p className="text-[10px] text-muted-foreground italic">{tpl.analysis.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduling */}
        <TabsContent value="scheduling" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scheduling Defaults</CardTitle>
              <CardDescription>Default hours, zones, and dispatch rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border p-4 space-y-3 text-sm">
                {[
                  ["Work Start", "7:00 AM"],
                  ["Work End", "5:00 PM"],
                  ["Max Drive Time", "45 min"],
                  ["Default Job Buffer", "30 min"],
                  ["Service Zone", "MD, DC, VA"],
                  ["Emergency Zone", "MD only"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <Button onClick={saveSettings}>
                <Save className="size-4 mr-2" />
                {saved ? "Saved!" : "Save Scheduling"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supervisor Access (manager only) */}
        <TabsContent value="supervisor-access" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Supervisor Feature Access
              </CardTitle>
              <CardDescription>
                Control which sections supervisors can see in their portal. Financial data (P&L, invoices, costs, salaries) is always hidden from supervisors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border/50">
                {(Object.keys(SUPERVISOR_PERM_META) as SupervisorPermKey[]).map(key => {
                  const meta = SUPERVISOR_PERM_META[key];
                  return (
                    <div key={key} className="flex items-center justify-between px-4 py-3 gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{meta.label}</div>
                        <div className="text-xs text-muted-foreground">{meta.desc}</div>
                      </div>
                      <Switch
                        checked={supervisorPerms[key]}
                        onCheckedChange={v => setSupervisorPerms(prev => ({ ...prev, [key]: v }))}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <strong>Always restricted from supervisors:</strong> P&L Engine, Invoices, Shop Calculator, Reports, Pricing & Contracts, and any employee salary or cost data.
              </div>
              <Button
                onClick={() => {
                  setSupervisorPermissions(supervisorPerms);
                  setPermsSaved(true);
                  setTimeout(() => setPermsSaved(false), 2000);
                }}
                className="gap-1.5"
              >
                <Save className="size-4" />
                {permsSaved ? "Saved!" : "Save Supervisor Permissions"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security & Access</CardTitle>
              <CardDescription>Portal access and role management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border p-4 space-y-3 text-sm">
                {[
                  ["Auth Method", "Local Role Selector"],
                  ["Session Storage", "Browser localStorage"],
                  ["Token Type", "Invite-based (btoa JWT)"],
                  ["Invite Expiry", "30 days"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={() => navigate("/invites")}>
                Manage Portal Invites →
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sign out dialog */}
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Out</DialogTitle>
            <DialogDescription>You'll be returned to the portal selector.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOutOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSignOut}>Sign Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
