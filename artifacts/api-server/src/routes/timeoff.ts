import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/time-off", async (req, res) => {
  try {
    const employeeId = req.query.employeeId ? asId(req.query.employeeId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const date = req.query.date ? String(req.query.date) : undefined;

    let rows = await q<any[]>("timeoff:list", employeeId ? { employeeId } : {});
    if (status) rows = rows.filter((r) => String(r.status) === status);
    if (date) rows = rows.filter((r) => {
      const start = String((r as any).requestedDate ?? "");
      const end = String((r as any).endDate ?? start);
      return start <= date && end >= date;
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list time-off requests", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/time-off", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("timeoff:create", {
      employeeId: asId(body.employeeId),
      requestedDate: String(body.startDate ?? body.requestedDate ?? body.date ?? ""),
      ...(body.endDate ? { endDate: String(body.endDate) } : {}),
      type: String(body.type ?? "shop-day"),
      ...(body.reason ? { reason: String(body.reason) } : {}),
      ...(body.notes ? { notes: String(body.notes) } : {}),
    });
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create time-off request", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/time-off/:id/review", async (req, res) => {
  try {
    const body = req.body ?? {};
    const status = String(body.status ?? body.decision ?? "approved").toLowerCase();
    const action = status === "approved" ? "approve" : "deny";
    const reviewed = await m("timeoff:review", {
      id: asId(req.params.id),
      action,
      reviewedBy: String(body.reviewedBy ?? "Manager"),
      ...(body.reviewNote ? { reviewNote: String(body.reviewNote) } : {}),
      ...(body.denialReason ? { denialReason: String(body.denialReason) } : {}),
    });
    return res.json(reviewed);
  } catch (err) {
    return res.status(500).json({ error: "Failed to review time-off request", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/time-off/:id", async (req, res) => {
  try {
    await m("timeoff:remove", { id: asId(req.params.id) });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete time-off request", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
