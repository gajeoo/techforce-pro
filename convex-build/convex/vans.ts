import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const vans = await ctx.db.query("vans").collect();
    const employees = await ctx.db.query("employees").collect();
    const empMap = Object.fromEntries(employees.map((e: any) => [e._id, e]));
    return vans.map((van: any) => ({
      ...van,
      assignedEmployeeName: van.assignedEmployeeId ? (empMap[van.assignedEmployeeId]?.name ?? null) : null,
    }));
  },
});

export const get = query({
  args: { id: v.id("vans") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Simulated GPS locations — drifts position for vans with trackers
export const locations = mutation({
  args: {},
  handler: async (ctx) => {
    const vans = await ctx.db.query("vans").collect();
    const updated: any[] = [];
    for (const van of vans) {
      if (!van.gpsTrackerId) { updated.push(van); continue; }
      const lat = (van.lat ?? 39.2037) + (Math.random() - 0.5) * 0.001;
      const lng = (van.lng ?? -76.861) + (Math.random() - 0.5) * 0.001;
      const speed = Math.floor(Math.random() * 40);
      const heading = Math.floor(Math.random() * 360);
      await ctx.db.patch(van._id, { lat, lng, speed, heading, lastLocationUpdate: Date.now() });
      updated.push({ ...van, lat, lng, speed, heading });
    }
    return updated;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    licensePlate: v.string(),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    color: v.optional(v.string()),
    assignedEmployeeId: v.optional(v.id("employees")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vans", {
      name: args.name,
      licensePlate: args.licensePlate,
      make: args.make ?? "Ford",
      model: args.model ?? "Transit",
      year: args.year ?? 2022,
      color: args.color ?? "White",
      assignedEmployeeId: args.assignedEmployeeId,
      speed: 0,
      heading: 0,
      status: "active",
      notes: args.notes,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("vans"),
    name: v.optional(v.string()),
    licensePlate: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    color: v.optional(v.string()),
    assignedEmployeeId: v.optional(v.id("employees")),
    status: v.optional(v.string()),
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
  args: { id: v.id("vans") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const installTracker = mutation({
  args: {
    id: v.id("vans"),
    gpsTrackerSerial: v.string(),
    gpsTrackerModel: v.string(),
  },
  handler: async (ctx, { id, gpsTrackerSerial, gpsTrackerModel }) => {
    const trackerId = `GPS-${Date.now()}`;
    await ctx.db.patch(id, {
      gpsTrackerId: trackerId,
      gpsTrackerSerial,
      gpsTrackerModel,
      gpsTrackerInstalledAt: Date.now(),
      lat: 39.2037 + (Math.random() - 0.5) * 0.05,
      lng: -76.861 + (Math.random() - 0.5) * 0.05,
    });
    return await ctx.db.get(id);
  },
});

export const removeTracker = mutation({
  args: { id: v.id("vans") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      gpsTrackerId: undefined,
      gpsTrackerSerial: undefined,
      gpsTrackerModel: undefined,
      gpsTrackerInstalledAt: undefined,
      lat: undefined,
      lng: undefined,
    });
    return await ctx.db.get(id);
  },
});
