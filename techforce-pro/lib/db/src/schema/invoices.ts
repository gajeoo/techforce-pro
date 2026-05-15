import { pgTable, serial, text, integer, decimal, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: integer("customer_id").notNull(),
  jobId: integer("job_id"),
  techId: integer("tech_id"),
  lineItems: jsonb("line_items").$type<Array<{ service: string; quantity: number; rate: number; total: number }>>().notNull().default([]),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("draft"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const invoiceTemplateTable = pgTable("invoice_template", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("Multicorp Fire Protection Services"),
  address: text("address").notNull().default("9693 Gerwig Lane, Columbia, MD 21046"),
  phone: text("phone").notNull().default("(410) 876-5000"),
  logoUrl: text("logo_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, generatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoiceTemplate = typeof invoiceTemplateTable.$inferSelect;
