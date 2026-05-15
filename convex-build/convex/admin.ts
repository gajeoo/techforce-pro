import { mutation, query } from "./_generated/server";

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
    const [employees, customers, customerLocations, jobs, openJobs, invoices, recurringSchedules] = await Promise.all([
      ctx.db.query("employees").collect(),
      ctx.db.query("customers").collect(),
      ctx.db.query("customerLocations").collect(),
      ctx.db.query("jobs").collect(),
      ctx.db.query("openJobs").collect(),
      ctx.db.query("invoices").collect(),
      ctx.db.query("recurringSchedules").collect(),
    ]);
    return { exportedAt: new Date().toISOString(), version: "2.0-convex", data: { employees, customers, customerLocations, jobs, openJobs, invoices, recurringSchedules } };
  },
});
