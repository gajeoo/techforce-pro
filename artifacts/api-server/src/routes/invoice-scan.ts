import { Router } from "express";

const router = Router();

router.post("/invoice-scan", async (_req, res) => {
  return res.status(501).json({
    success: false,
    error: "Invoice scan is not enabled in this backend runtime yet. Use the Convex AI action flow instead.",
  });
});

export default router;
