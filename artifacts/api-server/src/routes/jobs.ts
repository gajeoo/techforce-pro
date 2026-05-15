import { Router } from "express";
import { db } from "@workspace/db";
import { jobsTable, customersTable, employeesTable, invoicesTable, customerLocationsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import {
  CreateJobBody, UpdateJobBody, GetJobParams, DeleteJobParams, ListJobsQueryParams
} from "@workspace/api-zod";

const router = Router();

async function enrichJob(job: typeof jobsTable.$inferSelect) {
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, job.customerId));
  let employeeName: string | null = null;
  if (job.employeeId) {
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, job.employeeId));
    employeeName = emp?.name ?? null;
  }
  return {
    ...job,
    revenue: Number(job.revenue),
    customerName: customer?.name ?? "Unknown",
    customerAddress: customer?.address ?? "",
    locationId: job.locationId ?? null,
    locationName: job.locationName ?? null,
    dueDate: job.dueDate ?? null,
    employeeName,
    requiresFollowUp: job.requiresFollowUp,
    followUpConfirmed: job.followUpConfirmed,
    certificationRequired: job.certificationRequired,
  };
}

router.get("/jobs", async (req, res) => {
  const query = ListJobsQueryParams.parse(req.query);
  let jobs = await db.select().from(jobsTable).orderBy(jobsTable.scheduledDate);
  if (query.status) jobs = jobs.filter(j => j.status === query.status);
  if (query.employeeId) jobs = jobs.filter(j => j.employeeId === Number(query.employeeId));
  if (query.date) {
    const dateStr = String(query.date);
    jobs = jobs.filter(j => j.scheduledDate === dateStr);
  }
  const customers = await db.select().from(customersTable);
  const employees = await db.select().from(employeesTable);
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
  res.json(jobs.map(j => ({
    ...j,
    revenue: Number(j.revenue),
    customerName: customerMap[j.customerId]?.name ?? "Unknown",
    customerAddress: customerMap[j.customerId]?.address ?? "",
    locationId: j.locationId ?? null,
    locationName: j.locationName ?? null,
    dueDate: j.dueDate ?? null,
    employeeName: j.employeeId ? (employeeMap[j.employeeId]?.name ?? null) : null,
    requiresFollowUp: j.requiresFollowUp,
    followUpConfirmed: j.followUpConfirmed,
    certificationRequired: j.certificationRequired,
  })));
});

router.post("/jobs", async (req, res) => {
  const body = CreateJobBody.parse(req.body);
  let revenue = body.revenue ?? 0;
  if (!revenue) {
    const { customerPricingTable } = await import("@workspace/db");
    const pricing = await db.select().from(customerPricingTable).where(
      and(eq(customerPricingTable.customerId, body.customerId), eq(customerPricingTable.serviceType, body.serviceType))
    );
    if (pricing.length > 0) {
      revenue = Number(pricing[0].customerRate);
    }
  }

  // Resolve location name if locationId provided
  let locationName: string | null = (body as Record<string, unknown>).locationName as string ?? null;
  const locationId: number | null = (body as Record<string, unknown>).locationId as number ?? null;
  if (locationId && !locationName) {
    const [loc] = await db.select().from(customerLocationsTable).where(eq(customerLocationsTable.id, locationId));
    locationName = loc?.name ?? null;
  }

  const [job] = await db.insert(jobsTable).values({
    customerId: body.customerId,
    employeeId: body.employeeId ?? null,
    locationId: locationId ?? null,
    locationName: locationName ?? null,
    serviceType: body.serviceType,
    status: (body.status as string) ?? "pending",
    priority: (body.priority as string) ?? "medium",
    scheduledDate: body.scheduledDate ? String(body.scheduledDate) : null,
    dueDate: ((body as Record<string, unknown>).dueDate as string) ?? null,
    scheduledTime: body.scheduledTime ?? null,
    revenue: String(revenue),
    quantity: 1,
    notes: body.notes ?? null,
    requiresFollowUp: false,
    followUpConfirmed: false,
    certificationRequired: body.certRequired ?? "any",
  }).returning();
  return res.status(201).json(await enrichJob(job));
});

router.get("/jobs/returns", async (_req, res) => {
  const jobs = await db.select().from(jobsTable).where(
    or(eq(jobsTable.status, "return"), eq(jobsTable.status, "will_return"))
  );
  const customers = await db.select().from(customersTable);
  const employees = await db.select().from(employeesTable);
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
  res.json(jobs.map(j => ({
    ...j,
    revenue: Number(j.revenue),
    customerName: customerMap[j.customerId]?.name ?? "Unknown",
    customerAddress: customerMap[j.customerId]?.address ?? "",
    locationId: j.locationId ?? null,
    locationName: j.locationName ?? null,
    dueDate: j.dueDate ?? null,
    employeeName: j.employeeId ? (employeeMap[j.employeeId]?.name ?? null) : null,
    requiresFollowUp: j.requiresFollowUp,
    followUpConfirmed: j.followUpConfirmed,
    certificationRequired: j.certificationRequired,
  })));
});

router.get("/jobs/reschedules", async (_req, res) => {
  const jobs = await db.select().from(jobsTable).where(eq(jobsTable.status, "reschedule"));
  const customers = await db.select().from(customersTable);
  const employees = await db.select().from(employeesTable);
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
  res.json(jobs.map(j => ({
    ...j,
    revenue: Number(j.revenue),
    customerName: customerMap[j.customerId]?.name ?? "Unknown",
    customerAddress: customerMap[j.customerId]?.address ?? "",
    locationId: j.locationId ?? null,
    locationName: j.locationName ?? null,
    dueDate: j.dueDate ?? null,
    employeeName: j.employeeId ? (employeeMap[j.employeeId]?.name ?? null) : null,
    requiresFollowUp: j.requiresFollowUp,
    followUpConfirmed: j.followUpConfirmed,
    certificationRequired: j.certificationRequired,
  })));
});

router.get("/jobs/:id", async (req, res) => {
  const { id } = GetJobParams.parse({ id: Number(req.params.id) });
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(await enrichJob(job));
});

router.put("/jobs/:id", async (req, res) => {
  const { id } = GetJobParams.parse({ id: Number(req.params.id) });
  const body = UpdateJobBody.parse(req.body);
  const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Job not found" });

  const updates: Partial<typeof jobsTable.$inferInsert> = {};
  if (body.employeeId !== undefined) updates.employeeId = body.employeeId ?? null;
  if (body.serviceType !== undefined) updates.serviceType = body.serviceType;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.revenue !== undefined) updates.revenue = String(body.revenue);
  if (body.scheduledDate !== undefined) updates.scheduledDate = body.scheduledDate ? String(body.scheduledDate) : null;
  if (body.scheduledTime !== undefined) updates.scheduledTime = body.scheduledTime ?? null;
  if (body.notes !== undefined) updates.notes = body.notes ?? null;
  if (body.nonComplianceReason !== undefined) updates.nonComplianceReason = body.nonComplianceReason ?? null;

  // Location and due date from raw body (not in Zod schema, passed through)
  const raw = req.body as Record<string, unknown>;
  if (raw.locationId !== undefined) updates.locationId = raw.locationId as number ?? null;
  if (raw.locationName !== undefined) updates.locationName = raw.locationName as string ?? null;
  if (raw.dueDate !== undefined) updates.dueDate = raw.dueDate as string ?? null;

  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === "non_compliant") {
      updates.nonComplianceReason = body.nonComplianceReason ?? updates.nonComplianceReason ?? null;
    }
    if (body.status === "completed" && existing.status !== "completed") {
      const effectiveRevenue = body.revenue !== undefined ? body.revenue : Number(existing.revenue);
      const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, existing.customerId));
      if (customer && effectiveRevenue > 0) {
        const invoiceNumber = `MC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;
        await db.insert(invoicesTable).values({
          invoiceNumber,
          customerId: existing.customerId,
          jobId: id,
          techId: existing.employeeId ?? null,
          lineItems: [{ service: existing.serviceType, quantity: 1, rate: effectiveRevenue, total: effectiveRevenue }],
          totalAmount: String(effectiveRevenue),
          status: "draft",
        });
      }
    }
  }

  const [job] = await db.update(jobsTable).set(updates).where(eq(jobsTable.id, id)).returning();
  return res.json(await enrichJob(job));
});

router.delete("/jobs/:id", async (req, res) => {
  const { id } = DeleteJobParams.parse({ id: Number(req.params.id) });
  await db.delete(jobsTable).where(eq(jobsTable.id, id));
  res.status(204).send();
});

router.post("/jobs/:id/confirm-followup", async (req, res) => {
  const id = Number(req.params.id);
  const [job] = await db.update(jobsTable).set({ followUpConfirmed: true }).where(eq(jobsTable.id, id)).returning();
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(await enrichJob(job));
});

export default router;
