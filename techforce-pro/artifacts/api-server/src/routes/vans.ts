import { Router } from "express";
import { db } from "@workspace/db";
import { vansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Columbia MD base area — van positions drift around here
const BASE_LAT = 39.2037;
const BASE_LNG = -76.8610;

function simulateMovement(lat: string | null, lng: string | null, speed: number): { lat: string; lng: string; speed: number; heading: number } {
  const currentLat = lat ? parseFloat(lat) : BASE_LAT + (Math.random() - 0.5) * 0.05;
  const currentLng = lng ? parseFloat(lng) : BASE_LNG + (Math.random() - 0.5) * 0.05;
  const newSpeed = Math.max(0, Math.min(65, speed + (Math.random() - 0.5) * 10));
  const isMoving = newSpeed > 3;
  const drift = isMoving ? 0.0003 : 0.00001;
  return {
    lat: (currentLat + (Math.random() - 0.5) * drift).toFixed(7),
    lng: (currentLng + (Math.random() - 0.5) * drift * 1.3).toFixed(7),
    speed: Math.round(newSpeed),
    heading: Math.floor(Math.random() * 360),
  };
}

// GET /api/vans — list all vans
router.get("/vans", async (_req, res) => {
  const vans = await db.select().from(vansTable).orderBy(vansTable.name);
  res.json(vans);
});

// GET /api/vans/locations — poll for live positions (updates GPS-tracked vans)
router.get("/vans/locations", async (_req, res) => {
  const vans = await db.select().from(vansTable);
  const updates: { id: number; lat: string; lng: string; speed: number; heading: number; lastLocationUpdate: Date }[] = [];

  for (const van of vans) {
    if (van.gpsTrackerId && van.status === "active") {
      const moved = simulateMovement(van.lat, van.lng, van.speed);
      await db.update(vansTable).set({
        lat: moved.lat,
        lng: moved.lng,
        speed: moved.speed,
        heading: moved.heading,
        lastLocationUpdate: new Date(),
      }).where(eq(vansTable.id, van.id));
      updates.push({ id: van.id, ...moved, lastLocationUpdate: new Date() });
    }
  }

  const result = await db.select().from(vansTable).orderBy(vansTable.name);
  res.json(result);
});

// POST /api/vans — create a new van
router.post("/vans", async (req, res) => {
  const body = req.body;
  const [van] = await db.insert(vansTable).values({
    name: body.name,
    licensePlate: body.licensePlate,
    make: body.make ?? "Ford",
    model: body.model ?? "Transit",
    year: body.year ?? 2022,
    color: body.color ?? "White",
    assignedEmployeeId: body.assignedEmployeeId ?? null,
    status: body.status ?? "active",
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json(van);
});

// GET /api/vans/:id
router.get("/vans/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [van] = await db.select().from(vansTable).where(eq(vansTable.id, id));
  if (!van) return res.status(404).json({ error: "Van not found" });
  return res.json(van);
});

// PUT /api/vans/:id — update van info
router.put("/vans/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.licensePlate !== undefined) updates.licensePlate = body.licensePlate;
  if (body.make !== undefined) updates.make = body.make;
  if (body.model !== undefined) updates.model = body.model;
  if (body.year !== undefined) updates.year = body.year;
  if (body.color !== undefined) updates.color = body.color;
  if (body.assignedEmployeeId !== undefined) updates.assignedEmployeeId = body.assignedEmployeeId;
  if (body.status !== undefined) updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
  const [van] = await db.update(vansTable).set(updates).where(eq(vansTable.id, id)).returning();
  if (!van) return res.status(404).json({ error: "Van not found" });
  return res.json(van);
});

// DELETE /api/vans/:id
router.delete("/vans/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(vansTable).where(eq(vansTable.id, id));
  res.status(204).send();
});

// POST /api/vans/:id/install-tracker — configure & install a GPS tracker
router.post("/vans/:id/install-tracker", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const serial = body.serial || `GPS-${Date.now()}`;
  const model = body.model || "CalAmp LMU-4230";
  // Assign an initial position near Columbia MD
  const initLat = (BASE_LAT + (Math.random() - 0.5) * 0.04).toFixed(7);
  const initLng = (BASE_LNG + (Math.random() - 0.5) * 0.06).toFixed(7);
  const [van] = await db.update(vansTable).set({
    gpsTrackerId: serial,
    gpsTrackerSerial: serial,
    gpsTrackerModel: model,
    gpsTrackerInstalledAt: new Date(),
    lat: initLat,
    lng: initLng,
    speed: 0,
    heading: 0,
    lastLocationUpdate: new Date(),
  }).where(eq(vansTable.id, id)).returning();
  if (!van) return res.status(404).json({ error: "Van not found" });
  return res.json(van);
});

// DELETE /api/vans/:id/tracker — remove GPS tracker
router.delete("/vans/:id/tracker", async (req, res) => {
  const id = Number(req.params.id);
  const [van] = await db.update(vansTable).set({
    gpsTrackerId: null,
    gpsTrackerSerial: null,
    gpsTrackerModel: null,
    gpsTrackerInstalledAt: null,
    lat: null,
    lng: null,
    speed: 0,
    heading: 0,
    lastLocationUpdate: null,
  }).where(eq(vansTable.id, id)).returning();
  if (!van) return res.status(404).json({ error: "Van not found" });
  return res.json(van);
});

export default router;
