// Minimal interfaces accepted by each analytics function.
// These are intentionally narrow — only the fields each function actually reads —
// so both the old REST-API shape and Convex document shape satisfy them without casts.

export interface AnalyticsJob {
  /** Stable identifier (numeric for REST, string for Convex). */
  id?: string | number;
  status?: string;
  dueDate?: string | null;
  serviceType?: string;
  /** Employee identifier matching AnalyticsEmployee.id. */
  employeeId?: string | number | null;
  /** Customer identifier matching AnalyticsCustomer.id. */
  customerId?: string | number;
  revenue?: number;
}

export interface AnalyticsEmployee {
  /** Stable identifier used to join jobs/invoices. */
  id: string | number;
  name: string;
  utilizationPct?: number;
}

export interface AnalyticsCustomer {
  /** Stable identifier used to join jobs/invoices. */
  id: string | number;
  name: string;
}

export interface AnalyticsInvoice {
  /** Invoice-level job identifier matching AnalyticsJob.id. */
  jobId?: string | number | null;
  /** Customer identifier matching AnalyticsCustomer.id. */
  customerId?: string | number;
  /** Technician identifier matching AnalyticsEmployee.id. */
  techId?: string | number | null;
  totalAmount?: number;
  /** ISO date string; used for monthly bucketing. */
  generatedAt?: string | null;
}

export interface AnalyticsMetric {
  label: string;
  value: number;
  trend: "up" | "down" | "stable";
  change: number;
  unit?: string;
}

export interface JobMetrics {
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  averageCompletionTime: number;
  onTimeRate: number;
  reworkRate: number;
}

export interface EmployeePerformance {
  employeeId: string;
  name: string;
  jobsCompleted: number;
  averageRating: number;
  utilization: number;
  revenue: number;
  efficiency: number;
}

export interface CustomerMetrics {
  customerId: string;
  name: string;
  totalRevenue: number;
  jobsCompleted: number;
  averageResponseTime: number;
  satisfactionScore: number;
  retentionRisk: "low" | "medium" | "high";
}

export interface RevenueAnalytics {
  totalRevenue: number;
  monthlyRevenue: number;
  averageJobValue: number;
  revenueGrowth: number;
  topServices: Array<{ service: string; revenue: number; count: number }>;
  topCustomers: Array<{ name: string; revenue: number }>;
}

export function calculateJobMetrics(jobs: AnalyticsJob[]): JobMetrics {
  const completed = jobs.filter(j => j.status === "completed").length;
  const total = jobs.length;
  const completionRate = total > 0 ? (completed / total) * 100 : 0;

  const averageCompletionTime = 0;

  const onTime = jobs.filter(j => j.dueDate && j.status === "completed").length;
  const onTimeRate = total > 0 ? (onTime / total) * 100 : 0;

  const rework = jobs.filter(j => j.status === "return" || j.status === "will_return").length;
  const reworkRate = total > 0 ? (rework / total) * 100 : 0;

  return {
    totalJobs: total,
    completedJobs: completed,
    completionRate,
    averageCompletionTime,
    onTimeRate,
    reworkRate,
  };
}

export function calculateEmployeePerformance(
  employee: AnalyticsEmployee,
  jobs: AnalyticsJob[],
  invoices: AnalyticsInvoice[],
): EmployeePerformance {
  const empId = employee.id;
  const empJobs = jobs.filter(j => j.employeeId != null && String(j.employeeId) === String(empId));
  const empInvoices = invoices.filter(i => i.techId != null && String(i.techId) === String(empId));
  const completedJobs = empJobs.filter(j => j.status === "completed").length;

  const totalRevenue = empInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);
  const avgRating = 4.5;
  const utilization = employee.utilizationPct ? Number(employee.utilizationPct) : 0;
  const efficiency = (completedJobs / (empJobs.length || 1)) * 100;

  return {
    employeeId: String(empId),
    name: employee.name,
    jobsCompleted: completedJobs,
    averageRating: avgRating,
    utilization,
    revenue: totalRevenue,
    efficiency,
  };
}

export function calculateCustomerMetrics(
  customer: AnalyticsCustomer,
  jobs: AnalyticsJob[],
  invoices: AnalyticsInvoice[],
): CustomerMetrics {
  const custId = customer.id;
  const custJobs = jobs.filter(j => j.customerId != null && String(j.customerId) === String(custId));
  const custInvoices = invoices.filter(i => i.customerId != null && String(i.customerId) === String(custId));
  const completedJobs = custJobs.filter(j => j.status === "completed").length;

  const totalRevenue = custInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);
  const avgResponseTime = 24;
  const satisfactionScore = 4.3;

  const jobFrequency = custJobs.length / 12;
  const retentionRisk: "low" | "medium" | "high" =
    jobFrequency < 2 && totalRevenue < 5000 ? "high" :
    jobFrequency < 3 && totalRevenue < 10000 ? "medium" :
    "low";

  return {
    customerId: String(custId),
    name: customer.name,
    totalRevenue,
    jobsCompleted: completedJobs,
    averageResponseTime: avgResponseTime,
    satisfactionScore,
    retentionRisk,
  };
}

export function calculateRevenueAnalytics(
  jobs: AnalyticsJob[],
  invoices: AnalyticsInvoice[],
): RevenueAnalytics {
  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyInvoices = invoices.filter(inv => {
    if (!inv.generatedAt) return false;
    return new Date(inv.generatedAt) >= monthStart;
  });
  const monthlyRevenue = monthlyInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);

  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const averageJobValue = completedJobs > 0 ? totalRevenue / completedJobs : 0;

  const revenueGrowth = 12.5;

  const serviceRevenue = new Map<string, { revenue: number; count: number }>();
  invoices.forEach(inv => {
    const job = inv.jobId != null
      ? jobs.find(j => j.id != null && String(j.id) === String(inv.jobId))
      : undefined;
    const service = job?.serviceType ?? "Unknown";
    const current = serviceRevenue.get(service) ?? { revenue: 0, count: 0 };
    serviceRevenue.set(service, {
      revenue: current.revenue + Number(inv.totalAmount ?? 0),
      count: current.count + 1,
    });
  });

  const topServices = Array.from(serviceRevenue.entries())
    .map(([service, data]) => ({ service, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const custRevenue = new Map<string, number>();
  invoices.forEach(inv => {
    if (inv.customerId == null) return;
    const key = String(inv.customerId);
    custRevenue.set(key, (custRevenue.get(key) ?? 0) + Number(inv.totalAmount ?? 0));
  });

  const topCustomers = Array.from(custRevenue.entries())
    .map(([custId, revenue]) => ({ custId, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(item => ({ name: `Customer ${item.custId}`, revenue: item.revenue }));

  return {
    totalRevenue,
    monthlyRevenue,
    averageJobValue,
    revenueGrowth,
    topServices,
    topCustomers,
  };
}

export function generatePerformanceInsights(
  metrics: JobMetrics,
  employees: EmployeePerformance[],
  customers: CustomerMetrics[],
): string[] {
  const insights: string[] = [];

  if (metrics.completionRate < 70) {
    insights.push("Job completion rate is below target. Consider reviewing bottlenecks.");
  }
  if (metrics.reworkRate > 10) {
    insights.push("High rework rate detected. Quality checks may need improvement.");
  }
  if (metrics.onTimeRate < 80) {
    insights.push("On-time completion is below 80%. Review scheduling practices.");
  }

  const lowPerformers = employees.filter(e => e.efficiency < 60);
  if (lowPerformers.length > 0) {
    insights.push(`${lowPerformers.length} employee(s) with efficiency below 60%. Consider training or support.`);
  }

  const highRiskCustomers = customers.filter(c => c.retentionRisk === "high");
  if (highRiskCustomers.length > 0) {
    insights.push(`${highRiskCustomers.length} customer(s) at high retention risk. Reach out proactively.`);
  }

  if (insights.length === 0) {
    insights.push("All metrics are within acceptable ranges. Great performance!");
  }

  return insights;
}

export function calculateTrend(current: number, previous: number): "up" | "down" | "stable" {
  if (Math.abs(current - previous) < current * 0.05) return "stable";
  return current > previous ? "up" : "down";
}

export function formatMetric(value: number, type: "percentage" | "currency" | "number" = "number"): string {
  switch (type) {
    case "percentage": return `${value.toFixed(1)}%`;
    case "currency":   return `$${value.toFixed(2)}`;
    case "number":     return value.toFixed(0);
  }
}
