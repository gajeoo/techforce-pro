import { Router } from "express";
import { db } from "@workspace/db";
import { serviceRequestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/service-requests?customerId=&status=
router.get("/service-requests", async (req, res) => {
  const { customerId, status } = req.query as Record<string, string | undefined>;
  let requests = await db.select().from(serviceRequestsTable).orderBy(serviceRequestsTable.createdAt);
  if (customerId) requests = requests.filter(r => r.customerId === Number(customerId));
  if (status) requests = requests.filter(r => r.status === status);
  res.json(requests.reverse());
});

// POST /api/service-requests
router.post("/service-requests", async (req, res) => {
  const body = req.body;
  const [request] = await db.insert(serviceRequestsTable).values({
    customerId: Number(body.customerId),
    customerName: body.customerName ?? "Customer",
    serviceType: body.serviceType,
    description: body.description ?? null,
    location: body.location ?? null,
    preferredDate: body.preferredDate ?? null,
    urgency: body.urgency ?? "normal",
    status: "pending",
    managerMessage: null,
    fulfilledJobId: null,
  }).returning();
  res.status(201).json(request);
});

// PUT /api/service-requests/:id
router.put("/service-requests/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const [request] = await db.update(serviceRequestsTable).set({
    ...(body.status !== undefined && { status: body.status }),
    ...(body.managerMessage !== undefined && { managerMessage: body.managerMessage }),
    ...(body.fulfilledJobId !== undefined && { fulfilledJobId: body.fulfilledJobId ? Number(body.fulfilledJobId) : null }),
    updatedAt: new Date(),
  }).where(eq(serviceRequestsTable.id, id)).returning();
  if (!request) return res.status(404).json({ error: "Service request not found" });
  return res.json(request);
});

// DELETE /api/service-requests/:id
router.delete("/service-requests/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(serviceRequestsTable).where(eq(serviceRequestsTable.id, id));
  res.json({ success: true });
});

export default router;
