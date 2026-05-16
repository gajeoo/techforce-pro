import { Router } from "express";
import { q } from "../lib/convex-utils";

const router = Router();

router.get("/dashboard/summary", async (_req, res) => {
  try {
    return res.json(await q("dashboard:summary"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load dashboard summary", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/dashboard/profit-leaks", async (_req, res) => {
  try {
    return res.json(await q("dashboard:profitLeaks"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load profit leaks", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/dashboard/team-calendar", async (_req, res) => {
  try {
    return res.json(await q("dashboard:teamCalendar"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load team calendar", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/dashboard/revenue-by-service", async (_req, res) => {
  try {
    return res.json(await q("dashboard:revenueByService"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load revenue by service", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/dashboard/employee-roi", async (_req, res) => {
  try {
    return res.json(await q("dashboard:employeeROI"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load employee ROI", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
