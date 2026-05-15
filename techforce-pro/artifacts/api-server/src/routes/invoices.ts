import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, customersTable, invoiceTemplateTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function enrichInvoice(invoice: typeof invoicesTable.$inferSelect) {
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, invoice.customerId));
  let techName: string | null = null;
  if (invoice.techId) {
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, invoice.techId));
    techName = emp?.name ?? null;
  }
  return {
    ...invoice,
    totalAmount: Number(invoice.totalAmount),
    customerName: customer?.name ?? "Unknown",
    techName,
  };
}

router.get("/invoices", async (req, res) => {
  const customerIdFilter = req.query.customerId ? Number(req.query.customerId) : null;
  let query = db.select().from(invoicesTable).orderBy(invoicesTable.generatedAt);
  const invoices = customerIdFilter
    ? (await query).filter(i => i.customerId === customerIdFilter)
    : await query;
  const customers = await db.select().from(customersTable);
  const employees = await db.select().from(employeesTable);
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
  res.json(invoices.map(i => ({
    ...i,
    totalAmount: Number(i.totalAmount),
    customerName: customerMap[i.customerId]?.name ?? "Unknown",
    techName: i.techId ? (employeeMap[i.techId]?.name ?? null) : null,
  })));
});

router.post("/invoices", async (req, res) => {
  const body = req.body;
  const invoiceNumber = `MC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;
  const totalAmount = (body.lineItems ?? []).reduce((sum: number, item: { total: number }) => sum + item.total, 0);
  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber,
    customerId: body.customerId,
    jobId: body.jobId ?? null,
    techId: body.techId ?? null,
    lineItems: body.lineItems ?? [],
    totalAmount: String(totalAmount),
    status: "draft",
  }).returning();
  res.status(201).json(await enrichInvoice(invoice));
});

router.get("/invoices/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  return res.json(await enrichInvoice(invoice));
});

router.put("/invoices/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.techId !== undefined) updates.techId = body.techId === "__none__" ? null : (body.techId ? Number(body.techId) : null);
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
  const [invoice] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  return res.json(await enrichInvoice(invoice));
});

router.get("/invoice-template", async (_req, res) => {
  const [template] = await db.select().from(invoiceTemplateTable);
  if (!template) {
    const [created] = await db.insert(invoiceTemplateTable).values({
      companyName: "Multicorp Fire Protection Services",
      address: "9693 Gerwig Lane, Columbia, MD 21046",
      phone: "(410) 876-5000",
    }).returning();
    return res.json(created);
  }
  return res.json(template);
});

router.put("/invoice-template", async (req, res) => {
  const [existing] = await db.select().from(invoiceTemplateTable);
  if (existing) {
    const [updated] = await db.update(invoiceTemplateTable).set({
      companyName: req.body.companyName ?? existing.companyName,
      address: req.body.address ?? existing.address,
      phone: req.body.phone ?? existing.phone,
      logoUrl: req.body.logoUrl ?? existing.logoUrl,
      updatedAt: new Date(),
    }).where(eq(invoiceTemplateTable.id, existing.id)).returning();
    return res.json(updated);
  }
  const [created] = await db.insert(invoiceTemplateTable).values({
    companyName: req.body.companyName ?? "Multicorp Fire Protection Services",
    address: req.body.address ?? "9693 Gerwig Lane, Columbia, MD 21046",
    phone: req.body.phone ?? "(410) 876-5000",
    logoUrl: req.body.logoUrl ?? null,
  }).returning();
  return res.json(created);
});

export default router;
