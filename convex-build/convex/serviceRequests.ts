import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { customerId: v.optional(v.id("customers")), status: v.optional(v.string()) },
  handler: async (ctx, { customerId, status }) => {
    let reqs = await ctx.db.query("serviceRequests").collect();
    if (customerId) reqs = reqs.filter((r: any) => r.customerId === customerId);
    if (status) reqs = reqs.filter((r: any) => r.status === status);
    const customers = await ctx.db.query("customers").collect();
    const custMap = Object.fromEntries(customers.map((c: any) => [c._id, c]));
    return reqs.map((r: any) => ({ ...r, customerName: custMap[r.customerId]?.name ?? "Unknown" }));
  },
});

export const create = mutation({
  args: {
    customerId: v.id("customers"),
    serviceType: v.string(),
    urgency: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("serviceRequests", {
      customerId: args.customerId,
      serviceType: args.serviceType,
      urgency: args.urgency ?? "normal",
      description: args.description,
      status: "pending",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("serviceRequests"),
    status: v.optional(v.string()),
    fulfilledJobId: v.optional(v.id("jobs")),
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
  args: { id: v.id("serviceRequests") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return { success: true };
  },
});
