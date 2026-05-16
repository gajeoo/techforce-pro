import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/open-jobs", async (_req, res) => {
  try {
    const jobs = await q("openJobs:list");
    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list open jobs", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/open-jobs", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("openJobs:create", {
      title: String(body.title ?? "Open Job"),
      clientName: String(body.clientName ?? "Client"),
      ...(body.clientAddress ? { clientAddress: String(body.clientAddress) } : {}),
      ...(body.zipCode ? { zipCode: String(body.zipCode) } : {}),
      certRequired: String(body.certRequired ?? "any"),
      priority: String(body.priority ?? "medium"),
      ...(body.notes ? { notes: String(body.notes) } : {}),
    });
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create open job", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/open-jobs/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("openJobs:update", {
      id: asId(req.params.id),
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.clientName !== undefined ? { clientName: String(body.clientName) } : {}),
      ...(body.clientAddress !== undefined ? { clientAddress: body.clientAddress ? String(body.clientAddress) : undefined } : {}),
      ...(body.zipCode !== undefined ? { zipCode: body.zipCode ? String(body.zipCode) : undefined } : {}),
      ...(body.certRequired !== undefined ? { certRequired: String(body.certRequired) } : {}),
      ...(body.priority !== undefined ? { priority: String(body.priority) } : {}),
      ...(body.assignedEmployeeId !== undefined ? { assignedEmployeeId: body.assignedEmployeeId ? asId(body.assignedEmployeeId) : undefined } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : undefined } : {}),
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update open job", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/open-jobs/:id", async (req, res) => {
  try {
    await m("openJobs:remove", { id: asId(req.params.id) });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete open job", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
