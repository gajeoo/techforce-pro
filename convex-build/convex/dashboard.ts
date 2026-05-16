import { query } from "./_generated/server";

const SHOP_DAY_RATE = 275; // $/day flat cost when tech is in shop

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const [employees, jobs, openJobs] = await Promise.all([
      ctx.db.query("employees").collect(),
      ctx.db.query("jobs").collect(),
      ctx.db.query("openJobs").collect(),
    ]);

    // Treat employees as active unless explicitly inactive — imported rows often have isActive undefined.
    const activeEmps = employees.filter((e: any) => e.isActive !== false);
    const isCompleted = (j: any) => {
      const s = String(j.status ?? "").toLowerCase().trim();
      return s === "completed" || s === "complete" || s === "done" || s === "closed" || s === "finished" || s === "invoiced" || s === "paid";
    };
    const isReturn = (j: any) => {
      const s = String(j.status ?? "").toLowerCase().trim();
      return s.includes("return");
    };
    const isReschedule = (j: any) => {
      const s = String(j.status ?? "").toLowerCase().trim();
      return s.includes("reschedule");
    };
    const completedJobs = jobs.filter(isCompleted);
    const revenueYtd = completedJobs.reduce((sum: number, j: any) => sum + (Number(j.revenue) || Number(j.amount) || Number(j.price) || 0), 0);
    const shopDayCostYtd = activeEmps.reduce((sum: number, e: any) => sum + (Number(e.shopDaysUsedYtd) || 0) * SHOP_DAY_RATE, 0);
    // Average utilization: prefer stored utilizationPct; fall back to completion ratio per tech so imported data shows meaningful number.
    const utilValues = activeEmps.map((e: any) => {
      const stored = Number(e.utilizationPct);
      if (Number.isFinite(stored) && stored > 0) return stored;
      const empJobs = jobs.filter((j: any) => j.employeeId === e._id);
      if (empJobs.length === 0) return 0;
      const done = empJobs.filter(isCompleted).length;
      return Math.round((done / empJobs.length) * 1000) / 10;
    });
    const avgUtil = utilValues.length > 0 ? utilValues.reduce((a: number, b: number) => a + b, 0) / utilValues.length : 0;
    const returnCount = jobs.filter(isReturn).length;
    const rescheduleCount = jobs.filter(isReschedule).length;
    // Open jobs = anything in `jobs` table that isn't completed, plus the separate openJobs queue.
    const openFromJobs = jobs.filter((j: any) => !isCompleted(j) && !isReturn(j) && !isReschedule(j)).length;
    const projectedSavings = activeEmps.reduce((sum: number, e: any) => {
      const excess = Math.max(0, (e.shopDaysUsedYtd ?? 0) - (e.allowedShopDays ?? 0));
      return sum + excess * SHOP_DAY_RATE;
    }, 0);

    return {
      shopDayCostYtd,
      teamUtilizationPct: Math.round(avgUtil * 10) / 10,
      revenueYtd,
      activeTechCount: activeEmps.length,
      openJobCount: openFromJobs + openJobs.length,
      returnJobCount: returnCount,
      rescheduleJobCount: rescheduleCount,
      projectedAnnualSavings: projectedSavings,
      totalShopDaysUsed: activeEmps.reduce((s: number, e: any) => s + (e.shopDaysUsedYtd ?? 0), 0),
      totalShopDaysAllowed: activeEmps.reduce((s: number, e: any) => s + (e.allowedShopDays ?? 0), 0),
    };
  },
});

// Returns rows shaped for ProfitabilityPage: name, revenue, burdenCost, grossProfit, margin, utilization
export const employeeROI = query({
  args: {},
  handler: async (ctx) => {
    const [employees, jobs] = await Promise.all([
      ctx.db.query("employees").collect(),
      ctx.db.query("jobs").collect(),
    ]);
    const isCompleted = (j: any) => {
      const s = String(j.status ?? "").toLowerCase().trim();
      return s === "completed" || s === "complete" || s === "done" || s === "closed" || s === "finished" || s === "invoiced" || s === "paid";
    };
    const completedJobs = jobs.filter(isCompleted);
    const workingDaysYtd = Math.round((new Date().getMonth() + 1) * 21.67);

    return employees.filter((e: any) => e.isActive !== false).map((e: any) => {
      const empJobs = completedJobs.filter((j: any) => j.employeeId === e._id);
      const revenue = empJobs.reduce((s: number, j: any) => s + (Number(j.revenue) || Number(j.amount) || 0), 0);
      const dailyBurden = ((e.salary ?? 0) * 1.3 + 10000) / 260;
      const burdenCost = Math.round(dailyBurden * workingDaysYtd + (e.shopDaysUsedYtd ?? 0) * SHOP_DAY_RATE);
      const grossProfit = revenue - burdenCost;
      const margin = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;

      return {
        employeeId: e._id,
        name: e.name ?? "Unknown",
        role: e.role,
        revenue,
        burdenCost,
        grossProfit,
        margin,
        utilization: e.utilizationPct ?? 0,
        shopDaysUsed: e.shopDaysUsedYtd ?? 0,
        shopDaysAllowed: e.allowedShopDays ?? 0,
        jobCount: empJobs.length,
      };
    });
  },
});

// Returns rows shaped for ProfitabilityPage: title, description, impact
export const profitLeaks = query({
  args: {},
  handler: async (ctx) => {
    const employees = await ctx.db.query("employees").collect();
    const leaks: { title: string; description: string; impact: number; severity: string }[] = [];

    for (const e of employees) {
      if (!e.isActive) continue;
      const name = e.name ?? "Unknown";
      const util = e.utilizationPct ?? 0;
      const shopUsed = e.shopDaysUsedYtd ?? 0;
      const shopAllowed = e.allowedShopDays ?? 0;

      if (util < 80) {
        const dailyBurden = ((e.salary ?? 0) * 1.3 + 10000) / 260;
        const lostDays = Math.round((80 - util) / 100 * 260);
        leaks.push({
          title: `${name} — low utilization`,
          description: `Utilization at ${util}% — below the 80% target. Estimated ${lostDays} billable days lost YTD.`,
          impact: Math.round(lostDays * dailyBurden),
          severity: util < 60 ? "high" : "medium",
        });
      }
      if (shopUsed > shopAllowed) {
        const excess = shopUsed - shopAllowed;
        leaks.push({
          title: `${name} — excess shop days`,
          description: `${excess} shop day${excess !== 1 ? "s" : ""} over the ${shopAllowed}-day annual allowance.`,
          impact: excess * SHOP_DAY_RATE,
          severity: excess > 5 ? "high" : "medium",
        });
      }
    }
    return leaks;
  },
});

// Returns rows with jobCount and avgRevenue for ProfitabilityPage service chart
export const revenueByService = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    const isCompleted = (j: any) => {
      const s = String(j.status ?? "").toLowerCase().trim();
      return s === "completed" || s === "complete" || s === "done" || s === "closed" || s === "finished" || s === "invoiced" || s === "paid";
    };
    const completed = jobs.filter(isCompleted);

    const grouped: Record<string, { revenue: number; count: number }> = {};
    for (const j of completed) {
      const key = j.serviceType ?? "other";
      if (!grouped[key]) grouped[key] = { revenue: 0, count: 0 };
      grouped[key].revenue += Number(j.revenue) || Number((j as any).amount) || 0;
      grouped[key].count += 1;
    }

    return Object.entries(grouped).map(([serviceType, { revenue, count }]) => ({
      serviceType,
      revenue,
      jobCount: count,
      avgRevenue: count > 0 ? Math.round(revenue / count) : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  },
});

// Returns last 12 months of revenue + job counts for the trend chart
export const monthlyRevenue = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    const now = new Date();
    const months: { month: string; label: string; revenue: number; jobCount: number; completedCount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      months.push({ month: key, label, revenue: 0, jobCount: 0, completedCount: 0 });
    }
    for (const j of jobs) {
      const date = j.scheduledDate ?? "";
      if (!date) continue;
      const key = date.slice(0, 7); // "YYYY-MM"
      const slot = months.find(m => m.month === key);
      if (!slot) continue;
      slot.jobCount += 1;
      const isComp = ["completed","complete","done","closed","invoiced","paid"].includes(String(j.status ?? "").toLowerCase());
      if (isComp) {
        slot.revenue += Number(j.revenue) || Number((j as any).amount) || 0;
        slot.completedCount += 1;
      }
    }
    return months;
  },
});

// Returns recent jobs for the activity feed
export const recentJobs = query({
  args: {},
  handler: async (ctx) => {
    const [jobs, customers, employees] = await Promise.all([
      ctx.db.query("jobs").order("desc").take(15),
      ctx.db.query("customers").collect(),
      ctx.db.query("employees").collect(),
    ]);
    const custMap = Object.fromEntries(customers.map((c: any) => [c._id, c.name]));
    const empMap  = Object.fromEntries(employees.map((e: any) => [e._id, e.name]));
    return jobs.map((j: any) => ({
      _id: j._id,
      _creationTime: j._creationTime,
      customerName: custMap[j.customerId] ?? "Unknown",
      employeeName: j.employeeId ? (empMap[j.employeeId] ?? null) : null,
      serviceType: j.serviceType,
      status: j.status,
      revenue: Number(j.revenue) || 0,
      scheduledDate: j.scheduledDate ?? null,
      priority: j.priority ?? "normal",
    }));
  },
});

// Returns per-tech job counts for the workload panel
export const teamWorkload = query({
  args: {},
  handler: async (ctx) => {
    const [employees, jobs] = await Promise.all([
      ctx.db.query("employees").collect(),
      ctx.db.query("jobs").collect(),
    ]);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return employees
      .filter((e: any) => e.isActive !== false)
      .map((e: any) => {
        const allJobs   = jobs.filter((j: any) => j.employeeId === e._id);
        const thisMonth = allJobs.filter((j: any) => (j.scheduledDate ?? "").startsWith(monthKey));
        const completed = allJobs.filter((j: any) => ["completed","complete","done"].includes(String(j.status ?? "").toLowerCase()));
        return {
          employeeId: e._id,
          name: e.name ?? "Unknown",
          role: e.role ?? "",
          totalJobs: allJobs.length,
          thisMonthJobs: thisMonth.length,
          completedJobs: completed.length,
          revenue: completed.reduce((s: number, j: any) => s + (Number(j.revenue) || 0), 0),
        };
      })
      .sort((a: any, b: any) => b.totalJobs - a.totalJobs);
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
        employeeName: emp.name ?? "Unknown",
        certification: emp.certifications?.[0] ?? "any",
        date: job.scheduledDate,
        type: "job",
        revenue: job.revenue ?? 0,
        jobId: job._id,
        customerName: custMap[job.customerId]?.name ?? null,
        status: job.status,
      });
    }
    return entries;
  },
});
