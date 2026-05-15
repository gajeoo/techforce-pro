import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { calendarOwner: v.optional(v.string()), date: v.optional(v.string()) },
  handler: async (ctx, { calendarOwner, date }) => {
    let appts = await ctx.db.query("appointments").collect();
    if (calendarOwner) appts = appts.filter((a: any) => a.calendarOwner === calendarOwner);
    if (date) appts = appts.filter((a: any) => a.date === date);
    return appts;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    type: v.optional(v.string()),
    participants: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    calendarOwner: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("appointments", {
      title: args.title,
      description: args.description,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      type: args.type ?? "meeting",
      participants: args.participants,
      location: args.location,
      notes: args.notes,
      createdBy: args.createdBy,
      calendarOwner: args.calendarOwner ?? "manager",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("appointments"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    type: v.optional(v.string()),
    participants: v.optional(v.string()),
    location: v.optional(v.string()),
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
  args: { id: v.id("appointments") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
