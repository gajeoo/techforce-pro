import { Router } from "express";
import { m, q, asId, optionalId } from "../lib/convex-utils";

const router = Router();

function calcAllowedShopDays(role: string): number {
  if (role === "suppression_lead") return 2;
  if (role === "sprinkler_tech") return 3;
  if (role === "extinguisher_tech") return 5;
  if (role === "helper") return 12;
  return 0;
}

router.get("/employees", async (_req, res) => {
  try {
    const employees = await q("employees:list");
    return res.json(employees);
  } catch (err) {
    return res.status(500).json({ error: "Failed to list employees", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/employees", async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = await m("employees:create", {
      name: String(body.name ?? "Unknown"),
      role: String(body.role ?? "extinguisher_tech"),
      salary: Number(body.salary ?? 0),
      billableRate: Number(body.billableRate ?? 0),
      homeZip: String(body.homeZip ?? ""),
      certifications: Array.isArray(body.certifications) ? body.certifications.map(String) : [],
      allowedShopDays: Number(body.allowedShopDays ?? calcAllowedShopDays(String(body.role ?? "extinguisher_tech"))),
      shopDaysUsedYtd: Number(body.shopDaysUsedYtd ?? 0),
      allowedTrainingDays: Number(body.allowedTrainingDays ?? 3),
      trainingDaysUsedYtd: Number(body.trainingDaysUsedYtd ?? 0),
      utilizationPct: Number(body.utilizationPct ?? 0),
      isActive: body.isActive !== false,
    });
    const employee = await q("employees:get", { id: asId(id) });
    return res.status(201).json(employee);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create employee", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/employees/:id", async (req, res) => {
  try {
    const employee = await q("employees:get", { id: asId(req.params.id) });
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    return res.json(employee);
  } catch (err) {
    return res.status(500).json({ error: "Failed to get employee", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/employees/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await m("employees:update", {
      id: asId(req.params.id),
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.role !== undefined ? { role: String(body.role) } : {}),
      ...(body.salary !== undefined ? { salary: Number(body.salary) } : {}),
      ...(body.billableRate !== undefined ? { billableRate: Number(body.billableRate) } : {}),
      ...(body.homeZip !== undefined ? { homeZip: String(body.homeZip) } : {}),
      ...(body.certifications !== undefined ? { certifications: Array.isArray(body.certifications) ? body.certifications.map(String) : [] } : {}),
      ...(body.allowedShopDays !== undefined ? { allowedShopDays: Number(body.allowedShopDays) } : {}),
      ...(body.shopDaysUsedYtd !== undefined ? { shopDaysUsedYtd: Number(body.shopDaysUsedYtd) } : {}),
      ...(body.allowedTrainingDays !== undefined ? { allowedTrainingDays: Number(body.allowedTrainingDays) } : {}),
      ...(body.trainingDaysUsedYtd !== undefined ? { trainingDaysUsedYtd: Number(body.trainingDaysUsedYtd) } : {}),
      ...(body.utilizationPct !== undefined ? { utilizationPct: Number(body.utilizationPct) } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    });
    if (!updated) return res.status(404).json({ error: "Employee not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update employee", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/employees/:id", async (req, res) => {
  try {
    await m("employees:remove", { id: asId(req.params.id) });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete employee", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/employees/:id/schedule", async (req, res) => {
  try {
    const date = req.query.date ? String(req.query.date) : undefined;
    const jobs = await q("employees:getSchedule", { id: asId(req.params.id), ...(date ? { date } : {}) });
    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to get employee schedule", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
