import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/recurring-schedules", async (_req, res) => {
  try {
    return res.json(await q("recurringSchedules:list"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to list recurring schedules", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/recurring-schedules", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("recurringSchedules:create", {
      customerId: asId(body.customerId),
      ...(body.employeeId ? { employeeId: asId(body.employeeId) } : {}),
      serviceType: String(body.serviceType ?? "extinguisher_inspection"),
      intervalType: String(body.intervalType ?? "1year"),
      ...(body.customDays !== undefined ? { customDays: Number(body.customDays) } : {}),
      startDate: String(body.startDate ?? new Date().toISOString().slice(0, 10)),
      ...(body.revenue !== undefined ? { revenue: Number(body.revenue) } : {}),
      ...(body.notes ? { notes: String(body.notes) } : {}),
    });
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create recurring schedule", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/recurring-schedules/:id", async (req, res) => {
  try {
    const all = await q<any[]>("recurringSchedules:list");
    const row = all.find((r) => String((r as any)._id) === req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch recurring schedule", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/recurring-schedules/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("recurringSchedules:update", {
      id: asId(req.params.id),
      ...(body.employeeId !== undefined ? { employeeId: body.employeeId ? asId(body.employeeId) : undefined } : {}),
      ...(body.serviceType !== undefined ? { serviceType: String(body.serviceType) } : {}),
      ...(body.intervalType !== undefined ? { intervalType: String(body.intervalType) } : {}),
      ...(body.customDays !== undefined ? { customDays: Number(body.customDays) } : {}),
      ...(body.revenue !== undefined ? { revenue: Number(body.revenue) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : undefined } : {}),
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update recurring schedule", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/recurring-schedules/:id", async (req, res) => {
  try {
    await m("recurringSchedules:remove", { id: asId(req.params.id) });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete recurring schedule", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/recurring-schedules/:id/pause", async (req, res) => {
  try {
    return res.json(await m("recurringSchedules:pause", { id: asId(req.params.id) }));
  } catch (err) {
    return res.status(500).json({ error: "Failed to pause recurring schedule", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/recurring-schedules/:id/resume", async (req, res) => {
  try {
    return res.json(await m("recurringSchedules:resume", { id: asId(req.params.id) }));
  } catch (err) {
    return res.status(500).json({ error: "Failed to resume recurring schedule", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
