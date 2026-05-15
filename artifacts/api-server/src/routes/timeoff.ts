import { Router } from "express";
import { db } from "@workspace/db";
import { timeOffRequestsTable, employeesTable } from "@workspace/db";
import { eq, and, lte, gte, or } from "drizzle-orm";

const router = Router();

function toRow(r: typeof timeOffRequestsTable.$inferSelect, empName: string) {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: empName,
    type: r.type ?? "shop-day",
    startDate: r.requestedDate,
    endDate: r.endDate ?? r.requestedDate,
    reason: r.reason ?? "",
    notes: r.notes ?? "",
    status: r.status,
    denialReason: r.denialReason ?? null,
    reviewedBy: r.reviewedBy ?? null,
    reviewNote: r.reviewNote ?? null,
    createdAt: r.createdAt,
  };
}

// GET /api/time-off?status=&employeeId=&date=YYYY-MM-DD
router.get("/time-off", async (req, res) => {
  const { status, employeeId, date } = req.query as Record<string, string | undefined>;
  const requests = await db.select().from(timeOffRequestsTable).orderBy(timeOffRequestsTable.createdAt);
  const employees = await db.select().from(employeesTable);
  const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));

  let results = requests.map(r => toRow(r, empMap[r.employeeId] ?? "Unknown"));

  if (status) results = results.filter(r => r.status === status);
  if (employeeId) results = results.filter(r => r.employeeId === Number(employeeId));
  if (date) {
    results = results.filter(r => r.startDate <= date && r.endDate >= date);
  }

  res.json(results);
});

// POST /api/time-off
router.post("/time-off", async (req, res) => {
  const body = req.body;
  const empId = Number(body.employeeId);

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, empId));
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const startDateStr = String(body.startDate ?? body.requestedDate ?? body.date ?? "");
  const endDateStr = body.endDate ? String(body.endDate) : startDateStr;
  const reqType = body.type ?? "shop-day";
  const reason = body.reason ?? "";
  const notes = body.notes ?? "";

  // If manager is directly setting status, skip auto-rules
  let status: string = body.initialStatus ?? "pending";
  let denialReason: string | null = null;

  if (status === "pending") {
    // Auto-approve / deny based on business rules
    const usedPct = employee.allowedShopDays > 0 ? employee.shopDaysUsedYtd / employee.allowedShopDays : 1;
    if (usedPct >= 0.9) {
      status = "denied";
      denialReason = `Shop day limit reached (${employee.shopDaysUsedYtd}/${employee.allowedShopDays} used).`;
    }

    if (status === "pending" && Number(employee.utilizationPct) < 85) {
      status = "denied";
      denialReason = `Utilization at ${employee.utilizationPct}% — below 85% threshold.`;
    }

    // Check billable job conflict
    if (status === "pending" && startDateStr) {
      const { jobsTable } = await import("@workspace/db");
      const conflictJobs = await db.select().from(jobsTable).where(
        and(eq(jobsTable.employeeId, empId), eq(jobsTable.scheduledDate, startDateStr))
      );
      if (conflictJobs.filter(j => j.status !== "completed").length > 0) {
        status = "denied";
        denialReason = "Scheduled for a billable job on this date.";
      }
    }
  }

  if (status === "approved") {
    await db.update(employeesTable)
      .set({ shopDaysUsedYtd: employee.shopDaysUsedYtd + 1 })
      .where(eq(employeesTable.id, empId));
  }

  const [request] = await db.insert(timeOffRequestsTable).values({
    employeeId: empId,
    requestedDate: startDateStr,
    endDate: endDateStr,
    type: reqType,
    reason,
    notes,
    status,
    denialReason,
    reviewedBy: body.reviewedBy ?? null,
    reviewNote: body.reviewNote ?? null,
  }).returning();

  return res.status(201).json(toRow(request, employee.name));
});

// POST /api/time-off/:id/review
router.post("/time-off/:id/review", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const newStatus: string = body.status ?? body.decision ?? "approved";

  const [existing] = await db.select().from(timeOffRequestsTable).where(eq(timeOffRequestsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Request not found" });

  const [request] = await db.update(timeOffRequestsTable).set({
    status: newStatus,
    denialReason: body.denialReason ?? null,
    reviewedBy: body.reviewedBy ?? null,
    reviewNote: body.reviewNote ?? null,
  }).where(eq(timeOffRequestsTable.id, id)).returning();

  // If newly approved, increment shopDaysUsedYtd
  if (newStatus === "approved" && existing.status !== "approved") {
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, request.employeeId));
    if (emp) {
      await db.update(employeesTable)
        .set({ shopDaysUsedYtd: emp.shopDaysUsedYtd + 1 })
        .where(eq(employeesTable.id, emp.id));
    }
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, request.employeeId));
  return res.json(toRow(request, employee?.name ?? "Unknown"));
});

// DELETE /api/time-off/:id
router.delete("/time-off/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(timeOffRequestsTable).where(eq(timeOffRequestsTable.id, id));
  return res.json({ success: true });
});

export default router;
