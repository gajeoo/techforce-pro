import { pgTable, serial, text, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  facilityType: text("facility_type").notNull(),
  address: text("address").notNull(),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email"),
  inspectionFrequency: text("inspection_frequency").notNull().default("annual"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customerPricingTable = pgTable("customer_pricing", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  serviceType: text("service_type").notNull(),
  customerRate: decimal("customer_rate", { precision: 10, scale: 2 }).notNull(),
  standardRate: decimal("standard_rate", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("flat"),
});

export const customerLocationsTable = pgTable("customer_locations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  name: text("name").notNull().default("Main Location"),
  address: text("address").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
export type CustomerPricing = typeof customerPricingTable.$inferSelect;
export type CustomerLocation = typeof customerLocationsTable.$inferSelect;
