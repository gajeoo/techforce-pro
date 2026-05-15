import { pgTable, serial, text, decimal, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  salary: decimal("salary", { precision: 10, scale: 2 }).notNull(),
  billableRate: decimal("billable_rate", { precision: 10, scale: 2 }).notNull(),
  homeZip: text("home_zip").notNull(),
  certifications: jsonb("certifications").$type<string[]>().notNull().default([]),
  allowedShopDays: integer("allowed_shop_days").notNull().default(5),
  shopDaysUsedYtd: integer("shop_days_used_ytd").notNull().default(0),
  allowedTrainingDays: integer("allowed_training_days").notNull().default(3),
  trainingDaysUsedYtd: integer("training_days_used_ytd").notNull().default(0),
  utilizationPct: decimal("utilization_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  hoursPerDay: decimal("hours_per_day", { precision: 4, scale: 2 }).notNull().default("8"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
