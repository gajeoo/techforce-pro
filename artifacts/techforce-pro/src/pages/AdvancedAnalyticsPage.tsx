import { useState, useMemo, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Users, Briefcase, DollarSign, Target,
  BarChart3, Zap, AlertCircle, Eye, EyeOff, Download, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter,
} from "recharts";
import { getDashboardSummary, getEmployees, getJobs, getInvoices, getCustomers } from "@/lib/api";
import {
  calculateJobMetrics, calculateEmployeePerformance, calculateCustomerMetrics,
  calculateRevenueAnalytics, generatePerformanceInsights, formatMetric,
  type AnalyticsMetric, type EmployeePerformance,
} from "@/lib/analytics";
import { exportToCSV, exportToJSON, generateReport } from "@/lib/exportImport";

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AdvancedAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>({
    revenue: true,
    jobs: true,
    employees: true,
    customers: true,
  });
  const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter">("month");

  const [summary, setSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  async function loadAnalyticsData() {
    try {
      setLoading(true);
      const [sumData, empData, jobData, invData, custData] = await Promise.all([
        getDashboardSummary(),
        getEmployees(),
        getJobs(),
        getInvoices(),
        getCustomers(),
      ]);

      setSummary(sumData);
      setEmployees(empData);
      setJobs(jobData);
      setInvoices(invData);
      setCustomers(custData);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  // Calculated metrics
  const jobMetrics = useMemo(() => jobs ? calculateJobMetrics(jobs) : null, [jobs]);
  const employeePerformance = useMemo(
    () => employees.map(e => calculateEmployeePerformance(e, jobs || [], invoices || [])),
    [employees, jobs, invoices]
  );
  const customerMetrics = useMemo(
    () => customers.map(c => calculateCustomerMetrics(c, jobs || [], invoices || [])),
    [customers, jobs, invoices]
  );
  const revenueMetrics = useMemo(
    () => invoices && jobs ? calculateRevenueAnalytics(jobs, invoices) : null,
    [jobs, invoices]
  );
  const insights = useMemo(
    () => jobMetrics && employeePerformance && customerMetrics
      ? generatePerformanceInsights(jobMetrics, employeePerformance, customerMetrics)
      : [],
    [jobMetrics, employeePerformance, customerMetrics]
  );

  const handleExport = (format: "csv" | "json" | "html") => {
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `analytics-${timestamp}.${format}`;

    if (format === "csv") {
      exportToCSV(employeePerformance, filename);
    } else if (format === "json") {
      exportToJSON(
        { summary, metrics: { jobs: jobMetrics, revenue: revenueMetrics }, employees: employeePerformance },
        filename
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">Comprehensive performance insights and business intelligence</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Performance Insights */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            Key Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {insights.map((insight, idx) => (
              <div key={idx} className="text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
                <span className="text-amber-900 dark:text-amber-100">{insight}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Briefcase}
          label="Job Completion Rate"
          value={`${(jobMetrics?.completionRate || 0).toFixed(1)}%`}
          trend={jobMetrics?.completionRate || 0 > 75 ? "up" : "down"}
          target={80}
          current={jobMetrics?.completionRate || 0}
        />
        <MetricCard
          icon={DollarSign}
          label="Monthly Revenue"
          value={formatMetric(revenueMetrics?.monthlyRevenue || 0, "currency")}
          trend="up"
          subtitle={`Avg job: ${formatMetric(revenueMetrics?.averageJobValue || 0, "currency")}`}
        />
        <MetricCard
          icon={Users}
          label="Team Utilization"
          value={`${((employeePerformance[0]?.utilization || 0) / employeePerformance.length).toFixed(1)}%`}
          trend="up"
          target={85}
          current={(employeePerformance[0]?.utilization || 0) / employeePerformance.length}
        />
        <MetricCard
          icon={Target}
          label="On-Time Delivery"
          value={`${(jobMetrics?.onTimeRate || 0).toFixed(1)}%`}
          trend={jobMetrics?.onTimeRate || 0 > 80 ? "up" : "down"}
          target={90}
          current={jobMetrics?.onTimeRate || 0}
        />
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="employees">Employee Performance</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
          <TabsTrigger value="customers">Customer Insights</TabsTrigger>
        </TabsList>

        {/* Employee Performance */}
        <TabsContent value="employees" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employee Performance Metrics</CardTitle>
              <CardDescription>Efficiency, utilization, and revenue contribution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Employee Chart */}
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={employeePerformance.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="efficiency" fill="#3b82f6" name="Efficiency %" />
                  <Bar dataKey="utilization" fill="#10b981" name="Utilization %" />
                </BarChart>
              </ResponsiveContainer>

              {/* Employee Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Employee</th>
                      <th className="text-right py-2">Jobs</th>
                      <th className="text-right py-2">Revenue</th>
                      <th className="text-right py-2">Efficiency</th>
                      <th className="text-right py-2">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeePerformance.slice(0, 5).map((emp) => (
                      <tr key={emp.employeeId} className="border-b hover:bg-muted">
                        <td className="py-2">{emp.name}</td>
                        <td className="text-right">{emp.jobsCompleted}</td>
                        <td className="text-right">${(emp.revenue || 0).toFixed(0)}</td>
                        <td className="text-right">
                          <Badge variant={emp.efficiency > 80 ? "default" : "secondary"}>
                            {emp.efficiency.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="text-right">
                          <div className="w-20 mx-auto">
                            <Progress value={emp.utilization} className="h-1.5" />
                            <span className="text-xs text-muted-foreground">{emp.utilization.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Analytics */}
        <TabsContent value="revenue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Analysis</CardTitle>
              <CardDescription>Breakdown by service type and customer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Service Revenue Chart */}
                <div>
                  <h3 className="text-sm font-semibold mb-4">Revenue by Service Type</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={revenueMetrics?.topServices || []}
                        dataKey="revenue"
                        nameKey="service"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {revenueMetrics?.topServices?.map((_, idx) => (
                          <Cell key={`cell-${idx}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Top Services Table */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Top Services</h3>
                  {revenueMetrics?.topServices?.map((service, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{service.service}</span>
                        <span className="text-muted-foreground">${(service.revenue || 0).toFixed(0)}</span>
                      </div>
                      <Progress value={(service.revenue || 0) / (revenueMetrics?.totalRevenue || 1) * 100} />
                      <p className="text-xs text-muted-foreground">{service.count} jobs completed</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Insights */}
        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Intelligence</CardTitle>
              <CardDescription>Retention risk and lifetime value analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customerMetrics.slice(0, 6).map((cust) => (
                  <Card key={cust.customerId} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-sm">{cust.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {cust.jobsCompleted} jobs • ${(cust.totalRevenue || 0).toFixed(0)}
                          </p>
                        </div>
                        <Badge
                          variant={
                            cust.retentionRisk === "low" ? "default" :
                            cust.retentionRisk === "medium" ? "secondary" : "destructive"
                          }
                        >
                          {cust.retentionRisk}
                        </Badge>
                      </div>
                      <div className="text-xs space-y-1">
                        <p>Satisfaction: {cust.satisfactionScore.toFixed(1)}/5</p>
                        <p>Avg Response: {cust.averageResponseTime}h</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Metric Card Component ────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: "up" | "down";
  subtitle?: string;
  target?: number;
  current?: number;
}

function MetricCard({ icon: Icon, label, value, trend, subtitle, target, current }: MetricCardProps) {
  const isUp = trend === "up";
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{label}</p>
            {typeof Icon === "function" && <Icon className="h-4 w-4 text-muted-foreground" />}
          </div>
          
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold">{value}</h3>
            {trend && (
              <div className={`flex items-center gap-1 text-sm ${isUp ? "text-green-600" : "text-red-600"}`}>
                {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{isUp ? "↑" : "↓"}</span>
              </div>
            )}
          </div>

          {target && current !== undefined && (
            <>
              <Progress value={(current / target) * 100} className="h-1.5" />
              <p className="text-xs text-muted-foreground">Target: {target}%</p>
            </>
          )}

          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
