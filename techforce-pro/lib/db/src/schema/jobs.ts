import { pgTable, serial, text, integer, decimal, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  employeeId: integer("employee_id"),
  coTechnicianIds: text("co_technician_ids"),
  locationId: integer("location_id"),
  locationName: text("location_name"),
  serviceType: text("service_type").notNull(),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  scheduledDate: date("scheduled_date"),
  dueDate: date("due_date"),
  scheduledTime: text("scheduled_time"),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).notNull().default("0"),
  quantity: integer("quantity").notNull().default(1),
  notes: text("notes"),
  requiresFollowUp: boolean("requires_follow_up").notNull().default(false),
  followUpConfirmed: boolean("follow_up_confirmed").notNull().default(false),
  certificationRequired: text("certification_required").notNull().default("any"),
  nonComplianceReason: text("non_compliance_reason"),
  nonComplianceNotifiedAt: timestamp("non_compliance_notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const openJobsTable = pgTable("open_jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  clientAddress: text("client_address"),
  zipCode: text("zip_code"),
  certRequired: text("cert_required").notNull().default("any"),
  priority: text("priority").notNull().default("medium"),
  assignedEmployeeId: integer("assigned_employee_id"),
  coTechnicianIds: text("co_technician_ids"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const recurringSchedulesTable = pgTable("recurring_schedules", {
  id:             serial("id").primaryKey(),
  customerId:     integer("customer_id").notNull(),
  employeeId:     integer("employee_id"),
  serviceType:    text("service_type").notNull(),
  intervalType:   text("interval_type").notNull().default("1year"),
  customDays:     integer("custom_days"),
  startDate:      date("start_date").notNull(),
  nextOccurrence: date("next_occurrence").notNull(),
  status:         text("status").notNull().default("active"),
  revenue:        decimal("revenue", { precision: 10, scale: 2 }).notNull().default("0"),
  notes:          text("notes"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
export type OpenJob = typeof openJobsTable.$inferSelect;
export type RecurringSchedule = typeof recurringSchedulesTable.$inferSelect;
