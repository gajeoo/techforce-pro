import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function calcNextOccurrence(startDate: string, intervalType: string, customDays?: number): string {
  const d = new Date(startDate);
  if (intervalType === "6months") d.setMonth(d.getMonth() + 6);
  else if (intervalType === "1year") d.setFullYear(d.getFullYear() + 1);
  else if (intervalType === "custom" && customDays) d.setDate(d.getDate() + customDays);
  return d.toISOString().slice(0, 10);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const schedules = await ctx.db.query("recurringSchedules").collect();
    const [customers, employees] = await Promise.all([
      ctx.db.query("customers").collect(),
      ctx.db.query("employees").collect(),
    ]);
    const custMap = Object.fromEntries(customers.map((c: any) => [c._id, c]));
    const empMap = Object.fromEntries(employees.map((e: any) => [e._id, e]));
    return schedules.map((s: any) => ({
      ...s,
      customerName: custMap[s.customerId]?.name ?? "Unknown",
      employeeName: s.employeeId ? (empMap[s.employeeId]?.name ?? null) : null,
    }));
  },
});

export const create = mutation({
  args: {
    customerId: v.id("customers"),
    employeeId: v.optional(v.id("employees")),
    serviceType: v.string(),
    intervalType: v.string(),
    customDays: v.optional(v.number()),
    startDate: v.string(),
    revenue: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const nextOccurrence = calcNextOccurrence(args.startDate, args.intervalType, args.customDays);
    return await ctx.db.insert("recurringSchedules", {
      customerId: args.customerId,
      employeeId: args.employeeId,
      serviceType: args.serviceType,
      intervalType: args.intervalType,
      customDays: args.customDays,
      startDate: args.startDate,
      nextOccurrence,
      status: "active",
      revenue: args.revenue ?? 0,
      notes: args.notes,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("recurringSchedules"),
    employeeId: v.optional(v.id("employees")),
    serviceType: v.optional(v.string()),
    intervalType: v.optional(v.string()),
    customDays: v.optional(v.number()),
    revenue: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("recurringSchedules") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const pause = mutation({
  args: { id: v.id("recurringSchedules") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "paused" });
    return await ctx.db.get(id);
  },
});

export const resume = mutation({
  args: { id: v.id("recurringSchedules") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "active" });
    return await ctx.db.get(id);
  },
});
