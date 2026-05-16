import type { Doc } from "@/convex/_generated/dataModel";

/** Job document as returned by api.jobs.list (includes joined names). */
export type ConvexJob = Doc<"jobs"> & {
  customerName: string;
  customerAddress: string;
  employeeName: string | null;
};

/** Customer document as returned by api.customers.list. */
export type ConvexCustomer = Doc<"customers">;

/** Invoice document as returned by api.invoices.list (includes joined names). */
export type ConvexInvoice = Doc<"invoices"> & {
  customerName: string;
  techName: string | null;
};

/** Employee document as returned by api.employees.list. */
export type ConvexEmployee = Doc<"employees">;

/** Service-request document as returned by api.serviceRequests.list. */
export type ConvexServiceRequest = Doc<"serviceRequests"> & {
  customerName: string;
};

/** Recurring schedule document as returned by api.recurringSchedules.list. */
export type ConvexRecurringSchedule = Doc<"recurringSchedules">;

/** Time-off request document as returned by api.timeoff.list. */
export type ConvexTimeOff = Doc<"timeOffRequests">;

/** Open job document as returned by api.openJobs.list (may include resolved co-tech names). */
export type ConvexOpenJob = Doc<"openJobs"> & {
  coTechnicianNames?: string[];
};

/**
 * A job card item shown in the tech portal — either a real ConvexJob or a
 * synthesized record built from a ConvexOpenJob.
 */
export interface TechJob {
  _id: string;
  _isOpenJob?: true;
  customerName: string;
  customerAddress: string;
  serviceType: string;
  status: string;
  priority?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  notes?: string | null;
  employeeId?: string;
}
