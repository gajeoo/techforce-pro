import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/vans", async (_req, res) => {
  try {
    return res.json(await q("vans:list"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to list vans", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/vans/locations", async (_req, res) => {
  try {
    return res.json(await m("vans:locations"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch van locations", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/vans", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("vans:create", {
      name: String(body.name ?? "Van"),
      licensePlate: String(body.licensePlate ?? ""),
      make: String(body.make ?? "Ford"),
      model: String(body.model ?? "Transit"),
      year: Number(body.year ?? 2022),
      color: String(body.color ?? "White"),
      ...(body.assignedEmployeeId ? { assignedEmployeeId: asId(body.assignedEmployeeId) } : {}),
      ...(body.notes ? { notes: String(body.notes) } : {}),
    });
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create van", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/vans/:id", async (req, res) => {
  try {
    const van = await q("vans:get", { id: asId(req.params.id) });
    if (!van) return res.status(404).json({ error: "Van not found" });
    return res.json(van);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch van", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/vans/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("vans:update", {
      id: asId(req.params.id),
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.licensePlate !== undefined ? { licensePlate: String(body.licensePlate) } : {}),
      ...(body.make !== undefined ? { make: String(body.make) } : {}),
      ...(body.model !== undefined ? { model: String(body.model) } : {}),
      ...(body.year !== undefined ? { year: Number(body.year) } : {}),
      ...(body.color !== undefined ? { color: String(body.color) } : {}),
      ...(body.assignedEmployeeId !== undefined ? { assignedEmployeeId: body.assignedEmployeeId ? asId(body.assignedEmployeeId) : undefined } : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : undefined } : {}),
    });
    if (!updated) return res.status(404).json({ error: "Van not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update van", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/vans/:id", async (req, res) => {
  try {
    await m("vans:remove", { id: asId(req.params.id) });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete van", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/vans/:id/install-tracker", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("vans:installTracker", {
      id: asId(req.params.id),
      gpsTrackerSerial: String(body.serial ?? `GPS-${Date.now()}`),
      gpsTrackerModel: String(body.model ?? "CalAmp LMU-4230"),
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to install tracker", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/vans/:id/tracker", async (req, res) => {
  try {
    return res.json(await m("vans:removeTracker", { id: asId(req.params.id) }));
  } catch (err) {
    return res.status(500).json({ error: "Failed to remove tracker", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
