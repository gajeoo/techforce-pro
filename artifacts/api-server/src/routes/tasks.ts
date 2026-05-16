import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/tasks", async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const assignedTo = req.query.assignedTo ? String(req.query.assignedTo) : undefined;
    return res.json(await q("tasks:list", {
      ...(status ? { status } : {}),
      ...(assignedTo ? { assignedTo } : {}),
    }));
  } catch (err) {
    return res.status(500).json({ error: "Failed to list tasks", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("tasks:create", {
      title: String(body.title ?? "Task"),
      ...(body.description ? { description: String(body.description) } : {}),
      createdBy: String(body.createdBy ?? "Manager"),
      createdByRole: String(body.createdByRole ?? "manager"),
      ...(body.assignedTo ? { assignedTo: String(body.assignedTo) } : {}),
      priority: String(body.priority ?? "medium"),
      status: String(body.status ?? "open"),
      ...(body.dueDate ? { dueDate: String(body.dueDate) } : {}),
      ...(body.jobId ? { jobId: asId(body.jobId) } : {}),
    });
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create task", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/tasks/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("tasks:update", {
      id: asId(req.params.id),
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.description !== undefined ? { description: body.description ? String(body.description) : undefined } : {}),
      ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo ? String(body.assignedTo) : undefined } : {}),
      ...(body.priority !== undefined ? { priority: String(body.priority) } : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
      ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? String(body.dueDate) : undefined } : {}),
    });
    if (!updated) return res.status(404).json({ error: "Task not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update task", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    await m("tasks:remove", { id: asId(req.params.id) });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete task", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
