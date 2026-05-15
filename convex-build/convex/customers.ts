import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("customers").collect();
  },
});

export const get = query({
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    facilityType: v.string(),
    address: v.string(),
    contactName: v.string(),
    contactPhone: v.string(),
    contactEmail: v.optional(v.string()),
    inspectionFrequency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("customers", {
      name: args.name,
      facilityType: args.facilityType,
      address: args.address,
      contactName: args.contactName,
      contactPhone: args.contactPhone,
      contactEmail: args.contactEmail,
      inspectionFrequency: args.inspectionFrequency ?? "annual",
      isActive: true,
    });
    // Auto-create primary location
    await ctx.db.insert("customerLocations", {
      customerId: id,
      name: "Main Location",
      address: args.address,
      isPrimary: true,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    facilityType: v.optional(v.string()),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    inspectionFrequency: v.optional(v.string()),
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
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => {
    // Delete locations
    const locs = await ctx.db.query("customerLocations").withIndex("by_customer", (q) => q.eq("customerId", id)).collect();
    for (const l of locs) await ctx.db.delete(l._id);
    // Delete pricing
    const pricing = await ctx.db.query("customerPricing").withIndex("by_customer", (q) => q.eq("customerId", id)).collect();
    for (const p of pricing) await ctx.db.delete(p._id);
    await ctx.db.delete(id);
  },
});

// Locations
export const listLocations = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    return await ctx.db.query("customerLocations").withIndex("by_customer", (q) => q.eq("customerId", customerId)).collect();
  },
});

export const createLocation = mutation({
  args: {
    customerId: v.id("customers"),
    name: v.string(),
    address: v.string(),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customerLocations", {
      customerId: args.customerId,
      name: args.name,
      address: args.address,
      contactName: args.contactName,
      contactPhone: args.contactPhone,
      isPrimary: args.isPrimary ?? false,
    });
  },
});

export const updateLocation = mutation({
  args: {
    id: v.id("customerLocations"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
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

export const deleteLocation = mutation({
  args: { id: v.id("customerLocations") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// Pricing
export const listPricing = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    return await ctx.db.query("customerPricing").withIndex("by_customer", (q) => q.eq("customerId", customerId)).collect();
  },
});

export const upsertPricing = mutation({
  args: {
    customerId: v.id("customers"),
    serviceType: v.string(),
    customerRate: v.number(),
    standardRate: v.number(),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("customerPricing").withIndex("by_customer", (q) => q.eq("customerId", args.customerId)).collect();
    const found = existing.find((p) => p.serviceType === args.serviceType);
    if (found) {
      await ctx.db.patch(found._id, { customerRate: args.customerRate, standardRate: args.standardRate, unit: args.unit ?? "flat" });
      return found._id;
    }
    return await ctx.db.insert("customerPricing", {
      customerId: args.customerId,
      serviceType: args.serviceType,
      customerRate: args.customerRate,
      standardRate: args.standardRate,
      unit: args.unit ?? "flat",
    });
  },
});

// Customer jobs
export const listJobs = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const jobs = await ctx.db.query("jobs").withIndex("by_customer", (q) => q.eq("customerId", customerId)).collect();
    const employees = await ctx.db.query("employees").collect();
    const empMap = Object.fromEntries(employees.map((e) => [e._id, e]));
    const customer = await ctx.db.get(customerId);
    return jobs.map((j) => ({
      ...j,
      customerName: customer?.name ?? "Unknown",
      customerAddress: customer?.address ?? "",
      employeeName: j.employeeId ? (empMap[j.employeeId]?.name ?? null) : null,
    }));
  },
});

// Customer invoices
export const listInvoices = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const invoices = await ctx.db.query("invoices").withIndex("by_customer", (q) => q.eq("customerId", customerId)).collect();
    const customer = await ctx.db.get(customerId);
    return invoices.map((i) => ({
      ...i,
      customerName: customer?.name ?? "Unknown",
    }));
  },
});
