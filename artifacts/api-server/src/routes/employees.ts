import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, jobsTable, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function calcAllowedShopDays(role: string): number {
  if (role === "suppression_lead") return 2;
  if (role === "sprinkler_tech") return 3;
  if (role === "extinguisher_tech") return 5;
  if (role === "helper") return 12;
  return 0;
}

function mapEmp(e: typeof employeesTable.$inferSelect) {
  return {
    ...e,
    salary: Number(e.salary),
    billableRate: Number(e.billableRate),
    utilizationPct: Number(e.utilizationPct),
    hourlyRate: e.hourlyRate !== null ? Number(e.hourlyRate) : null,
    hoursPerDay: Number(e.hoursPerDay ?? 8),
  };
}

router.get("/employees", async (_req, res) => {
  const employees = await db.select().from(employeesTable).orderBy(employeesTable.name);
  res.json(employees.map(mapEmp));
});

router.post("/employees", async (req, res) => {
  const body = req.body;
  const allowedShopDays = calcAllowedShopDays(body.role);
  const [employee] = await db.insert(employeesTable).values({
    name: body.name,
    role: body.role,
    salary: String(body.salary),
    billableRate: String(body.billableRate ?? 0),
    homeZip: body.homeZip ?? null,
    certifications: body.certifications ?? [],
    allowedShopDays: body.allowedShopDays ?? allowedShopDays,
    shopDaysUsedYtd: 0,
    utilizationPct: "0",
    hourlyRate: body.hourlyRate != null ? String(body.hourlyRate) : null,
    hoursPerDay: body.hoursPerDay != null ? String(body.hoursPerDay) : "8",
    isActive: body.isActive ?? true,
  }).returning();
  res.status(201).json(mapEmp(employee));
});

router.get("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  return res.json(mapEmp(employee));
});

router.put("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const allowedShopDays = body.role && body.salary ? calcAllowedShopDays(body.role) : undefined;
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.role !== undefined) updates.role = body.role;
  if (body.salary !== undefined) updates.salary = String(body.salary);
  if (body.billableRate !== undefined) updates.billableRate = String(body.billableRate);
  if (body.homeZip !== undefined) updates.homeZip = body.homeZip;
  if (body.certifications !== undefined) updates.certifications = body.certifications;
  if (allowedShopDays !== undefined) updates.allowedShopDays = allowedShopDays;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.shopDaysUsedYtd !== undefined) updates.shopDaysUsedYtd = body.shopDaysUsedYtd;
  if (body.trainingDaysUsedYtd !== undefined) updates.trainingDaysUsedYtd = body.trainingDaysUsedYtd;
  if (body.allowedTrainingDays !== undefined) updates.allowedTrainingDays = body.allowedTrainingDays;
  if (body.utilizationPct !== undefined) updates.utilizationPct = String(body.utilizationPct);
  if (body.hourlyRate !== undefined) updates.hourlyRate = body.hourlyRate != null ? String(body.hourlyRate) : null;
  if (body.hoursPerDay !== undefined) updates.hoursPerDay = String(body.hoursPerDay);
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
  const [employee] = await db.update(employeesTable).set(updates).where(eq(employeesTable.id, id)).returning();
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  return res.json(mapEmp(employee));
});

router.delete("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  res.status(204).send();
});

router.get("/employees/:id/schedule", async (req, res) => {
  const id = Number(req.params.id);
  const dateParam = req.query.date ? String(req.query.date) : null;
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  const customers = await db.select().from(customersTable);
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
  let jobs = await db.select().from(jobsTable).where(eq(jobsTable.employeeId, id));
  if (dateParam) {
    jobs = jobs.filter(j => j.scheduledDate === dateParam);
  }
  res.json(jobs.map(j => ({
    ...j,
    revenue: Number(j.revenue),
    customerName: customerMap[j.customerId]?.name ?? "Unknown",
    customerAddress: customerMap[j.customerId]?.address ?? "",
    employeeName: emp?.name ?? null,
    requiresFollowUp: j.requiresFollowUp,
    followUpConfirmed: j.followUpConfirmed,
    certificationRequired: j.certificationRequired,
  })));
});

export default router;
