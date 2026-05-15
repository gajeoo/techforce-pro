import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const openJobs = await ctx.db.query("openJobs").collect();
    const employees = await ctx.db.query("employees").collect();
    const empMap = Object.fromEntries(employees.map((e: any) => [e._id, e]));
    return openJobs.map((oj: any) => ({
      ...oj,
      assignedEmployeeName: oj.assignedEmployeeId ? (empMap[oj.assignedEmployeeId]?.name ?? null) : null,
      coTechnicianNames: (oj.coTechnicianIds ?? []).map((id: string) => empMap[id]?.name ?? "Unknown"),
    }));
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    clientName: v.string(),
    clientAddress: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    certRequired: v.optional(v.string()),
    priority: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("openJobs", {
      title: args.title,
      clientName: args.clientName,
      clientAddress: args.clientAddress,
      zipCode: args.zipCode,
      certRequired: args.certRequired ?? "any",
      priority: args.priority ?? "medium",
      notes: args.notes,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("openJobs"),
    title: v.optional(v.string()),
    clientName: v.optional(v.string()),
    clientAddress: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    certRequired: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignedEmployeeId: v.optional(v.id("employees")),
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
  args: { id: v.id("openJobs") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// Auto-assign: match open jobs to eligible employees by cert + shop day availability
export const autoAssign = mutation({
  args: {},
  handler: async (ctx) => {
    const [openJobs, employees] = await Promise.all([
      ctx.db.query("openJobs").collect(),
      ctx.db.query("employees").collect(),
    ]);
    let assigned = 0;
    for (const oj of openJobs) {
      if (oj.assignedEmployeeId) continue;
      const eligible = employees.filter((e: any) => {
        if (!e.isActive) return false;
        if (e.shopDaysUsedYtd >= e.allowedShopDays) return false;
        if (oj.certRequired === "any") return true;
        return e.certifications.includes(oj.certRequired);
      });
      if (eligible.length > 0) {
        const pick = eligible[Math.floor(Math.random() * eligible.length)];
        await ctx.db.patch(oj._id, { assignedEmployeeId: pick._id });
        assigned++;
      }
    }
    return { assigned };
  },
});

// Emergency assign: give all unassigned open jobs to one employee
export const emergencyAssign = mutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, { employeeId }) => {
    const openJobs = await ctx.db.query("openJobs").collect();
    let assigned = 0;
    for (const oj of openJobs) {
      if (!oj.assignedEmployeeId) {
        await ctx.db.patch(oj._id, { assignedEmployeeId: employeeId });
        assigned++;
      }
    }
    return { assigned };
  },
});

// Fill shop days: assign jobs up to each tech's remaining shop day allowance
export const fillShopDays = mutation({
  args: {},
  handler: async (ctx) => {
    const [openJobs, employees] = await Promise.all([
      ctx.db.query("openJobs").collect(),
      ctx.db.query("employees").collect(),
    ]);
    const unassigned = openJobs.filter((oj: any) => !oj.assignedEmployeeId);
    let assigned = 0;
    let jobIndex = 0;
    for (const emp of employees) {
      if (!emp.isActive) continue;
      const remaining = emp.allowedShopDays - emp.shopDaysUsedYtd;
      for (let i = 0; i < remaining && jobIndex < unassigned.length; i++, jobIndex++) {
        await ctx.db.patch(unassigned[jobIndex]._id, { assignedEmployeeId: emp._id });
        assigned++;
      }
    }
    return { assigned };
  },
});
