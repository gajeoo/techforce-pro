import { query } from "./_generated/server";

const SHOP_DAY_RATE = 275; // $/day flat cost when tech is in shop

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const [employees, jobs, openJobs, invoices] = await Promise.all([
      ctx.db.query("employees").collect(),
      ctx.db.query("jobs").collect(),
      ctx.db.query("openJobs").collect(),
      ctx.db.query("invoices").collect(),
    ]);

    const activeEmps = employees.filter((e: any) => e.isActive);
    const completedJobs = jobs.filter((j: any) => j.status === "completed");
    const revenueYtd = completedJobs.reduce((sum: number, j: any) => sum + (j.revenue ?? 0), 0);
    const shopDayCostYtd = activeEmps.reduce((sum: number, e: any) => sum + e.shopDaysUsedYtd * SHOP_DAY_RATE, 0);
    const avgUtil = activeEmps.length > 0
      ? activeEmps.reduce((sum: number, e: any) => sum + e.utilizationPct, 0) / activeEmps.length
      : 0;
    const returnCount = jobs.filter((j: any) => j.status === "return" || j.status === "will_return").length;
    const rescheduleCount = jobs.filter((j: any) => j.status === "reschedule").length;
    const projectedSavings = activeEmps.reduce((sum: number, e: any) => {
      const excess = Math.max(0, e.shopDaysUsedYtd - e.allowedShopDays);
      return sum + excess * SHOP_DAY_RATE;
    }, 0);

    return {
      shopDayCostYtd,
      teamUtilizationPct: Math.round(avgUtil * 10) / 10,
      revenueYtd,
      activeTechCount: activeEmps.length,
      openJobCount: openJobs.length,
      returnJobCount: returnCount,
      rescheduleJobCount: rescheduleCount,
      projectedAnnualSavings: projectedSavings,
    };
  },
});

export const profitLeaks = query({
  args: {},
  handler: async (ctx) => {
    const employees = await ctx.db.query("employees").collect();
    const leaks: any[] = [];
    for (const e of employees) {
      if (!e.isActive) continue;
      if (e.utilizationPct < 80) {
        const dailyBurden = (e.salary * 1.3 + 10000) / 260;
        const lostDays = Math.round((80 - e.utilizationPct) / 100 * 260);
        leaks.push({
          employeeId: e._id,
          employeeName: e.name,
          message: `Utilization at ${e.utilizationPct}% — below 80% target`,
          severity: e.utilizationPct < 60 ? "high" : "medium",
          dollarAmount: Math.round(lostDays * dailyBurden),
        });
      }
      if (e.shopDaysUsedYtd > e.allowedShopDays) {
        const excess = e.shopDaysUsedYtd - e.allowedShopDays;
        leaks.push({
          employeeId: e._id,
          employeeName: e.name,
          message: `${excess} excess shop days over allowance`,
          severity: excess > 5 ? "high" : "medium",
          dollarAmount: excess * 275,
        });
      }
    }
    return leaks;
  },
});

export const teamCalendar = query({
  args: {},
  handler: async (ctx) => {
    const [employees, jobs, customers] = await Promise.all([
      ctx.db.query("employees").collect(),
      ctx.db.query("jobs").collect(),
      ctx.db.query("customers").collect(),
    ]);
    const custMap = Object.fromEntries(customers.map((c: any) => [c._id, c]));
    const entries: any[] = [];
    for (const job of jobs) {
      if (!job.scheduledDate || !job.employeeId) continue;
      const emp = employees.find((e: any) => e._id === job.employeeId);
      if (!emp) continue;
      entries.push({
        employeeId: job.employeeId,
        employeeName: emp.name,
        certification: emp.certifications[0] ?? "any",
        date: job.scheduledDate,
        type: "job",
        revenue: job.revenue,
        jobId: job._id,
        customerName: custMap[job.customerId]?.name ?? null,
        status: job.status,
      });
    }
    return entries;
  },
});

export const employeeROI = query({
  args: {},
  handler: async (ctx) => {
    const [employees, jobs] = await Promise.all([
      ctx.db.query("employees").collect(),
      ctx.db.query("jobs").collect(),
    ]);
    const completedJobs = jobs.filter((j: any) => j.status === "completed");
    return employees.filter((e: any) => e.isActive).map((e: any) => {
      const empJobs = completedJobs.filter((j: any) => j.employeeId === e._id);
      const revenueYtd = empJobs.reduce((s: number, j: any) => s + j.revenue, 0);
      const dailyBurden = (e.salary * 1.3 + 10000) / 260;
      const workingDaysYtd = Math.round((new Date().getMonth() + 1) * 21.67);
      const salaryCostYtd = Math.round(dailyBurden * workingDaysYtd);
      const shopDayCost = e.shopDaysUsedYtd * 275;
      return {
        employeeId: e._id,
        employeeName: e.name,
        role: e.role,
        revenueYtd,
        salaryCostYtd,
        shopDayCost,
        netProfit: revenueYtd - salaryCostYtd - shopDayCost,
        utilizationPct: e.utilizationPct,
        shopDaysUsed: e.shopDaysUsedYtd,
        shopDaysAllowed: e.allowedShopDays,
      };
    });
  },
});

export const revenueByService = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    const completed = jobs.filter((j: any) => j.status === "completed");
    const grouped: Record<string, number> = {};
    for (const j of completed) {
      grouped[j.serviceType] = (grouped[j.serviceType] ?? 0) + j.revenue;
    }
    return Object.entries(grouped).map(([serviceType, revenue]) => ({ serviceType, revenue }));
  },
});
