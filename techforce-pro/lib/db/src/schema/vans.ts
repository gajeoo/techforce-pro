import { pgTable, serial, text, decimal, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vansTable = pgTable("vans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  licensePlate: text("license_plate").notNull(),
  make: text("make").notNull().default("Ford"),
  model: text("model").notNull().default("Transit"),
  year: integer("year").notNull().default(2022),
  color: text("color").notNull().default("White"),
  assignedEmployeeId: integer("assigned_employee_id"),
  gpsTrackerId: text("gps_tracker_id"),
  gpsTrackerSerial: text("gps_tracker_serial"),
  gpsTrackerModel: text("gps_tracker_model"),
  gpsTrackerInstalledAt: timestamp("gps_tracker_installed_at"),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  speed: integer("speed").notNull().default(0),
  heading: integer("heading").notNull().default(0),
  lastLocationUpdate: timestamp("last_location_update"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVanSchema = createInsertSchema(vansTable).omit({ id: true, createdAt: true });
export type InsertVan = z.infer<typeof insertVanSchema>;
export type Van = typeof vansTable.$inferSelect;
