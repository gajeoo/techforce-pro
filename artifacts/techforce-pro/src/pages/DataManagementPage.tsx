import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertTriangle, CheckCircle2, Database, Download, FileJson,
  FileSpreadsheet, FileText, Play, Trash2, Upload, Users,
  Building2, Briefcase, Car, Clock, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Fingerprint helpers ──────────────────────────────────────────────────────

const IMPORT_LOG_KEY = "tfp-import-log";

function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return h >>> 0;
}

function makeFingerprint(content: string): string {
  return String(djb2(content.slice(0, 8000) + content.length));
}

type ImportLogEntry = { fingerprint: string; importedAt: string; label: string };

function getImportLog(): ImportLogEntry[] {
  try { return JSON.parse(localStorage.getItem(IMPORT_LOG_KEY) ?? "[]"); } catch { return []; }
}

function saveImportLog(log: ImportLogEntry[]) {
  localStorage.setItem(IMPORT_LOG_KEY, JSON.stringify(log.slice(-50)));
}

function recordImport(fingerprint: string, label: string) {
  const log = getImportLog();
  log.push({ fingerprint, importedAt: new Date().toISOString(), label });
  saveImportLog(log);
}

function checkDuplicate(fingerprint: string): ImportLogEntry | null {
  return getImportLog().find(e => e.fingerprint === fingerprint) ?? null;
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]).filter(k => !["_id", "_creationTime"].includes(k));
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map(r => keys.map(k => esc(r[k])).join(","))].join("\n");
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
      else cur += ch;
    }
    vals.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

// ─── ServiceFusion HTML parser ────────────────────────────────────────────────

function isServiceFusionReport(html: string): boolean {
  return html.includes("rateTable") && html.includes("customerName");
}

function cleanAmount(raw: string): number {
  const n = parseFloat(raw.replace(/[$*,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function mapSFStatus(sfStatus: string): { status: string; invoiceStatus: string } {
  switch (sfStatus.toLowerCase().trim()) {
    case "invoiced":     return { status: "completed",   invoiceStatus: "sent"  };
    case "completed":    return { status: "completed",   invoiceStatus: "draft" };
    case "scheduled":    return { status: "scheduled",   invoiceStatus: "none"  };
    case "in progress":  return { status: "in_progress", invoiceStatus: "none"  };
    case "cancelled":
    case "canceled":     return { status: "cancelled",   invoiceStatus: "none"  };
    default:             return { status: "pending",     invoiceStatus: "none"  };
  }
}

function parseServiceFusionSalesByTech(html: string): DataBundle {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Tech name lives in .customerName td
  const techName = doc.querySelector("table.customerName td")?.textContent?.trim() ?? "Unknown Tech";
  const empId = `sf_emp_${techName.toLowerCase().replace(/\W+/g, "_")}`;

  const employees: Record<string, unknown>[] = [{
    _id: empId, name: techName,
    role: "extinguisher_tech", salary: 50000, billableRate: 800,
    homeZip: "00000", certifications: [], allowedShopDays: 5,
    shopDaysUsedYtd: 0, allowedTrainingDays: 3, trainingDaysUsedYtd: 0,
    utilizationPct: 0, isActive: true,
  }];

  const rateTable = doc.querySelector("table.rateTable");
  if (!rateTable) return { employees };

  // tbody rows only (skips the two thead header rows automatically)
  const tbodyRows = Array.from(rateTable.querySelectorAll("tbody tr"));

  const custMap = new Map<string, string>(); // name → syntheticId
  const customers: Record<string, unknown>[] = [];
  const jobs: Record<string, unknown>[] = [];

  const dateRe = /^\d{2}\/\d{2}\/\d{4}$/;

  let i = 0;
  while (i < tbodyRows.length) {
    const cells = Array.from(tbodyRows[i].querySelectorAll("td"))
      .map(td => td.textContent?.replace(/\s+/g, " ").trim() ?? "");

    // Job info row: position 1 is a date like 01/02/2026
    if (cells.length >= 7 && dateRe.test(cells[1])) {
      const jobNumber    = cells[0];
      const date         = cells[1];
      const time         = cells[2];
      const sfStatus     = cells[3];
      const jobCategory  = cells[5];
      const customerName = cells[6];
      const jobDetails   = (cells[7] ?? "").replace(/\n/g, " ").trim();

      // Register customer
      if (!custMap.has(customerName)) {
        const custId = `sf_cust_${customerName.toLowerCase().replace(/\W+/g, "_")}`;
        custMap.set(customerName, custId);
        customers.push({
          _id: custId, name: customerName,
          facilityType: "commercial", address: "",
          contactName: "", contactPhone: "",
          inspectionFrequency: "annual", isActive: true,
        });
      }
      const custId = custMap.get(customerName)!;
      const { status, invoiceStatus } = mapSFStatus(sfStatus);

      // Look ahead for the financial row (first row where cell[0] starts with $)
      let revenue = 0;
      let j = i + 1;
      while (j < tbodyRows.length) {
        const fc = Array.from(tbodyRows[j].querySelectorAll("td"))
          .map(td => td.textContent?.replace(/\s+/g, " ").trim() ?? "");
        if (fc[0]?.startsWith("$")) {
          // col 6 = Job Total
          revenue = cleanAmount(fc[6] ?? "0");
          i = j + 1;
          break;
        }
        // If we hit the next job info row without finding financials, stop
        if (fc.length >= 7 && dateRe.test(fc[1])) { i = j; break; }
        j++;
      }
      if (j >= tbodyRows.length) i = j;

      jobs.push({
        // Foreign keys (resolved by importAll via custIdMap / empIdMap)
        customerId:  custId,
        employeeId:  empId,
        // Display-friendly fields (visible in the editable grid)
        customer:    customerName,
        tech:        techName,
        // Core job fields
        scheduledDate: date,
        dueDate:       date,
        time,
        serviceType:   jobCategory || "extinguisher_inspection",
        status,
        invoiceStatus,
        priority:      "medium",
        revenue,
        quantity:      1,
        notes:         jobDetails || undefined,
        certificationRequired: "any",
        requiresFollowUp:  false,
        followUpConfirmed: false,
        sfJobNumber:   jobNumber,
        sfStatus,
      });
    } else {
      i++;
    }
  }

  return { employees, customers, jobs };
}

// ─── Generic HTML table parser (fallback) ─────────────────────────────────────

function parseHtmlTable(html: string): Record<string, unknown>[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];
  const headers = Array.from(table.querySelectorAll("th")).map(th => th.textContent?.trim() ?? "");
  if (!headers.length) {
    const firstRow = table.querySelector("tr");
    headers.push(...Array.from(firstRow?.querySelectorAll("td") ?? []).map(td => td.textContent?.trim() ?? ""));
  }
  return Array.from(table.querySelectorAll("tr")).slice(1).map(row => {
    const cells = Array.from(row.querySelectorAll("td")).map(td => td.textContent?.trim() ?? "");
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  }).filter(r => Object.values(r).some(v => v !== ""));
}

// ─── Entity detection from filename ──────────────────────────────────────────

const ENTITY_ALIASES: Record<string, string> = {
  employee: "employees", employees: "employees", staff: "employees", techs: "employees",
  customer: "customers", customers: "customers", clients: "customers",
  location: "customerLocations", locations: "customerLocations", customerlocations: "customerLocations",
  job: "jobs", jobs: "jobs", workorder: "jobs", workorders: "jobs",
  openjob: "openJobs", openjobs: "openJobs", "open-jobs": "openJobs",
  invoice: "invoices", invoices: "invoices",
  van: "vans", vans: "vans", fleet: "vans",
  timeoff: "timeOffRequests", "time-off": "timeOffRequests", timeoffrequests: "timeOffRequests",
  servicerequest: "serviceRequests", servicerequests: "serviceRequests",
};

function detectEntity(filename: string): string | null {
  const base = filename.toLowerCase().replace(/\.[^.]+$/, "").replace(/[-_\s]/g, "");
  return ENTITY_ALIASES[base] ?? null;
}

// ─── Editable import grid types ───────────────────────────────────────────────

type EditableSheet = {
  headers: string[];
  rows: Record<string, string>[];
};
type EditedImport = Record<string, EditableSheet>;

// ─── Import bundle type ───────────────────────────────────────────────────────

type DataBundle = {
  employees?: unknown[];
  customers?: unknown[];
  customerLocations?: unknown[];
  jobs?: unknown[];
  openJobs?: unknown[];
  invoices?: unknown[];
  vans?: unknown[];
  timeOffRequests?: unknown[];
  serviceRequests?: unknown[];
};

type ImportPreview = DataBundle & {
  fingerprint: string;
  fileLabel: string;
  duplicate: ImportLogEntry | null;
};

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, content: string) {
  downloadBlob(filename, new Blob([content], { type: "text/csv" }));
}

function downloadJson(filename: string, data: unknown) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}

async function downloadXlsx(filename: string, sheets: Record<string, Record<string, unknown>[]>) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    if (!rows.length) continue;
    const clean = rows.map(r => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (["_id", "_creationTime"].includes(k)) continue;
        out[k] = typeof v === "object" && v !== null ? JSON.stringify(v) : v;
      }
      return out;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clean), name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

// ─── Entity config ────────────────────────────────────────────────────────────

const CSV_ENTITIES = [
  { key: "employees",        label: "Employees",      icon: Users },
  { key: "customers",        label: "Customers",      icon: Building2 },
  { key: "jobs",             label: "Jobs",           icon: Briefcase },
  { key: "invoices",         label: "Invoices",       icon: FileText },
  { key: "vans",             label: "Fleet / Vans",   icon: Car },
  { key: "timeOffRequests",  label: "Time-Off Requests", icon: Clock },
  { key: "serviceRequests",  label: "Service Requests", icon: ClipboardList },
] as const;

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DataManagementPage() {
  const [loading, setLoading]               = useState<string | null>(null);
  const [confirmClear, setConfirmClear]     = useState<0 | 1 | 2>(0);
  const [importPreview, setImportPreview]   = useState<ImportPreview | null>(null);
  const [clearFirst, setClearFirst]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Editable import grid state ────────────────────────────────────────────
  const [editedImport,  setEditedImport]    = useState<EditedImport>({});
  const [editingSheet,  setEditingSheet]    = useState<string>("");
  const [editingCell,   setEditingCell]     = useState<{ row: number; col: string } | null>(null);
  const [editingHeader, setEditingHeader]   = useState<string | null>(null);

  // Sync editable grid when preview changes
  useEffect(() => {
    if (!importPreview) { setEditedImport({}); setEditingSheet(""); return; }
    const SKIP = new Set(["fingerprint", "fileLabel", "duplicate"]);
    const sheets: EditedImport = {};
    for (const [key, val] of Object.entries(importPreview)) {
      if (SKIP.has(key) || !Array.isArray(val) || !val.length) continue;
      const hdrs = Object.keys(val[0] as Record<string, unknown>)
        .filter(k => !["_id", "_creationTime"].includes(k));
      sheets[key] = {
        headers: hdrs,
        rows: val.map(r =>
          Object.fromEntries(hdrs.map(h => [h, String((r as Record<string,unknown>)[h] ?? "")]))
        ),
      };
    }
    setEditedImport(sheets);
    setEditingSheet(Object.keys(sheets)[0] ?? "");
  }, [importPreview]);

  const seedDemo   = useMutation(api.admin.seedDemo);
  const clearAll   = useMutation(api.admin.clearAll);
  const importAll  = useMutation(api.admin.importAll);
  const exportData = useQuery(api.admin.exportAll);

  // ── Demo: seed ──────────────────────────────────────────────────────────────
  async function handleSeed() {
    setLoading("seed");
    try {
      const result = await seedDemo({}) as { seeded?: { employees?: number; customers?: number; jobs?: number } };
      toast.success(
        `Demo data loaded — ${result?.seeded?.employees ?? 0} employees, ${result?.seeded?.customers ?? 0} customers, ${result?.seeded?.jobs ?? 0} jobs`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed demo data");
    } finally { setLoading(null); }
  }

  // ── Demo: clear all ─────────────────────────────────────────────────────────
  async function handleClear() {
    setLoading("clear");
    try {
      await clearAll({});
      // Also wipe P&L localStorage so the P&L page shows zeroes immediately
      try {
        localStorage.removeItem("pl-day-overrides");
        localStorage.removeItem("pl-rev-overrides");
        localStorage.removeItem("pl-week-start");
        localStorage.removeItem("pl-period");
        localStorage.removeItem(IMPORT_LOG_KEY);
      } catch {}
      toast.success("All data cleared successfully");
      setConfirmClear(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear data");
    } finally { setLoading(null); }
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function handleExportJson() {
    if (!exportData) return;
    downloadJson(`techforce-export-${new Date().toISOString().slice(0, 10)}.json`, exportData);
    toast.success("Full JSON export downloaded");
  }

  function handleExportXlsx() {
    if (!exportData) return;
    const d = (exportData as { data?: Record<string, Record<string, unknown>[]> }).data ?? {};
    downloadXlsx(`techforce-export-${new Date().toISOString().slice(0, 10)}.xlsx`, d as Record<string, Record<string, unknown>[]>);
    toast.success("Excel workbook downloaded — one sheet per entity");
  }

  function handleExportCsv(entityKey: string, label: string) {
    if (!exportData) return;
    const d = (exportData as { data?: Record<string, unknown[]> }).data ?? {};
    const rows = d[entityKey] as Record<string, unknown>[] | undefined;
    if (!rows?.length) { toast.warning(`No ${label} data to export`); return; }
    downloadCsv(`techforce-${entityKey}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    toast.success(`${label} CSV downloaded (${rows.length} rows)`);
  }

  // ── Import: parse file ──────────────────────────────────────────────────────
  function buildPreview(bundle: DataBundle, fingerprint: string, fileLabel: string): ImportPreview {
    return {
      ...bundle,
      fingerprint,
      fileLabel,
      duplicate: checkDuplicate(fingerprint),
    };
  }

  function parseJsonFile(text: string, fileLabel: string) {
    const raw = JSON.parse(text);
    const d: DataBundle = raw.data ?? raw;
    setImportPreview(buildPreview(d, makeFingerprint(text), fileLabel));
  }

  function parseCsvFile(text: string, filename: string) {
    const entity = detectEntity(filename);
    if (!entity) {
      toast.error(`Can't detect entity from filename "${filename}". Rename to e.g. employees.csv, jobs.csv, invoices.csv.`);
      return;
    }
    const rows = parseCsv(text);
    if (!rows.length) { toast.error("CSV has no data rows"); return; }
    const bundle: DataBundle = { [entity]: rows };
    setImportPreview(buildPreview(bundle, makeFingerprint(text), filename));
  }

  function parseXlsxFile(buffer: ArrayBuffer, filename: string) {
    import("xlsx").then(XLSX => {
      const wb = XLSX.read(buffer, { type: "array" });
      const bundle: DataBundle = {};
      for (const sheetName of wb.SheetNames) {
        const entity = detectEntity(sheetName) ?? detectEntity(filename);
        if (!entity) continue;
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
        if (rows.length) (bundle as Record<string, unknown[]>)[entity] = rows;
      }
      if (!Object.keys(bundle).length) {
        toast.error("No recognisable entity sheets found in the workbook.");
        return;
      }
      const fp = makeFingerprint(filename + JSON.stringify(Object.keys(bundle)) + JSON.stringify(
        Object.values(bundle).map(a => a.length)
      ));
      setImportPreview(buildPreview(bundle, fp, filename));
    }).catch(() => toast.error("Failed to load Excel parser"));
  }

  function parseHtmlFile(text: string, filename: string) {
    // ServiceFusion "Sales Revenue By Tech" HTML — specialized two-row-per-job parser
    if (isServiceFusionReport(text)) {
      const bundle = parseServiceFusionSalesByTech(text);
      const totalJobs = bundle.jobs?.length ?? 0;
      const totalCusts = bundle.customers?.length ?? 0;
      if (!totalJobs) {
        toast.error("ServiceFusion report parsed but no job rows found. Check the file format.");
        return;
      }
      toast.success(`ServiceFusion report detected — ${totalJobs} jobs, ${totalCusts} customers extracted`);
      setImportPreview(buildPreview(bundle, makeFingerprint(text), filename));
      return;
    }
    // Generic HTML table fallback
    const entity = detectEntity(filename);
    const rows = parseHtmlTable(text);
    if (!rows.length) { toast.error("No table found in HTML file"); return; }
    const bundle: DataBundle = { [(entity ?? "employees")]: rows };
    setImportPreview(buildPreview(bundle, makeFingerprint(text), filename));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    e.target.value = "";

    if (ext === "json") {
      const reader = new FileReader();
      reader.onload = ev => {
        try { parseJsonFile(ev.target?.result as string, file.name); }
        catch { toast.error("Invalid JSON file"); setImportPreview(null); }
      };
      reader.readAsText(file);
    } else if (ext === "csv") {
      const reader = new FileReader();
      reader.onload = ev => {
        try { parseCsvFile(ev.target?.result as string, file.name); }
        catch { toast.error("Invalid CSV file"); setImportPreview(null); }
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = ev => {
        try { parseXlsxFile(ev.target?.result as ArrayBuffer, file.name); }
        catch { toast.error("Invalid Excel file"); setImportPreview(null); }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === "html" || ext === "htm") {
      const reader = new FileReader();
      reader.onload = ev => {
        try { parseHtmlFile(ev.target?.result as string, file.name); }
        catch { toast.error("Invalid HTML file"); setImportPreview(null); }
      };
      reader.readAsText(file);
    } else {
      toast.error("Unsupported file type. Use JSON, CSV, Excel (.xlsx), or HTML.");
    }
  }

  // ── Import: confirm (uses editedImport so in-grid changes are preserved) ──
  async function handleImport() {
    if (!importPreview) return;
    setLoading("import");
    try {
      const data: DataBundle = {};
      for (const [key, sheet] of Object.entries(editedImport)) {
        (data as Record<string, unknown[]>)[key] = sheet.rows.map(row => {
          const obj: Record<string, unknown> = {};
          for (const h of sheet.headers) {
            const v = row[h] ?? "";
            const n = Number(v);
            obj[h] = v !== "" && !isNaN(n) ? n : v;
          }
          return obj;
        });
      }
      const result = await importAll({ data: data as Parameters<typeof importAll>[0]["data"], clearFirst }) as { imported?: Record<string, number> };
      const imp = result?.imported ?? {};
      const summary = Object.entries(imp).map(([k, n]) => `${n} ${k}`).join(", ");
      toast.success(`Import complete — ${summary || "no records"}`);
      recordImport(importPreview.fingerprint, importPreview.fileLabel);
      setImportPreview(null);
      setClearFirst(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally { setLoading(null); }
  }

  // ── Editable grid helpers ────────────────────────────────────────────────
  function renameHeader(sheetKey: string, idx: number, newName: string) {
    setEditedImport(prev => {
      const sheet = { ...prev[sheetKey] };
      const old = sheet.headers[idx];
      if (!newName.trim() || newName === old) return prev;
      sheet.headers = sheet.headers.map((h, i) => i === idx ? newName : h);
      sheet.rows = sheet.rows.map(r => {
        const nr = { ...r, [newName]: r[old] };
        delete nr[old];
        return nr;
      });
      return { ...prev, [sheetKey]: sheet };
    });
  }

  function updateCell(sheetKey: string, rowIdx: number, col: string, val: string) {
    setEditedImport(prev => {
      const sheet = { ...prev[sheetKey] };
      sheet.rows = sheet.rows.map((r, i) => i === rowIdx ? { ...r, [col]: val } : r);
      return { ...prev, [sheetKey]: sheet };
    });
  }

  function deleteRow(sheetKey: string, rowIdx: number) {
    setEditedImport(prev => {
      const sheet = { ...prev[sheetKey] };
      sheet.rows = sheet.rows.filter((_, i) => i !== rowIdx);
      return { ...prev, [sheetKey]: sheet };
    });
  }

  function addRow(sheetKey: string) {
    setEditedImport(prev => {
      const sheet = { ...prev[sheetKey] };
      const blank = Object.fromEntries(sheet.headers.map(h => [h, ""]));
      sheet.rows = [...sheet.rows, blank];
      return { ...prev, [sheetKey]: sheet };
    });
  }

  // ─── Preview entity counts ────────────────────────────────────────────────
  const previewCounts: [string, number][] = importPreview
    ? [
        ["Employees",  importPreview.employees?.length       ?? 0],
        ["Customers",  importPreview.customers?.length       ?? 0],
        ["Locations",  importPreview.customerLocations?.length ?? 0],
        ["Jobs",       importPreview.jobs?.length            ?? 0],
        ["Open Jobs",  importPreview.openJobs?.length        ?? 0],
        ["Invoices",   importPreview.invoices?.length        ?? 0],
        ["Vans",       importPreview.vans?.length            ?? 0],
        ["Time-Off",   importPreview.timeOffRequests?.length ?? 0],
        ["Requests",   importPreview.serviceRequests?.length ?? 0],
      ].filter(([, n]) => (n as number) > 0) as [string, number][]
    : [];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="size-6 text-primary" /> Data Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Seed demo data, export records, import backups, or clear the database.
        </p>
      </div>

      <Tabs defaultValue="demo">
        <TabsList className="mb-4">
          <TabsTrigger value="demo"   className="gap-1.5"><Play className="size-3.5" /> Demo Data</TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5"><Download className="size-3.5" /> Export</TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5"><Upload className="size-3.5" /> Import</TabsTrigger>
        </TabsList>

        {/* ── Demo Data tab ── */}
        <TabsContent value="demo" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="size-4 text-emerald-600" /> Load Demo Data
              </CardTitle>
              <CardDescription>
                Seeds 3 employees, 3 customers (3 locations each), 6 jobs, 3 invoices, and 4 fleet vans.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Employees", desc: "Ernest, Tyler, Ephraim" },
                  { label: "Customers", desc: "Harbor View, Riverside, Gold Coast" },
                  { label: "Jobs, Invoices & Vans", desc: "6 jobs · 3 invoices · 4 vans" },
                ].map(item => (
                  <div key={item.label} className="rounded-lg bg-muted/50 border p-3">
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSeed}
                disabled={loading === "seed"}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading === "seed"
                  ? <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Play className="size-4" />}
                {loading === "seed" ? "Loading…" : "Load Demo Data"}
              </button>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
                <Trash2 className="size-4" /> Clear All Data
              </CardTitle>
              <CardDescription>
                Permanently deletes every record from every table. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {confirmClear === 0 && (
                <button
                  onClick={() => setConfirmClear(1)}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="size-4" /> Clear All Data
                </button>
              )}

              {confirmClear === 1 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" /> Step 1 of 2 — Are you sure?
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    This will permanently delete <strong>all employees, customers, jobs, invoices, vans, and every other record</strong>. Your P&L settings will also be reset. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmClear(2)}
                      className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                    >
                      <AlertTriangle className="size-3.5" /> Yes, I understand — continue
                    </button>
                    <button
                      onClick={() => setConfirmClear(0)}
                      className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {confirmClear === 2 && (
                <div className="rounded-lg border border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" /> Step 2 of 2 — Final confirmation
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    <strong>Last chance.</strong> Every record in the database will be permanently erased. There is no backup or undo.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClear}
                      disabled={loading === "clear"}
                      className="flex items-center gap-2 bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50 transition-colors"
                    >
                      {loading === "clear"
                        ? <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Trash2 className="size-3.5" />}
                      {loading === "clear" ? "Clearing…" : "Permanently delete everything"}
                    </button>
                    <button
                      onClick={() => setConfirmClear(0)}
                      className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Export tab ── */}
        <TabsContent value="export" className="space-y-4">
          {/* Full exports */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileJson className="size-4 text-blue-600" /> Full Data Export
              </CardTitle>
              <CardDescription>
                Download a complete snapshot of all data — employees, customers, jobs, invoices, fleet, time-off and more.
                Use the JSON file to re-import data exactly, or open the Excel workbook in Excel/Google Sheets.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <button
                onClick={handleExportJson}
                disabled={!exportData}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <FileJson className="size-4" />
                {exportData ? "Export All (JSON)" : "Loading…"}
              </button>
              <button
                onClick={handleExportXlsx}
                disabled={!exportData}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <FileSpreadsheet className="size-4" />
                {exportData ? "Export All (Excel)" : "Loading…"}
              </button>
            </CardContent>
          </Card>

          {/* Per-entity CSV */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="size-4 text-violet-600" /> Per-Entity CSV Downloads
              </CardTitle>
              <CardDescription>
                Download individual tables as CSV. Name files are auto-detected on re-import (e.g. employees.csv, jobs.csv).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CSV_ENTITIES.map(({ key, label, icon: Icon }) => {
                  const d = (exportData as { data?: Record<string, unknown[]> } | undefined)?.data;
                  const count = d ? (d[key]?.length ?? 0) : null;
                  return (
                    <button
                      key={key}
                      onClick={() => handleExportCsv(key, label)}
                      disabled={!exportData || count === 0}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:bg-muted/50 disabled:opacity-40 transition-colors text-center"
                    >
                      <Icon className="size-5 text-muted-foreground" />
                      <span className="text-xs font-medium">{label}</span>
                      {count !== null && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                          {count} rows
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Import tab ── */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="size-4 text-amber-600" /> Import Data
              </CardTitle>
              <CardDescription>
                Supported formats: <strong>JSON</strong> (full export), <strong>Excel</strong> (.xlsx / .xls — one sheet per entity),
                <strong> CSV</strong> (filename must match entity: employees.csv, jobs.csv, invoices.csv…),
                <strong> HTML</strong> (must contain a &lt;table&gt;). Foreign-key relationships are re-mapped automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <input
                type="file"
                accept=".json,.csv,.xlsx,.xls,.html,.htm"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-muted-foreground/30 rounded-xl px-6 py-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors w-full"
              >
                <Upload className="size-5" />
                <span>Click to choose a file</span>
                <span className="text-xs opacity-60">JSON · Excel (.xlsx) · CSV · HTML</span>
              </button>

              {/* ── Editable Preview ── */}
              {importPreview && (
                <div className="space-y-4 rounded-xl border bg-muted/30 p-4">

                  {/* Duplicate warning */}
                  {importPreview.duplicate && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                      <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-700">This file has already been imported</p>
                        <p className="text-amber-600 text-xs mt-0.5">
                          Last imported {new Date(importPreview.duplicate.importedAt).toLocaleString()}.
                          Importing again creates duplicates unless "Clear existing data" is checked.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      {importPreview.fileLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Click any cell or column header to edit before saving.
                    </p>
                  </div>

                  {/* Entity tabs */}
                  {Object.keys(editedImport).length > 0 ? (
                    <>
                      {Object.keys(editedImport).length > 1 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {Object.keys(editedImport).map(key => (
                            <button
                              key={key}
                              onClick={() => { setEditingSheet(key); setEditingCell(null); setEditingHeader(null); }}
                              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                                editingSheet === key
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-muted-foreground/20 hover:bg-muted"
                              }`}
                            >
                              {key} <span className="opacity-60">({editedImport[key].rows.length})</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Editable spreadsheet */}
                      {editingSheet && editedImport[editingSheet] && (
                        <div className="rounded-xl border overflow-auto max-h-72 bg-background">
                          <table className="text-xs w-full border-collapse">
                            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                              <tr>
                                <th className="px-2 py-2 text-muted-foreground/60 font-normal w-8 border-r border-b border-border text-center">#</th>
                                {editedImport[editingSheet].headers.map((h, hi) => (
                                  <th key={hi} className="px-1 py-1 border-b border-r border-border font-medium min-w-[90px]">
                                    {editingHeader === `${editingSheet}:${hi}` ? (
                                      <input
                                        autoFocus
                                        defaultValue={h}
                                        onBlur={e => { renameHeader(editingSheet, hi, e.target.value); setEditingHeader(null); }}
                                        onKeyDown={e => {
                                          if (e.key === "Enter") e.currentTarget.blur();
                                          if (e.key === "Escape") setEditingHeader(null);
                                        }}
                                        className="w-full bg-white border border-primary rounded px-1.5 py-0.5 text-xs focus:outline-none font-semibold"
                                      />
                                    ) : (
                                      <button
                                        onClick={() => setEditingHeader(`${editingSheet}:${hi}`)}
                                        title="Click to rename column"
                                        className="w-full text-left px-1.5 py-0.5 hover:bg-primary/10 rounded font-semibold text-foreground truncate block"
                                      >
                                        {h}
                                      </button>
                                    )}
                                  </th>
                                ))}
                                <th className="px-2 py-2 border-b border-border w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {editedImport[editingSheet].rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-border/50 hover:bg-muted/30 group">
                                  <td className="px-2 py-1 text-muted-foreground/40 text-center border-r border-border/40 select-none">{ri + 1}</td>
                                  {editedImport[editingSheet].headers.map((h, hi) => {
                                    const isEditing = editingCell?.row === ri && editingCell?.col === h;
                                    return (
                                      <td key={hi} className="px-0.5 py-0.5 border-r border-border/40">
                                        {isEditing ? (
                                          <input
                                            autoFocus
                                            defaultValue={row[h] ?? ""}
                                            onBlur={e => { updateCell(editingSheet, ri, h, e.target.value); setEditingCell(null); }}
                                            onKeyDown={e => {
                                              if (e.key === "Enter") e.currentTarget.blur();
                                              if (e.key === "Escape") { setEditingCell(null); }
                                              if (e.key === "Tab") {
                                                e.preventDefault();
                                                e.currentTarget.blur();
                                                const next = editedImport[editingSheet].headers[hi + 1];
                                                if (next) setEditingCell({ row: ri, col: next });
                                                else if (ri + 1 < editedImport[editingSheet].rows.length)
                                                  setEditingCell({ row: ri + 1, col: editedImport[editingSheet].headers[0] });
                                              }
                                            }}
                                            className="w-full bg-white border border-primary rounded px-1.5 py-0.5 text-xs focus:outline-none"
                                          />
                                        ) : (
                                          <button
                                            onClick={() => setEditingCell({ row: ri, col: h })}
                                            title={row[h] || undefined}
                                            className="w-full text-left px-1.5 py-0.5 hover:bg-primary/10 rounded truncate block max-w-[140px]"
                                          >
                                            {row[h] !== "" ? row[h] : <span className="text-muted-foreground/30">—</span>}
                                          </button>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-1 py-1 text-center">
                                    <button
                                      onClick={() => deleteRow(editingSheet, ri)}
                                      title="Delete row"
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-500 transition-all text-sm leading-none"
                                    >×</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Add row + row count */}
                      {editingSheet && editedImport[editingSheet] && (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => addRow(editingSheet)}
                            className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 rounded-lg px-3 py-1.5 transition-colors"
                          >
                            + Add row
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {editedImport[editingSheet].rows.length} row{editedImport[editingSheet].rows.length !== 1 ? "s" : ""}
                            {" · "}{editedImport[editingSheet].headers.length} column{editedImport[editingSheet].headers.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recognised entity data found in this file.</p>
                  )}

                  {/* Options + actions */}
                  <div className="border-t border-border pt-3 space-y-3">
                    <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={clearFirst}
                        onChange={e => setClearFirst(e.target.checked)}
                        className="accent-red-600 size-4"
                      />
                      <span>
                        <span className="font-medium text-red-600">Clear existing data</span> before importing
                      </span>
                    </label>
                    {clearFirst && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        All current records will be deleted before the import runs. This cannot be undone.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleImport}
                        disabled={loading === "import" || Object.keys(editedImport).length === 0}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {loading === "import"
                          ? <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          : <Upload className="size-4" />}
                        {loading === "import" ? "Importing…" : "Confirm Import"}
                      </button>
                      <button
                        onClick={() => { setImportPreview(null); setClearFirst(false); }}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium border hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
