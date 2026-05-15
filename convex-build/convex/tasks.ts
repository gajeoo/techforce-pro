import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { status: v.optional(v.string()), assignedTo: v.optional(v.string()) },
  handler: async (ctx, { status, assignedTo }) => {
    let tasks = await ctx.db.query("tasks").collect();
    if (status) tasks = tasks.filter((t: any) => t.status === status);
    if (assignedTo) tasks = tasks.filter((t: any) => t.assignedTo === assignedTo);
    return tasks;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    createdBy: v.string(),
    createdByRole: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    priority: v.optional(v.string()),
    status: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      createdBy: args.createdBy,
      createdByRole: args.createdByRole ?? "manager",
      assignedTo: args.assignedTo,
      priority: args.priority ?? "medium",
      status: args.status ?? "open",
      dueDate: args.dueDate,
      jobId: args.jobId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    priority: v.optional(v.string()),
    status: v.optional(v.string()),
    dueDate: v.optional(v.string()),
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
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
