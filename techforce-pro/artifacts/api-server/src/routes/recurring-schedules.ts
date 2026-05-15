import { Router } from "express";
import { db } from "@workspace/db";
import { recurringSchedulesTable, customersTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const RecurringScheduleInputSchema = z.object({
  customerId:     z.number().int(),
  employeeId:     z.number().int().nullable().optional(),
  serviceType:    z.string().min(1),
  intervalType:   z.enum(["6months", "1year", "custom"]),
  customDays:     z.number().int().positive().nullable().optional(),
  startDate:      z.string(),
  revenue:        z.number().nonnegative().optional().default(0),
  notes:          z.string().nullable().optional(),
});

const RecurringScheduleUpdateSchema = z.object({
  employeeId:     z.number().int().nullable().optional(),
  serviceType:    z.string().optional(),
  intervalType:   z.enum(["6months", "1year", "custom"]).optional(),
  customDays:     z.number().int().positive().nullable().optional(),
  nextOccurrence: z.string().optional(),
  revenue:        z.number().nonnegative().optional(),
  notes:          z.string().nullable().optional(),
});

function computeNextOccurrence(from: string, intervalType: string, customDays?: number | null): string {
  const d = new Date(from + "T12:00:00Z");
  if (intervalType === "6months") d.setMonth(d.getMonth() + 6);
  else if (intervalType === "1year") d.setFullYear(d.getFullYear() + 1);
  else if (intervalType === "custom" && customDays) d.setDate(d.getDate() + customDays);
  return d.toISOString().slice(0, 10);
}

async function enrichSchedule(s: typeof recurringSchedulesTable.$inferSelect) {
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, s.customerId));
  let employeeName: string | null = null;
  if (s.employeeId) {
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, s.employeeId));
    employeeName = emp?.name ?? null;
  }
  return {
    ...s,
    revenue: Number(s.revenue),
    customerName: customer?.name ?? "Unknown",
    employeeName,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/recurring-schedules", async (req, res) => {
  const rows = await db.select().from(recurringSchedulesTable).orderBy(recurringSchedulesTable.nextOccurrence);
  const customers = await db.select().from(customersTable);
  const employees = await db.select().from(employeesTable);
  const cMap = Object.fromEntries(customers.map(c => [c.id, c]));
  const eMap = Object.fromEntries(employees.map(e => [e.id, e]));
  res.json(rows.map(s => ({
    ...s,
    revenue: Number(s.revenue),
    customerName: cMap[s.customerId]?.name ?? "Unknown",
    employeeName: s.employeeId ? (eMap[s.employeeId]?.name ?? null) : null,
    createdAt: s.createdAt.toISOString(),
  })));
});

router.post("/recurring-schedules", async (req, res) => {
  const body = RecurringScheduleInputSchema.parse(req.body);
  const nextOccurrence = computeNextOccurrence(body.startDate, body.intervalType, body.customDays);
  const [inserted] = await db.insert(recurringSchedulesTable).values({
    customerId:     body.customerId,
    employeeId:     body.employeeId ?? null,
    serviceType:    body.serviceType,
    intervalType:   body.intervalType,
    customDays:     body.customDays ?? null,
    startDate:      body.startDate,
    nextOccurrence,
    status:         "active",
    revenue:        String(body.revenue ?? 0),
    notes:          body.notes ?? null,
  }).returning();
  const enriched = await enrichSchedule(inserted);
  res.status(201).json(enriched);
});

router.get("/recurring-schedules/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(recurringSchedulesTable).where(eq(recurringSchedulesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichSchedule(row));
});

router.put("/recurring-schedules/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = RecurringScheduleUpdateSchema.parse(req.body);
  const updates: Record<string, unknown> = {};
  if (body.employeeId !== undefined) updates.employeeId = body.employeeId;
  if (body.serviceType !== undefined) updates.serviceType = body.serviceType;
  if (body.intervalType !== undefined) updates.intervalType = body.intervalType;
  if (body.customDays !== undefined) updates.customDays = body.customDays;
  if (body.nextOccurrence !== undefined) updates.nextOccurrence = body.nextOccurrence;
  if (body.revenue !== undefined) updates.revenue = String(body.revenue);
  if (body.notes !== undefined) updates.notes = body.notes;
  const [updated] = await db.update(recurringSchedulesTable).set(updates).where(eq(recurringSchedulesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichSchedule(updated));
});

router.delete("/recurring-schedules/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(recurringSchedulesTable).where(eq(recurringSchedulesTable.id, id));
  res.status(204).send();
});

router.post("/recurring-schedules/:id/pause", async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db.update(recurringSchedulesTable).set({ status: "paused" }).where(eq(recurringSchedulesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichSchedule(updated));
});

router.post("/recurring-schedules/:id/resume", async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db.update(recurringSchedulesTable).set({ status: "active" }).where(eq(recurringSchedulesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichSchedule(updated));
});

export default router;
