import { Router } from "express";
import { db } from "@workspace/db";
import { openJobsTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function certMatches(empCerts: string[], required: string): boolean {
  if (required === "any") return true;
  return empCerts.includes(required);
}

router.post("/schedules/auto-assign", async (_req, res) => {
  const openJobs = await db.select().from(openJobsTable);
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.isActive, true));
  const sorted = openJobs.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));

  const assignments: Array<{ jobId: number; employeeId: number; employeeName: string }> = [];
  let skipped = 0;
  let flagged = 0;

  for (const job of sorted) {
    if (job.assignedEmployeeId) { skipped++; continue; }
    const candidates = employees.filter(e => {
      const hasExcessShopDays = e.shopDaysUsedYtd < e.allowedShopDays;
      return certMatches(e.certifications as string[], job.certRequired) && hasExcessShopDays;
    }).sort((a, b) => a.shopDaysUsedYtd - b.shopDaysUsedYtd);

    if (candidates.length > 0) {
      const emp = candidates[0];
      await db.update(openJobsTable).set({ assignedEmployeeId: emp.id }).where(eq(openJobsTable.id, job.id));
      assignments.push({ jobId: job.id, employeeId: emp.id, employeeName: emp.name });
    } else {
      flagged++;
    }
  }

  res.json({ assignedCount: assignments.length, skippedCount: skipped, flaggedCount: flagged, assignments });
});

router.post("/schedules/emergency", async (req, res) => {
  const { employeeId } = req.body;
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId));
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const openJobs = await db.select().from(openJobsTable);
  const sorted = openJobs
    .filter(j => !j.assignedEmployeeId && certMatches(employee.certifications as string[], j.certRequired))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));

  const assignments: Array<{ jobId: number; employeeId: number; employeeName: string }> = [];
  for (const job of sorted) {
    await db.update(openJobsTable).set({ assignedEmployeeId: employeeId }).where(eq(openJobsTable.id, job.id));
    assignments.push({ jobId: job.id, employeeId, employeeName: employee.name });
  }

  return res.json({ assignedCount: assignments.length, skippedCount: 0, flaggedCount: 0, assignments });
});

router.post("/schedules/fill-shop-days", async (_req, res) => {
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.isActive, true));
  const openJobs = await db.select().from(openJobsTable);
  const unassigned = openJobs.filter(j => !j.assignedEmployeeId)
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));

  const assignments: Array<{ jobId: number; employeeId: number; employeeName: string }> = [];

  for (const emp of employees) {
    const excessDays = emp.allowedShopDays - emp.shopDaysUsedYtd;
    if (excessDays <= 0) continue;
    const eligible = unassigned.filter(j => !j.assignedEmployeeId && certMatches(emp.certifications as string[], j.certRequired));
    for (let i = 0; i < Math.min(excessDays, eligible.length); i++) {
      const job = eligible[i];
      await db.update(openJobsTable).set({ assignedEmployeeId: emp.id }).where(eq(openJobsTable.id, job.id));
      assignments.push({ jobId: job.id, employeeId: emp.id, employeeName: emp.name });
      job.assignedEmployeeId = emp.id;
    }
  }

  res.json({ assignedCount: assignments.length, skippedCount: 0, flaggedCount: 0, assignments });
});

export default router;
