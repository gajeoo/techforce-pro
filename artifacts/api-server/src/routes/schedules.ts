import { Router } from "express";
import { m, asId } from "../lib/convex-utils";

const router = Router();

router.post("/schedules/auto-assign", async (_req, res) => {
  try {
    const out = await m<{ assigned: number }>("openJobs:autoAssign");
    return res.json({
      assignedCount: out?.assigned ?? 0,
      skippedCount: 0,
      flaggedCount: 0,
      assignments: [],
    });
  } catch (err) {
    return res.status(500).json({ error: "Auto-assign failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/schedules/emergency", async (req, res) => {
  try {
    const employeeId = asId(req.body?.employeeId);
    const out = await m<{ assigned: number }>("openJobs:emergencyAssign", { employeeId });
    return res.json({
      assignedCount: out?.assigned ?? 0,
      skippedCount: 0,
      flaggedCount: 0,
      assignments: [],
    });
  } catch (err) {
    return res.status(500).json({ error: "Emergency assignment failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/schedules/fill-shop-days", async (_req, res) => {
  try {
    const out = await m<{ assigned: number }>("openJobs:fillShopDays");
    return res.json({
      assignedCount: out?.assigned ?? 0,
      skippedCount: 0,
      flaggedCount: 0,
      assignments: [],
    });
  } catch (err) {
    return res.status(500).json({ error: "Fill shop days failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
