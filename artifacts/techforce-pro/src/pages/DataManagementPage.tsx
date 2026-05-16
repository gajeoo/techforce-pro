import { useState, useRef, useMemo, useEffect } from "react";
import {
  Database, Download, Upload, Trash2, Play, CheckCircle2,
  AlertTriangle, FileJson, Users, Building2, Briefcase,
  FileText, RefreshCw, Info, Package, FileCode2, TableProperties,
  ChevronRight, Search, ArrowLeft, DollarSign, X, ServerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  adminSeedDemo, adminClearAll, adminExport, adminImport,
  type AdminExportData, API_BASE,
} from "@/lib/api";
import { toast } from "sonner";

// ─── Backend availability ─────────────────────────────────────────────────────

function is404(e: unknown) {
  return e instanceof Error && e.message.includes("(404)");
}

const BACKEND_MSG = "The backend server is not available on this deployment. Run TechForce Pro locally or on Replit to use data management features.";

async function checkBackend(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/health`, { method: "GET" });
    return r.status !== 404;
  } catch {
    return false;
  }
}

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
function fmtCurrency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── File Parsers ─────────────────────────────────────────────────────────────

function parseMoney(s: string): number {
  return parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
}

function parseSFDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function parseAnyDate(s: string): string | null {
  if (!s) return null;
  let m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function inferServiceType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes(" ss") || t.includes("suppression") || t.includes("hood") || t.includes("ansul")) return "hood_suppression";
  if (t.includes(" fe") || t.includes("extinguisher") || t.includes("fire ext")) return "extinguisher_inspection";
  if (t.includes("sprinkler") || t.includes("sprk")) return "sprinkler_test";
  if (t.includes("standpipe")) return "standpipe_test";
  if (t.includes("backflow") || t.includes(" bfp")) return "backflow_test";
  if (t.includes("exit light") || t.includes("emergency light")) return "exit_light_check";
  if (t.includes("fire alarm") || t.includes(" fa ")) return "fire_alarm_test";
  return "other";
}

interface ParsedData {
  employees?: Record<string, unknown>[];
  customers?: Record<string, unknown>[];
  customerLocations?: Record<string, unknown>[];
  jobs?: Record<string, unknown>[];
  openJobs?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
}

interface SFParseResult {
  data: ParsedData;
  techNames: string[];
  totalJobs: number;
  totalRevenue: number;
  dateRange: string;
}

/** Parse a ServiceFusion "Sales Revenue By Tech" HTML export */
function parseSFHtmlReport(html: string): SFParseResult | null {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const fieldTitles = Array.from(doc.querySelectorAll(".fieldTitle"));
  const dateRangeEl = fieldTitles.find(el => el.textContent?.trim() === "Date Range");
  const dateRange = dateRangeEl?.nextElementSibling?.textContent?.trim() ?? "";

  const techNameEls = Array.from(doc.querySelectorAll("table.customerName td"));
  const rateTables  = Array.from(doc.querySelectorAll("table.rateTable"));

  if (!rateTables.length) return null;

  const employees: Record<string, unknown>[] = [];
  const customers: Record<string, unknown>[] = [];
  const jobs:      Record<string, unknown>[] = [];
  const invoices:  Record<string, unknown>[] = [];

  const custMap = new Map<string, number>();
  const empMap  = new Map<string, number>();
  let empId = 1, custId = 1;

  const numSections = Math.min(Math.max(techNameEls.length, 1), rateTables.length);

  for (let ti = 0; ti < numSections; ti++) {
    const techName = techNameEls[ti]?.textContent?.trim() ?? `Technician ${ti + 1}`;

    if (!empMap.has(techName)) {
      employees.push({
        id: empId, name: techName,
        role: "extinguisher_tech", salary: 50000, billableRate: 800,
        homeZip: "00000", certifications: [],
        allowedShopDays: 5, shopDaysUsedYtd: 0,
        allowedTrainingDays: 3, trainingDaysUsedYtd: 0,
        utilizationPct: 0, isActive: true,
      });
      empMap.set(techName, empId++);
    }
    const currentEmpId = empMap.get(techName)!;

    const tbody = rateTables[ti].querySelector("tbody");
    if (!tbody) continue;

    const rows = Array.from(tbody.querySelectorAll("tr"));
    let i = 0;

    while (i < rows.length) {
      const cells = Array.from(rows[i].querySelectorAll("td"));
      const firstLink = cells[0]?.querySelector("a");

      if (firstLink && /^\d+$/.test(firstLink.textContent?.trim() ?? "")) {
        const jobNum    = firstLink.textContent?.trim() ?? "";
        const dateStr   = cells[1]?.textContent?.trim() ?? "";
        const sfStatus  = cells[3]?.textContent?.trim() ?? "";
        const custAnchor = cells[6]?.querySelector("a");
        const customerName = (custAnchor ?? cells[6])?.textContent?.trim() ?? "Unknown";
        const details   = cells[7]?.textContent?.replace(/\s+/g, " ").trim() ?? "";

        let jobTotal = 0, techTotal = 0;
        if (i + 1 < rows.length) {
          const finCells = Array.from(rows[i + 1].querySelectorAll("td"));
          if (finCells[0]?.textContent?.trim().startsWith("$")) {
            techTotal = parseMoney(finCells[5]?.textContent ?? "0");
            jobTotal  = parseMoney(finCells[6]?.textContent ?? "0");
            i++;
          }
        }

        while (i + 1 < rows.length) {
          const nextTd = rows[i + 1].querySelector("td");
          const isNote = nextTd?.getAttribute("colspan") ||
            (rows[i + 1].querySelectorAll("td").length === 1 &&
             rows[i + 1].textContent?.includes("*"));
          if (isNote) i++; else break;
        }

        if (!custMap.has(customerName)) {
          customers.push({
            id: custId, name: customerName,
            facilityType: "commercial", address: "",
            contactName: "", contactPhone: "",
            inspectionFrequency: "annual", isActive: true,
          });
          custMap.set(customerName, custId++);
        }
        const currentCustId = custMap.get(customerName)!;

        const sfDone = ["Invoiced", "Job Closed", "Completed", "Complete", "Closed"];
        const status = sfDone.includes(sfStatus) ? "completed" : "pending";
        const invoiceStatus = sfStatus === "Invoiced" ? "sent"
          : sfStatus === "Job Closed" ? "paid" : "draft";

        const scheduledDate = parseSFDate(dateStr);
        const serviceType   = inferServiceType(details);
        const revenue       = jobTotal > 0 ? jobTotal : techTotal;
        const notes         = [details, `SF#${jobNum}`].filter(Boolean).join(" | ");
        const jobIdx        = jobs.length;

        jobs.push({
          id: jobIdx + 1,
          customerId: currentCustId, employeeId: currentEmpId,
          serviceType, status, priority: "medium",
          scheduledDate, dueDate: scheduledDate,
          revenue, quantity: 1, notes,
          certificationRequired: "any",
        });

        if (revenue > 0 && status === "completed") {
          invoices.push({
            invoiceNumber: `SF-${jobNum}`,
            customerId: currentCustId, jobId: null, techId: currentEmpId,
            lineItems: [{ service: details || serviceType, quantity: 1, rate: revenue, total: revenue }],
            totalAmount: revenue, status: invoiceStatus,
            generatedAt: scheduledDate
              ? new Date(scheduledDate + "T12:00:00").toISOString()
              : new Date().toISOString(),
            _jobIdx: jobIdx, // internal: which job this invoice belongs to
          });
        }
      }
      i++;
    }
  }

  const totalRevenue = invoices.reduce((s, inv) => s + Number(inv.totalAmount), 0);
  return {
    data: { employees, customers, jobs, invoices },
    techNames: employees.map(e => String(e.name)),
    totalJobs: jobs.length, totalRevenue, dateRange,
  };
}

/** Minimal CSV parser (handles quoted fields) */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) continue;
    const cells: string[] = [];
    let inQuote = false, current = "";
    for (let ci = 0; ci < line.length; ci++) {
      const c = line[ci];
      if (c === '"') {
        if (inQuote && line[ci + 1] === '"') { current += '"'; ci++; }
        else inQuote = !inQuote;
      } else if (c === "," && !inQuote) {
        cells.push(current.trim()); current = "";
      } else {
        current += c;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

type CsvEntityType = "employees" | "customers" | "jobs" | "unknown";

function detectCsvType(headers: string[]): CsvEntityType {
  const h = headers.map(s => s.toLowerCase());
  const has = (k: string) => h.some(s => s.includes(k));
  if ((has("salary") || has("billable")) && has("name")) return "employees";
  if ((has("address") || has("facility")) && has("name") && !has("revenue")) return "customers";
  if (has("date") || has("revenue") || (has("customer") && has("service"))) return "jobs";
  return "unknown";
}

interface CsvParseResult {
  data: ParsedData;
  entityType: CsvEntityType;
  rowCount: number;
  detectedColumns: string[];
}

function parseCsvFile(text: string): CsvParseResult | null {
  const rows = parseCsvText(text);
  if (rows.length < 2) return null;

  const rawHeaders = rows[0];
  const headers    = rawHeaders.map(h => h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  const entityType = detectCsvType(headers);
  const dataRows   = rows.slice(1).filter(r => r.some(c => c.trim()));

  const get = (row: string[], ...keys: string[]): string => {
    for (const key of keys) {
      const idx = headers.findIndex(h => h.includes(key));
      if (idx >= 0 && idx < row.length && row[idx].trim()) return row[idx].trim();
    }
    return "";
  };

  if (entityType === "employees") {
    const employees = dataRows.map((row, i) => ({
      id: i + 1,
      name: get(row, "name", "employee"),
      role: get(row, "role", "title", "position") || "extinguisher_tech",
      salary: parseMoney(get(row, "salary", "annual")) || 50000,
      billableRate: parseMoney(get(row, "billable", "rate", "daily")) || 800,
      homeZip: get(row, "zip", "postal") || "00000",
      certifications: [], allowedShopDays: 5, shopDaysUsedYtd: 0,
      allowedTrainingDays: 3, trainingDaysUsedYtd: 0,
      utilizationPct: 0, isActive: true,
    })).filter(e => e.name);
    return { data: { employees }, entityType, rowCount: employees.length, detectedColumns: rawHeaders };
  }

  if (entityType === "customers") {
    const customers = dataRows.map((row, i) => ({
      id: i + 1,
      name: get(row, "name", "company", "customer"),
      facilityType: get(row, "facility", "type") || "commercial",
      address: get(row, "address", "street", "location") || "",
      contactName: get(row, "contact_name", "contact", "manager") || "",
      contactPhone: get(row, "phone", "tel", "mobile") || "",
      contactEmail: get(row, "email") || null,
      inspectionFrequency: get(row, "frequency", "inspection") || "annual",
      isActive: true,
    })).filter(c => c.name);
    return { data: { customers }, entityType, rowCount: customers.length, detectedColumns: rawHeaders };
  }

  // Jobs CSV
  const custMap = new Map<string, number>();
  const empMap  = new Map<string, number>();
  const customers: Record<string, unknown>[] = [];
  const employees: Record<string, unknown>[] = [];
  const jobs:      Record<string, unknown>[] = [];
  const invoices:  Record<string, unknown>[] = [];
  let custId = 1, empId = 1;

  for (const row of dataRows) {
    const custName  = get(row, "customer", "client", "company");
    const empName   = get(row, "tech", "technician", "employee", "assigned");
    const dateStr   = get(row, "date", "scheduled", "service_date", "job_date");
    const revStr    = get(row, "revenue", "total", "amount", "price", "job_total");
    const statusStr = get(row, "status").toLowerCase();
    const serviceStr = get(row, "service", "type", "category");
    const notes     = get(row, "notes", "description", "details", "job_details");

    if (!custName && !dateStr && !revStr) continue;

    if (custName && !custMap.has(custName)) {
      customers.push({ id: custId, name: custName, facilityType: "commercial", address: "", contactName: "", contactPhone: "", inspectionFrequency: "annual", isActive: true });
      custMap.set(custName, custId++);
    }
    if (empName && !empMap.has(empName)) {
      employees.push({ id: empId, name: empName, role: "extinguisher_tech", salary: 50000, billableRate: 800, homeZip: "00000", certifications: [], allowedShopDays: 5, shopDaysUsedYtd: 0, allowedTrainingDays: 3, trainingDaysUsedYtd: 0, utilizationPct: 0, isActive: true });
      empMap.set(empName, empId++);
    }

    const sfDone = ["invoiced", "job closed", "completed", "complete", "done", "closed", "paid"];
    const status = sfDone.includes(statusStr) ? "completed" : "pending";
    const scheduledDate = parseAnyDate(dateStr);
    const revenue = parseMoney(revStr);
    const jobIdx = jobs.length;

    jobs.push({
      id: jobIdx + 1,
      customerId: custName ? custMap.get(custName)! : 0,
      employeeId: empName ? empMap.get(empName)! : null,
      serviceType: inferServiceType(serviceStr + " " + notes),
      status, priority: "medium",
      scheduledDate, dueDate: scheduledDate,
      revenue, quantity: 1,
      notes: notes || null,
      certificationRequired: "any",
    });

    if (revenue > 0 && status === "completed") {
      invoices.push({
        invoiceNumber: `CSV-${Date.now()}-${jobs.length}`,
        customerId: custName ? custMap.get(custName)! : 0,
        jobId: null,
        techId: empName ? empMap.get(empName)! : null,
        lineItems: [{ service: serviceStr || "Service", quantity: 1, rate: revenue, total: revenue }],
        totalAmount: revenue, status: "sent",
        generatedAt: scheduledDate
          ? new Date(scheduledDate + "T12:00:00").toISOString()
          : new Date().toISOString(),
        _jobIdx: jobIdx,
      });
    }
  }

  const data: ParsedData = {};
  if (employees.length) data.employees = employees;
  if (customers.length) data.customers = customers;
  if (jobs.length) data.jobs = jobs;
  if (invoices.length) data.invoices = invoices;

  return { data, entityType: "jobs", rowCount: jobs.length, detectedColumns: rawHeaders };
}

type FileFormat = "json" | "sf-html" | "csv";

function detectFormat(filename: string, text: string): FileFormat {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json") return "json";
  if (ext === "html" || ext === "htm") return "sf-html";
  if (ext === "csv") return "csv";
  if (text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) return "json";
  if (text.includes("rateTable") || text.includes("customerName") || text.includes("servicefusion")) return "sf-html";
  return "csv";
}

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

function clearLocalStorage() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith("tfpro_"));
  keys.forEach(k => localStorage.removeItem(k));
}

function resetLicenseSeed() {
  Object.keys(localStorage)
    .filter(k => k.startsWith("tfpro_licenses_seeded"))
    .forEach(k => localStorage.removeItem(k));
}

function DemoDataTab() {
  const [seeding,   setSeeding]   = useState(false);
  const [clearing,  setClearing]  = useState(false);
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [lastSeed,  setLastSeed]  = useState<string[] | null>(null);

  async function handleSeed() {
    setSeeding(true);
    try {
      const result = await adminSeedDemo();
      resetLicenseSeed();
      setLastSeed([
        ...result.seeded.employees,
        ...result.seeded.customers,
        `${result.seeded.jobs} jobs`,
        `${result.seeded.invoices} invoices`,
        `${result.seeded.locations} locations`,
      ]);
      toast.success("Demo data loaded! All pages are now populated.");
    } catch (e) {
      toast.error(is404(e) ? BACKEND_MSG : (e instanceof Error ? e.message : "Failed to seed demo data"));
    } finally {
      setSeeding(false);
    }
  }

  async function handleClearAll() {
    setClearStep(0);
    setClearing(true);
    try {
      await adminClearAll();
      clearLocalStorage();
      setLastSeed(null);
      toast.success("All data cleared. The slate is clean — ready for real data.");
    } catch (e) {
      toast.error(is404(e) ? BACKEND_MSG : "Failed to clear data");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-700 dark:text-blue-300 flex gap-3">
        <Info className="size-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Training Mode</p>
          <p>Load sample employees, customers, jobs, and invoices to explore all features before entering real data. When ready, use "Clear All Data" to start fresh.</p>
        </div>
      </div>

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
              { icon: Users,     label: "Employees", desc: "Ernest McKinley (tech), Tyler Beaumont (supervisor), Ephraim Osei (tech)" },
              { icon: Building2, label: "Customers",  desc: "Harbor View Condominiums, Riverside Elementary, Gold Coast Restaurant Group" },
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

      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" /> Clear All Data
          </CardTitle>
          <CardDescription>
            Permanently removes all employees, customers, jobs, invoices, and related records. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setClearStep(1)} disabled={clearing} className="gap-2">
            {clearing ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {clearing ? "Clearing…" : "Clear All Data"}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog open={clearStep === 1} title="Clear All Data?" danger
        description="This will permanently delete ALL employees, customers, jobs, invoices, and related records from the database, AND clear all locally cached data. This cannot be undone."
        confirmLabel="Yes, I want to clear everything"
        onConfirm={() => setClearStep(2)} onCancel={() => setClearStep(0)} />
      <ConfirmDialog open={clearStep === 2} title="Final Warning — Are You Absolutely Sure?" danger
        description="You are about to permanently erase all data. There is no undo, no backup, and no recovery."
        confirmLabel="Delete Everything"
        onConfirm={handleClearAll} onCancel={() => setClearStep(0)} />
    </div>
  );
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

function ExportTab() {
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<AdminExportData | null>(null);

  async function fetchExport() {
    setExporting(true);
    try { const r = await adminExport(); setData(r); return r; }
    catch (e) { toast.error(is404(e) ? BACKEND_MSG : "Export failed"); return null; }
    finally { setExporting(false); }
  }

  async function exportAll() {
    const result = await fetchExport();
    if (!result) return;
    downloadJson(result, `techforce-export-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success("Full export downloaded");
  }

  async function exportEntity(key: keyof AdminExportData["data"], filename: string) {
    let source = data;
    if (!source) {
      setExporting(true);
      try { source = await adminExport(); setData(source); }
      catch (e) { toast.error(is404(e) ? BACKEND_MSG : "Export failed"); setExporting(false); return; }
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="size-4 text-blue-600" /> Full System Export
          </CardTitle>
          <CardDescription>Downloads a single JSON file with all data for backup or migration.</CardDescription>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="size-4 text-emerald-600" /> Export by Type (CSV)
          </CardTitle>
          <CardDescription>Download individual CSV files compatible with Excel and Google Sheets.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {entities.map(({ key, label, icon: Icon, filename }) => (
              <button key={key} onClick={() => exportEntity(key, filename)} disabled={exporting}
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

// ─── Import Preview (editable table) ─────────────────────────────────────────

const SERVICE_OPTS = [
  { v: "hood_suppression",        l: "Hood Suppression" },
  { v: "extinguisher_inspection", l: "Extinguisher" },
  { v: "sprinkler_test",          l: "Sprinkler Test" },
  { v: "standpipe_test",          l: "Standpipe" },
  { v: "backflow_test",           l: "Backflow" },
  { v: "exit_light_check",        l: "Exit Lights" },
  { v: "fire_alarm_test",         l: "Fire Alarm" },
  { v: "other",                   l: "Other" },
] as const;

const JOB_STATUS_OPTS = [
  { v: "completed", l: "Completed" },
  { v: "pending",   l: "Pending" },
  { v: "cancelled", l: "Cancelled" },
] as const;

const INV_STATUS_OPTS = [
  { v: "paid",    l: "Paid" },
  { v: "sent",    l: "Sent" },
  { v: "draft",   l: "Draft" },
  { v: "overdue", l: "Overdue" },
] as const;

const ROLE_OPTS = [
  { v: "extinguisher_tech",  l: "Extinguisher Tech" },
  { v: "suppression_lead",   l: "Suppression Lead" },
  { v: "sprinkler_tech",     l: "Sprinkler Tech" },
  { v: "helper",             l: "Helper" },
  { v: "admin",              l: "Admin" },
  { v: "supervisor",         l: "Supervisor" },
] as const;

interface PRow {
  idx:           number;
  date:          string | null;
  custName:      string;
  empName:       string;
  serviceType:   string;
  revenue:       number;
  jobStatus:     string;
  invoiceStatus: string;
  notes:         string;
  customerId:    number;
  employeeId:    number | null;
}

interface PEmp {
  id:           number;
  name:         string;
  role:         string;
  salary:       number;
  billableRate: number;
}

// Thin cell select — no shadcn Select to keep table performance fast
function CellSelect({ value, options, onChange, className }: {
  value: string;
  options: readonly { v: string; l: string }[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`h-7 w-full rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring ${className ?? ""}`}
    >
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function CellMoney({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="h-7 w-24 rounded border border-input bg-background pl-4 pr-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

function ImportPreview({
  rawData, sfResult, csvResult, onBack, onImport, isImporting,
}: {
  rawData:    ParsedData;
  sfResult:   SFParseResult | null;
  csvResult:  CsvParseResult | null;
  onBack:     () => void;
  onImport:   (data: ParsedData, clearFirst: boolean) => void;
  isImporting: boolean;
}) {
  // Build name lookup maps
  const custById = useMemo(() => {
    const m = new Map<number, string>();
    rawData.customers?.forEach(c => m.set(Number(c.id), String(c.name)));
    return m;
  }, [rawData.customers]);

  const empById = useMemo(() => {
    const m = new Map<number, string>();
    rawData.employees?.forEach(e => m.set(Number(e.id), String(e.name)));
    return m;
  }, [rawData.employees]);

  const invByJobIdx = useMemo(() => {
    const m = new Map<number, number>();
    rawData.invoices?.forEach((inv, ii) => {
      const ji = Number((inv as Record<string, unknown>)._jobIdx ?? -1);
      if (ji >= 0) m.set(ji, ii);
    });
    return m;
  }, [rawData.invoices]);

  // Editable rows
  const [rows, setRows] = useState<PRow[]>(() =>
    (rawData.jobs ?? []).map((j, idx) => {
      const invIdx = invByJobIdx.get(idx) ?? -1;
      const inv = invIdx >= 0 ? rawData.invoices?.[invIdx] as Record<string, unknown> | undefined : undefined;
      return {
        idx,
        date:          j.scheduledDate ? String(j.scheduledDate) : null,
        custName:      custById.get(Number(j.customerId)) ?? "Unknown",
        empName:       j.employeeId != null ? (empById.get(Number(j.employeeId)) ?? "—") : "—",
        serviceType:   String(j.serviceType ?? "other"),
        revenue:       Number(j.revenue ?? 0),
        jobStatus:     String(j.status ?? "pending"),
        invoiceStatus: String(inv?.status ?? "draft"),
        notes:         j.notes ? String(j.notes) : "",
        customerId:    Number(j.customerId),
        employeeId:    j.employeeId != null ? Number(j.employeeId) : null,
      };
    })
  );

  // Editable employees
  const [employees, setEmployees] = useState<PEmp[]>(() =>
    (rawData.employees ?? []).map(e => ({
      id:           Number(e.id),
      name:         String(e.name),
      role:         String(e.role ?? "extinguisher_tech"),
      salary:       Number(e.salary ?? 50000),
      billableRate: Number(e.billableRate ?? 800),
    }))
  );

  const [filter,      setFilter]      = useState("");
  const [clearFirst,  setClearFirst]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Editable column headers
  const [colLabels, setColLabels] = useState<Record<string, string>>({
    date:        "# Date",
    customer:    "Customer / Tech",
    serviceType: "Service Type",
    revenue:     "Revenue",
    jobStatus:   "Job Status",
    invoice:     "Invoice",
    notes:       "Notes",
  });
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [colEditVal, setColEditVal] = useState("");

  // Bulk operation state
  const [bulkDate,   setBulkDate]   = useState("");
  const [bulkStatus, setBulkStatus] = useState("");

  // Next unique idx for new rows
  const nextIdx = useMemo(() =>
    rows.length > 0 ? Math.max(...rows.map(r => r.idx)) + 1 : 0,
    [rows]
  );

  // ─── Filtered rows ──────────────────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter(r =>
      r.custName.toLowerCase().includes(q) ||
      (r.date ?? "").includes(q) ||
      r.empName.toLowerCase().includes(q) ||
      r.serviceType.includes(q) ||
      r.notes.toLowerCase().includes(q)
    );
  }, [rows, filter]);

  // ─── Live totals ────────────────────────────────────────────────────────────
  const totalRevenue  = useMemo(() => rows.reduce((s, r) => s + r.revenue, 0), [rows]);
  const completedJobs = useMemo(() => rows.filter(r => r.jobStatus === "completed").length, [rows]);
  const invoiceTotal  = useMemo(() => rows.filter(r => r.jobStatus === "completed").reduce((s, r) => s + r.revenue, 0), [rows]);
  const uniqueCustomers = useMemo(() => new Set(rows.map(r => r.custName).filter(Boolean)).size, [rows]);

  // ─── Row mutations ──────────────────────────────────────────────────────────
  function updateRow(idx: number, field: keyof PRow, value: unknown) {
    setRows(prev => prev.map(r => r.idx === idx ? { ...r, [field]: value } : r));
  }

  function updateEmp(id: number, field: keyof PEmp, value: unknown) {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  }

  function addRow() {
    setRows(prev => [...prev, {
      idx: nextIdx,
      date: null, custName: "", empName: "—",
      serviceType: "extinguisher_inspection",
      revenue: 0, jobStatus: "pending", invoiceStatus: "draft", notes: "",
      customerId: 0, employeeId: null,
    }]);
  }

  function deleteRow(idx: number) {
    setRows(prev => prev.filter(r => r.idx !== idx));
  }

  // ─── Bulk operations ─────────────────────────────────────────────────────────
  function bulkApply(patch: Partial<PRow>) {
    const idxSet = new Set(visibleRows.map(r => r.idx));
    setRows(prev => prev.map(r => idxSet.has(r.idx) ? { ...r, ...patch } : r));
  }

  function bulkSetServiceType(svcType: string) { bulkApply({ serviceType: svcType }); }
  function bulkSetStatus(status: string)        { bulkApply({ jobStatus: status }); }
  function applyBulkDate()  { if (bulkDate)   bulkApply({ date: bulkDate }); }

  // ─── Column header editing ───────────────────────────────────────────────────
  function startColEdit(key: string) {
    setEditingCol(key);
    setColEditVal(colLabels[key] ?? key);
  }
  function commitColEdit() {
    if (editingCol) setColLabels(prev => ({ ...prev, [editingCol]: colEditVal.trim() || prev[editingCol] }));
    setEditingCol(null);
  }

  // ─── Import handler ──────────────────────────────────────────────────────────
  function handleImport() {
    setShowConfirm(false);

    // Rebuild unique customers from edited rows
    const custMap = new Map<string, number>();
    let nextCustId = 1;
    rawData.customers?.forEach(c => {
      const name = String(c.name);
      if (!custMap.has(name)) { custMap.set(name, Number(c.id)); nextCustId = Math.max(nextCustId, Number(c.id) + 1); }
    });
    rows.forEach(r => { if (r.custName && !custMap.has(r.custName)) custMap.set(r.custName, nextCustId++); });

    const updatedCustomers = Array.from(custMap.entries()).map(([name, id]) => {
      const existing = rawData.customers?.find(c => String(c.name) === name);
      return existing ?? { id, name, facilityType: "commercial", address: "", contactName: "", contactPhone: "", inspectionFrequency: "annual", isActive: true };
    });

    // Rebuild unique employees from edited rows
    const empNameToId = new Map<string, number>(employees.map(e => [e.name, e.id]));
    let nextEmpId = employees.length > 0 ? Math.max(...employees.map(e => e.id)) + 1 : 1;
    rows.forEach(r => {
      const n = r.empName === "—" ? "" : r.empName;
      if (n && !empNameToId.has(n)) empNameToId.set(n, nextEmpId++);
    });

    const updatedEmployees: Record<string, unknown>[] = employees.map(e => ({
      ...(rawData.employees?.find(re => Number(re.id) === e.id) ?? {}),
      id: e.id, name: e.name, role: e.role, salary: e.salary, billableRate: e.billableRate,
    }));
    rows.forEach(r => {
      const n = r.empName === "—" ? "" : r.empName;
      if (n && !employees.find(e => e.name === n)) {
        const id = empNameToId.get(n)!;
        updatedEmployees.push({ id, name: n, role: "extinguisher_tech", salary: 50000, billableRate: 800, homeZip: "00000", certifications: [], allowedShopDays: 5, shopDaysUsedYtd: 0, allowedTrainingDays: 3, trainingDaysUsedYtd: 0, utilizationPct: 0, isActive: true });
      }
    });

    const updatedJobs: Record<string, unknown>[] = rows.map((r, ji) => {
      const custId = r.custName ? (custMap.get(r.custName) ?? 0) : (r.customerId || 0);
      const eName = r.empName === "—" ? "" : r.empName;
      const empId = eName ? (empNameToId.get(eName) ?? r.employeeId) : r.employeeId;
      return {
        ...(rawData.jobs?.[r.idx] ?? {}),
        id: ji + 1, customerId: custId, employeeId: empId,
        serviceType: r.serviceType, status: r.jobStatus,
        revenue: r.revenue, scheduledDate: r.date, dueDate: r.date,
        notes: r.notes || null, priority: "medium", quantity: 1, certificationRequired: "any",
      };
    });

    const updatedInvoices: Record<string, unknown>[] = rows
      .filter(r => r.jobStatus === "completed" && r.revenue > 0)
      .map((r, ii) => {
        const custId = r.custName ? (custMap.get(r.custName) ?? 0) : (r.customerId || 0);
        const eName = r.empName === "—" ? "" : r.empName;
        const empId = eName ? (empNameToId.get(eName) ?? r.employeeId) : r.employeeId;
        return {
          invoiceNumber: `IMP-${Date.now()}-${ii + 1}`,
          customerId: custId, jobId: null, techId: empId,
          lineItems: [{ service: r.serviceType, quantity: 1, rate: r.revenue, total: r.revenue }],
          totalAmount: r.revenue, status: r.invoiceStatus,
          generatedAt: r.date ? new Date(r.date + "T12:00:00").toISOString() : new Date().toISOString(),
        };
      });

    onImport({ employees: updatedEmployees, customers: updatedCustomers as Record<string, unknown>[], jobs: updatedJobs, invoices: updatedInvoices }, clearFirst);
  }

  // ─── Editable col-header helper ──────────────────────────────────────────────
  function ColHeader({ colKey, className }: { colKey: string; className?: string }) {
    return editingCol === colKey ? (
      <input
        autoFocus
        value={colEditVal}
        onChange={e => setColEditVal(e.target.value)}
        onBlur={commitColEdit}
        onKeyDown={e => { if (e.key === "Enter") commitColEdit(); if (e.key === "Escape") setEditingCol(null); }}
        className={`h-5 text-xs bg-background border border-primary rounded px-1 focus:outline-none ${className ?? ""}`}
        style={{ minWidth: 60 }}
      />
    ) : (
      <span
        className="cursor-pointer hover:text-primary group inline-flex items-center gap-0.5"
        title="Click to rename column"
        onClick={() => startColEdit(colKey)}
      >
        {colLabels[colKey]}
        <span className="opacity-0 group-hover:opacity-40 text-[9px]">✎</span>
      </span>
    );
  }

  const hasJobs      = rows.length > 0;
  const hasEmployees = employees.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base">Review & Edit Before Importing</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edit any cell, rename column headers by clicking them, use bulk-set controls to update multiple rows at once.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5 shrink-0">
          <ArrowLeft className="size-3.5" /> Back
        </Button>
      </div>

      {/* Source summary strip */}
      {(sfResult || csvResult) && (
        <div className="rounded-lg border bg-muted/20 px-4 py-2.5 flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
          {sfResult && <>
            <span><span className="text-muted-foreground">Tech: </span><span className="font-semibold">{sfResult.techNames.join(", ")}</span></span>
            {sfResult.dateRange && <span><span className="text-muted-foreground">Period: </span><span className="font-semibold">{sfResult.dateRange}</span></span>}
          </>}
          {csvResult && <span><span className="text-muted-foreground">Format: </span><span className="font-semibold">CSV ({csvResult.entityType})</span></span>}
          <span><span className="text-muted-foreground">Jobs: </span><span className="font-semibold">{fmt(rows.length)}</span></span>
          <span><span className="text-muted-foreground">Customers: </span><span className="font-semibold">{fmt(uniqueCustomers)}</span></span>
        </div>
      )}

      {/* Live stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Total Jobs",    value: fmt(rows.length),         icon: Briefcase,    color: "text-blue-600" },
          { label: "Completed",     value: fmt(completedJobs),        icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Total Revenue", value: fmtCurrency(totalRevenue), icon: DollarSign,   color: "text-emerald-600" },
          { label: "Invoice Value", value: fmtCurrency(invoiceTotal), icon: FileText,     color: "text-primary" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-lg border bg-muted/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`size-3.5 ${color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
            <div className="font-semibold text-sm">{value}</div>
          </div>
        ))}
      </div>

      {/* Employees section */}
      {hasEmployees && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="size-3.5 text-primary" />
              Technicians / Employees ({employees.length})
              <span className="text-[10px] text-muted-foreground font-normal ml-1">— set correct role & pay before importing</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left pb-2 pr-3 font-medium w-44">Name</th>
                    <th className="text-left pb-2 pr-3 font-medium w-48">Role</th>
                    <th className="text-left pb-2 pr-3 font-medium w-36">Annual Salary</th>
                    <th className="text-left pb-2 font-medium w-36">Daily Bill Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <input
                          type="text"
                          value={emp.name}
                          onChange={e => updateEmp(emp.id, "name", e.target.value)}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <CellSelect value={emp.role} options={ROLE_OPTS} onChange={v => updateEmp(emp.id, "role", v)} className="h-8 w-full" />
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                          <input type="number" min={0} step={1000} value={emp.salary}
                            onChange={e => updateEmp(emp.id, "salary", Number(e.target.value) || 0)}
                            className="h-8 w-32 rounded border border-input bg-background pl-5 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </td>
                      <td className="py-2.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                          <input type="number" min={0} step={50} value={emp.billableRate}
                            onChange={e => updateEmp(emp.id, "billableRate", Number(e.target.value) || 0)}
                            className="h-8 w-28 rounded border border-input bg-background pl-5 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jobs table */}
      {hasJobs && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="size-3.5 text-primary" />
                Jobs ({fmt(rows.length)})
                {filter && visibleRows.length !== rows.length && (
                  <Badge variant="secondary" className="text-[10px]">{fmt(visibleRows.length)} shown</Badge>
                )}
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  placeholder="Filter rows…"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="h-8 pl-6 text-xs w-40"
                />
              </div>
            </div>

            {/* Bulk operations bar */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium shrink-0">
                Bulk set{filter ? " filtered" : " all"} rows →
              </span>
              <CellSelect
                value=""
                options={[{ v: "", l: "— service type —" }, ...SERVICE_OPTS]}
                onChange={v => { if (v) bulkSetServiceType(v); }}
                className="h-8 w-40"
              />
              <CellSelect
                value=""
                options={[{ v: "", l: "— job status —" }, ...JOB_STATUS_OPTS]}
                onChange={v => { if (v) bulkSetStatus(v); }}
                className="h-8 w-36"
              />
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={bulkDate}
                  onChange={e => setBulkDate(e.target.value)}
                  className="h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={applyBulkDate} disabled={!bulkDate}>
                  Set date
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <div className="overflow-y-auto" style={{ maxHeight: "min(60vh, 560px)" }}>
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                    <tr className="border-b">
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground w-36">
                        <ColHeader colKey="date" />
                      </th>
                      <th className="text-left px-2 py-3 font-medium text-muted-foreground">
                        <ColHeader colKey="customer" />
                      </th>
                      <th className="text-left px-2 py-3 font-medium text-muted-foreground w-40">
                        <ColHeader colKey="serviceType" />
                      </th>
                      <th className="text-right px-2 py-3 font-medium text-muted-foreground w-32">
                        <ColHeader colKey="revenue" />
                      </th>
                      <th className="text-left px-2 py-3 font-medium text-muted-foreground w-32">
                        <ColHeader colKey="jobStatus" />
                      </th>
                      <th className="text-left px-2 py-3 font-medium text-muted-foreground w-28">
                        <ColHeader colKey="invoice" />
                      </th>
                      <th className="text-left px-2 py-3 font-medium text-muted-foreground">
                        <ColHeader colKey="notes" />
                      </th>
                      <th className="w-8 px-1 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, vi) => (
                      <tr key={row.idx}
                        className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${vi % 2 === 1 ? "bg-muted/10" : ""}`}
                      >
                        {/* Date — editable */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-[10px] text-muted-foreground block leading-none mb-1">#{row.idx + 1}</span>
                          <input
                            type="date"
                            value={row.date ?? ""}
                            onChange={e => updateRow(row.idx, "date", e.target.value || null)}
                            className="h-8 rounded border border-input bg-background px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        {/* Customer + Tech — editable */}
                        <td className="px-2 py-2.5 max-w-[200px]">
                          <input
                            type="text"
                            value={row.custName}
                            onChange={e => updateRow(row.idx, "custName", e.target.value)}
                            className="h-8 text-xs font-medium rounded border border-input bg-background px-2 w-full focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Customer name…"
                          />
                          <input
                            type="text"
                            value={row.empName === "—" ? "" : row.empName}
                            onChange={e => updateRow(row.idx, "empName", e.target.value || "—")}
                            className="h-7 mt-1 text-[10px] text-muted-foreground rounded border border-input/60 bg-background px-2 w-full focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Technician…"
                          />
                        </td>
                        {/* Service Type */}
                        <td className="px-2 py-2.5">
                          <CellSelect
                            value={row.serviceType}
                            options={SERVICE_OPTS}
                            onChange={v => updateRow(row.idx, "serviceType", v)}
                            className="h-8"
                          />
                        </td>
                        {/* Revenue */}
                        <td className="px-2 py-2.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={row.revenue}
                              onChange={e => updateRow(row.idx, "revenue", parseFloat(e.target.value) || 0)}
                              className="h-8 w-28 rounded border border-input bg-background pl-5 pr-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                        </td>
                        {/* Job Status */}
                        <td className="px-2 py-2.5">
                          <CellSelect
                            value={row.jobStatus}
                            options={JOB_STATUS_OPTS}
                            onChange={v => updateRow(row.idx, "jobStatus", v)}
                            className="h-8"
                          />
                        </td>
                        {/* Invoice Status */}
                        <td className="px-2 py-2.5">
                          {row.jobStatus === "completed" ? (
                            <CellSelect
                              value={row.invoiceStatus}
                              options={INV_STATUS_OPTS}
                              onChange={v => updateRow(row.idx, "invoiceStatus", v)}
                              className="h-8"
                            />
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </td>
                        {/* Notes — editable */}
                        <td className="px-2 py-2.5 min-w-[140px]">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={e => updateRow(row.idx, "notes", e.target.value)}
                            className="h-8 text-xs text-muted-foreground rounded border border-input/60 bg-background px-2 w-full focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Notes…"
                          />
                        </td>
                        {/* Delete row */}
                        <td className="px-1 py-2.5 text-center">
                          <button
                            onClick={() => deleteRow(row.idx)}
                            className="size-7 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mx-auto"
                            title="Delete row"
                          >
                            <X className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {visibleRows.length === 0 && rows.length > 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                          No rows match "{filter}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table footer */}
            <div className="border-t px-4 py-2.5 flex items-center justify-between text-xs bg-muted/20">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {fmt(completedJobs)} of {fmt(rows.length)} completed
                </span>
                <button
                  onClick={addRow}
                  className="flex items-center gap-1 text-primary font-medium hover:underline"
                >
                  <span className="text-base leading-none">+</span> Add row
                </button>
              </div>
              <span className="font-semibold tabular-nums">
                Total: {fmtCurrency(totalRevenue)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customers summary */}
      {uniqueCustomers > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="size-3.5 text-primary" />
              Customers ({uniqueCustomers} unique)
              <span className="text-[10px] text-muted-foreground font-normal ml-1">— names are taken from the Customer column above; edit cells to correct them</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set(rows.map(r => r.custName).filter(Boolean))).slice(0, 50).map(name => (
                <Badge key={name} variant="outline" className="text-[10px] font-normal">{name}</Badge>
              ))}
              {uniqueCustomers > 50 && (
                <Badge variant="secondary" className="text-[10px]">+{uniqueCustomers - 50} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer action bar */}
      <div className="sticky bottom-0 -mx-1 rounded-xl border bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Checkbox id="clearFirst2" checked={clearFirst} onCheckedChange={v => setClearFirst(v === true)} />
          <Label htmlFor="clearFirst2" className="text-sm cursor-pointer">
            Clear existing data first
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {fmt(rows.length)} jobs · {fmt(uniqueCustomers)} customers · {fmtCurrency(invoiceTotal)} invoiced
          </span>
          <Button onClick={() => setShowConfirm(true)} disabled={isImporting || rows.length === 0} className="gap-2">
            {isImporting ? <RefreshCw className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {isImporting ? "Importing…" : `Import ${fmt(rows.length)} Jobs`}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title={clearFirst ? "Clear & Import?" : "Confirm Import"}
        description={`This will import ${fmt(rows.length)} jobs, ${fmt(uniqueCustomers)} customers, and ${fmt(employees.length)} employee(s)${clearFirst ? " — and CLEAR all existing data first" : ""}.`}
        confirmLabel={clearFirst ? "Clear & Import" : "Import"}
        danger={clearFirst}
        onConfirm={handleImport}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

const FORMAT_INFO = {
  json: {
    label: "TechForce JSON", icon: FileJson, accept: ".json", color: "text-blue-600",
    description: "Full system export from this app. All entities restored with ID remapping.",
  },
  "sf-html": {
    label: "ServiceFusion Report", icon: FileCode2, accept: ".html,.htm", color: "text-orange-600",
    description: "\"Sales Revenue By Tech\" HTML export from ServiceFusion. Extracts jobs, customers, and invoices.",
  },
  csv: {
    label: "Spreadsheet (CSV)", icon: TableProperties, accept: ".csv", color: "text-emerald-600",
    description: "Employees, customers, or jobs CSV. Column headers are auto-detected.",
  },
} as const;

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFormat, setSelectedFormat] = useState<FileFormat>("sf-html");
  const [parsed,         setParsed]         = useState<ParsedData | null>(null);
  const [sfResult,       setSfResult]       = useState<SFParseResult | null>(null);
  const [csvResult,      setCsvResult]      = useState<CsvParseResult | null>(null);
  const [filename,       setFilename]       = useState<string | null>(null);
  const [importing,      setImporting]      = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [mode,           setMode]           = useState<"upload" | "preview">("upload");

  function resetFile() {
    setParsed(null); setSfResult(null); setCsvResult(null);
    setFilename(null); setError(null); setMode("upload");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFormatChange(fmt: FileFormat) {
    setSelectedFormat(fmt);
    resetFile();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setError(null);
    setParsed(null); setSfResult(null); setCsvResult(null); setMode("upload");

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const detected = detectFormat(file.name, text);

        if (detected === "json") {
          const json = JSON.parse(text);
          const data = json.data ?? json;
          if (typeof data !== "object") throw new Error("Invalid format");
          setParsed(data as ParsedData);
          setMode("preview");
        } else if (detected === "sf-html") {
          const result = parseSFHtmlReport(text);
          if (!result) throw new Error("Could not find job data in this file. Make sure it is a ServiceFusion 'Sales Revenue By Tech' report.");
          setSfResult(result);
          setParsed(result.data);
          setMode("preview");
        } else if (detected === "csv") {
          const result = parseCsvFile(text);
          if (!result || !Object.keys(result.data).length) throw new Error("No recognisable data found. Check that your CSV has headers and data rows.");
          setCsvResult(result);
          setParsed(result.data);
          setMode("preview");
        } else {
          throw new Error("Unrecognised file format. Please upload a .json, .html, or .csv file.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not parse file.");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport(data: ParsedData, clearFirst: boolean) {
    setImporting(true);
    try {
      const result = await adminImport(data as Record<string, unknown[]>, clearFirst);
      const summary = Object.entries(result.imported).map(([k, v]) => `${v} ${k}`).join(", ");
      toast.success(`Import complete: ${summary || "no records"}`);
      resetFile();
    } catch (e) {
      toast.error(is404(e) ? BACKEND_MSG : (e instanceof Error ? e.message : "Import failed"));
    } finally {
      setImporting(false);
    }
  }

  // ── Preview mode ──────────────────────────────────────────────────────────
  if (mode === "preview" && parsed) {
    return (
      <ImportPreview
        rawData={parsed}
        sfResult={sfResult}
        csvResult={csvResult}
        onBack={resetFile}
        onImport={handleImport}
        isImporting={importing}
      />
    );
  }

  // ── Upload mode ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Format selector */}
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.entries(FORMAT_INFO) as [FileFormat, typeof FORMAT_INFO[FileFormat]][]).map(([key, info]) => {
          const Icon = info.icon;
          const active = selectedFormat === key;
          return (
            <button key={key} onClick={() => handleFormatChange(key)}
              className={`rounded-lg border p-3 text-left transition-all ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`size-4 ${info.color}`} />
                <span className="text-xs font-semibold">{info.label}</span>
                {active && <ChevronRight className="size-3 text-primary ml-auto" />}
              </div>
              <p className="text-[10px] text-muted-foreground">{info.description}</p>
            </button>
          );
        })}
      </div>

      {/* Drop zone */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="size-4 text-primary" /> Upload {FORMAT_INFO[selectedFormat].label}
          </CardTitle>
          <CardDescription>
            {selectedFormat === "sf-html" && "Export from ServiceFusion: Reports → Sales Revenue → By Tech → Save Page As HTML."}
            {selectedFormat === "csv"     && "Supports employees, customers, or jobs. Column headers are auto-detected."}
            {selectedFormat === "json"    && "Upload a JSON file previously exported from TechForce Pro."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {(() => { const Icon = FORMAT_INFO[selectedFormat].icon; return <Icon className={`size-10 mx-auto mb-2 opacity-30 ${FORMAT_INFO[selectedFormat].color}`} />; })()}
            <p className="text-sm font-medium">
              {filename ? `✓ ${filename} — parsing…` : `Click to select ${FORMAT_INFO[selectedFormat].accept.split(",").join(" / ")} file`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">or drag and drop here</p>
            <input ref={fileRef} type="file" accept={FORMAT_INFO[selectedFormat].accept} className="hidden" onChange={handleFile} />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CSV format guide */}
      {selectedFormat === "csv" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="size-3.5 text-muted-foreground" /> Supported CSV Column Names
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {[
              { label: "Employees", cols: "Name, Role, Salary, Billable Rate, ZIP" },
              { label: "Customers", cols: "Name, Address, Contact Name, Phone, Email, Facility Type" },
              { label: "Jobs",      cols: "Date, Customer, Tech / Employee, Service, Revenue, Status, Notes" },
            ].map(({ label, cols }) => (
              <div key={label}><span className="font-semibold text-foreground">{label}:</span> {cols}</div>
            ))}
            <p className="text-[10px] pt-1">Headers are matched by keyword — exact names aren't required. Status values "Invoiced", "Job Closed", "Completed" map to completed jobs.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DataManagementPage() {
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkBackend().then(setBackendAvailable);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Database className="size-6 text-primary shrink-0" />
          Data Management
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Import from ServiceFusion or CSV, export backups, and manage demo data.
        </p>
      </div>

      {backendAvailable === false && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300 flex gap-3">
          <ServerOff className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Backend server not available</p>
            <p>
              Data management features (import, export, seed/clear) require the TechForce Pro
              backend server. This Vercel deployment is a static preview — run the app on{" "}
              <strong>Replit</strong> or a self-hosted server to use these features.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="import">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="demo"   className="gap-1.5"><Package  className="size-3.5" /> Demo Data</TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5"><Download className="size-3.5" /> Export</TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5"><Upload   className="size-3.5" /> Import</TabsTrigger>
        </TabsList>
        <TabsContent value="demo"   className="mt-6"><DemoDataTab /></TabsContent>
        <TabsContent value="export" className="mt-6"><ExportTab /></TabsContent>
        <TabsContent value="import" className="mt-6"><ImportTab /></TabsContent>
      </Tabs>
    </div>
  );
}
