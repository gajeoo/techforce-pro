import { Router } from "express";
import { db } from "@workspace/db";
import { openJobsTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function parseCoTechIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as number[]; } catch { return []; }
}

router.get("/open-jobs", async (_req, res) => {
  const jobs = await db.select().from(openJobsTable);
  const employees = await db.select().from(employeesTable);
  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
  const sorted = jobs.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));
  res.json(sorted.map(j => {
    const coIds = parseCoTechIds(j.coTechnicianIds);
    return {
      ...j,
      assignedEmployeeName: j.assignedEmployeeId ? (employeeMap[j.assignedEmployeeId]?.name ?? null) : null,
      coTechnicianIds: coIds,
      coTechnicianNames: coIds.map(id => employeeMap[id]?.name).filter(Boolean),
    };
  }));
});

router.post("/open-jobs", async (req, res) => {
  const body = req.body;
  const coIds: number[] = Array.isArray(body.coTechnicianIds) ? body.coTechnicianIds.map(Number) : [];
  const [job] = await db.insert(openJobsTable).values({
    title: body.title,
    clientName: body.clientName,
    clientAddress: body.clientAddress ?? null,
    zipCode: body.zipCode ?? null,
    certRequired: body.certRequired ?? "any",
    priority: body.priority ?? "medium",
    notes: body.notes ?? null,
    coTechnicianIds: coIds.length ? JSON.stringify(coIds) : null,
  }).returning();
  const employees = await db.select().from(employeesTable);
  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
  res.status(201).json({
    ...job,
    assignedEmployeeName: null,
    coTechnicianIds: coIds,
    coTechnicianNames: coIds.map(id => employeeMap[id]?.name).filter(Boolean),
  });
});

router.put("/open-jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const coIds: number[] | undefined = Array.isArray(body.coTechnicianIds) ? body.coTechnicianIds.map(Number) : undefined;
  const [job] = await db.update(openJobsTable).set({
    ...(body.title && { title: body.title }),
    ...(body.clientName && { clientName: body.clientName }),
    ...(body.clientAddress !== undefined && { clientAddress: body.clientAddress ?? null }),
    ...(body.zipCode !== undefined && { zipCode: body.zipCode ?? null }),
    ...(body.certRequired && { certRequired: body.certRequired }),
    ...(body.priority && { priority: body.priority }),
    ...(body.notes !== undefined && { notes: body.notes ?? null }),
    ...(coIds !== undefined && { coTechnicianIds: coIds.length ? JSON.stringify(coIds) : null }),
    ...(body.assignedEmployeeId !== undefined && { assignedEmployeeId: body.assignedEmployeeId ? Number(body.assignedEmployeeId) : null }),
  }).where(eq(openJobsTable.id, id)).returning();
  if (!job) return res.status(404).json({ error: "Open job not found" });
  const employees = await db.select().from(employeesTable);
  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
  const parsedCoIds = parseCoTechIds(job.coTechnicianIds as unknown as string);
  return res.json({
    ...job,
    assignedEmployeeName: job.assignedEmployeeId ? (employeeMap[job.assignedEmployeeId]?.name ?? null) : null,
    coTechnicianIds: parsedCoIds,
    coTechnicianNames: parsedCoIds.map(cid => employeeMap[cid]?.name).filter(Boolean),
  });
});

router.delete("/open-jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(openJobsTable).where(eq(openJobsTable.id, id));
  res.status(204).send();
});

export default router;
