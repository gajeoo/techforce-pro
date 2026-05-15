import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, customerPricingTable, customerLocationsTable, jobsTable, invoicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/customers", async (_req, res) => {
  const customers = await db.select().from(customersTable).orderBy(customersTable.name);
  res.json(customers);
});

router.post("/customers", async (req, res) => {
  const body = req.body;
  const [customer] = await db.insert(customersTable).values({
    name: body.name,
    facilityType: body.facilityType ?? body.type ?? "Commercial",
    address: body.address,
    contactName: body.contactName ?? body.contact ?? "",
    contactPhone: body.contactPhone ?? body.phone ?? "",
    contactEmail: body.contactEmail ?? body.email ?? null,
    inspectionFrequency: body.inspectionFrequency ?? "annual",
    isActive: body.isActive ?? true,
  }).returning();
  // Auto-create a primary location from customer address
  await db.insert(customerLocationsTable).values({
    customerId: customer.id,
    name: "Main Location",
    address: customer.address,
    contactName: customer.contactName || null,
    contactPhone: customer.contactPhone || null,
    isPrimary: true,
  });
  res.status(201).json(customer);
});

router.get("/customers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  return res.json(customer);
});

router.put("/customers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.facilityType !== undefined) updates.facilityType = body.facilityType;
  if (body.type !== undefined) updates.facilityType = body.type;
  if (body.address !== undefined) updates.address = body.address;
  if (body.contactName !== undefined) updates.contactName = body.contactName;
  if (body.contact !== undefined) updates.contactName = body.contact;
  if (body.contactPhone !== undefined) updates.contactPhone = body.contactPhone;
  if (body.phone !== undefined) updates.contactPhone = body.phone;
  if (body.contactEmail !== undefined) updates.contactEmail = body.contactEmail ?? null;
  if (body.email !== undefined) updates.contactEmail = body.email ?? null;
  if (body.inspectionFrequency !== undefined) updates.inspectionFrequency = body.inspectionFrequency;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  const [customer] = await db.update(customersTable).set(updates).where(eq(customersTable.id, id)).returning();
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  return res.json(customer);
});

router.delete("/customers/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.status(204).send();
});

// ─── Customer Locations ───────────────────────────────────────────────────────

router.get("/customers/:id/locations", async (req, res) => {
  const id = Number(req.params.id);
  let locations = await db.select().from(customerLocationsTable)
    .where(eq(customerLocationsTable.customerId, id))
    .orderBy(customerLocationsTable.isPrimary, customerLocationsTable.name);

  // Auto-seed a primary location from the customer's address if none exist
  if (locations.length === 0) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (customer) {
      const [loc] = await db.insert(customerLocationsTable).values({
        customerId: id,
        name: "Main Location",
        address: customer.address,
        contactName: customer.contactName || null,
        contactPhone: customer.contactPhone || null,
        isPrimary: true,
      }).returning();
      locations = [loc];
    }
  }

  res.json(locations);
});

router.post("/customers/:id/locations", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const [loc] = await db.insert(customerLocationsTable).values({
    customerId: id,
    name: body.name ?? "New Location",
    address: body.address ?? "",
    contactName: body.contactName ?? null,
    contactPhone: body.contactPhone ?? null,
    isPrimary: body.isPrimary ?? false,
  }).returning();
  res.status(201).json(loc);
});

router.put("/customers/:id/locations/:locId", async (req, res) => {
  const locId = Number(req.params.locId);
  const body = req.body;
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.address !== undefined) updates.address = body.address;
  if (body.contactName !== undefined) updates.contactName = body.contactName ?? null;
  if (body.contactPhone !== undefined) updates.contactPhone = body.contactPhone ?? null;
  if (body.isPrimary !== undefined) updates.isPrimary = body.isPrimary;
  const [loc] = await db.update(customerLocationsTable).set(updates)
    .where(eq(customerLocationsTable.id, locId)).returning();
  if (!loc) return res.status(404).json({ error: "Location not found" });
  return res.json(loc);
});

router.delete("/customers/:id/locations/:locId", async (req, res) => {
  const locId = Number(req.params.locId);
  await db.delete(customerLocationsTable).where(eq(customerLocationsTable.id, locId));
  res.status(204).send();
});

// ─── Customer Pricing ─────────────────────────────────────────────────────────

router.get("/customers/:id/pricing", async (req, res) => {
  const id = Number(req.params.id);
  const pricing = await db.select().from(customerPricingTable).where(eq(customerPricingTable.customerId, id));
  res.json(pricing.map(p => ({ ...p, customerRate: Number(p.customerRate), standardRate: Number(p.standardRate) })));
});

router.post("/customers/:id/pricing", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const existing = await db.select().from(customerPricingTable).where(
    and(eq(customerPricingTable.customerId, id), eq(customerPricingTable.serviceType, body.serviceType))
  );
  let result;
  if (existing.length > 0) {
    const [updated] = await db.update(customerPricingTable).set({
      customerRate: String(body.customerRate),
      standardRate: String(body.standardRate),
      unit: body.unit,
    }).where(and(eq(customerPricingTable.customerId, id), eq(customerPricingTable.serviceType, body.serviceType))).returning();
    result = updated;
  } else {
    const [created] = await db.insert(customerPricingTable).values({
      customerId: id,
      serviceType: body.serviceType,
      customerRate: String(body.customerRate),
      standardRate: String(body.standardRate),
      unit: body.unit,
    }).returning();
    result = created;
  }
  res.json({ ...result, customerRate: Number(result.customerRate), standardRate: Number(result.standardRate) });
});

router.get("/customers/:id/jobs", async (req, res) => {
  const id = Number(req.params.id);
  const jobs = await db.select().from(jobsTable).where(eq(jobsTable.customerId, id));
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  res.json(jobs.map(j => ({
    ...j,
    revenue: Number(j.revenue),
    customerName: customer?.name ?? "Unknown",
    customerAddress: customer?.address ?? "",
    employeeName: null,
    requiresFollowUp: j.requiresFollowUp,
    followUpConfirmed: j.followUpConfirmed,
    certificationRequired: j.certificationRequired,
  })));
});

router.get("/customers/:id/invoices", async (req, res) => {
  const id = Number(req.params.id);
  const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.customerId, id));
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  res.json(invoices.map(i => ({ ...i, totalAmount: Number(i.totalAmount), customerName: customer?.name ?? "Unknown" })));
});

export default router;
