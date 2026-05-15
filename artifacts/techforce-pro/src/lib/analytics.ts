/**
 * Advanced Analytics Module
 * Provides comprehensive analytics, metrics, and performance insights
 */

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

/**
 * Calculate job completion metrics
 */
export function calculateJobMetrics(jobs: any[]): JobMetrics {
  const completed = jobs.filter(j => j.status === "completed").length;
  const total = jobs.length;
  const completionRate = total > 0 ? (completed / total) * 100 : 0;

  const completionTimes = jobs
    .filter(j => j.completedAt && j.createdAt)
    .map(j => (new Date(j.completedAt).getTime() - new Date(j.createdAt).getTime()) / (1000 * 3600 * 24));
  
  const averageCompletionTime = completionTimes.length > 0
    ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
    : 0;

  const onTime = jobs.filter(j => j.dueDate && new Date(j.completedAt || new Date()) <= new Date(j.dueDate)).length;
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

/**
 * Calculate employee performance metrics
 */
export function calculateEmployeePerformance(employee: any, jobs: any[], invoices: any[]): EmployeePerformance {
  const empJobs = jobs.filter(j => j.employeeId === employee.id);
  const empInvoices = invoices.filter(i => i.techId === employee.id);
  const completedJobs = empJobs.filter(j => j.status === "completed").length;
  
  const totalRevenue = empInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const avgRating = 4.5; // Placeholder - would come from ratings system
  const utilization = employee.utilizationPct ? Number(employee.utilizationPct) : 0;
  const efficiency = (completedJobs / (empJobs.length || 1)) * 100;

  return {
    employeeId: employee.id,
    name: employee.name,
    jobsCompleted: completedJobs,
    averageRating: avgRating,
    utilization,
    revenue: totalRevenue,
    efficiency,
  };
}

/**
 * Calculate customer metrics and retention risk
 */
export function calculateCustomerMetrics(customer: any, jobs: any[], invoices: any[]): CustomerMetrics {
  const custJobs = jobs.filter(j => j.customerId === customer.id);
  const custInvoices = invoices.filter(i => i.customerId === customer.id);
  const completedJobs = custJobs.filter(j => j.status === "completed").length;
  
  const totalRevenue = custInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const avgResponseTime = 24; // Placeholder - would calculate from actual data
  const satisfactionScore = 4.3; // Placeholder
  
  // Risk calculation: low activity, high complaints, long response times
  const jobFrequency = custJobs.length / 12; // jobs per month
  const retentionRisk: "low" | "medium" | "high" = 
    jobFrequency < 2 && totalRevenue < 5000 ? "high" :
    jobFrequency < 3 && totalRevenue < 10000 ? "medium" :
    "low";

  return {
    customerId: customer.id,
    name: customer.name,
    totalRevenue,
    jobsCompleted: completedJobs,
    averageResponseTime: avgResponseTime,
    satisfactionScore,
    retentionRisk,
  };
}

/**
 * Calculate revenue analytics
 */
export function calculateRevenueAnalytics(jobs: any[], invoices: any[]): RevenueAnalytics {
  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyInvoices = invoices.filter(inv => new Date(inv.generatedAt || now) >= monthStart);
  const monthlyRevenue = monthlyInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const averageJobValue = completedJobs > 0 ? totalRevenue / completedJobs : 0;

  const revenueGrowth = 12.5; // Placeholder - would calculate from historical data

  // Top services
  const serviceRevenue = new Map<string, { revenue: number; count: number }>();
  invoices.forEach(inv => {
    const job = jobs.find(j => j.id === inv.jobId);
    const service = job?.serviceType || "Unknown";
    const current = serviceRevenue.get(service) || { revenue: 0, count: 0 };
    serviceRevenue.set(service, {
      revenue: current.revenue + Number(inv.totalAmount || 0),
      count: current.count + 1,
    });
  });

  const topServices = Array.from(serviceRevenue.entries())
    .map(([service, data]) => ({ service, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top customers
  const custRevenue = new Map<string, number>();
  invoices.forEach(inv => {
    const current = custRevenue.get(inv.customerId) || 0;
    custRevenue.set(inv.customerId, current + Number(inv.totalAmount || 0));
  });

  const topCustomers = Array.from(custRevenue.entries())
    .map(([custId, revenue]) => ({ customerId: custId, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(item => ({ name: `Customer ${item.customerId}`, revenue: item.revenue }));

  return {
    totalRevenue,
    monthlyRevenue,
    averageJobValue,
    revenueGrowth,
    topServices,
    topCustomers,
  };
}

/**
 * Generate performance insights
 */
export function generatePerformanceInsights(
  metrics: JobMetrics,
  employees: EmployeePerformance[],
  customers: CustomerMetrics[]
): string[] {
  const insights: string[] = [];

  if (metrics.completionRate < 70) {
    insights.push("⚠️ Job completion rate is below target. Consider reviewing bottlenecks.");
  }

  if (metrics.reworkRate > 10) {
    insights.push("🔧 High rework rate detected. Quality checks may need improvement.");
  }

  if (metrics.onTimeRate < 80) {
    insights.push("📅 On-time completion is below 80%. Review scheduling practices.");
  }

  const lowPerformers = employees.filter(e => e.efficiency < 60);
  if (lowPerformers.length > 0) {
    insights.push(`👤 ${lowPerformers.length} employee(s) with efficiency below 60%. Consider training or support.`);
  }

  const highRiskCustomers = customers.filter(c => c.retentionRisk === "high");
  if (highRiskCustomers.length > 0) {
    insights.push(`⚠️ ${highRiskCustomers.length} customer(s) at high retention risk. Reach out proactively.`);
  }

  if (insights.length === 0) {
    insights.push("✅ All metrics are within acceptable ranges. Great performance!");
  }

  return insights;
}

/**
 * Calculate trend for metric comparison
 */
export function calculateTrend(current: number, previous: number): "up" | "down" | "stable" {
  if (Math.abs(current - previous) < current * 0.05) return "stable";
  return current > previous ? "up" : "down";
}

/**
 * Format analytics metric for display
 */
export function formatMetric(value: number, type: "percentage" | "currency" | "number" = "number"): string {
  switch (type) {
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "currency":
      return `$${value.toFixed(2)}`;
    case "number":
      return value.toFixed(0);
  }
}
