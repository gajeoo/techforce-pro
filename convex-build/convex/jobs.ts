import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

async function enrichJob(ctx: any, job: any) {
  const customer = await ctx.db.get(job.customerId);
  let employeeName: string | null = null;
  if (job.employeeId) {
    const emp = await ctx.db.get(job.employeeId);
    employeeName = emp?.name ?? null;
  }
  return {
    ...job,
    customerName: customer?.name ?? "Unknown",
    customerAddress: customer?.address ?? "",
    employeeName,
  };
}

export const list = query({
  args: {
    status: v.optional(v.string()),
    employeeId: v.optional(v.id("employees")),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let jobs = await ctx.db.query("jobs").collect();
    if (args.status) jobs = jobs.filter((j: any) => j.status === args.status);
    if (args.employeeId) jobs = jobs.filter((j: any) => j.employeeId === args.employeeId);
    if (args.date) jobs = jobs.filter((j: any) => j.scheduledDate === args.date);
    const customers = await ctx.db.query("customers").collect();
    const employees = await ctx.db.query("employees").collect();
    const custMap = Object.fromEntries(customers.map((c: any) => [c._id, c]));
    const empMap = Object.fromEntries(employees.map((e: any) => [e._id, e]));
    return jobs.map((j: any) => ({
      ...j,
      customerName: custMap[j.customerId]?.name ?? "Unknown",
      customerAddress: custMap[j.customerId]?.address ?? "",
      employeeName: j.employeeId ? (empMap[j.employeeId]?.name ?? null) : null,
      revenue: Number(j.revenue) || Number(j.amount) || 0,
    }));
  },
});

export const get = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job) return null;
    return await enrichJob(ctx, job);
  },
});

export const listReturns = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    const returns = jobs.filter((j: any) => j.status === "return" || j.status === "will_return");
    const customers = await ctx.db.query("customers").collect();
    const employees = await ctx.db.query("employees").collect();
    const custMap = Object.fromEntries(customers.map((c: any) => [c._id, c]));
    const empMap = Object.fromEntries(employees.map((e: any) => [e._id, e]));
    return returns.map((j: any) => ({
      ...j,
      customerName: custMap[j.customerId]?.name ?? "Unknown",
      customerAddress: custMap[j.customerId]?.address ?? "",
      employeeName: j.employeeId ? (empMap[j.employeeId]?.name ?? null) : null,
    }));
  },
});

export const listReschedules = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    const reschedules = jobs.filter((j: any) => j.status === "reschedule");
    const customers = await ctx.db.query("customers").collect();
    const employees = await ctx.db.query("employees").collect();
    const custMap = Object.fromEntries(customers.map((c: any) => [c._id, c]));
    const empMap = Object.fromEntries(employees.map((e: any) => [e._id, e]));
    return reschedules.map((j: any) => ({
      ...j,
      customerName: custMap[j.customerId]?.name ?? "Unknown",
      customerAddress: custMap[j.customerId]?.address ?? "",
      employeeName: j.employeeId ? (empMap[j.employeeId]?.name ?? null) : null,
    }));
  },
});

export const create = mutation({
  args: {
    customerId: v.id("customers"),
    employeeId: v.optional(v.id("employees")),
    locationId: v.optional(v.id("customerLocations")),
    locationName: v.optional(v.string()),
    serviceType: v.string(),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    scheduledDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    revenue: v.optional(v.number()),
    quantity: v.optional(v.number()),
    notes: v.optional(v.string()),
    certificationRequired: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Try to get revenue from customer pricing if not provided
    let revenue = args.revenue ?? 0;
    if (!args.revenue) {
      const pricing = await ctx.db.query("customerPricing").withIndex("by_customer", (q: any) => q.eq("customerId", args.customerId)).collect();
      const match = pricing.find((p: any) => p.serviceType === args.serviceType);
      if (match) revenue = match.customerRate;
    }
    return await ctx.db.insert("jobs", {
      customerId: args.customerId,
      employeeId: args.employeeId,
      locationId: args.locationId,
      locationName: args.locationName,
      serviceType: args.serviceType,
      status: args.status ?? "pending",
      priority: args.priority ?? "medium",
      scheduledDate: args.scheduledDate,
      dueDate: args.dueDate,
      scheduledTime: args.scheduledTime,
      revenue,
      quantity: args.quantity ?? 1,
      notes: args.notes,
      requiresFollowUp: false,
      followUpConfirmed: false,
      certificationRequired: args.certificationRequired ?? "any",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("jobs"),
    employeeId: v.optional(v.id("employees")),
    locationId: v.optional(v.id("customerLocations")),
    locationName: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    scheduledDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    revenue: v.optional(v.number()),
    quantity: v.optional(v.number()),
    notes: v.optional(v.string()),
    nonComplianceReason: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const job = await ctx.db.get(id);
    if (!job) throw new Error("Job not found");

    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }

    // Auto-create invoice when completing
    if (fields.status === "completed" && job.status !== "completed") {
      const customer = await ctx.db.get(job.customerId);
      const effectiveRevenue = fields.revenue ?? job.revenue;
      if (customer && effectiveRevenue > 0) {
        const num = `MC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;
        await ctx.db.insert("invoices", {
          invoiceNumber: num,
          customerId: job.customerId,
          jobId: id,
          techId: fields.employeeId ?? job.employeeId,
          lineItems: [{ service: job.serviceType, quantity: 1, rate: effectiveRevenue, total: effectiveRevenue }],
          totalAmount: effectiveRevenue,
          status: "draft",
        });
      }
    }

    await ctx.db.patch(id, patch);
    return await enrichJob(ctx, await ctx.db.get(id));
  },
});

export const remove = mutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const confirmFollowup = mutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { followUpConfirmed: true });
  },
});
