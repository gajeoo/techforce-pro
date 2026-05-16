import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/customers", async (_req, res) => {
  try {
    const customers = await q("customers:list");
    return res.json(customers);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list customers", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("customers:create", {
      name: String(body.name ?? "Unknown"),
      facilityType: String(body.facilityType ?? body.type ?? "commercial"),
      address: String(body.address ?? ""),
      contactName: String(body.contactName ?? body.contact ?? ""),
      contactPhone: String(body.contactPhone ?? body.phone ?? ""),
      ...(body.contactEmail ?? body.email ? { contactEmail: String(body.contactEmail ?? body.email) } : {}),
      inspectionFrequency: String(body.inspectionFrequency ?? "annual"),
    });
    const customer = await q("customers:get", { id: asId(id) });
    return res.status(201).json(customer);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create customer", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const customer = await q("customers:get", { id: asId(req.params.id) });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    return res.json(customer);
  } catch (err) {
    return res.status(500).json({ error: "Failed to get customer", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/customers/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("customers:update", {
      id: asId(req.params.id),
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.facilityType !== undefined ? { facilityType: String(body.facilityType) } : {}),
      ...(body.type !== undefined ? { facilityType: String(body.type) } : {}),
      ...(body.address !== undefined ? { address: String(body.address) } : {}),
      ...(body.contactName !== undefined ? { contactName: String(body.contactName) } : {}),
      ...(body.contact !== undefined ? { contactName: String(body.contact) } : {}),
      ...(body.contactPhone !== undefined ? { contactPhone: String(body.contactPhone) } : {}),
      ...(body.phone !== undefined ? { contactPhone: String(body.phone) } : {}),
      ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail ? String(body.contactEmail) : undefined } : {}),
      ...(body.email !== undefined ? { contactEmail: body.email ? String(body.email) : undefined } : {}),
      ...(body.inspectionFrequency !== undefined ? { inspectionFrequency: String(body.inspectionFrequency) } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    });
    if (!updated) return res.status(404).json({ error: "Customer not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update customer", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/customers/:id", async (req, res) => {
  try {
    await m("customers:remove", { id: asId(req.params.id) });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete customer", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/customers/:id/locations", async (req, res) => {
  try {
    const locations = await q("customers:listLocations", { customerId: asId(req.params.id) });
    return res.json(locations);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list locations", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/customers/:id/locations", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("customers:createLocation", {
      customerId: asId(req.params.id),
      name: String(body.name ?? "New Location"),
      address: String(body.address ?? ""),
      ...(body.contactName ? { contactName: String(body.contactName) } : {}),
      ...(body.contactPhone ? { contactPhone: String(body.contactPhone) } : {}),
      isPrimary: body.isPrimary === true,
    });
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create location", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/customers/:id/locations/:locId", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("customers:updateLocation", {
      id: asId(req.params.locId),
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.address !== undefined ? { address: String(body.address) } : {}),
      ...(body.contactName !== undefined ? { contactName: body.contactName ? String(body.contactName) : undefined } : {}),
      ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone ? String(body.contactPhone) : undefined } : {}),
      ...(body.isPrimary !== undefined ? { isPrimary: Boolean(body.isPrimary) } : {}),
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update location", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/customers/:id/locations/:locId", async (req, res) => {
  try {
    await m("customers:deleteLocation", { id: asId(req.params.locId) });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete location", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/customers/:id/pricing", async (req, res) => {
  try {
    const pricing = await q("customers:listPricing", { customerId: asId(req.params.id) });
    return res.json(pricing);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list pricing", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/customers/:id/pricing", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("customers:upsertPricing", {
      customerId: asId(req.params.id),
      serviceType: String(body.serviceType ?? ""),
      customerRate: Number(body.customerRate ?? 0),
      standardRate: Number(body.standardRate ?? 0),
      unit: String(body.unit ?? "flat"),
    });
    return res.json({ id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to upsert pricing", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/customers/:id/jobs", async (req, res) => {
  try {
    const jobs = await q("customers:listJobs", { customerId: asId(req.params.id) });
    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list customer jobs", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/customers/:id/invoices", async (req, res) => {
  try {
    const invoices = await q("customers:listInvoices", { customerId: asId(req.params.id) });
    return res.json(invoices);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list customer invoices", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
