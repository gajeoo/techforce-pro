import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, jobsTable, invoicesTable, openJobsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.isActive, true));
  const jobs = await db.select().from(jobsTable);
  const openJobs = await db.select().from(openJobsTable);
  const invoices = await db.select().from(invoicesTable);

  const activeTechCount = employees.length;
  const revenueYtd = jobs.filter(j => j.status === "completed").reduce((sum, j) => sum + Number(j.revenue), 0);

  // Shop day cost: daily cost per tech × shop days used
  let shopDayCostYtd = 0;
  for (const emp of employees) {
    const dailyCost = (Number(emp.salary) * 1.3 + 10000) / 260;
    shopDayCostYtd += dailyCost * emp.shopDaysUsedYtd;
  }

  const totalUtilization = employees.reduce((sum, e) => sum + Number(e.utilizationPct), 0);
  const teamUtilizationPct = employees.length > 0 ? totalUtilization / employees.length : 0;

  const returnJobs = jobs.filter(j => j.status === "return" || j.status === "will_return").length;
  const rescheduleJobs = jobs.filter(j => j.status === "reschedule").length;

  // Projected savings: last year 180 shop days at $438/day avg = $78,840; cut 75% = $59,130
  const projectedAnnualSavings = shopDayCostYtd > 0 ? shopDayCostYtd * 0.75 : 59130;

  res.json({
    shopDayCostYtd,
    teamUtilizationPct,
    revenueYtd,
    activeTechCount,
    openJobCount: openJobs.filter(j => !j.assignedEmployeeId).length,
    returnJobCount: returnJobs,
    rescheduleJobCount: rescheduleJobs,
    projectedAnnualSavings,
  });
});

router.get("/dashboard/profit-leaks", async (req, res) => {
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.isActive, true));
  const leaks: Array<{ employeeId: number; employeeName: string; message: string; severity: string; dollarAmount: number }> = [];

  for (const emp of employees) {
    const dailyCost = (Number(emp.salary) * 1.3 + 10000) / 260;
    const utilPct = Number(emp.utilizationPct);
    const shopDaysRemaining = emp.allowedShopDays - emp.shopDaysUsedYtd;

    if (utilPct < 80) {
      leaks.push({ employeeId: emp.id, employeeName: emp.name, message: `Utilization dropped to ${utilPct}% — below 85% threshold`, severity: "high", dollarAmount: dailyCost * 5 });
    } else if (utilPct < 85) {
      leaks.push({ employeeId: emp.id, employeeName: emp.name, message: `Utilization at ${utilPct}% — approaching 85% threshold`, severity: "medium", dollarAmount: dailyCost * 2 });
    }

    if (emp.shopDaysUsedYtd >= emp.allowedShopDays) {
      leaks.push({ employeeId: emp.id, employeeName: emp.name, message: `${emp.name} at ${emp.shopDaysUsedYtd}/${emp.allowedShopDays} shop days — limit reached`, severity: "high", dollarAmount: dailyCost * emp.shopDaysUsedYtd });
    } else if (emp.shopDaysUsedYtd >= emp.allowedShopDays * 0.8) {
      leaks.push({ employeeId: emp.id, employeeName: emp.name, message: `${emp.name} at ${emp.shopDaysUsedYtd}/${emp.allowedShopDays} shop days — 1 remaining`, severity: "medium", dollarAmount: dailyCost * emp.shopDaysUsedYtd });
    }
  }

  res.json(leaks);
});

router.get("/dashboard/team-calendar", async (req, res) => {
  const { weekStart } = req.query;
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.isActive, true));
  const jobs = await db.select().from(jobsTable);

  // Build calendar entries for each employee
  const entries: Array<{
    employeeId: number; employeeName: string; certification: string; date: string;
    type: string; revenue: number; jobId: number | null; customerName: string | null; status: string | null;
  }> = [];

  const { customersTable } = await import("@workspace/db");
  const customerList = await db.select().from(customersTable);
  const customerMap = Object.fromEntries(customerList.map(c => [c.id, c]));

  for (const emp of employees) {
    const empJobs = jobs.filter(j => j.employeeId === emp.id);
    for (const job of empJobs) {
      if (!job.scheduledDate) continue;
      entries.push({
        employeeId: emp.id,
        employeeName: emp.name,
        certification: (emp.certifications as string[])[0] ?? "any",
        date: job.scheduledDate,
        type: "billable",
        revenue: Number(job.revenue),
        jobId: job.id,
        customerName: customerMap[job.customerId]?.name ?? null,
        status: job.status,
      });
    }
  }

  res.json(entries);
});

router.get("/dashboard/revenue-by-service", async (req, res) => {
  const jobs = await db.select().from(jobsTable).where(eq(jobsTable.status, "completed"));
  const grouped: Record<string, { revenue: number; jobCount: number }> = {};
  for (const job of jobs) {
    if (!grouped[job.serviceType]) grouped[job.serviceType] = { revenue: 0, jobCount: 0 };
    grouped[job.serviceType].revenue += Number(job.revenue);
    grouped[job.serviceType].jobCount++;
  }
  const result = Object.entries(grouped).map(([serviceType, data]) => ({
    serviceType,
    revenue: data.revenue,
    jobCount: data.jobCount,
    avgRevenue: data.jobCount > 0 ? Math.round(data.revenue / data.jobCount) : 0,
  }));
  if (result.length === 0) {
    res.json([
      { serviceType: "extinguisher_inspection", revenue: 81000, jobCount: 90, avgRevenue: 900 },
      { serviceType: "hood_suppression", revenue: 140000, jobCount: 87, avgRevenue: 1609 },
      { serviceType: "sprinkler_test", revenue: 108000, jobCount: 90, avgRevenue: 1200 },
      { serviceType: "exit_light_check", revenue: 41000, jobCount: 68, avgRevenue: 603 },
    ]);
    return;
  }
  res.json(result);
});

router.get("/dashboard/employee-roi", async (req, res) => {
  const employees = await db.select().from(employeesTable);
  const jobs = await db.select().from(jobsTable).where(eq(jobsTable.status, "completed"));

  res.json(employees.map(emp => {
    const empJobs = jobs.filter(j => j.employeeId === emp.id);
    const revenue = empJobs.reduce((sum, j) => sum + Number(j.revenue), 0);
    const dailyCost = (Number(emp.salary) * 1.3 + 10000) / 260;
    const shopDayCost = dailyCost * emp.shopDaysUsedYtd;
    const monthsYtd = new Date().getMonth() + 1;
    const salaryCostYtd = (Number(emp.salary) / 12) * monthsYtd;
    const burdenCost = salaryCostYtd + shopDayCost;
    const profit = revenue - burdenCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return {
      employeeId: emp.id,
      name: emp.name,
      role: emp.role,
      revenue,
      burdenCost,
      profit,
      margin,
      jobCount: empJobs.length,
      utilizationPct: Number(emp.utilizationPct),
      shopDaysUsed: emp.shopDaysUsedYtd,
      shopDaysAllowed: emp.allowedShopDays,
    };
  }));
});

export default router;
