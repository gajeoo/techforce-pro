import { useState, useRef } from "react";
import {
  Database, Download, Upload, Trash2, Play, CheckCircle2,
  AlertTriangle, FileJson, Users, Building2, Briefcase,
  FileText, RefreshCw, Info, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  adminSeedDemo, adminClearAll, adminExport, adminImport,
  type AdminExportData,
} from "@/lib/api";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) { toast.error("No data to export"); return; }
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => escape(r[k])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function fmt(n: number) { return n.toLocaleString(); }

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  open, title, description, confirmLabel, danger, onConfirm, onCancel,
}: {
  open: boolean; title: string; description: string;
  confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${danger ? "text-destructive" : ""}`}>
            {danger ? <AlertTriangle className="size-5" /> : <Info className="size-5" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "destructive" : "default"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Demo Data Tab ────────────────────────────────────────────────────────────

/** Wipe all tfpro_* localStorage keys so demo-data-driven caches re-seed cleanly. */
function clearLocalStorage() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith("tfpro_"));
  keys.forEach(k => localStorage.removeItem(k));
}

/** Only remove the license-seed flag so licenses re-seed with new employee IDs after seeding. */
function resetLicenseSeed() {
  // bump any version suffix — remove all tfpro_licenses_seeded_* keys
  Object.keys(localStorage)
    .filter(k => k.startsWith("tfpro_licenses_seeded"))
    .forEach(k => localStorage.removeItem(k));
}

function DemoDataTab() {
  const [seeding,  setSeeding]  = useState(false);
  const [clearing, setClearing] = useState(false);
  // Two-step clear: step 1 = first warning, step 2 = final confirmation
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [lastSeed, setLastSeed] = useState<string[] | null>(null);

  async function handleSeed() {
    setSeeding(true);
    try {
      const result = await adminSeedDemo();
      resetLicenseSeed();          // force licenses to re-seed with new employee IDs
      setLastSeed([
        ...result.seeded.employees,
        ...result.seeded.customers,
        `${result.seeded.jobs} jobs`,
        `${result.seeded.invoices} invoices`,
        `${result.seeded.locations} locations`,
      ]);
      toast.success("Demo data loaded! All pages are now populated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed demo data");
    } finally {
      setSeeding(false);
    }
  }

  async function handleClearAll() {
    setClearStep(0);
    setClearing(true);
    try {
      await adminClearAll();
      clearLocalStorage();         // wipe all cached localStorage (licenses, catalog seed flags, etc.)
      setLastSeed(null);
      toast.success("All data cleared. The slate is clean — ready for real data.");
    } catch {
      toast.error("Failed to clear data");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-700 dark:text-blue-300 flex gap-3">
        <Info className="size-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Training Mode</p>
          <p>Load sample employees, customers, jobs, and invoices to explore all features before entering real data. When ready, use "Clear All Data" to start fresh.</p>
        </div>
      </div>

      {/* Load Demo Data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="size-4 text-emerald-600" /> Load Demo Data
          </CardTitle>
          <CardDescription>
            Adds 3 employees, 3 customers (with 3 locations each), 6 jobs, and 3 invoices to populate dashboards, analytics, and P&L views.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Users, label: "Employees", desc: "Ernest McKinley (tech), Tyler Beaumont (supervisor), Ephraim Osei (tech)" },
              { icon: Building2, label: "Customers", desc: "Harbor View Condominiums, Riverside Elementary, Gold Coast Restaurant Group" },
              { icon: Briefcase, label: "Jobs & Invoices", desc: "6 jobs (3 completed, 3 pending) + 3 invoices across all customers" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="size-3.5 text-primary" />
                  <span className="text-xs font-semibold">{label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          {lastSeed && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                <span className="text-xs font-semibold">Demo data loaded</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lastSeed.map(s => (
                  <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleSeed} disabled={seeding} className="gap-2">
            {seeding ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
            {seeding ? "Loading…" : "Load Demo Data"}
          </Button>
        </CardContent>
      </Card>

      {/* Clear All Data */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" /> Clear All Data
          </CardTitle>
          <CardDescription>
            Permanently removes all employees, customers, jobs, invoices, and related records. This cannot be undone. Use this to remove demo data before entering real data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setClearStep(1)}
            disabled={clearing}
            className="gap-2"
          >
            {clearing ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {clearing ? "Clearing…" : "Clear All Data"}
          </Button>
        </CardContent>
      </Card>

      {/* Step 1: First warning */}
      <ConfirmDialog
        open={clearStep === 1}
        title="Clear All Data?"
        description="This will permanently delete ALL employees, customers, jobs, invoices, and related records from the database, AND clear all locally cached data (licenses, catalog). This cannot be undone."
        confirmLabel="Yes, I want to clear everything"
        danger
        onConfirm={() => setClearStep(2)}
        onCancel={() => setClearStep(0)}
      />

      {/* Step 2: Final confirmation */}
      <ConfirmDialog
        open={clearStep === 2}
        title="Final Warning — Are You Absolutely Sure?"
        description="You are about to permanently erase all data. There is no undo, no backup, and no recovery. Click 'Delete Everything' only if you are 100% certain."
        confirmLabel="Delete Everything"
        danger
        onConfirm={handleClearAll}
        onCancel={() => setClearStep(0)}
      />
    </div>
  );
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

function ExportTab() {
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<AdminExportData | null>(null);

  async function fetchExport() {
    setExporting(true);
    try {
      const result = await adminExport();
      setData(result);
      return result;
    } catch {
      toast.error("Export failed");
      return null;
    } finally {
      setExporting(false);
    }
  }

  async function exportAll() {
    const result = await fetchExport();
    if (!result) return;
    const ts = new Date().toISOString().slice(0, 10);
    downloadJson(result, `techforce-export-${ts}.json`);
    toast.success("Full export downloaded");
  }

  async function exportEntity(key: keyof AdminExportData["data"], filename: string) {
    let source = data;
    if (!source) {
      setExporting(true);
      try { source = await adminExport(); setData(source); }
      catch { toast.error("Export failed"); setExporting(false); return; }
      finally { setExporting(false); }
    }
    const rows = source.data[key] as unknown as Record<string, unknown>[];
    if (!rows?.length) { toast("No data to export for this entity"); return; }
    downloadCsv(rows, filename);
    toast.success(`${filename} downloaded`);
  }

  const entities: { key: keyof AdminExportData["data"]; label: string; icon: React.ComponentType<{ className?: string }>; filename: string }[] = [
    { key: "employees",         label: "Employees",          icon: Users,      filename: "employees.csv" },
    { key: "customers",         label: "Customers",          icon: Building2,  filename: "customers.csv" },
    { key: "customerLocations", label: "Customer Locations", icon: Building2,  filename: "customer-locations.csv" },
    { key: "jobs",              label: "Jobs",               icon: Briefcase,  filename: "jobs.csv" },
    { key: "openJobs",          label: "Open Jobs",          icon: Briefcase,  filename: "open-jobs.csv" },
    { key: "invoices",          label: "Invoices",           icon: FileText,   filename: "invoices.csv" },
    { key: "recurringSchedules",label: "Recurring Schedules",icon: RefreshCw,  filename: "recurring-schedules.csv" },
  ];

  return (
    <div className="space-y-6">
      {/* Export All */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="size-4 text-blue-600" /> Full System Export
          </CardTitle>
          <CardDescription>
            Downloads a single JSON file containing all employees, customers, locations, jobs, invoices, and recurring schedules. Use this to back up your data or migrate to another system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Snapshot ready — </span>
              {Object.entries(data.data).map(([k, v]) => `${fmt(v.length)} ${k}`).join(" · ")}
            </div>
          )}
          <Button onClick={exportAll} disabled={exporting} className="gap-2">
            {exporting ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}
            {exporting ? "Preparing…" : "Export All (JSON)"}
          </Button>
        </CardContent>
      </Card>

      {/* Per-Entity CSV */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="size-4 text-emerald-600" /> Export by Type (CSV)
          </CardTitle>
          <CardDescription>Download individual CSV files for each data type, compatible with Excel and Google Sheets.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {entities.map(({ key, label, icon: Icon, filename }) => (
              <button
                key={key}
                onClick={() => exportEntity(key, filename)}
                disabled={exporting}
                className="flex items-center gap-2.5 rounded-lg border bg-muted/20 hover:bg-muted/50 px-3 py-2.5 text-left transition-colors disabled:opacity-50"
              >
                <Icon className="size-3.5 text-primary shrink-0" />
                <div>
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="text-[10px] text-muted-foreground">{filename}</div>
                </div>
                <Download className="size-3 text-muted-foreground ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

interface ParsedData {
  employees?: Record<string, unknown>[];
  customers?: Record<string, unknown>[];
  customerLocations?: Record<string, unknown>[];
  jobs?: Record<string, unknown>[];
  openJobs?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
}

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [clearFirst, setClearFirst] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setError(null);
    setParsed(null);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const json = JSON.parse(text);
        // Accept both a raw data object and the full export envelope
        const data = json.data ?? json;
        if (typeof data !== "object") throw new Error("Invalid format");
        setParsed(data as ParsedData);
      } catch {
        setError("Could not parse file. Please upload a valid JSON export.");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed) return;
    setConfirmImport(false);
    setImporting(true);
    try {
      const result = await adminImport(parsed as Record<string, unknown[]>, clearFirst);
      const summary = Object.entries(result.imported).map(([k, v]) => `${v} ${k}`).join(", ");
      toast.success(`Import complete: ${summary || "no records"}`);
      setParsed(null);
      setFilename(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const entityCounts = parsed
    ? Object.entries(parsed).filter(([, v]) => Array.isArray(v) && v.length > 0)
    : [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300 flex gap-3">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Supported Format</p>
          <p>Upload a JSON file exported from this system. Employee and customer IDs will be remapped automatically to avoid conflicts.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="size-4 text-primary" /> Upload Data File
          </CardTitle>
          <CardDescription>Select a JSON file to import. Preview the contents before applying.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileJson className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">{filename ?? "Click to select a JSON file"}</p>
            <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {parsed && entityCounts.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                <span className="text-xs font-semibold">File parsed — ready to import</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entityCounts.map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-[10px]">
                    {fmt((v as unknown[]).length)} {k}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {parsed && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="clearFirst"
                checked={clearFirst}
                onCheckedChange={v => setClearFirst(v === true)}
              />
              <Label htmlFor="clearFirst" className="text-sm cursor-pointer">
                Clear all existing data before importing
              </Label>
            </div>
          )}

          {parsed && entityCounts.length > 0 && (
            <Button onClick={() => setConfirmImport(true)} disabled={importing} className="gap-2">
              {importing ? <RefreshCw className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {importing ? "Importing…" : "Import Data"}
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmImport}
        title="Confirm Import"
        description={`This will import ${entityCounts.map(([k, v]) => `${fmt((v as unknown[]).length)} ${k}`).join(", ")}${clearFirst ? " and CLEAR all existing data first" : ""}.`}
        confirmLabel={clearFirst ? "Clear & Import" : "Import"}
        danger={clearFirst}
        onConfirm={handleImport}
        onCancel={() => setConfirmImport(false)}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DataManagementPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Database className="size-6 text-primary shrink-0" />
          Data Management
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Import, export, and manage all system data. Load demo data for training, or export your real data for backup.
        </p>
      </div>

      <Tabs defaultValue="demo">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="demo" className="gap-1.5">
            <Package className="size-3.5" /> Demo Data
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5">
            <Download className="size-3.5" /> Export
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5">
            <Upload className="size-3.5" /> Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="mt-6">
          <DemoDataTab />
        </TabsContent>
        <TabsContent value="export" className="mt-6">
          <ExportTab />
        </TabsContent>
        <TabsContent value="import" className="mt-6">
          <ImportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
