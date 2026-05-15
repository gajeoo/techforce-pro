import { Router } from "express";
import { convex } from "../lib/convex";

const router = Router();

type ImportPayload = {
  employees?: Record<string, unknown>[];
  customers?: Record<string, unknown>[];
  customerLocations?: Record<string, unknown>[];
  jobs?: Record<string, unknown>[];
  openJobs?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
};

router.post("/admin/seed-demo", async (_req, res) => {
  try {
    const result = await (convex as any).mutation("admin:seedDemo", {});
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({
      error: "Seed failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.delete("/admin/clear-all", async (_req, res) => {
  try {
    await (convex as any).mutation("admin:clearAll", {});
    return res.json({ success: true, message: "All data cleared." });
  } catch (err) {
    return res.status(500).json({
      error: "Clear failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/admin/export", async (_req, res) => {
  try {
    const exported = await (convex as any).query("admin:exportAll", {});
    return res.json(exported);
  } catch (err) {
    return res.status(500).json({
      error: "Export failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/admin/import", async (req, res) => {
  const { data, clearFirst } = req.body as {
    data?: ImportPayload;
    clearFirst?: boolean;
  };

  if (!data) {
    return res.status(400).json({ error: "Missing data payload" });
  }

  try {
    if (clearFirst) {
      await (convex as any).mutation("admin:clearAll", {});
    }

    return res.status(501).json({
      error: "Import not implemented on Convex yet",
      imported: {
        employees: data.employees?.length ?? 0,
        customers: data.customers?.length ?? 0,
        customerLocations: data.customerLocations?.length ?? 0,
        jobs: data.jobs?.length ?? 0,
        openJobs: data.openJobs?.length ?? 0,
        invoices: data.invoices?.length ?? 0,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: "Import failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
