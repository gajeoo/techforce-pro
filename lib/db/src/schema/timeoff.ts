import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timeOffRequestsTable = pgTable("time_off_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  requestedDate: date("requested_date").notNull(),
  endDate: date("end_date"),
  type: text("type").notNull().default("shop-day"),
  reason: text("reason"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  denialReason: text("denial_reason"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTimeOffSchema = createInsertSchema(timeOffRequestsTable).omit({ id: true, createdAt: true });
export type InsertTimeOff = z.infer<typeof insertTimeOffSchema>;
export type TimeOffRequest = typeof timeOffRequestsTable.$inferSelect;
