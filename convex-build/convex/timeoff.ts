import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { employeeId: v.optional(v.id("employees")) },
  handler: async (ctx, { employeeId }) => {
    let requests = await ctx.db.query("timeOffRequests").collect();
    if (employeeId) requests = requests.filter((r: any) => r.employeeId === employeeId);
    const employees = await ctx.db.query("employees").collect();
    const empMap = Object.fromEntries(employees.map((e: any) => [e._id, e]));
    return requests.map((r: any) => ({
      ...r,
      employeeName: empMap[r.employeeId]?.name ?? "Unknown",
      employeeRole: empMap[r.employeeId]?.role ?? "",
    }));
  },
});

export const create = mutation({
  args: {
    employeeId: v.id("employees"),
    requestedDate: v.string(),
    endDate: v.optional(v.string()),
    type: v.optional(v.string()),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new Error("Employee not found");

    // Auto-deny rules
    if (employee.utilizationPct < 85) {
      return await ctx.db.insert("timeOffRequests", {
        ...args,
        type: args.type ?? "shop-day",
        status: "denied",
        denialReason: "Utilization below 85% threshold",
      });
    }
    if (employee.shopDaysUsedYtd >= employee.allowedShopDays) {
      return await ctx.db.insert("timeOffRequests", {
        ...args,
        type: args.type ?? "shop-day",
        status: "denied",
        denialReason: "Annual shop day allowance exhausted",
      });
    }

    // Check for job conflicts
    const jobs = await ctx.db.query("jobs").withIndex("by_employee", (q: any) => q.eq("employeeId", args.employeeId)).collect();
    const conflict = jobs.some((j: any) => j.scheduledDate === args.requestedDate && j.status === "pending");
    if (conflict) {
      return await ctx.db.insert("timeOffRequests", {
        ...args,
        type: args.type ?? "shop-day",
        status: "denied",
        denialReason: "Scheduled job conflicts with requested date",
      });
    }

    return await ctx.db.insert("timeOffRequests", {
      ...args,
      type: args.type ?? "shop-day",
      status: "pending",
    });
  },
});

export const review = mutation({
  args: {
    id: v.id("timeOffRequests"),
    action: v.union(v.literal("approve"), v.literal("deny")),
    reviewedBy: v.string(),
    reviewNote: v.optional(v.string()),
    denialReason: v.optional(v.string()),
  },
  handler: async (ctx, { id, action, reviewedBy, reviewNote, denialReason }) => {
    const req = await ctx.db.get(id);
    if (!req) throw new Error("Request not found");
    if (action === "approve") {
      await ctx.db.patch(id, { status: "approved", reviewedBy, reviewNote });
      // Increment shopDaysUsedYtd
      const emp = await ctx.db.get(req.employeeId);
      if (emp) await ctx.db.patch(req.employeeId, { shopDaysUsedYtd: emp.shopDaysUsedYtd + 1 });
    } else {
      await ctx.db.patch(id, { status: "denied", reviewedBy, reviewNote, denialReason });
    }
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("timeOffRequests") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return { success: true };
  },
});
