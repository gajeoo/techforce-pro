import { Router } from "express";
import { db } from "@workspace/db";
import { appointments } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const CreateBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  type: z.enum(["meeting", "site-visit", "call", "internal", "other"]).default("meeting"),
  participants: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
  calendarOwner: z.enum(["manager", "supervisor", "shared"]).default("manager"),
});

const UpdateBody = CreateBody.partial();

router.get("/appointments", async (req, res) => {
  try {
    const owner = req.query.owner as string | undefined;
    let rows;
    if (owner === "manager") {
      rows = await db.select().from(appointments)
        .where(or(eq(appointments.calendarOwner, "manager"), eq(appointments.calendarOwner, "shared")))
        .orderBy(appointments.date, appointments.startTime);
    } else if (owner === "supervisor") {
      rows = await db.select().from(appointments)
        .where(or(eq(appointments.calendarOwner, "supervisor"), eq(appointments.calendarOwner, "shared")))
        .orderBy(appointments.date, appointments.startTime);
    } else {
      rows = await db.select().from(appointments).orderBy(appointments.date, appointments.startTime);
    }
    res.json(rows);
  } catch (err) {
    req.log.error(err, "Failed to list appointments");
    res.status(500).json({ error: "Failed to list appointments" });
  }
});

router.post("/appointments", async (req, res) => {
  try {
    const body = CreateBody.parse(req.body);
    const [created] = await db.insert(appointments).values(body).returning();
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.message });
    req.log.error(err, "Failed to create appointment");
    return res.status(500).json({ error: "Failed to create appointment" });
  }
});

router.put("/appointments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateBody.parse(req.body);
    const [updated] = await db.update(appointments).set(body).where(eq(appointments.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.message });
    req.log.error(err, "Failed to update appointment");
    return res.status(500).json({ error: "Failed to update appointment" });
  }
});

router.delete("/appointments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(appointments).where(eq(appointments.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
    return;
  } catch (err) {
    req.log.error(err, "Failed to delete appointment");
    return res.status(500).json({ error: "Failed to delete appointment" });
  }
});

export default router;
