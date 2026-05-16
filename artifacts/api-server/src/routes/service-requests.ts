import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/service-requests", async (req, res) => {
  try {
    const customerId = req.query.customerId ? asId(req.query.customerId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    return res.json(await q("serviceRequests:list", {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
    }));
  } catch (err) {
    return res.status(500).json({ error: "Failed to list service requests", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/service-requests", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("serviceRequests:create", {
      customerId: asId(body.customerId),
      serviceType: String(body.serviceType ?? ""),
      urgency: String(body.urgency ?? "normal"),
      ...(body.description ? { description: String(body.description) } : {}),
    });
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create service request", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/service-requests/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("serviceRequests:update", {
      id: asId(req.params.id),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
      ...(body.fulfilledJobId !== undefined ? { fulfilledJobId: body.fulfilledJobId ? asId(body.fulfilledJobId) : undefined } : {}),
    });
    if (!updated) return res.status(404).json({ error: "Service request not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update service request", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/service-requests/:id", async (req, res) => {
  try {
    await m("serviceRequests:remove", { id: asId(req.params.id) });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete service request", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
