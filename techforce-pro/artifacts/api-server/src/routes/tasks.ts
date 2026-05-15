import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/tasks?status=&assignedTo=
router.get("/tasks", async (req, res) => {
  const { status, assignedTo } = req.query as Record<string, string | undefined>;
  let tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);
  if (status) tasks = tasks.filter(t => t.status === status);
  if (assignedTo) tasks = tasks.filter(t => t.assignedTo === assignedTo || t.assignedTo === null);
  res.json(tasks.reverse());
});

// POST /api/tasks
router.post("/tasks", async (req, res) => {
  const body = req.body;
  const [task] = await db.insert(tasksTable).values({
    title: body.title,
    description: body.description ?? null,
    createdBy: body.createdBy ?? "Manager",
    createdByRole: body.createdByRole ?? "manager",
    assignedTo: body.assignedTo ?? null,
    priority: body.priority ?? "medium",
    status: "open",
    dueDate: body.dueDate ?? null,
    jobId: body.jobId ? Number(body.jobId) : null,
  }).returning();
  res.status(201).json(task);
});

// PUT /api/tasks/:id
router.put("/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const [task] = await db.update(tasksTable).set({
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
    ...(body.priority !== undefined && { priority: body.priority }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.dueDate !== undefined && { dueDate: body.dueDate }),
    updatedAt: new Date(),
  }).where(eq(tasksTable.id, id)).returning();
  if (!task) return res.status(404).json({ error: "Task not found" });
  return res.json(task);
});

// DELETE /api/tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.json({ success: true });
});

export default router;
