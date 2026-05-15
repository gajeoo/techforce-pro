import { db } from "@workspace/db";
import {
  employeesTable, customersTable, customerPricingTable,
  jobsTable, openJobsTable, invoicesTable, invoiceTemplateTable,
} from "@workspace/db";

async function seed() {
  console.log("🌱 Seeding TechForce Pro...");

  // Employees
  const employees = await db.insert(employeesTable).values([
    { name: "Marcus Williams", role: "suppression_lead", salary: "72000", billableRate: "95", homeZip: "21046", certifications: ["suppression", "extinguisher"], allowedShopDays: 2, shopDaysUsedYtd: 1, utilizationPct: "92" },
    { name: "Jennifer Torres", role: "sprinkler_tech", salary: "62000", billableRate: "85", homeZip: "21201", certifications: ["sprinkler", "extinguisher"], allowedShopDays: 3, shopDaysUsedYtd: 2, utilizationPct: "88" },
    { name: "Devon Clark", role: "extinguisher_tech", salary: "52000", billableRate: "72", homeZip: "21090", certifications: ["extinguisher", "exit_light"], allowedShopDays: 5, shopDaysUsedYtd: 3, utilizationPct: "85" },
    { name: "Rosa Martinez", role: "helper", salary: "40000", billableRate: "55", homeZip: "21157", certifications: ["extinguisher"], allowedShopDays: 12, shopDaysUsedYtd: 7, utilizationPct: "78" },
    { name: "Tyler Brooks", role: "extinguisher_tech", salary: "54000", billableRate: "72", homeZip: "21044", certifications: ["extinguisher", "suppression"], allowedShopDays: 5, shopDaysUsedYtd: 1, utilizationPct: "91" },
  ]).returning();
  console.log(`✅ ${employees.length} employees`);

  // Customers
  const customers = await db.insert(customersTable).values([
    { name: "Chick-fil-A #1042 - Columbia", facilityType: "restaurant", address: "6481 Dobbin Rd, Columbia MD 21045", contactName: "Sarah Kim", contactPhone: "410-555-0101", inspectionFrequency: "semi-annual" },
    { name: "Howard County Schools - Div. A", facilityType: "school", address: "10910 Clarksville Pike, Ellicott City MD 21042", contactName: "Doug Franklin", contactPhone: "410-555-0202", inspectionFrequency: "annual" },
    { name: "Merriweather Commons HOA", facilityType: "condo", address: "5900 Symphony Woods Rd, Columbia MD 21044", contactName: "Patricia Lee", contactPhone: "410-555-0303", inspectionFrequency: "annual" },
    { name: "Wegmans Ellicott City", facilityType: "commercial", address: "3885 Crain Hwy, Waldorf MD 20603", contactName: "Mike Peters", contactPhone: "301-555-0404", inspectionFrequency: "quarterly" },
    { name: "Arundel Group Home - Site 7", facilityType: "group_home", address: "224 Dorchester Rd, Annapolis MD 21401", contactName: "Carla Osei", contactPhone: "410-555-0505", inspectionFrequency: "annual" },
    { name: "County Fleet Depot - Lot C", facilityType: "fleet", address: "8500 Guilford Rd, Columbia MD 21046", contactName: "Ron Harris", contactPhone: "410-555-0606", inspectionFrequency: "annual" },
  ]).returning();
  console.log(`✅ ${customers.length} customers`);

  // Custom pricing for Chick-fil-A (negotiated rates)
  await db.insert(customerPricingTable).values([
    { customerId: customers[0].id, serviceType: "extinguisher_inspection", customerRate: "42", standardRate: "55", unit: "per_unit" },
    { customerId: customers[0].id, serviceType: "hood_suppression", customerRate: "1200", standardRate: "1800", unit: "flat" },
    { customerId: customers[3].id, serviceType: "sprinkler_test", customerRate: "950", standardRate: "1200", unit: "flat" },
  ]);
  console.log("✅ Custom pricing set");

  // Jobs
  const today = new Date();
  function dateStr(offset: number) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  }

  const jobs = await db.insert(jobsTable).values([
    { customerId: customers[0].id, employeeId: employees[0].id, serviceType: "hood_suppression", status: "completed", priority: "high", scheduledDate: dateStr(-30), revenue: "1200", quantity: 1, notes: "Semi-annual kitchen suppression check" },
    { customerId: customers[1].id, employeeId: employees[1].id, serviceType: "sprinkler_test", status: "completed", priority: "medium", scheduledDate: dateStr(-15), revenue: "2400", quantity: 2, notes: "Two buildings tested" },
    { customerId: customers[2].id, employeeId: employees[2].id, serviceType: "extinguisher_inspection", status: "in_progress", priority: "medium", scheduledDate: dateStr(0), revenue: "630", quantity: 15, scheduledTime: "09:00" },
    { customerId: customers[3].id, employeeId: employees[1].id, serviceType: "sprinkler_test", status: "pending", priority: "high", scheduledDate: dateStr(3), revenue: "950", quantity: 1 },
    { customerId: customers[4].id, employeeId: employees[3].id, serviceType: "exit_light_check", status: "return", priority: "low", scheduledDate: dateStr(-5), revenue: "180", quantity: 1, notes: "3 lights need replacement - returning next week", requiresFollowUp: true, followUpConfirmed: false },
    { customerId: customers[5].id, employeeId: employees[4].id, serviceType: "extinguisher_inspection", status: "reschedule", priority: "medium", scheduledDate: dateStr(-2), revenue: "320", quantity: 8, notes: "Fleet lot was closed - reschedule requested" },
    { customerId: customers[0].id, employeeId: null, serviceType: "extinguisher_inspection", status: "pending", priority: "medium", scheduledDate: dateStr(7), revenue: "210", quantity: 5 },
    { customerId: customers[1].id, employeeId: employees[0].id, serviceType: "hood_suppression", status: "pending", priority: "high", scheduledDate: dateStr(5), revenue: "1800", quantity: 1, certificationRequired: "suppression" },
  ]).returning();
  console.log(`✅ ${jobs.length} jobs`);

  // Open jobs (unscheduled)
  await db.insert(openJobsTable).values([
    { title: "Extinguisher Annual - Towson Mall Food Court", clientName: "Towson Mall LLC", certRequired: "extinguisher", priority: "high" },
    { title: "Hood Suppression Service - Applebee's Rte 40", clientName: "Applebee's #3317", certRequired: "suppression", priority: "high" },
    { title: "Sprinkler 5yr Test - Camden Apartments Bldg B", clientName: "Camden Property Trust", certRequired: "sprinkler", priority: "medium" },
    { title: "Exit Light Annual - Loyola Elementary", clientName: "Baltimore City Schools", certRequired: "exit_light", priority: "medium" },
    { title: "Extinguisher Inspection - Aldi #0442", clientName: "ALDI Inc", certRequired: "extinguisher", priority: "low" },
    { title: "Fleet Vehicle Extinguishers - DPW Yard", clientName: "Howard Co. DPW", certRequired: "extinguisher", priority: "low" },
  ]);
  console.log("✅ 6 open jobs");

  // Auto-generate invoices for completed jobs
  for (const job of jobs.filter((j: typeof jobs[0]) => j.status === "completed")) {
    const customer = customers.find((c: typeof customers[0]) => c.id === job.customerId)!;
    const lineItems = [{
      service: job.serviceType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      quantity: job.quantity,
      rate: Number(job.revenue) / job.quantity,
      total: Number(job.revenue),
    }];
    const invoiceNumber = `MC-2025-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    await db.insert(invoicesTable).values({
      invoiceNumber,
      customerId: job.customerId,
      jobId: job.id,
      lineItems,
      totalAmount: job.revenue,
      status: Math.random() > 0.5 ? "paid" : "sent",
    });
  }
  console.log("✅ Invoices generated for completed jobs");

  // Invoice template
  await db.insert(invoiceTemplateTable).values({
    companyName: "Multicorp Fire Protection Services",
    address: "9693 Gerwig Lane, Columbia, MD 21046",
    phone: "(410) 876-5000",
  });
  console.log("✅ Invoice template set");

  console.log("\n🎉 Seed complete! TechForce Pro is ready.");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
