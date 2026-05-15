import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  employees: defineTable({
    name: v.string(),
    role: v.string(),
    salary: v.number(),
    billableRate: v.number(),
    homeZip: v.string(),
    certifications: v.array(v.string()),
    allowedShopDays: v.number(),
    shopDaysUsedYtd: v.number(),
    allowedTrainingDays: v.number(),
    trainingDaysUsedYtd: v.number(),
    utilizationPct: v.number(),
    isActive: v.boolean(),
  }),

  customers: defineTable({
    name: v.string(),
    facilityType: v.string(),
    address: v.string(),
    contactName: v.string(),
    contactPhone: v.string(),
    contactEmail: v.optional(v.string()),
    inspectionFrequency: v.string(),
    isActive: v.boolean(),
  }),

  customerLocations: defineTable({
    customerId: v.id("customers"),
    name: v.string(),
    address: v.string(),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    isPrimary: v.boolean(),
  }).index("by_customer", ["customerId"]),

  customerPricing: defineTable({
    customerId: v.id("customers"),
    serviceType: v.string(),
    customerRate: v.number(),
    standardRate: v.number(),
    unit: v.string(),
  }).index("by_customer", ["customerId"]),

  jobs: defineTable({
    customerId: v.id("customers"),
    employeeId: v.optional(v.id("employees")),
    locationId: v.optional(v.id("customerLocations")),
    locationName: v.optional(v.string()),
    serviceType: v.string(),
    status: v.string(),
    priority: v.string(),
    scheduledDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    revenue: v.number(),
    quantity: v.number(),
    notes: v.optional(v.string()),
    requiresFollowUp: v.boolean(),
    followUpConfirmed: v.boolean(),
    certificationRequired: v.string(),
    nonComplianceReason: v.optional(v.string()),
    nonComplianceNotifiedAt: v.optional(v.number()),
  })
    .index("by_customer", ["customerId"])
    .index("by_employee", ["employeeId"])
    .index("by_status", ["status"])
    .index("by_date", ["scheduledDate"]),

  openJobs: defineTable({
    title: v.string(),
    clientName: v.string(),
    clientAddress: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    certRequired: v.string(),
    priority: v.string(),
    assignedEmployeeId: v.optional(v.id("employees")),
    coTechnicianIds: v.optional(v.array(v.id("employees"))),
    notes: v.optional(v.string()),
  }),

  recurringSchedules: defineTable({
    customerId: v.id("customers"),
    employeeId: v.optional(v.id("employees")),
    serviceType: v.string(),
    intervalType: v.string(),
    customDays: v.optional(v.number()),
    startDate: v.string(),
    nextOccurrence: v.string(),
    status: v.string(),
    revenue: v.number(),
    notes: v.optional(v.string()),
  }).index("by_customer", ["customerId"]),

  invoices: defineTable({
    invoiceNumber: v.string(),
    customerId: v.id("customers"),
    jobId: v.optional(v.id("jobs")),
    techId: v.optional(v.id("employees")),
    lineItems: v.array(
      v.object({
        service: v.string(),
        quantity: v.number(),
        rate: v.number(),
        total: v.number(),
      })
    ),
    totalAmount: v.number(),
    status: v.string(),
  })
    .index("by_customer", ["customerId"])
    .index("by_job", ["jobId"]),

  invoiceTemplate: defineTable({
    companyName: v.string(),
    address: v.string(),
    phone: v.string(),
    logoUrl: v.optional(v.string()),
  }),

  timeOffRequests: defineTable({
    employeeId: v.id("employees"),
    requestedDate: v.string(),
    endDate: v.optional(v.string()),
    type: v.string(),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.string(),
    denialReason: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
  }).index("by_employee", ["employeeId"]),

  vans: defineTable({
    name: v.string(),
    licensePlate: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    color: v.string(),
    assignedEmployeeId: v.optional(v.id("employees")),
    gpsTrackerId: v.optional(v.string()),
    gpsTrackerSerial: v.optional(v.string()),
    gpsTrackerModel: v.optional(v.string()),
    gpsTrackerInstalledAt: v.optional(v.number()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    speed: v.number(),
    heading: v.number(),
    lastLocationUpdate: v.optional(v.number()),
    status: v.string(),
    notes: v.optional(v.string()),
  }),

  appointments: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    type: v.string(),
    participants: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    calendarOwner: v.string(),
  }).index("by_date", ["date"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    createdBy: v.string(),
    createdByRole: v.string(),
    assignedTo: v.optional(v.string()),
    priority: v.string(),
    status: v.string(),
    dueDate: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
  }),

  serviceRequests: defineTable({
    customerId: v.id("customers"),
    serviceType: v.string(),
    urgency: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    fulfilledJobId: v.optional(v.id("jobs")),
  }).index("by_customer", ["customerId"]),

  conversations: defineTable({
    title: v.optional(v.string()),
  }),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.string(),
    content: v.string(),
  }).index("by_conversation", ["conversationId"]),
});
