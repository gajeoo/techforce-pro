export const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

// ─── Types matching DB schema ─────────────────────────────────────────────────

export interface ApiEmployee {
  id: number;
  name: string;
  role: string;
  salary: number;
  billableRate: number;
  homeZip: string;
  certifications: string[];
  allowedShopDays: number;
  shopDaysUsedYtd: number;
  allowedTrainingDays: number;
  trainingDaysUsedYtd: number;
  utilizationPct: number;
  hourlyRate: number | null;
  hoursPerDay: number;
  isActive: boolean;
}

export interface ApiCustomer {
  id: number;
  name: string;
  facilityType: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  inspectionFrequency: string;
  isActive: boolean;
}

export interface ApiCustomerLocation {
  id: number;
  customerId: number;
  name: string;
  address: string;
  contactName: string | null;
  contactPhone: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface ApiJob {
  id: number;
  customerId: number;
  employeeId: number | null;
  locationId: number | null;
  locationName: string | null;
  serviceType: string;
  status: string;
  priority: string;
  scheduledDate: string | null;
  dueDate: string | null;
  scheduledTime: string | null;
  revenue: number;
  quantity: number;
  notes: string | null;
  requiresFollowUp: boolean;
  followUpConfirmed: boolean;
  certificationRequired: string;
  customerName: string;
  customerAddress: string;
  employeeName: string | null;
  nonComplianceReason: string | null;
  nonComplianceNotifiedAt: string | null;
}

export interface ApiInvoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  jobId: number | null;
  techId: number | null;
  techName: string | null;
  lineItems: Array<{ service: string; quantity: number; rate: number; total: number }>;
  totalAmount: number;
  status: string;
  generatedAt: string;
  customerName: string;
}

export interface DashboardSummary {
  shopDayCostYtd: number;
  teamUtilizationPct: number;
  revenueYtd: number;
  activeTechCount: number;
  openJobCount: number;
  returnJobCount: number;
  rescheduleJobCount: number;
  projectedAnnualSavings: number;
}

export interface ProfitLeak {
  employeeId: number;
  employeeName: string;
  message: string;
  severity: string;
  dollarAmount: number;
}

export interface CalendarEntry {
  employeeId: number;
  employeeName: string;
  certification: string;
  date: string;
  type: string;
  revenue: number;
  jobId: number | null;
  customerName: string | null;
  status: string | null;
}

export interface ApiOpenJob {
  id: number;
  title: string;
  clientName: string;
  clientAddress: string | null;
  zipCode: string | null;
  certRequired: string;
  priority: string;
  notes: string | null;
  assignedEmployeeId: number | null;
  assignedEmployeeName: string | null;
  coTechnicianIds: number[];
  coTechnicianNames: string[];
  scheduledDate: string | null;
  scheduledTime: string | null;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${url} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Employees ────────────────────────────────────────────────────────────────

export const getEmployees = () => request<ApiEmployee[]>("/employees");
export const createEmployee = (body: Record<string, unknown>) =>
  request<ApiEmployee>("/employees", { method: "POST", body: JSON.stringify(body) });
export const updateEmployee = (id: number, body: Record<string, unknown>) =>
  request<ApiEmployee>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteEmployee = (id: number) =>
  fetch(`${API_BASE}/employees/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("Delete failed"); });

// ─── Customers ────────────────────────────────────────────────────────────────

export const getCustomers = () => request<ApiCustomer[]>("/customers");
export const createCustomer = (body: Record<string, unknown>) =>
  request<ApiCustomer>("/customers", { method: "POST", body: JSON.stringify(body) });
export const updateCustomer = (id: number, body: Record<string, unknown>) =>
  request<ApiCustomer>(`/customers/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteCustomer = (id: number) =>
  fetch(`${API_BASE}/customers/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("Delete failed"); });

// ─── Admin / Data Management ──────────────────────────────────────────────────

export interface AdminSeedResult {
  success: boolean;
  seeded: { employees: string[]; customers: string[]; locations: number; jobs: number; invoices: number };
}
export interface AdminExportData {
  exportedAt: string;
  version: string;
  data: {
    employees: ApiEmployee[];
    customers: ApiCustomer[];
    customerLocations: ApiCustomerLocation[];
    jobs: ApiJob[];
    openJobs: ApiOpenJob[];
    invoices: ApiInvoice[];
    recurringSchedules: ApiRecurringSchedule[];
  };
}
export const adminSeedDemo = () =>
  request<AdminSeedResult>("/admin/seed-demo", { method: "POST" });
export const adminClearAll = () =>
  fetch(`${API_BASE}/admin/clear-all`, { method: "DELETE" }).then(r => r.json() as Promise<{ success: boolean; message: string }>);
export const adminExport = () =>
  request<AdminExportData>("/admin/export");
export const adminImport = (data: Record<string, unknown[]>, clearFirst: boolean) =>
  request<{ success: boolean; imported: Record<string, number> }>("/admin/import", { method: "POST", body: JSON.stringify({ data, clearFirst }) });

// ─── Customer Locations ───────────────────────────────────────────────────────

export const getCustomerLocations = (customerId: number) =>
  request<ApiCustomerLocation[]>(`/customers/${customerId}/locations`);
export const createCustomerLocation = (customerId: number, body: Record<string, unknown>) =>
  request<ApiCustomerLocation>(`/customers/${customerId}/locations`, { method: "POST", body: JSON.stringify(body) });
export const updateCustomerLocation = (customerId: number, locId: number, body: Record<string, unknown>) =>
  request<ApiCustomerLocation>(`/customers/${customerId}/locations/${locId}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteCustomerLocation = (customerId: number, locId: number) =>
  request<void>(`/customers/${customerId}/locations/${locId}`, { method: "DELETE" });

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const getJobs = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<ApiJob[]>(`/jobs${qs}`);
};
export const getJob = (id: number) => request<ApiJob>(`/jobs/${id}`);
export const getReturnJobs = () => request<ApiJob[]>("/jobs/returns");
export const getRescheduleJobs = () => request<ApiJob[]>("/jobs/reschedules");
export const createJob = (body: Record<string, unknown>) =>
  request<ApiJob>("/jobs", { method: "POST", body: JSON.stringify(body) });
export const updateJob = (id: number, body: Record<string, unknown>) =>
  request<ApiJob>(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(body) });

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const getInvoices = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<ApiInvoice[]>(`/invoices${qs}`);
};
export const createInvoice = (body: Record<string, unknown>) =>
  request<ApiInvoice>("/invoices", { method: "POST", body: JSON.stringify(body) });
export const updateInvoice = (id: number, body: { status?: string; techId?: number | null }) =>
  request<ApiInvoice>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(body) });

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getDashboardSummary = () => request<DashboardSummary>("/dashboard/summary");
export const getProfitLeaks = () => request<ProfitLeak[]>("/dashboard/profit-leaks");
export const getTeamCalendar = () => request<CalendarEntry[]>("/dashboard/team-calendar");
export const getEmployeeROI = () =>
  request<Array<{
    employeeId: number; name: string; role: string;
    revenue: number; burdenCost: number; profit: number; margin: number; jobCount: number;
    utilizationPct: number; shopDaysUsed: number; shopDaysAllowed: number;
  }>>("/dashboard/employee-roi");

export const getRevenueByService = () =>
  request<Array<{
    serviceType: string; revenue: number; jobCount: number; avgRevenue: number;
  }>>("/dashboard/revenue-by-service");

// ─── Recurring Schedules ──────────────────────────────────────────────────────

export interface ApiRecurringSchedule {
  id: number;
  customerId: number;
  customerName: string;
  employeeId: number | null;
  employeeName: string | null;
  serviceType: string;
  intervalType: "6months" | "1year" | "custom";
  customDays: number | null;
  startDate: string;
  nextOccurrence: string;
  status: "active" | "paused";
  revenue: number;
  notes: string | null;
  createdAt: string;
}

export const getRecurringSchedules  = () => request<ApiRecurringSchedule[]>("/recurring-schedules");
export const createRecurringSchedule = (body: Record<string, unknown>) =>
  request<ApiRecurringSchedule>("/recurring-schedules", { method: "POST", body: JSON.stringify(body) });
export const updateRecurringSchedule = (id: number, body: Record<string, unknown>) =>
  request<ApiRecurringSchedule>(`/recurring-schedules/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteRecurringSchedule = (id: number) =>
  request<void>(`/recurring-schedules/${id}`, { method: "DELETE" });
export const pauseRecurringSchedule  = (id: number) =>
  request<ApiRecurringSchedule>(`/recurring-schedules/${id}/pause`, { method: "POST" });
export const resumeRecurringSchedule = (id: number) =>
  request<ApiRecurringSchedule>(`/recurring-schedules/${id}/resume`, { method: "POST" });

// ─── Open Jobs ────────────────────────────────────────────────────────────────

export const getOpenJobs = () => request<ApiOpenJob[]>("/open-jobs");

// ─── Utility helpers ──────────────────────────────────────────────────────────

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    suppression_lead: "Suppression Lead",
    sprinkler_tech: "Sprinkler Tech",
    extinguisher_tech: "Extinguisher Tech",
    helper: "Helper / Apprentice",
    admin: "Admin",
  };
  return map[role] ?? role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export function jobStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    completed: "✅",
    in_progress: "🔧",
    "in-progress": "🔧",
    return: "🔄",
    will_return: "🔄",
    reschedule: "📅",
    emergency: "🚨",
    pending: "⏳",
  };
  return icons[status] ?? "⏳";
}

export function serviceTypeLabel(s: string): string {
  const map: Record<string, string> = {
    hood_suppression: "Hood Suppression",
    extinguisher_inspection: "Extinguisher Inspection",
    sprinkler_test: "Sprinkler Test",
    exit_light_check: "Exit Light Check",
    full_inspection: "Full Fire Safety Inspection",
    standpipe_test: "Standpipe Test",
    fire_alarm: "Fire Alarm Inspection",
    suppression: "Hood Suppression",
    extinguisher: "Extinguisher Inspection",
    sprinkler: "Sprinkler Test",
    "exit-light": "Exit Light Check",
    mixed: "Mixed Services",
    emergency: "Emergency Service",
  };
  return map[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function getWeekDates(weekOffset: number): { label: string; date: string }[] {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMon + weekOffset * 7);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, date: d.toISOString().slice(0, 10) };
  });
}

export function formatWeekLabel(weekOffset: number): string {
  const dates = getWeekDates(weekOffset);
  if (dates.length === 0) return "";
  const fmt = (d: string) => {
    const [, m, day] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[Number(m) - 1]} ${Number(day)}`;
  };
  const year = dates[0].date.split("-")[0];
  return `${fmt(dates[0].date)} – ${fmt(dates[6].date)}, ${year}`;
}
