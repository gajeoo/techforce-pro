// ─── Types ──────────────────────────────────────────────────────────────

export type Employee = {
  id: string;
  name: string;
  role: string;
  certs: string[];
  salary: number;
  billRate: number;
  utilization: number;
  shopDaysUsed: number;
  shopDaysAllowed: number;
  revenueYTD: number;
  revenueThisMonth: number;
  status: "active" | "on-job" | "shop" | "off";
  avatar: string;
  phone: string;
  hireDate: string;
  shopDayHistory: number[];
};

export type JobDocument = {
  id: string;
  name: string;
  type: "photo" | "pdf" | "document";
  uploadedBy: string;
  uploadedAt: string;
  size: string;
};

export type Job = {
  id: string;
  client: string;
  customerId: string;
  locationId?: string;
  address: string;
  type: string;
  serviceCategory: "suppression" | "extinguisher" | "sprinkler" | "exit-light" | "mixed";
  certRequired: string;
  revenue: number;
  status: "completed" | "in-progress" | "pending" | "return" | "reschedule" | "emergency";
  techId: string;
  techName: string;
  scheduledDate: string;
  scheduledTime: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  statusIcon: string;
  notes?: string;
  documents: JobDocument[];
};

export type WeekSchedule = {
  techId: string;
  techName: string;
  cert: string;
  days: { label: string; value: string; type: "billable" | "shop" | "training" | "off" | "open" }[];
};

export type CustomerLocation = {
  id: string;
  name: string;
  address: string;
  isPrimary: boolean;
};

export type Customer = {
  id: string;
  name: string;
  type: string;
  contact: string;
  phone: string;
  extinguisher: string;
  suppression: string;
  sprinkler: string;
  exitLight: string;
  jobCount: number;
  revenueYTD: number;
  lastService: string;
  contractStatus: "active" | "expiring" | "pending";
  locations: CustomerLocation[];
};

export type PreviousYearJob = {
  id: string;
  jobId: string;
  client: string;
  customerId: string;
  locationId: string;
  address: string;
  type: string;
  serviceCategory: string;
  techName: string;
  completedDate: string;
  revenue: number;
  status: string;
  notes?: string;
  documents: JobDocument[];
};

export type EmployeeWeekDay = {
  label: string;
  date: string;
  type: "billable" | "shop" | "training" | "off" | "open";
  revenue: number;
  jobs: { id: string; client: string; type: string; time: string; revenue: number; status: string }[];
};

export type EmployeeWeekSchedule = {
  techId: string;
  techName: string;
  cert: string;
  specialty: string;
  weekRevenue: number;
  shopDaysThisWeek: number;
  days: EmployeeWeekDay[];
};

// ─── All data arrays are empty — app is populated from real database ─────

export const employees: Employee[] = [];
export const todayJobs: Job[] = [];
export const allCustomerJobs: Job[] = [];
export const weekSchedule: WeekSchedule[] = [];
export const profitAlerts: { tech: string; message: string; severity: "high" | "medium" | "low" }[] = [];
export const openJobs: { id: string; job: string; client: string; cert: string; priority: "high" | "medium" | "low"; revenue: number }[] = [];
export const customers: Customer[] = [];
export const monthlyRevenue: { month: string; revenue: number; cost: number; profit: number; shopDays: number }[] = [];
export const returnJobs: (Job & { notes: string })[] = [];
export const rescheduleJobs: (Job & { notes: string; followUpRequired: boolean; followUpDone: boolean })[] = [];
export const previousYearJobs: PreviousYearJob[] = [];
export const employeeWeekSchedules: EmployeeWeekSchedule[] = [];

// ─── UI constants (service category color map — not mock data) ───────────

export const serviceCategoryColors: Record<string, { bg: string; text: string; label: string }> = {
  "suppression": { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", label: "Suppression" },
  "extinguisher": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Extinguisher" },
  "sprinkler": { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", label: "Sprinkler" },
  "exit-light": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", label: "Exit Light" },
  "mixed": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", label: "Mixed" },
};

// ─── History lookup (safe on empty arrays) ───────────────────────────────

export function getJobHistory(jobId: string): { currentYearJobs: Job[]; previousYearJobs: PreviousYearJob[] } {
  const job = [...allCustomerJobs, ...todayJobs].find(j => j.id === jobId);
  if (!job) return { currentYearJobs: [], previousYearJobs: [] };

  const currentYearJobs = allCustomerJobs.filter(j =>
    j.customerId === job.customerId &&
    (j.locationId === job.locationId || !job.locationId) &&
    j.id !== job.id
  );

  const prevYearAtLocation = previousYearJobs.filter(j =>
    j.customerId === job.customerId &&
    (j.locationId === job.locationId || !job.locationId)
  );

  return { currentYearJobs, previousYearJobs: prevYearAtLocation };
}
