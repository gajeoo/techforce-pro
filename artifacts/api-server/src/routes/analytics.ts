import { Router } from "express";

const router = Router();

/**
 * Analytics & Advanced Features Routes
 * Provides endpoints for analytics, reports, and metrics
 */

// ─── Analytics Endpoints ──────────────────────────────────────────────────────

/**
 * GET /api/analytics/summary
 * Get comprehensive analytics summary
 */
router.get("/analytics/summary", async (req, res) => {
  try {
    // This would fetch from Convex/DB
    const summary = {
      period: "month",
      metrics: {
        totalJobs: 42,
        completedJobs: 38,
        completionRate: 90.5,
        totalRevenue: 32500,
        monthlyRevenue: 8200,
        averageJobValue: 215.79,
        employeeUtilization: 82.3,
        customerSatisfaction: 4.6,
      },
      trends: {
        revenueGrowth: 12.5,
        completionTrend: 5.2,
        utilizationTrend: -2.1,
      },
      topMetrics: {
        topEmployee: { name: "Tyler Beaumont", revenue: 5200, jobs: 8 },
        topCustomer: { name: "Harbor View Condominiums", revenue: 3500, jobs: 5 },
        topService: { type: "hood_suppression", revenue: 8500, count: 12 },
      },
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch analytics summary", detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/analytics/employee-performance
 * Get detailed employee performance metrics
 */
router.get("/analytics/employee-performance", async (req, res) => {
  try {
    const employees = [
      {
        id: "1",
        name: "Ernest Johnson",
        jobsCompleted: 12,
        efficiency: 92.3,
        utilization: 88.5,
        revenue: 4200,
        rating: 4.8,
        certifications: ["suppression", "extinguisher"],
      },
      {
        id: "2",
        name: "Tyler Beaumont",
        jobsCompleted: 8,
        efficiency: 88.1,
        utilization: 85.2,
        revenue: 5200,
        rating: 4.6,
        certifications: ["suppression", "extinguisher", "sprinkler"],
      },
      {
        id: "3",
        name: "Ephraim Osei",
        jobsCompleted: 15,
        efficiency: 95.5,
        utilization: 92.1,
        revenue: 4800,
        rating: 4.9,
        certifications: ["sprinkler", "standpipe"],
      },
    ];

    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch employee performance", detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/analytics/revenue-breakdown
 * Get revenue breakdown by service type
 */
router.get("/analytics/revenue-breakdown", async (req, res) => {
  try {
    const breakdown = {
      period: "month",
      total: 32500,
      byService: [
        { service: "hood_suppression", revenue: 12500, percentage: 38.5, jobCount: 18 },
        { service: "extinguisher_inspection", revenue: 9200, percentage: 28.3, jobCount: 24 },
        { service: "sprinkler_test", revenue: 6800, percentage: 20.9, jobCount: 8 },
        { service: "other", revenue: 4000, percentage: 12.3, jobCount: 5 },
      ],
      byCustomer: [
        { name: "Harbor View Condominiums", revenue: 8500, percentage: 26.2 },
        { name: "Gold Coast Restaurant Group", revenue: 7200, percentage: 22.2 },
        { name: "Riverside Elementary School", revenue: 5100, percentage: 15.7 },
      ],
      trend: 12.5, // Growth percentage vs last month
    };

    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch revenue breakdown", detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/analytics/customer-health
 * Get customer health and retention scores
 */
router.get("/analytics/customer-health", async (req, res) => {
  try {
    const customers = [
      {
        id: "1",
        name: "Harbor View Condominiums",
        retentionScore: 92,
        retentionRisk: "low",
        jobFrequency: 4.5,
        satisfaction: 4.8,
        lastJob: "2024-05-10",
        totalValue: 8500,
      },
      {
        id: "2",
        name: "Gold Coast Restaurant Group",
        retentionScore: 78,
        retentionRisk: "medium",
        jobFrequency: 2.1,
        satisfaction: 4.2,
        lastJob: "2024-05-05",
        totalValue: 7200,
      },
      {
        id: "3",
        name: "Riverside Elementary School",
        retentionScore: 45,
        retentionRisk: "high",
        jobFrequency: 1.2,
        satisfaction: 3.5,
        lastJob: "2024-04-15",
        totalValue: 5100,
      },
    ];

    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer health", detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/analytics/kpis
 * Get key performance indicators
 */
router.get("/analytics/kpis", async (req, res) => {
  try {
    const kpis = {
      timestamp: new Date().toISOString(),
      kpis: [
        { name: "Job Completion Rate", value: 90.5, unit: "%", target: 85, status: "excellent" },
        { name: "On-Time Delivery", value: 87.2, unit: "%", target: 90, status: "good" },
        { name: "Customer Satisfaction", value: 4.6, unit: "/5", target: 4.5, status: "excellent" },
        { name: "Team Utilization", value: 82.3, unit: "%", target: 85, status: "good" },
        { name: "Rework Rate", value: 4.2, unit: "%", target: 5, status: "excellent" },
        { name: "Revenue per Job", value: 775, unit: "$", target: 700, status: "excellent" },
        { name: "Invoice Collection Rate", value: 94.1, unit: "%", target: 95, status: "good" },
        { name: "Profit Margin", value: 28.5, unit: "%", target: 30, status: "good" },
      ],
    };

    res.json(kpis);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch KPIs", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Report Generation Endpoints ─────────────────────────────────────────────

/**
 * POST /api/reports/generate
 * Generate custom report
 */
router.post("/reports/generate", async (req, res) => {
  try {
    const { type, startDate, endDate, format } = req.body;

    // Validate parameters
    if (!type || !format) {
      return res.status(400).json({ error: "Missing required parameters: type, format" });
    }

    // Generate report data based on type
    const reportData = {
      type,
      generated: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      format,
      url: `/api/reports/download/${type}-${Date.now()}.${format}`,
    };

    res.json(reportData);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate report", detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/reports/templates
 * Get available report templates
 */
router.get("/reports/templates", async (req, res) => {
  try {
    const templates = [
      { id: "monthly-summary", name: "Monthly Business Summary", description: "Overview of all metrics for the month" },
      { id: "employee-perf", name: "Employee Performance Report", description: "Detailed employee metrics and KPIs" },
      { id: "customer-health", name: "Customer Health Report", description: "Customer satisfaction and retention analysis" },
      { id: "revenue-analysis", name: "Revenue Analysis", description: "Detailed breakdown of revenue by service and customer" },
      { id: "compliance", name: "Compliance Report", description: "Certifications and compliance status" },
    ];

    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch report templates", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Notifications Endpoints ──────────────────────────────────────────────────

/**
 * POST /api/notifications/send
 * Send notification
 */
router.post("/notifications/send", async (req, res) => {
  try {
    const { userId, type, title, message, category } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // In production, this would save to DB and push via websocket
    const notification = {
      id: `notif-${Date.now()}`,
      userId,
      type,
      title,
      message,
      category,
      timestamp: new Date().toISOString(),
      read: false,
    };

    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: "Failed to send notification", detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/notifications/preferences/:userId
 * Get user notification preferences
 */
router.get("/notifications/preferences/:userId", async (req, res) => {
  try {
    const preferences = {
      userId: req.params.userId,
      notifications: {
        job: { enabled: true, inApp: true, email: true, sms: false },
        schedule: { enabled: true, inApp: true, email: false, sms: true },
        customer: { enabled: true, inApp: true, email: true, sms: false },
        invoice: { enabled: true, inApp: true, email: true, sms: false },
        system: { enabled: true, inApp: true, email: false, sms: false },
        alert: { enabled: true, inApp: true, email: true, sms: true },
      },
    };

    res.json(preferences);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch preferences", detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * PUT /api/notifications/preferences/:userId
 * Update notification preferences
 */
router.put("/notifications/preferences/:userId", async (req, res) => {
  try {
    const { preferences } = req.body;

    // In production, this would update DB
    res.json({ success: true, message: "Preferences updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update preferences", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
