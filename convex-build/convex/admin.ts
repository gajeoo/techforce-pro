import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => {
    // Employees
    const ernestId = await ctx.db.insert("employees", {
      name: "Ernest McKinley", role: "extinguisher_tech",
      salary: 52000, billableRate: 850, homeZip: "21045",
      certifications: ["extinguisher", "exit_lights"],
      allowedShopDays: 5, shopDaysUsedYtd: 2,
      allowedTrainingDays: 3, trainingDaysUsedYtd: 1,
      utilizationPct: 87.5, isActive: true,
    });
    const tylerId = await ctx.db.insert("employees", {
      name: "Tyler Beaumont", role: "suppression_lead",
      salary: 72000, billableRate: 1200, homeZip: "21046",
      certifications: ["suppression", "extinguisher", "sprinkler"],
      allowedShopDays: 2, shopDaysUsedYtd: 1,
      allowedTrainingDays: 3, trainingDaysUsedYtd: 0,
      utilizationPct: 94.2, isActive: true,
    });
    const ephraimId = await ctx.db.insert("employees", {
      name: "Ephraim Osei", role: "sprinkler_tech",
      salary: 61000, billableRate: 950, homeZip: "21229",
      certifications: ["sprinkler", "standpipe"],
      allowedShopDays: 3, shopDaysUsedYtd: 0,
      allowedTrainingDays: 3, trainingDaysUsedYtd: 2,
      utilizationPct: 91.0, isActive: true,
    });

    // Customers
    const harborId = await ctx.db.insert("customers", {
      name: "Harbor View Condominiums", facilityType: "condo",
      address: "2100 Boston St, Baltimore, MD 21231",
      contactName: "Patricia Nguyen", contactPhone: "(410) 555-0101",
      contactEmail: "pnguyen@harborview.com",
      inspectionFrequency: "annual", isActive: true,
    });
    const riversideId = await ctx.db.insert("customers", {
      name: "Riverside Elementary School", facilityType: "school",
      address: "5500 Harpers Farm Rd, Columbia, MD 21044",
      contactName: "David Thornton", contactPhone: "(410) 555-0202",
      contactEmail: "dthornton@hcpss.org",
      inspectionFrequency: "semi-annual", isActive: true,
    });
    const goldCoastId = await ctx.db.insert("customers", {
      name: "Gold Coast Restaurant Group", facilityType: "restaurant",
      address: "8800 Stanford Blvd, Columbia, MD 21045",
      contactName: "Marco Bellini", contactPhone: "(410) 555-0303",
      contactEmail: "marco@goldcoastrg.com",
      inspectionFrequency: "semi-annual", isActive: true,
    });

    // Locations
    await ctx.db.insert("customerLocations", { customerId: harborId, name: "Tower A — Main", address: "2100 Boston St, Tower A, Baltimore, MD 21231", contactName: "Patricia Nguyen", contactPhone: "(410) 555-0101", isPrimary: true });
    await ctx.db.insert("customerLocations", { customerId: harborId, name: "Tower B", address: "2102 Boston St, Tower B, Baltimore, MD 21231", isPrimary: false });
    await ctx.db.insert("customerLocations", { customerId: harborId, name: "Parking Garage", address: "2104 Boston St, Garage, Baltimore, MD 21231", isPrimary: false });
    await ctx.db.insert("customerLocations", { customerId: riversideId, name: "Main Building", address: "5500 Harpers Farm Rd, Columbia, MD 21044", contactName: "David Thornton", contactPhone: "(410) 555-0202", isPrimary: true });
    await ctx.db.insert("customerLocations", { customerId: riversideId, name: "Gymnasium", address: "5500 Harpers Farm Rd, Gym Annex, Columbia, MD 21044", isPrimary: false });
    await ctx.db.insert("customerLocations", { customerId: riversideId, name: "Portable Classrooms", address: "5500 Harpers Farm Rd, South Lot, Columbia, MD 21044", isPrimary: false });
    await ctx.db.insert("customerLocations", { customerId: goldCoastId, name: "Columbia Location", address: "8800 Stanford Blvd, Columbia, MD 21045", contactName: "Marco Bellini", contactPhone: "(410) 555-0303", isPrimary: true });
    await ctx.db.insert("customerLocations", { customerId: goldCoastId, name: "Ellicott City", address: "3290 Pine Orchard Ln, Ellicott City, MD 21042", isPrimary: false });
    await ctx.db.insert("customerLocations", { customerId: goldCoastId, name: "Towson", address: "1238 Putty Hill Ave, Towson, MD 21286", isPrimary: false });

    const past = (d: number) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString().slice(0, 10); };
    const future = (d: number) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };

    const job1Id = await ctx.db.insert("jobs", { customerId: goldCoastId, employeeId: tylerId, serviceType: "hood_suppression", status: "completed", priority: "high", scheduledDate: past(14), dueDate: past(14), revenue: 1400, quantity: 1, certificationRequired: "suppression", notes: "Annual hood suppression — Columbia", requiresFollowUp: false, followUpConfirmed: false });
    const job2Id = await ctx.db.insert("jobs", { customerId: harborId, employeeId: ernestId, serviceType: "extinguisher_inspection", status: "completed", priority: "medium", scheduledDate: past(7), dueDate: past(7), revenue: 780, quantity: 26, certificationRequired: "extinguisher", notes: "Tower A & B", requiresFollowUp: false, followUpConfirmed: false });
    const job3Id = await ctx.db.insert("jobs", { customerId: riversideId, employeeId: ephraimId, serviceType: "sprinkler_test", status: "completed", priority: "medium", scheduledDate: past(21), dueDate: past(21), revenue: 1100, quantity: 1, certificationRequired: "sprinkler", requiresFollowUp: false, followUpConfirmed: false });
    await ctx.db.insert("jobs", { customerId: goldCoastId, employeeId: tylerId, serviceType: "hood_suppression", status: "pending", priority: "high", scheduledDate: future(5), dueDate: future(5), revenue: 1400, quantity: 1, certificationRequired: "suppression", notes: "Towson location", requiresFollowUp: false, followUpConfirmed: false });
    await ctx.db.insert("jobs", { customerId: harborId, employeeId: ernestId, serviceType: "exit_light_check", status: "pending", priority: "low", scheduledDate: future(10), dueDate: future(10), revenue: 420, quantity: 42, certificationRequired: "any", requiresFollowUp: false, followUpConfirmed: false });
    await ctx.db.insert("jobs", { customerId: riversideId, employeeId: ephraimId, serviceType: "extinguisher_inspection", status: "pending", priority: "medium", scheduledDate: future(12), dueDate: future(12), revenue: 560, quantity: 28, certificationRequired: "extinguisher", requiresFollowUp: false, followUpConfirmed: false });

    // Invoices
    await ctx.db.insert("invoices", { invoiceNumber: "INV-DEMO-0001", customerId: goldCoastId, jobId: job1Id, techId: tylerId, lineItems: [{ service: "Hood Suppression Annual", quantity: 1, rate: 1400, total: 1400 }], totalAmount: 1400, status: "sent" });
    await ctx.db.insert("invoices", { invoiceNumber: "INV-DEMO-0002", customerId: harborId, jobId: job2Id, techId: ernestId, lineItems: [{ service: "Extinguisher Annual", quantity: 26, rate: 30, total: 780 }], totalAmount: 780, status: "paid" });
    await ctx.db.insert("invoices", { invoiceNumber: "INV-DEMO-0003", customerId: riversideId, jobId: job3Id, techId: ephraimId, lineItems: [{ service: "Sprinkler Test", quantity: 1, rate: 850, total: 850 }, { service: "Sprinkler Gym", quantity: 1, rate: 250, total: 250 }], totalAmount: 1100, status: "draft" });

    // Vans
    await ctx.db.insert("vans", { name: "Van 1", licensePlate: "MC-001", make: "Ford", model: "Transit", year: 2022, color: "White", assignedEmployeeId: ernestId, gpsTrackerId: "GPS-001", gpsTrackerSerial: "SN-001", gpsTrackerModel: "Samsara VG34", gpsTrackerInstalledAt: Date.now(), lat: 39.2037, lng: -76.861, speed: 0, heading: 0, status: "active" });
    await ctx.db.insert("vans", { name: "Van 2", licensePlate: "MC-002", make: "Ford", model: "Transit", year: 2021, color: "White", assignedEmployeeId: tylerId, gpsTrackerId: "GPS-002", gpsTrackerSerial: "SN-002", gpsTrackerModel: "Samsara VG34", gpsTrackerInstalledAt: Date.now(), lat: 39.215, lng: -76.875, speed: 0, heading: 0, status: "active" });
    await ctx.db.insert("vans", { name: "Van 3", licensePlate: "MC-003", make: "Mercedes", model: "Sprinter", year: 2023, color: "White", assignedEmployeeId: ephraimId, gpsTrackerId: "GPS-003", gpsTrackerSerial: "SN-003", gpsTrackerModel: "Samsara VG34", gpsTrackerInstalledAt: Date.now(), lat: 39.195, lng: -76.848, speed: 0, heading: 0, status: "active" });
    await ctx.db.insert("vans", { name: "Van 4", licensePlate: "MC-004", make: "Ford", model: "Transit", year: 2020, color: "Silver", speed: 0, heading: 0, status: "active" });

    return { success: true, seeded: { employees: 3, customers: 3, locations: 9, jobs: 6, invoices: 3, vans: 4 } };
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["invoices", "jobs", "openJobs", "customerPricing", "customerLocations", "customers", "employees", "recurringSchedules", "timeOffRequests", "vans", "appointments", "tasks", "serviceRequests", "messages", "conversations"] as const;
    for (const table of tables) {
      const rows = await ctx.db.query(table as any).collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    return { success: true };
  },
});

export const exportAll = query({
  args: {},
  handler: async (ctx) => {
    const [employees, customers, customerLocations, jobs, openJobs, invoices, recurringSchedules, vans, timeOffRequests, serviceRequests] = await Promise.all([
      ctx.db.query("employees").collect(),
      ctx.db.query("customers").collect(),
      ctx.db.query("customerLocations").collect(),
      ctx.db.query("jobs").collect(),
      ctx.db.query("openJobs").collect(),
      ctx.db.query("invoices").collect(),
      ctx.db.query("recurringSchedules").collect(),
      ctx.db.query("vans").collect(),
      ctx.db.query("timeOffRequests").collect(),
      ctx.db.query("serviceRequests").collect(),
    ]);
    const exportId = `tf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      exportId,
      exportedAt: new Date().toISOString(),
      version: "2.1-convex",
      data: { employees, customers, customerLocations, jobs, openJobs, invoices, recurringSchedules, vans, timeOffRequests, serviceRequests },
    };
  },
});

const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

function normRow(row: any): Record<string, any> {
  if (!row || typeof row !== "object") return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) out[normalizeKey(k)] = v;
  return out;
}

function pick(norm: Record<string, any>, ...aliases: string[]): any {
  for (const a of aliases) {
    const v = norm[normalizeKey(a)];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

const truthy = (v: any) =>
  v === true || v === 1 || v === "1" ||
  (typeof v === "string" && ["true", "yes", "y", "active"].includes(v.toLowerCase()));
const falsy = (v: any) =>
  v === false || v === 0 || v === "0" ||
  (typeof v === "string" && ["false", "no", "n", "inactive"].includes(v.toLowerCase()));

function parseArrayish(v: any): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) {
    return v.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeRole(v: any): string {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return "extinguisher_tech";
  if (s.includes("manager") || s.includes("admin")) return "manager";
  if (s.includes("super")) return "supervisor";
  if (s.includes("sprink")) return "sprinkler_tech";
  if (s.includes("suppress")) return "suppression_tech";
  if (s.includes("helper") || s.includes("apprentice")) return "helper";
  if (s.includes("ext") || s.includes("fire ext") || s === "tech" || s === "technician") return "extinguisher_tech";
  return s.replace(/[\s-]+/g, "_");
}

export const importAll = mutation({
  args: {
    data: v.object({
      employees:         v.optional(v.array(v.any())),
      customers:         v.optional(v.array(v.any())),
      customerLocations: v.optional(v.array(v.any())),
      jobs:              v.optional(v.array(v.any())),
      openJobs:          v.optional(v.array(v.any())),
      invoices:          v.optional(v.array(v.any())),
      vans:              v.optional(v.array(v.any())),
      timeOffRequests:   v.optional(v.array(v.any())),
      serviceRequests:   v.optional(v.array(v.any())),
      recurringSchedules: v.optional(v.array(v.any())),
    }),
    clearFirst: v.optional(v.boolean()),
  },
  handler: async (ctx, { data, clearFirst }) => {
    if (clearFirst) {
      const tables = ["invoices", "jobs", "openJobs", "customerPricing", "customerLocations", "customers", "employees", "recurringSchedules", "vans", "timeOffRequests", "serviceRequests"] as const;
      for (const table of tables) {
        const rows = await (ctx.db.query as any)(table).collect();
        for (const row of rows) await ctx.db.delete(row._id);
      }
    }

    const counts: Record<string, number> = {};
    const empIdMap = new Map<string, Id<"employees">>();
    const custIdMap = new Map<string, Id<"customers">>();
    const jobIdMap = new Map<string, Id<"jobs">>();

    // Pre-load existing employees so jobs that reference already-present
    // employees (not included in this batch) resolve their employeeId correctly.
    {
      const existingEmps = await ctx.db.query("employees").collect();
      for (const emp of existingEmps) {
        empIdMap.set(String(emp._id), emp._id);
        // Also index by normalised name as a fallback.
        empIdMap.set(`name:${emp.name.trim().toLowerCase()}`, emp._id);
      }
    }
    // Same pre-load for customers.
    {
      const existingCusts = await ctx.db.query("customers").collect();
      for (const c of existingCusts) {
        custIdMap.set(String(c._id), c._id);
        custIdMap.set(`name:${c.name.trim().toLowerCase()}`, c._id);
      }
    }

    if (data.employees?.length) {
      for (const raw of data.employees) {
        const e = normRow(raw);
        const oldId = String(pick(e, "_id", "id", "employeeId", "empId", "employeeNumber") ?? "");
        const activeRaw = pick(e, "isActive", "active", "status");
        const newId = await ctx.db.insert("employees", {
          name: String(pick(e, "name", "fullName", "employeeName", "tech", "technician", "firstName") ?? "Unknown"),
          role: normalizeRole(pick(e, "role", "position", "title", "jobTitle", "type")),
          salary: Number(pick(e, "salary", "annualSalary", "pay", "wage", "compensation") ?? 50000),
          billableRate: Number(pick(e, "billableRate", "rate", "hourlyRate", "billRate", "billing") ?? 800),
          homeZip: String(pick(e, "homeZip", "zip", "zipCode", "postalCode", "postal") ?? "00000"),
          certifications: parseArrayish(pick(e, "certifications", "certs", "certification", "licenses", "license")),
          allowedShopDays: Number(pick(e, "allowedShopDays", "shopDaysAllowed", "shopAllowance") ?? 5),
          shopDaysUsedYtd: Number(pick(e, "shopDaysUsedYtd", "shopDaysUsed", "shopUsed") ?? 0),
          allowedTrainingDays: Number(pick(e, "allowedTrainingDays", "trainingDaysAllowed", "trainingAllowance") ?? 3),
          trainingDaysUsedYtd: Number(pick(e, "trainingDaysUsedYtd", "trainingDaysUsed", "trainingUsed") ?? 0),
          utilizationPct: Number(pick(e, "utilizationPct", "utilization", "util", "utilizationPercent") ?? 0),
          isActive: falsy(activeRaw) ? false : true,
        });
        if (oldId) empIdMap.set(oldId, newId);
      }
      counts.employees = data.employees.length;
    }

    if (data.customers?.length) {
      for (const raw of data.customers) {
        const c = normRow(raw);
        const oldId = String(pick(c, "_id", "id", "customerId", "customerNumber", "accountNumber") ?? "");
        const activeRaw = pick(c, "isActive", "active", "status");
        const newId = await ctx.db.insert("customers", {
          name: String(pick(c, "name", "customerName", "company", "companyName", "businessName", "client", "clientName", "account") ?? "Unknown"),
          facilityType: String(pick(c, "facilityType", "type", "category", "industry") ?? "commercial"),
          address: String(pick(c, "address", "streetAddress", "street", "addr", "fullAddress", "location") ?? ""),
          contactName: String(pick(c, "contactName", "contact", "primaryContact", "contactPerson") ?? ""),
          contactPhone: String(pick(c, "contactPhone", "phone", "telephone", "tel", "phoneNumber", "mobile") ?? ""),
          contactEmail: (() => { const v = pick(c, "contactEmail", "email", "emailAddress"); return v ? String(v) : undefined; })(),
          inspectionFrequency: String(pick(c, "inspectionFrequency", "frequency", "inspectionInterval", "interval") ?? "annual"),
          isActive: falsy(activeRaw) ? false : true,
        });
        if (oldId) custIdMap.set(oldId, newId);
      }
      counts.customers = data.customers.length;
    }

    if (data.customerLocations?.length) {
      for (const l of data.customerLocations) {
        const oldCustId = String(l.customerId ?? "");
        const newCustId = custIdMap.get(oldCustId) ?? l.customerId;
        if (!newCustId) continue;
        await ctx.db.insert("customerLocations", {
          customerId: newCustId as Id<"customers">,
          name: String(l.name ?? "Location"),
          address: String(l.address ?? ""),
          contactName: l.contactName ? String(l.contactName) : undefined,
          contactPhone: l.contactPhone ? String(l.contactPhone) : undefined,
          isPrimary: l.isPrimary === true,
        });
      }
      counts.customerLocations = data.customerLocations.length;
    }

    if (data.jobs?.length) {
      for (const raw of data.jobs) {
        const j = normRow(raw);
        const oldCustId = String(pick(j, "customerId", "custId", "clientId") ?? "");
        const custName = pick(j, "customerName", "customer", "client", "clientName", "company", "account") as string | undefined;
        const nameKey = custName ? `name:${String(custName).trim().toLowerCase()}` : "";
        let newCustId: Id<"customers"> | undefined =
          (oldCustId ? custIdMap.get(oldCustId) : undefined) ??
          (nameKey ? custIdMap.get(nameKey) : undefined);
        if (!newCustId && custName) {
          newCustId = await ctx.db.insert("customers", {
            name: String(custName), facilityType: "commercial", address: "", contactName: "", contactPhone: "",
            inspectionFrequency: "annual", isActive: true,
          });
          custIdMap.set(nameKey, newCustId);
          if (oldCustId) custIdMap.set(oldCustId, newCustId);
        }
        if (!newCustId) continue;
        const oldEmpId = pick(j, "employeeId", "empId", "techId", "technicianId", "assignedTo", "tech") ? String(pick(j, "employeeId", "empId", "techId", "technicianId", "assignedTo", "tech")) : null;
        const empNameRaw = pick(j, "employeeName", "techName", "technicianName", "assignedToName", "assignedEmployee") as string | undefined;
        const empNameKey = empNameRaw ? `name:${String(empNameRaw).trim().toLowerCase()}` : "";
        const newEmpId = oldEmpId
          ? (empIdMap.get(oldEmpId) ?? (empNameKey ? empIdMap.get(empNameKey) : undefined) ?? undefined)
          : (empNameKey ? empIdMap.get(empNameKey) : undefined);
        const oldJobId = String(pick(j, "_id", "id", "jobId", "jobNumber", "workOrder", "workOrderNumber") ?? "");
        const newJobId = await ctx.db.insert("jobs", {
          customerId: newCustId as Id<"customers">,
          employeeId: newEmpId as Id<"employees"> | undefined,
          serviceType: String(pick(j, "serviceType", "service", "type", "category", "workType") ?? "extinguisher_inspection"),
          status: String(pick(j, "status", "state", "jobStatus") ?? "pending"),
          priority: String(pick(j, "priority", "urgency") ?? "medium"),
          scheduledDate: (() => { const v = pick(j, "scheduledDate", "date", "scheduled", "serviceDate", "appointmentDate", "startDate"); return v ? String(v) : undefined; })(),
          dueDate: (() => { const v = pick(j, "dueDate", "due", "deadline", "endDate"); return v ? String(v) : undefined; })(),
          revenue: Number(pick(j, "revenue", "amount", "total", "totalAmount", "price", "value", "sales") ?? 0),
          quantity: Number(pick(j, "quantity", "qty", "units", "count") ?? 1),
          notes: (() => { const v = pick(j, "notes", "description", "comments", "memo", "details"); return v ? String(v) : undefined; })(),
          certificationRequired: String(pick(j, "certificationRequired", "certRequired", "certification") ?? "any"),
          requiresFollowUp: truthy(pick(j, "requiresFollowUp", "followUp", "needsFollowUp")),
          followUpConfirmed: truthy(pick(j, "followUpConfirmed", "followUpDone")),
        });
        if (oldJobId) jobIdMap.set(oldJobId, newJobId);
      }
      counts.jobs = data.jobs.length;
    }

    if (data.openJobs?.length) {
      for (const oj of data.openJobs) {
        await ctx.db.insert("openJobs", {
          title: String(oj.title ?? "Open Job"),
          clientName: String(oj.clientName ?? ""),
          clientAddress: oj.clientAddress ? String(oj.clientAddress) : undefined,
          zipCode: oj.zipCode ? String(oj.zipCode) : undefined,
          certRequired: String(oj.certRequired ?? "any"),
          priority: String(oj.priority ?? "medium"),
          notes: oj.notes ? String(oj.notes) : undefined,
        });
      }
      counts.openJobs = data.openJobs.length;
    }

    if (data.invoices?.length) {
      for (const raw of data.invoices) {
        const inv = normRow(raw);
        const oldCustId = String(pick(inv, "customerId", "custId", "clientId") ?? "");
        const custName = pick(inv, "customerName", "customer", "client", "clientName", "company", "account") as string | undefined;
        const nameKey = custName ? `name:${String(custName).trim().toLowerCase()}` : "";
        const newCustId: Id<"customers"> | undefined =
          (oldCustId ? custIdMap.get(oldCustId) : undefined) ??
          (nameKey ? custIdMap.get(nameKey) : undefined);
        if (!newCustId) continue;
        const oldTechId = pick(inv, "techId", "employeeId", "technicianId", "tech") ? String(pick(inv, "techId", "employeeId", "technicianId", "tech")) : null;
        const newTechId = oldTechId ? (empIdMap.get(oldTechId) ?? undefined) : undefined;
        const oldJobId = pick(inv, "jobId", "workOrderId", "job") ? String(pick(inv, "jobId", "workOrderId", "job")) : null;
        const newJobId = oldJobId ? (jobIdMap.get(oldJobId) ?? undefined) : undefined;
        const lineItemsRaw = pick(inv, "lineItems", "items", "lines");
        await ctx.db.insert("invoices", {
          invoiceNumber: String(pick(inv, "invoiceNumber", "invoiceNo", "number", "invoice", "invoiceId") ?? `INV-IMP-${Date.now()}`),
          customerId: newCustId as Id<"customers">,
          jobId: newJobId as Id<"jobs"> | undefined,
          techId: newTechId as Id<"employees"> | undefined,
          lineItems: Array.isArray(lineItemsRaw) ? lineItemsRaw : [],
          totalAmount: Number(pick(inv, "totalAmount", "total", "amount", "amountDue", "grandTotal", "balance") ?? 0),
          status: String(pick(inv, "status", "state", "paymentStatus") ?? "draft"),
        });
      }
      counts.invoices = data.invoices.length;
    }

    if (data.vans?.length) {
      for (const van of data.vans) {
        const oldEmpId = van.assignedEmployeeId ? String(van.assignedEmployeeId) : null;
        const newEmpId = oldEmpId ? (empIdMap.get(oldEmpId) ?? undefined) : undefined;
        await ctx.db.insert("vans", {
          name: String(van.name ?? "Van"),
          licensePlate: String(van.licensePlate ?? ""),
          make: String(van.make ?? "Ford"),
          model: String(van.model ?? "Transit"),
          year: Number(van.year ?? new Date().getFullYear()),
          color: String(van.color ?? "White"),
          assignedEmployeeId: newEmpId as Id<"employees"> | undefined,
          gpsTrackerId: van.gpsTrackerId ? String(van.gpsTrackerId) : undefined,
          gpsTrackerSerial: van.gpsTrackerSerial ? String(van.gpsTrackerSerial) : undefined,
          gpsTrackerModel: van.gpsTrackerModel ? String(van.gpsTrackerModel) : undefined,
          lat: van.lat != null ? Number(van.lat) : undefined,
          lng: van.lng != null ? Number(van.lng) : undefined,
          speed: Number(van.speed ?? 0),
          heading: Number(van.heading ?? 0),
          status: String(van.status ?? "active"),
          notes: van.notes ? String(van.notes) : undefined,
        });
      }
      counts.vans = data.vans.length;
    }

    if (data.timeOffRequests?.length) {
      for (const tor of data.timeOffRequests) {
        const oldEmpId = tor.employeeId ? String(tor.employeeId) : null;
        const newEmpId = oldEmpId ? (empIdMap.get(oldEmpId) ?? undefined) : undefined;
        if (!newEmpId) continue;
        await ctx.db.insert("timeOffRequests", {
          employeeId: newEmpId as Id<"employees">,
          requestedDate: String(tor.requestedDate ?? new Date().toISOString().slice(0, 10)),
          endDate: tor.endDate ? String(tor.endDate) : undefined,
          type: String(tor.type ?? "vacation"),
          reason: tor.reason ? String(tor.reason) : undefined,
          notes: tor.notes ? String(tor.notes) : undefined,
          status: String(tor.status ?? "pending"),
          denialReason: tor.denialReason ? String(tor.denialReason) : undefined,
          reviewedBy: tor.reviewedBy ? String(tor.reviewedBy) : undefined,
          reviewNote: tor.reviewNote ? String(tor.reviewNote) : undefined,
        });
      }
      counts.timeOffRequests = data.timeOffRequests.length;
    }

    if (data.recurringSchedules?.length) {
      for (const rs of data.recurringSchedules) {
        const oldCustId = String(rs.customerId ?? "");
        const newCustId = custIdMap.get(oldCustId) ?? rs.customerId;
        if (!newCustId) continue;
        const oldEmpId = rs.employeeId ? String(rs.employeeId) : null;
        const newEmpId = oldEmpId ? (empIdMap.get(oldEmpId) ?? undefined) : undefined;
        await ctx.db.insert("recurringSchedules", {
          customerId: newCustId as Id<"customers">,
          employeeId: newEmpId as Id<"employees"> | undefined,
          serviceType: String(rs.serviceType ?? "inspection"),
          intervalType: String(rs.intervalType ?? "monthly"),
          customDays: rs.customDays != null ? Number(rs.customDays) : undefined,
          startDate: String(rs.startDate ?? new Date().toISOString().slice(0, 10)),
          nextOccurrence: String(rs.nextOccurrence ?? new Date().toISOString().slice(0, 10)),
          status: String(rs.status ?? "active"),
          revenue: Number(rs.revenue ?? 0),
          notes: rs.notes ? String(rs.notes) : undefined,
        });
      }
      counts.recurringSchedules = data.recurringSchedules.length;
    }

    if (data.serviceRequests?.length) {
      for (const sr of data.serviceRequests) {
        const oldCustId = String(sr.customerId ?? "");
        const newCustId = custIdMap.get(oldCustId) ?? sr.customerId;
        if (!newCustId) continue;
        await ctx.db.insert("serviceRequests", {
          customerId: newCustId as Id<"customers">,
          serviceType: String(sr.serviceType ?? "inspection"),
          urgency: String(sr.urgency ?? "standard"),
          description: sr.description ? String(sr.description) : undefined,
          status: String(sr.status ?? "pending"),
        });
      }
      counts.serviceRequests = data.serviceRequests.length;
    }

    return { success: true, imported: counts };
  },
});
