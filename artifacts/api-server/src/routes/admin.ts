import { Router } from "express";
import { db } from "@workspace/db";
import {
  employeesTable,
  customersTable,
  customerLocationsTable,
  customerPricingTable,
  jobsTable,
  openJobsTable,
  invoicesTable,
  invoiceTemplateTable,
  recurringSchedulesTable,
  timeOffRequestsTable,
  appointments,
  tasksTable,
  serviceRequestsTable,
  vansTable,
  messages,
  conversations,
} from "@workspace/db";

const router = Router();

async function clearAllDataTables() {
  // Delete dependent rows first, then parent rows.
  await db.delete(messages);
  await db.delete(conversations);

  await db.delete(invoicesTable);
  await db.delete(invoiceTemplateTable);
  await db.delete(recurringSchedulesTable);
  await db.delete(jobsTable);
  await db.delete(openJobsTable);

  await db.delete(timeOffRequestsTable);
  await db.delete(appointments);
  await db.delete(tasksTable);
  await db.delete(serviceRequestsTable);
  await db.delete(vansTable);

  await db.delete(customerPricingTable);
  await db.delete(customerLocationsTable);
  await db.delete(customersTable);
  await db.delete(employeesTable);
}

// ─── Seed Demo Data ──────────────────────────────────────────────────────────

router.post("/admin/seed-demo", async (_req, res) => {
  try {
    // 1. Employees
    const [ernest] = await db.insert(employeesTable).values({
      name: "Ernest McKinley",
      role: "extinguisher_tech",
      salary: "52000",
      billableRate: "850",
      homeZip: "21045",
      certifications: ["extinguisher", "exit_lights"],
      allowedShopDays: 5,
      shopDaysUsedYtd: 2,
      allowedTrainingDays: 3,
      trainingDaysUsedYtd: 1,
      utilizationPct: "87.5",
      isActive: true,
    }).returning();

    const [tyler] = await db.insert(employeesTable).values({
      name: "Tyler Beaumont",
      role: "suppression_lead",
      salary: "72000",
      billableRate: "1200",
      homeZip: "21046",
      certifications: ["suppression", "extinguisher", "sprinkler"],
      allowedShopDays: 2,
      shopDaysUsedYtd: 1,
      allowedTrainingDays: 3,
      trainingDaysUsedYtd: 0,
      utilizationPct: "94.2",
      isActive: true,
    }).returning();

    const [ephraim] = await db.insert(employeesTable).values({
      name: "Ephraim Osei",
      role: "sprinkler_tech",
      salary: "61000",
      billableRate: "950",
      homeZip: "21229",
      certifications: ["sprinkler", "standpipe"],
      allowedShopDays: 3,
      shopDaysUsedYtd: 0,
      allowedTrainingDays: 3,
      trainingDaysUsedYtd: 2,
      utilizationPct: "91.0",
      isActive: true,
    }).returning();

    // 2. Customers (3)
    const [harborView] = await db.insert(customersTable).values({
      name: "Harbor View Condominiums",
      facilityType: "condo",
      address: "2100 Boston St, Baltimore, MD 21231",
      contactName: "Patricia Nguyen",
      contactPhone: "(410) 555-0101",
      contactEmail: "pnguyen@harborview.com",
      inspectionFrequency: "annual",
      isActive: true,
    }).returning();

    const [riverside] = await db.insert(customersTable).values({
      name: "Riverside Elementary School",
      facilityType: "school",
      address: "5500 Harpers Farm Rd, Columbia, MD 21044",
      contactName: "David Thornton",
      contactPhone: "(410) 555-0202",
      contactEmail: "dthornton@hcpss.org",
      inspectionFrequency: "semi-annual",
      isActive: true,
    }).returning();

    const [goldCoast] = await db.insert(customersTable).values({
      name: "Gold Coast Restaurant Group",
      facilityType: "restaurant",
      address: "8800 Stanford Blvd, Columbia, MD 21045",
      contactName: "Marco Bellini",
      contactPhone: "(410) 555-0303",
      contactEmail: "marco@goldcoastrg.com",
      inspectionFrequency: "semi-annual",
      isActive: true,
    }).returning();

    // 3 locations each
    await db.insert(customerLocationsTable).values([
      { customerId: harborView.id, name: "Tower A — Main", address: "2100 Boston St, Tower A, Baltimore, MD 21231", contactName: "Patricia Nguyen", contactPhone: "(410) 555-0101", isPrimary: true },
      { customerId: harborView.id, name: "Tower B",         address: "2102 Boston St, Tower B, Baltimore, MD 21231", contactName: "Front Desk",       contactPhone: "(410) 555-0110", isPrimary: false },
      { customerId: harborView.id, name: "Parking Garage",  address: "2104 Boston St, Garage, Baltimore, MD 21231",  contactName: null,                contactPhone: null,             isPrimary: false },
    ]);

    await db.insert(customerLocationsTable).values([
      { customerId: riverside.id, name: "Main Building",        address: "5500 Harpers Farm Rd, Columbia, MD 21044",           contactName: "David Thornton", contactPhone: "(410) 555-0202", isPrimary: true },
      { customerId: riverside.id, name: "Gymnasium",             address: "5500 Harpers Farm Rd, Gym Annex, Columbia, MD 21044", contactName: "Facilities",     contactPhone: "(410) 555-0210", isPrimary: false },
      { customerId: riverside.id, name: "Portable Classrooms",   address: "5500 Harpers Farm Rd, South Lot, Columbia, MD 21044", contactName: null,             contactPhone: null,             isPrimary: false },
    ]);

    await db.insert(customerLocationsTable).values([
      { customerId: goldCoast.id, name: "Columbia Location",       address: "8800 Stanford Blvd, Columbia, MD 21045",      contactName: "Marco Bellini", contactPhone: "(410) 555-0303", isPrimary: true },
      { customerId: goldCoast.id, name: "Ellicott City Location",  address: "3290 Pine Orchard Ln, Ellicott City, MD 21042", contactName: "Sofia Reyes",   contactPhone: "(410) 555-0311", isPrimary: false },
      { customerId: goldCoast.id, name: "Towson Location",          address: "1238 Putty Hill Ave, Towson, MD 21286",        contactName: "Raj Kumar",     contactPhone: "(410) 555-0312", isPrimary: false },
    ]);

    // 4. Jobs (6)
    const pastDate = (d: number) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString().slice(0, 10); };
    const futureDate = (d: number) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };

    const [job1] = await db.insert(jobsTable).values({
      customerId: goldCoast.id, employeeId: tyler.id,
      serviceType: "hood_suppression", status: "completed", priority: "high",
      scheduledDate: pastDate(14), dueDate: pastDate(14),
      revenue: "1400", quantity: 1, certificationRequired: "suppression",
      notes: "Annual hood suppression — Columbia location",
    }).returning();

    const [job2] = await db.insert(jobsTable).values({
      customerId: harborView.id, employeeId: ernest.id,
      serviceType: "extinguisher_inspection", status: "completed", priority: "medium",
      scheduledDate: pastDate(7), dueDate: pastDate(7),
      revenue: "780", quantity: 26, certificationRequired: "extinguisher",
      notes: "Semi-annual extinguisher inspection — Tower A & B",
    }).returning();

    const [job3] = await db.insert(jobsTable).values({
      customerId: riverside.id, employeeId: ephraim.id,
      serviceType: "sprinkler_test", status: "completed", priority: "medium",
      scheduledDate: pastDate(21), dueDate: pastDate(21),
      revenue: "1100", quantity: 1, certificationRequired: "sprinkler",
      notes: "Annual sprinkler test — main building & gymnasium",
    }).returning();

    await db.insert(jobsTable).values({
      customerId: goldCoast.id, employeeId: tyler.id,
      serviceType: "hood_suppression", status: "pending", priority: "high",
      scheduledDate: futureDate(5), dueDate: futureDate(5),
      revenue: "1400", quantity: 1, certificationRequired: "suppression",
      notes: "Towson location — semi-annual hood suppression",
    });

    await db.insert(jobsTable).values({
      customerId: harborView.id, employeeId: ernest.id,
      serviceType: "exit_light_check", status: "pending", priority: "low",
      scheduledDate: futureDate(10), dueDate: futureDate(10),
      revenue: "420", quantity: 42, certificationRequired: "any",
      notes: "Exit light inspection — all towers",
    });

    await db.insert(jobsTable).values({
      customerId: riverside.id, employeeId: ephraim.id,
      serviceType: "extinguisher_inspection", status: "pending", priority: "medium",
      scheduledDate: futureDate(12), dueDate: futureDate(12),
      revenue: "560", quantity: 28, certificationRequired: "extinguisher",
      notes: "Extinguisher annual — main building",
    });

    // 5. Invoices (3)
    await db.insert(invoicesTable).values({
      invoiceNumber: "INV-DEMO-0001",
      customerId: goldCoast.id, jobId: job1.id, techId: tyler.id,
      lineItems: [{ service: "Hood Suppression Annual Inspection", quantity: 1, rate: 1400, total: 1400 }],
      totalAmount: "1400", status: "sent",
    });

    await db.insert(invoicesTable).values({
      invoiceNumber: "INV-DEMO-0002",
      customerId: harborView.id, jobId: job2.id, techId: ernest.id,
      lineItems: [{ service: "Extinguisher Annual Inspection", quantity: 26, rate: 30, total: 780 }],
      totalAmount: "780", status: "paid",
    });

    await db.insert(invoicesTable).values({
      invoiceNumber: "INV-DEMO-0003",
      customerId: riverside.id, jobId: job3.id, techId: ephraim.id,
      lineItems: [
        { service: "Sprinkler Annual Test — Main Building", quantity: 1, rate: 850, total: 850 },
        { service: "Sprinkler Annual Test — Gymnasium",    quantity: 1, rate: 250, total: 250 },
      ],
      totalAmount: "1100", status: "draft",
    });

    res.json({
      success: true,
      seeded: {
        employees: [ernest.name, tyler.name, ephraim.name],
        customers: [harborView.name, riverside.name, goldCoast.name],
        locations: 9,
        jobs: 6,
        invoices: 3,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Seed failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Clear All Data ──────────────────────────────────────────────────────────

router.delete("/admin/clear-all", async (_req, res) => {
  try {
    await clearAllDataTables();
    res.json({ success: true, message: "All data cleared." });
  } catch (err) {
    res.status(500).json({ error: "Clear failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Export All Data ─────────────────────────────────────────────────────────

router.get("/admin/export", async (_req, res) => {
  const [employees, customers, locations, jobs, openJobs, invoices, recurring] =
    await Promise.all([
      db.select().from(employeesTable),
      db.select().from(customersTable),
      db.select().from(customerLocationsTable),
      db.select().from(jobsTable),
      db.select().from(openJobsTable),
      db.select().from(invoicesTable),
      db.select().from(recurringSchedulesTable),
    ]);

  res.json({
    exportedAt: new Date().toISOString(),
    version: "1.0",
    data: {
      employees: employees.map(e => ({ ...e, salary: Number(e.salary), billableRate: Number(e.billableRate), utilizationPct: Number(e.utilizationPct) })),
      customers,
      customerLocations: locations,
      jobs: jobs.map(j => ({ ...j, revenue: Number(j.revenue) })),
      openJobs,
      invoices: invoices.map(i => ({ ...i, totalAmount: Number(i.totalAmount) })),
      recurringSchedules: recurring.map(r => ({ ...r, revenue: Number(r.revenue) })),
    },
  });
});

// ─── Import Data ─────────────────────────────────────────────────────────────

router.post("/admin/import", async (req, res) => {
  const { data, clearFirst } = req.body as {
    data: {
      employees?: Record<string, unknown>[];
      customers?: Record<string, unknown>[];
      customerLocations?: Record<string, unknown>[];
      jobs?: Record<string, unknown>[];
      openJobs?: Record<string, unknown>[];
      invoices?: Record<string, unknown>[];
    };
    clearFirst?: boolean;
  };

  if (!data) return res.status(400).json({ error: "Missing data payload" });

  const counts: Record<string, number> = {};
  const empIdMap: Record<number, number> = {};
  const custIdMap: Record<number, number> = {};

  try {
    if (clearFirst) {
      await clearAllDataTables();
    }

    if (data.employees?.length) {
      for (const e of data.employees) {
        const oldId = Number(e.id);
        const [inserted] = await db.insert(employeesTable).values({
          name: String(e.name ?? "Unknown"),
          role: String(e.role ?? "extinguisher_tech"),
          salary: String(Number(e.salary ?? 50000)),
          billableRate: String(Number(e.billableRate ?? 800)),
          homeZip: String(e.homeZip ?? "00000"),
          certifications: (e.certifications as string[]) ?? [],
          allowedShopDays: Number(e.allowedShopDays ?? 5),
          shopDaysUsedYtd: Number(e.shopDaysUsedYtd ?? 0),
          allowedTrainingDays: Number(e.allowedTrainingDays ?? 3),
          trainingDaysUsedYtd: Number(e.trainingDaysUsedYtd ?? 0),
          utilizationPct: String(Number(e.utilizationPct ?? 0)),
          isActive: e.isActive !== false,
        }).returning();
        if (oldId) empIdMap[oldId] = inserted.id;
      }
      counts.employees = data.employees.length;
    }

    if (data.customers?.length) {
      for (const c of data.customers) {
        const oldId = Number(c.id);
        const [inserted] = await db.insert(customersTable).values({
          name: String(c.name ?? "Unknown"),
          facilityType: String(c.facilityType ?? "commercial"),
          address: String(c.address ?? ""),
          contactName: String(c.contactName ?? ""),
          contactPhone: String(c.contactPhone ?? ""),
          contactEmail: c.contactEmail ? String(c.contactEmail) : null,
          inspectionFrequency: String(c.inspectionFrequency ?? "annual"),
          isActive: c.isActive !== false,
        }).returning();
        if (oldId) custIdMap[oldId] = inserted.id;
      }
      counts.customers = data.customers.length;
    }

    if (data.customerLocations?.length) {
      for (const l of data.customerLocations) {
        const newCustId = custIdMap[Number(l.customerId)] ?? Number(l.customerId);
        await db.insert(customerLocationsTable).values({
          customerId: newCustId,
          name: String(l.name ?? "Location"),
          address: String(l.address ?? ""),
          contactName: l.contactName ? String(l.contactName) : null,
          contactPhone: l.contactPhone ? String(l.contactPhone) : null,
          isPrimary: l.isPrimary === true,
        });
      }
      counts.customerLocations = data.customerLocations.length;
    }

    if (data.jobs?.length) {
      for (const j of data.jobs) {
        const newCustId = custIdMap[Number(j.customerId)] ?? Number(j.customerId);
        const newEmpId = j.employeeId ? (empIdMap[Number(j.employeeId)] ?? Number(j.employeeId)) : null;
        await db.insert(jobsTable).values({
          customerId: newCustId,
          employeeId: newEmpId,
          serviceType: String(j.serviceType ?? "extinguisher_inspection"),
          status: String(j.status ?? "pending"),
          priority: String(j.priority ?? "medium"),
          scheduledDate: j.scheduledDate ? String(j.scheduledDate) : null,
          dueDate: j.dueDate ? String(j.dueDate) : null,
          revenue: String(Number(j.revenue ?? 0)),
          quantity: Number(j.quantity ?? 1),
          notes: j.notes ? String(j.notes) : null,
          certificationRequired: String(j.certificationRequired ?? "any"),
        });
      }
      counts.jobs = data.jobs.length;
    }

    if (data.openJobs?.length) {
      for (const oj of data.openJobs) {
        await db.insert(openJobsTable).values({
          title: String(oj.title ?? "Open Job"),
          clientName: String(oj.clientName ?? ""),
          clientAddress: oj.clientAddress ? String(oj.clientAddress) : null,
          zipCode: oj.zipCode ? String(oj.zipCode) : null,
          certRequired: String(oj.certRequired ?? "any"),
          priority: String(oj.priority ?? "medium"),
          notes: oj.notes ? String(oj.notes) : null,
        });
      }
      counts.openJobs = data.openJobs.length;
    }

    if (data.invoices?.length) {
      for (const inv of data.invoices) {
        const newCustId = custIdMap[Number(inv.customerId)] ?? Number(inv.customerId);
        const newTechId = inv.techId ? (empIdMap[Number(inv.techId)] ?? Number(inv.techId)) : null;
        const customGeneratedAt = inv.generatedAt ? new Date(String(inv.generatedAt)) : undefined;
        await db.insert(invoicesTable).values({
          invoiceNumber: String(inv.invoiceNumber ?? `INV-IMP-${Date.now()}`),
          customerId: newCustId,
          jobId: inv.jobId ? Number(inv.jobId) : null,
          techId: newTechId,
          lineItems: (inv.lineItems as Array<{ service: string; quantity: number; rate: number; total: number }>) ?? [],
          totalAmount: String(Number(inv.totalAmount ?? 0)),
          status: String(inv.status ?? "draft"),
          ...(customGeneratedAt && !isNaN(customGeneratedAt.getTime()) ? { generatedAt: customGeneratedAt } : {}),
        });
      }
      counts.invoices = data.invoices.length;
    }

    return res.json({ success: true, imported: counts });
  } catch (err) {
    return res.status(500).json({ error: "Import failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
