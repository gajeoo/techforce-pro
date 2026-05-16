import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/appointments", async (req, res) => {
  try {
    const owner = req.query.owner ? String(req.query.owner) : undefined;
    const date = req.query.date ? String(req.query.date) : undefined;
    return res.json(await q("appointments:list", {
      ...(owner ? { calendarOwner: owner } : {}),
      ...(date ? { date } : {}),
    }));
  } catch (err) {
    req.log.error(err, "Failed to list appointments");
    return res.status(500).json({ error: "Failed to list appointments" });
  }
});

router.post("/appointments", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("appointments:create", {
      title: String(body.title ?? "Appointment"),
      ...(body.description ? { description: String(body.description) } : {}),
      date: String(body.date ?? ""),
      startTime: String(body.startTime ?? ""),
      ...(body.endTime ? { endTime: String(body.endTime) } : {}),
      ...(body.type ? { type: String(body.type) } : {}),
      ...(body.participants ? { participants: String(body.participants) } : {}),
      ...(body.location ? { location: String(body.location) } : {}),
      ...(body.notes ? { notes: String(body.notes) } : {}),
      ...(body.createdBy ? { createdBy: String(body.createdBy) } : {}),
      ...(body.calendarOwner ? { calendarOwner: String(body.calendarOwner) } : {}),
    });
    return res.status(201).json({ id });
  } catch (err) {
    req.log.error(err, "Failed to create appointment");
    return res.status(500).json({ error: "Failed to create appointment" });
  }
});

router.put("/appointments/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("appointments:update", {
      id: asId(req.params.id),
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.description !== undefined ? { description: body.description ? String(body.description) : undefined } : {}),
      ...(body.date !== undefined ? { date: String(body.date) } : {}),
      ...(body.startTime !== undefined ? { startTime: String(body.startTime) } : {}),
      ...(body.endTime !== undefined ? { endTime: body.endTime ? String(body.endTime) : undefined } : {}),
      ...(body.type !== undefined ? { type: String(body.type) } : {}),
      ...(body.participants !== undefined ? { participants: body.participants ? String(body.participants) : undefined } : {}),
      ...(body.location !== undefined ? { location: body.location ? String(body.location) : undefined } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : undefined } : {}),
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error(err, "Failed to update appointment");
    return res.status(500).json({ error: "Failed to update appointment" });
  }
});

router.delete("/appointments/:id", async (req, res) => {
  try {
    await m("appointments:remove", { id: asId(req.params.id) });
    return res.status(204).end();
  } catch (err) {
    req.log.error(err, "Failed to delete appointment");
    return res.status(500).json({ error: "Failed to delete appointment" });
  }
});

export default router;
