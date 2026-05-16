import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/invoices", async (req, res) => {
  try {
    const customerId = req.query.customerId ? asId(req.query.customerId) : undefined;
    return res.json(await q("invoices:list", customerId ? { customerId } : {}));
  } catch (err) {
    return res.status(500).json({ error: "Failed to list invoices", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const body = req.body ?? {};
    const lineItems = Array.isArray(body.lineItems) ? body.lineItems : [];
    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + Number(item?.total ?? 0), 0);
    const id = await m("invoices:create", {
      customerId: asId(body.customerId),
      ...(body.jobId ? { jobId: asId(body.jobId) } : {}),
      ...(body.techId ? { techId: asId(body.techId) } : {}),
      lineItems: lineItems.map((it: any) => ({
        service: String(it.service ?? ""),
        quantity: Number(it.quantity ?? 0),
        rate: Number(it.rate ?? 0),
        total: Number(it.total ?? 0),
      })),
      totalAmount,
      status: String(body.status ?? "draft"),
    });
    return res.status(201).json(await q("invoices:get", { id: asId(id) }));
  } catch (err) {
    return res.status(500).json({ error: "Failed to create invoice", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/invoices/:id", async (req, res) => {
  try {
    const invoice = await q("invoices:get", { id: asId(req.params.id) });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    return res.json(invoice);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch invoice", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/invoices/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("invoices:update", {
      id: asId(req.params.id),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
      ...(body.techId !== undefined ? { techId: body.techId ? asId(body.techId) : undefined } : {}),
      ...(body.lineItems !== undefined
        ? {
            lineItems: (Array.isArray(body.lineItems) ? body.lineItems : []).map((it: any) => ({
              service: String(it.service ?? ""),
              quantity: Number(it.quantity ?? 0),
              rate: Number(it.rate ?? 0),
              total: Number(it.total ?? 0),
            })),
          }
        : {}),
      ...(body.totalAmount !== undefined ? { totalAmount: Number(body.totalAmount) } : {}),
    });
    if (!updated) return res.status(404).json({ error: "Invoice not found" });
    return res.json(await q("invoices:get", { id: asId(req.params.id) }));
  } catch (err) {
    return res.status(500).json({ error: "Failed to update invoice", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/invoice-template", async (_req, res) => {
  try {
    return res.json(await q("invoices:getTemplate"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch invoice template", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/invoice-template", async (req, res) => {
  try {
    const body = req.body ?? {};
    await m("invoices:updateTemplate", {
      ...(body.companyName !== undefined ? { companyName: String(body.companyName) } : {}),
      ...(body.address !== undefined ? { address: String(body.address) } : {}),
      ...(body.phone !== undefined ? { phone: String(body.phone) } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl ? String(body.logoUrl) : undefined } : {}),
    });
    return res.json(await q("invoices:getTemplate"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to update invoice template", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
