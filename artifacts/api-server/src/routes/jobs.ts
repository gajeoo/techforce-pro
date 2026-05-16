import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/jobs", async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const employeeId = req.query.employeeId ? asId(req.query.employeeId) : undefined;
    const date = req.query.date ? String(req.query.date) : undefined;
    const jobs = await q("jobs:list", {
      ...(status ? { status } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(date ? { date } : {}),
    });
    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list jobs", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/jobs", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("jobs:create", {
      customerId: asId(body.customerId),
      ...(body.employeeId ? { employeeId: asId(body.employeeId) } : {}),
      ...(body.locationId ? { locationId: asId(body.locationId) } : {}),
      ...(body.locationName ? { locationName: String(body.locationName) } : {}),
      serviceType: String(body.serviceType ?? "extinguisher_inspection"),
      status: String(body.status ?? "pending"),
      priority: String(body.priority ?? "medium"),
      ...(body.scheduledDate ? { scheduledDate: String(body.scheduledDate) } : {}),
      ...(body.dueDate ? { dueDate: String(body.dueDate) } : {}),
      ...(body.scheduledTime ? { scheduledTime: String(body.scheduledTime) } : {}),
      ...(body.revenue !== undefined ? { revenue: Number(body.revenue) } : {}),
      ...(body.quantity !== undefined ? { quantity: Number(body.quantity) } : {}),
      ...(body.notes ? { notes: String(body.notes) } : {}),
      ...(body.certificationRequired || body.certRequired ? { certificationRequired: String(body.certificationRequired ?? body.certRequired) } : {}),
    });
    const created = await q("jobs:get", { id: asId(id) });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create job", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/jobs/returns", async (_req, res) => {
  try {
    const jobs = await q("jobs:listReturns");
    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list return jobs", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/jobs/reschedules", async (_req, res) => {
  try {
    const jobs = await q("jobs:listReschedules");
    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list reschedule jobs", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/jobs/:id", async (req, res) => {
  try {
    const job = await q("jobs:get", { id: asId(req.params.id) });
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(job);
  } catch (err) {
    return res.status(500).json({ error: "Failed to get job", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/jobs/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("jobs:update", {
      id: asId(req.params.id),
      ...(body.employeeId !== undefined ? { employeeId: body.employeeId ? asId(body.employeeId) : undefined } : {}),
      ...(body.locationId !== undefined ? { locationId: body.locationId ? asId(body.locationId) : undefined } : {}),
      ...(body.locationName !== undefined ? { locationName: body.locationName ? String(body.locationName) : undefined } : {}),
      ...(body.serviceType !== undefined ? { serviceType: String(body.serviceType) } : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
      ...(body.priority !== undefined ? { priority: String(body.priority) } : {}),
      ...(body.scheduledDate !== undefined ? { scheduledDate: body.scheduledDate ? String(body.scheduledDate) : undefined } : {}),
      ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? String(body.dueDate) : undefined } : {}),
      ...(body.scheduledTime !== undefined ? { scheduledTime: body.scheduledTime ? String(body.scheduledTime) : undefined } : {}),
      ...(body.revenue !== undefined ? { revenue: Number(body.revenue) } : {}),
      ...(body.quantity !== undefined ? { quantity: Number(body.quantity) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : undefined } : {}),
      ...(body.nonComplianceReason !== undefined ? { nonComplianceReason: body.nonComplianceReason ? String(body.nonComplianceReason) : undefined } : {}),
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update job", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/jobs/:id", async (req, res) => {
  try {
    await m("jobs:remove", { id: asId(req.params.id) });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete job", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/jobs/:id/confirm-followup", async (req, res) => {
  try {
    await m("jobs:confirmFollowup", { id: asId(req.params.id) });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to confirm follow-up", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
