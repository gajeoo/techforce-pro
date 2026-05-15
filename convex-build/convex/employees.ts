import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("employees").collect();
  },
});

export const get = query({
  args: { id: v.id("employees") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    salary: v.number(),
    billableRate: v.number(),
    homeZip: v.string(),
    certifications: v.array(v.string()),
    allowedShopDays: v.number(),
    shopDaysUsedYtd: v.optional(v.number()),
    allowedTrainingDays: v.optional(v.number()),
    trainingDaysUsedYtd: v.optional(v.number()),
    utilizationPct: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("employees", {
      name: args.name,
      role: args.role,
      salary: args.salary,
      billableRate: args.billableRate,
      homeZip: args.homeZip,
      certifications: args.certifications,
      allowedShopDays: args.allowedShopDays,
      shopDaysUsedYtd: args.shopDaysUsedYtd ?? 0,
      allowedTrainingDays: args.allowedTrainingDays ?? 3,
      trainingDaysUsedYtd: args.trainingDaysUsedYtd ?? 0,
      utilizationPct: args.utilizationPct ?? 0,
      isActive: args.isActive ?? true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("employees"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    salary: v.optional(v.number()),
    billableRate: v.optional(v.number()),
    homeZip: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
    allowedShopDays: v.optional(v.number()),
    shopDaysUsedYtd: v.optional(v.number()),
    allowedTrainingDays: v.optional(v.number()),
    trainingDaysUsedYtd: v.optional(v.number()),
    utilizationPct: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) patch[k] = v;
    }
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("employees") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const getSchedule = query({
  args: { id: v.id("employees"), date: v.optional(v.string()) },
  handler: async (ctx, { id, date }) => {
    let jobsQuery = ctx.db.query("jobs").withIndex("by_employee", (q) => q.eq("employeeId", id));
    const jobs = await jobsQuery.collect();
    const filtered = date ? jobs.filter((j) => j.scheduledDate === date) : jobs;
    const customers = await ctx.db.query("customers").collect();
    const custMap = Object.fromEntries(customers.map((c) => [c._id, c]));
    return filtered.map((j) => ({
      ...j,
      customerName: custMap[j.customerId]?.name ?? "Unknown",
      customerAddress: custMap[j.customerId]?.address ?? "",
    }));
  },
});
