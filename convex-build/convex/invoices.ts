import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { customerId: v.optional(v.id("customers")) },
  handler: async (ctx, { customerId }) => {
    let invoices = await ctx.db.query("invoices").collect();
    if (customerId) invoices = invoices.filter((i: any) => i.customerId === customerId);
    const customers = await ctx.db.query("customers").collect();
    const employees = await ctx.db.query("employees").collect();
    const custMap = Object.fromEntries(customers.map((c: any) => [c._id, c]));
    const empMap = Object.fromEntries(employees.map((e: any) => [e._id, e]));
    return invoices.map((i: any) => ({
      ...i,
      customerName: custMap[i.customerId]?.name ?? "Unknown",
      techName: i.techId ? (empMap[i.techId]?.name ?? null) : null,
    }));
  },
});

export const get = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, { id }) => {
    const inv = await ctx.db.get(id);
    if (!inv) return null;
    const customer = await ctx.db.get(inv.customerId);
    const tech = inv.techId ? await ctx.db.get(inv.techId) : null;
    return { ...inv, customerName: customer?.name ?? "Unknown", techName: tech?.name ?? null };
  },
});

export const create = mutation({
  args: {
    customerId: v.id("customers"),
    jobId: v.optional(v.id("jobs")),
    techId: v.optional(v.id("employees")),
    lineItems: v.array(v.object({ service: v.string(), quantity: v.number(), rate: v.number(), total: v.number() })),
    totalAmount: v.number(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const num = `MC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;
    return await ctx.db.insert("invoices", {
      invoiceNumber: num,
      customerId: args.customerId,
      jobId: args.jobId,
      techId: args.techId,
      lineItems: args.lineItems,
      totalAmount: args.totalAmount,
      status: args.status ?? "draft",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("invoices"),
    status: v.optional(v.string()),
    techId: v.optional(v.id("employees")),
    lineItems: v.optional(v.array(v.object({ service: v.string(), quantity: v.number(), rate: v.number(), total: v.number() }))),
    totalAmount: v.optional(v.number()),
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

export const getTemplate = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query("invoiceTemplate").collect();
    return templates[0] ?? {
      companyName: "Multicorp Fire Protection Services",
      address: "9693 Gerwig Lane, Columbia, MD 21046",
      phone: "(410) 876-5000",
      logoUrl: null,
    };
  },
});

export const updateTemplate = mutation({
  args: {
    companyName: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const templates = await ctx.db.query("invoiceTemplate").collect();
    if (templates[0]) {
      await ctx.db.patch(templates[0]._id, args);
    } else {
      await ctx.db.insert("invoiceTemplate", {
        companyName: args.companyName ?? "Multicorp Fire Protection Services",
        address: args.address ?? "9693 Gerwig Lane, Columbia, MD 21046",
        phone: args.phone ?? "(410) 876-5000",
        logoUrl: args.logoUrl,
      });
    }
  },
});
