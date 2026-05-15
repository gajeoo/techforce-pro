const STORAGE_KEY = "tfpro_mock_api_state_v1";
const INSTALL_KEY = "__TFPRO_MOCK_API_INSTALLED__";

interface Employee {
  id: number;
  name: string;
  role: string;
  salary: number;
  billableRate: number;
  homeZip: string;
  certifications: string[];
  allowedShopDays: number;
  shopDaysUsedYtd: number;
  allowedTrainingDays: number;
  trainingDaysUsedYtd: number;
  utilizationPct: number;
  hourlyRate: number | null;
  hoursPerDay: number;
  isActive: boolean;
}

interface Customer {
  id: number;
  name: string;
  facilityType: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  inspectionFrequency: string;
  isActive: boolean;
}

interface CustomerLocation {
  id: number;
  customerId: number;
  name: string;
  address: string;
  contactName: string | null;
  contactPhone: string | null;
  isPrimary: boolean;
  createdAt: string;
}

interface Job {
  id: number;
  customerId: number;
  employeeId: number | null;
  locationId: number | null;
  locationName: string | null;
  serviceType: string;
  status: string;
  priority: string;
  scheduledDate: string | null;
  dueDate: string | null;
  scheduledTime: string | null;
  revenue: number;
  quantity: number;
  notes: string | null;
  requiresFollowUp: boolean;
  followUpConfirmed: boolean;
  certificationRequired: string;
  customerName: string;
  customerAddress: string;
  employeeName: string | null;
  nonComplianceReason: string | null;
  nonComplianceNotifiedAt: string | null;
}

interface OpenJob {
  id: number;
  title: string;
  clientName: string;
  clientAddress: string | null;
  zipCode: string | null;
  certRequired: string;
  priority: string;
  notes: string | null;
  assignedEmployeeId: number | null;
  assignedEmployeeName: string | null;
  coTechnicianIds: number[];
  coTechnicianNames: string[];
  scheduledDate: string | null;
  scheduledTime: string | null;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  jobId: number | null;
  techId: number | null;
  techName: string | null;
  lineItems: Array<{ service: string; quantity: number; rate: number; total: number }>;
  totalAmount: number;
  status: string;
  generatedAt: string;
  customerName: string;
}

interface RecurringSchedule {
  id: number;
  customerId: number;
  customerName: string;
  employeeId: number | null;
  employeeName: string | null;
  serviceType: string;
  intervalType: "6months" | "1year" | "custom";
  customDays: number | null;
  startDate: string;
  nextOccurrence: string;
  status: "active" | "paused";
  revenue: number;
  notes: string | null;
  createdAt: string;
}

interface TimeOffRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  notes: string;
  status: "pending" | "approved" | "denied";
  denialReason: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  createdBy: string;
  createdByRole: string;
  assignedTo: string | null;
  priority: "high" | "medium" | "low";
  status: "open" | "in-progress" | "done";
  dueDate: string | null;
  jobId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Appointment {
  id: number;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  type: string;
  participants: string | null;
  location: string | null;
  notes: string | null;
  createdBy: string | null;
  calendarOwner: string;
  createdAt: string;
}

interface ServiceRequest {
  id: number;
  customerId: number;
  customerName: string;
  serviceType: string;
  description: string | null;
  location: string | null;
  preferredDate: string | null;
  urgency: string;
  status: "pending" | "in-review" | "scheduled" | "completed" | "declined";
  managerMessage: string | null;
  fulfilledJobId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Van {
  id: number;
  name: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  assignedEmployeeId: number | null;
  gpsTrackerId: string | null;
  gpsTrackerSerial: string | null;
  gpsTrackerModel: string | null;
  gpsTrackerInstalledAt: string | null;
  lat: string | null;
  lng: string | null;
  speed: number;
  heading: number;
  lastLocationUpdate: string | null;
  status: string;
  notes: string | null;
}

interface Conversation {
  id: number;
  title: string;
}

interface MockState {
  employees: Employee[];
  customers: Customer[];
  customerLocations: CustomerLocation[];
  jobs: Job[];
  openJobs: OpenJob[];
  invoices: Invoice[];
  recurringSchedules: RecurringSchedule[];
  timeOffRequests: TimeOffRequest[];
  tasks: Task[];
  appointments: Appointment[];
  serviceRequests: ServiceRequest[];
  vans: Van[];
  conversations: Conversation[];
  nextIds: Record<string, number>;
}

function daysFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInitialState(): MockState {
  const employees: Employee[] = [
    { id: 1, name: "Ernest McKinley", role: "extinguisher_tech", salary: 52000, billableRate: 850, homeZip: "21045", certifications: ["extinguisher", "exit_lights"], allowedShopDays: 5, shopDaysUsedYtd: 2, allowedTrainingDays: 3, trainingDaysUsedYtd: 1, utilizationPct: 87.5, hourlyRate: 32, hoursPerDay: 8, isActive: true },
    { id: 2, name: "Tyler Beaumont", role: "suppression_lead", salary: 72000, billableRate: 1200, homeZip: "21046", certifications: ["suppression", "extinguisher", "sprinkler"], allowedShopDays: 2, shopDaysUsedYtd: 1, allowedTrainingDays: 3, trainingDaysUsedYtd: 0, utilizationPct: 94.2, hourlyRate: 42, hoursPerDay: 8, isActive: true },
    { id: 3, name: "Ephraim Osei", role: "sprinkler_tech", salary: 61000, billableRate: 950, homeZip: "21229", certifications: ["sprinkler", "standpipe"], allowedShopDays: 3, shopDaysUsedYtd: 0, allowedTrainingDays: 3, trainingDaysUsedYtd: 2, utilizationPct: 91, hourlyRate: 36, hoursPerDay: 8, isActive: true },
    { id: 4, name: "James Rodriguez", role: "admin", salary: 78000, billableRate: 0, homeZip: "21044", certifications: [], allowedShopDays: 0, shopDaysUsedYtd: 0, allowedTrainingDays: 3, trainingDaysUsedYtd: 0, utilizationPct: 100, hourlyRate: 46, hoursPerDay: 8, isActive: true },
    { id: 5, name: "Sarah Johnson", role: "helper", salary: 43000, billableRate: 500, homeZip: "21075", certifications: ["extinguisher"], allowedShopDays: 12, shopDaysUsedYtd: 4, allowedTrainingDays: 4, trainingDaysUsedYtd: 1, utilizationPct: 82, hourlyRate: 24, hoursPerDay: 8, isActive: true },
    { id: 6, name: "Marcus Taylor", role: "sprinkler_tech", salary: 64000, billableRate: 980, homeZip: "21043", certifications: ["sprinkler", "extinguisher"], allowedShopDays: 3, shopDaysUsedYtd: 1, allowedTrainingDays: 3, trainingDaysUsedYtd: 0, utilizationPct: 89, hourlyRate: 37, hoursPerDay: 8, isActive: true },
  ];

  const customers: Customer[] = [
    { id: 1, name: "Harbor View Condominiums", facilityType: "condo", address: "2100 Boston St, Baltimore, MD 21231", contactName: "Patricia Nguyen", contactPhone: "(410) 555-0101", contactEmail: "pnguyen@harborview.com", inspectionFrequency: "annual", isActive: true },
    { id: 2, name: "Riverside Elementary School", facilityType: "school", address: "5500 Harpers Farm Rd, Columbia, MD 21044", contactName: "David Thornton", contactPhone: "(410) 555-0202", contactEmail: "dthornton@hcpss.org", inspectionFrequency: "semi-annual", isActive: true },
    { id: 3, name: "Gold Coast Restaurant Group", facilityType: "restaurant", address: "8800 Stanford Blvd, Columbia, MD 21045", contactName: "Marco Bellini", contactPhone: "(410) 555-0303", contactEmail: "marco@goldcoastrg.com", inspectionFrequency: "semi-annual", isActive: true },
    { id: 4, name: "Lincoln Elementary", facilityType: "school", address: "6200 Cedar Ln, Columbia, MD 21044", contactName: "Linda Carver", contactPhone: "(410) 555-0404", contactEmail: "lcarver@lincoln.edu", inspectionFrequency: "annual", isActive: true },
    { id: 5, name: "Metro Office Park", facilityType: "commercial", address: "8450 Broken Land Pkwy, Columbia, MD 21045", contactName: "Sean Miller", contactPhone: "(410) 555-0505", contactEmail: "sean@metrooffice.com", inspectionFrequency: "quarterly", isActive: true },
    { id: 6, name: "Olive Garden Columbia", facilityType: "restaurant", address: "10000 Town Center Ave, Columbia, MD 21044", contactName: "Sandra Mills", contactPhone: "(410) 555-0606", contactEmail: "sandra@olivegarden.com", inspectionFrequency: "semi-annual", isActive: true },
  ];

  const customerLocations: CustomerLocation[] = [
    { id: 1, customerId: 1, name: "Tower A - Main", address: "2100 Boston St, Tower A, Baltimore, MD 21231", contactName: "Patricia Nguyen", contactPhone: "(410) 555-0101", isPrimary: true, createdAt: nowIso() },
    { id: 2, customerId: 1, name: "Tower B", address: "2102 Boston St, Baltimore, MD 21231", contactName: "Front Desk", contactPhone: "(410) 555-0110", isPrimary: false, createdAt: nowIso() },
    { id: 3, customerId: 2, name: "Main Building", address: "5500 Harpers Farm Rd, Columbia, MD 21044", contactName: "David Thornton", contactPhone: "(410) 555-0202", isPrimary: true, createdAt: nowIso() },
    { id: 4, customerId: 2, name: "Gymnasium", address: "5500 Harpers Farm Rd, Gym Annex, Columbia, MD 21044", contactName: null, contactPhone: null, isPrimary: false, createdAt: nowIso() },
    { id: 5, customerId: 3, name: "Columbia Location", address: "8800 Stanford Blvd, Columbia, MD 21045", contactName: "Marco Bellini", contactPhone: "(410) 555-0303", isPrimary: true, createdAt: nowIso() },
    { id: 6, customerId: 4, name: "North Wing", address: "6200 Cedar Ln, Columbia, MD 21044", contactName: "Linda Carver", contactPhone: "(410) 555-0404", isPrimary: true, createdAt: nowIso() },
    { id: 7, customerId: 5, name: "Building A", address: "8450 Broken Land Pkwy, Columbia, MD 21045", contactName: "Sean Miller", contactPhone: "(410) 555-0505", isPrimary: true, createdAt: nowIso() },
    { id: 8, customerId: 6, name: "Dining Area", address: "10000 Town Center Ave, Columbia, MD 21044", contactName: "Sandra Mills", contactPhone: "(410) 555-0606", isPrimary: true, createdAt: nowIso() },
  ];

  const jobs: Job[] = [
    { id: 1, customerId: 3, employeeId: 2, locationId: 5, locationName: "Columbia Location", serviceType: "hood_suppression", status: "completed", priority: "high", scheduledDate: daysFromToday(-14), dueDate: daysFromToday(-14), scheduledTime: "08:30", revenue: 1400, quantity: 1, notes: "Annual hood suppression inspection", requiresFollowUp: false, followUpConfirmed: false, certificationRequired: "suppression", customerName: "Gold Coast Restaurant Group", customerAddress: "8800 Stanford Blvd, Columbia, MD 21045", employeeName: "Tyler Beaumont", nonComplianceReason: null, nonComplianceNotifiedAt: null },
    { id: 2, customerId: 1, employeeId: 1, locationId: 1, locationName: "Tower A - Main", serviceType: "extinguisher_inspection", status: "completed", priority: "medium", scheduledDate: daysFromToday(-7), dueDate: daysFromToday(-7), scheduledTime: "09:00", revenue: 780, quantity: 26, notes: "Tower A and B annual inspection", requiresFollowUp: false, followUpConfirmed: false, certificationRequired: "extinguisher", customerName: "Harbor View Condominiums", customerAddress: "2100 Boston St, Baltimore, MD 21231", employeeName: "Ernest McKinley", nonComplianceReason: null, nonComplianceNotifiedAt: null },
    { id: 3, customerId: 2, employeeId: 3, locationId: 3, locationName: "Main Building", serviceType: "sprinkler_test", status: "completed", priority: "medium", scheduledDate: daysFromToday(-21), dueDate: daysFromToday(-21), scheduledTime: "10:00", revenue: 1100, quantity: 1, notes: "Main campus sprinkler test", requiresFollowUp: false, followUpConfirmed: false, certificationRequired: "sprinkler", customerName: "Riverside Elementary School", customerAddress: "5500 Harpers Farm Rd, Columbia, MD 21044", employeeName: "Ephraim Osei", nonComplianceReason: null, nonComplianceNotifiedAt: null },
    { id: 4, customerId: 6, employeeId: 2, locationId: 8, locationName: "Dining Area", serviceType: "hood_suppression", status: "pending", priority: "high", scheduledDate: daysFromToday(5), dueDate: daysFromToday(5), scheduledTime: "08:00", revenue: 1450, quantity: 1, notes: "Semi-annual service", requiresFollowUp: false, followUpConfirmed: false, certificationRequired: "suppression", customerName: "Olive Garden Columbia", customerAddress: "10000 Town Center Ave, Columbia, MD 21044", employeeName: "Tyler Beaumont", nonComplianceReason: null, nonComplianceNotifiedAt: null },
    { id: 5, customerId: 5, employeeId: 6, locationId: 7, locationName: "Building A", serviceType: "sprinkler_test", status: "in_progress", priority: "medium", scheduledDate: daysFromToday(0), dueDate: daysFromToday(0), scheduledTime: "13:00", revenue: 950, quantity: 1, notes: "Quarterly sprinkler test", requiresFollowUp: false, followUpConfirmed: false, certificationRequired: "sprinkler", customerName: "Metro Office Park", customerAddress: "8450 Broken Land Pkwy, Columbia, MD 21045", employeeName: "Marcus Taylor", nonComplianceReason: null, nonComplianceNotifiedAt: null },
    { id: 6, customerId: 4, employeeId: 1, locationId: 6, locationName: "North Wing", serviceType: "extinguisher_inspection", status: "return", priority: "medium", scheduledDate: daysFromToday(-2), dueDate: daysFromToday(2), scheduledTime: "11:30", revenue: 420, quantity: 14, notes: "Return visit needed for 4 replacements", requiresFollowUp: true, followUpConfirmed: false, certificationRequired: "extinguisher", customerName: "Lincoln Elementary", customerAddress: "6200 Cedar Ln, Columbia, MD 21044", employeeName: "Ernest McKinley", nonComplianceReason: "4 units need replacement", nonComplianceNotifiedAt: nowIso() },
    { id: 7, customerId: 1, employeeId: 5, locationId: 2, locationName: "Tower B", serviceType: "exit_light_check", status: "reschedule", priority: "low", scheduledDate: daysFromToday(-1), dueDate: daysFromToday(4), scheduledTime: "15:00", revenue: 320, quantity: 8, notes: "Customer requested next week", requiresFollowUp: true, followUpConfirmed: true, certificationRequired: "exit_lights", customerName: "Harbor View Condominiums", customerAddress: "2100 Boston St, Baltimore, MD 21231", employeeName: "Sarah Johnson", nonComplianceReason: null, nonComplianceNotifiedAt: null },
    { id: 8, customerId: 2, employeeId: null, locationId: 4, locationName: "Gymnasium", serviceType: "sprinkler_test", status: "pending", priority: "high", scheduledDate: daysFromToday(8), dueDate: daysFromToday(8), scheduledTime: null, revenue: 1250, quantity: 1, notes: "Awaiting assignment", requiresFollowUp: false, followUpConfirmed: false, certificationRequired: "sprinkler", customerName: "Riverside Elementary School", customerAddress: "5500 Harpers Farm Rd, Columbia, MD 21044", employeeName: null, nonComplianceReason: null, nonComplianceNotifiedAt: null },
  ];

  const openJobs: OpenJob[] = [
    { id: 1, title: "Extinguisher Annual - Towson Mall Food Court", clientName: "Towson Mall LLC", clientAddress: "825 Dulaney Valley Rd, Towson, MD 21204", zipCode: "21204", certRequired: "extinguisher", priority: "high", notes: "Needs morning slot", assignedEmployeeId: null, assignedEmployeeName: null, coTechnicianIds: [], coTechnicianNames: [], scheduledDate: null, scheduledTime: null },
    { id: 2, title: "Hood Suppression Service - Applebee's Route 40", clientName: "Applebee's #3317", clientAddress: "10015 Baltimore National Pike, Ellicott City, MD 21042", zipCode: "21042", certRequired: "suppression", priority: "high", notes: null, assignedEmployeeId: 2, assignedEmployeeName: "Tyler Beaumont", coTechnicianIds: [], coTechnicianNames: [], scheduledDate: daysFromToday(2), scheduledTime: "07:30" },
    { id: 3, title: "Sprinkler 5-year Test - Camden Apartments", clientName: "Camden Property Trust", clientAddress: "6200 Chatham Ct, Elkridge, MD 21075", zipCode: "21075", certRequired: "sprinkler", priority: "medium", notes: null, assignedEmployeeId: 3, assignedEmployeeName: "Ephraim Osei", coTechnicianIds: [6], coTechnicianNames: ["Marcus Taylor"], scheduledDate: daysFromToday(4), scheduledTime: "09:00" },
    { id: 4, title: "Exit Light Annual - Loyola Elementary", clientName: "Baltimore City Schools", clientAddress: "7025 Bellona Ave, Baltimore, MD 21212", zipCode: "21212", certRequired: "exit_lights", priority: "medium", notes: null, assignedEmployeeId: 1, assignedEmployeeName: "Ernest McKinley", coTechnicianIds: [], coTechnicianNames: [], scheduledDate: daysFromToday(6), scheduledTime: "10:30" },
    { id: 5, title: "Fleet Vehicle Extinguishers - DPW Yard", clientName: "Howard County DPW", clientAddress: "9200 Berger Rd, Columbia, MD 21046", zipCode: "21046", certRequired: "extinguisher", priority: "low", notes: null, assignedEmployeeId: null, assignedEmployeeName: null, coTechnicianIds: [], coTechnicianNames: [], scheduledDate: null, scheduledTime: null },
    { id: 6, title: "Emergency Alarm Check - River Hill", clientName: "River Hill Center", clientAddress: "6030 Daybreak Cir, Clarksville, MD 21029", zipCode: "21029", certRequired: "sprinkler", priority: "high", notes: "Customer reported false alarms", assignedEmployeeId: 6, assignedEmployeeName: "Marcus Taylor", coTechnicianIds: [], coTechnicianNames: [], scheduledDate: daysFromToday(1), scheduledTime: "14:00" },
  ];

  const invoices: Invoice[] = [
    { id: 1, invoiceNumber: "INV-DEMO-0001", customerId: 3, jobId: 1, techId: 2, techName: "Tyler Beaumont", lineItems: [{ service: "Hood Suppression Annual", quantity: 1, rate: 1400, total: 1400 }], totalAmount: 1400, status: "sent", generatedAt: daysFromToday(-13), customerName: "Gold Coast Restaurant Group" },
    { id: 2, invoiceNumber: "INV-DEMO-0002", customerId: 1, jobId: 2, techId: 1, techName: "Ernest McKinley", lineItems: [{ service: "Extinguisher Annual", quantity: 26, rate: 30, total: 780 }], totalAmount: 780, status: "paid", generatedAt: daysFromToday(-6), customerName: "Harbor View Condominiums" },
    { id: 3, invoiceNumber: "INV-DEMO-0003", customerId: 2, jobId: 3, techId: 3, techName: "Ephraim Osei", lineItems: [{ service: "Sprinkler Test", quantity: 1, rate: 1100, total: 1100 }], totalAmount: 1100, status: "draft", generatedAt: daysFromToday(-20), customerName: "Riverside Elementary School" },
  ];

  const recurringSchedules: RecurringSchedule[] = [
    { id: 1, customerId: 6, customerName: "Olive Garden Columbia", employeeId: 2, employeeName: "Tyler Beaumont", serviceType: "hood_suppression", intervalType: "6months", customDays: null, startDate: daysFromToday(-180), nextOccurrence: daysFromToday(45), status: "active", revenue: 1450, notes: "Semi-annual kitchen suppression", createdAt: nowIso() },
    { id: 2, customerId: 2, customerName: "Riverside Elementary School", employeeId: 3, employeeName: "Ephraim Osei", serviceType: "sprinkler_test", intervalType: "1year", customDays: null, startDate: daysFromToday(-300), nextOccurrence: daysFromToday(60), status: "active", revenue: 1250, notes: null, createdAt: nowIso() },
  ];

  const timeOffRequests: TimeOffRequest[] = [
    { id: 1, employeeId: 5, employeeName: "Sarah Johnson", type: "training", startDate: daysFromToday(3), endDate: daysFromToday(3), reason: "NICET prep course", notes: "Half day", status: "approved", denialReason: null, reviewedBy: "James Rodriguez", reviewNote: "Approved", createdAt: nowIso() },
    { id: 2, employeeId: 6, employeeName: "Marcus Taylor", type: "vacation", startDate: daysFromToday(10), endDate: daysFromToday(12), reason: "Family trip", notes: "Planned PTO", status: "pending", denialReason: null, reviewedBy: null, reviewNote: null, createdAt: nowIso() },
    { id: 3, employeeId: 1, employeeName: "Ernest McKinley", type: "shop-day", startDate: daysFromToday(1), endDate: daysFromToday(1), reason: "Truck restock and extinguisher tags", notes: "Morning only", status: "approved", denialReason: null, reviewedBy: "James Rodriguez", reviewNote: "Approved", createdAt: nowIso() },
  ];

  const tasks: Task[] = [
    { id: 1, title: "Confirm Lincoln return parts", description: "Order replacement units before Friday", createdBy: "James Rodriguez", createdByRole: "manager", assignedTo: "Ernest McKinley", priority: "high", status: "open", dueDate: daysFromToday(1), jobId: 6, createdAt: nowIso(), updatedAt: nowIso() },
    { id: 2, title: "Upload Olive Garden certificate", description: null, createdBy: "James Rodriguez", createdByRole: "manager", assignedTo: "Tyler Beaumont", priority: "medium", status: "in-progress", dueDate: daysFromToday(0), jobId: 1, createdAt: nowIso(), updatedAt: nowIso() },
    { id: 3, title: "Review open jobs board", description: "Assign remaining extinguisher jobs", createdBy: "James Rodriguez", createdByRole: "manager", assignedTo: null, priority: "low", status: "done", dueDate: null, jobId: null, createdAt: nowIso(), updatedAt: nowIso() },
  ];

  const appointments: Appointment[] = [
    { id: 1, title: "Supervisor planning", description: "Morning schedule review", date: daysFromToday(0), startTime: "07:30", endTime: "08:00", type: "meeting", participants: "James Rodriguez, Tyler Beaumont", location: "Main office", notes: null, createdBy: "James Rodriguez", calendarOwner: "manager", createdAt: nowIso() },
    { id: 2, title: "Customer walk-through", description: "Review non-compliance list", date: daysFromToday(1), startTime: "10:00", endTime: "11:00", type: "site-visit", participants: "Patricia Nguyen", location: "Harbor View Condominiums", notes: null, createdBy: "James Rodriguez", calendarOwner: "shared", createdAt: nowIso() },
    { id: 3, title: "Supplier call", description: null, date: daysFromToday(2), startTime: "15:00", endTime: "15:30", type: "call", participants: "Extinguisher Supply Co.", location: null, notes: null, createdBy: "James Rodriguez", calendarOwner: "supervisor", createdAt: nowIso() },
  ];

  const serviceRequests: ServiceRequest[] = [
    { id: 1, customerId: 1, customerName: "Harbor View Condominiums", serviceType: "Equipment Repair", description: "Exit light in Tower B keeps flickering", location: "Tower B", preferredDate: daysFromToday(2), urgency: "urgent", status: "pending", managerMessage: null, fulfilledJobId: null, createdAt: nowIso(), updatedAt: nowIso() },
    { id: 2, customerId: 6, customerName: "Olive Garden Columbia", serviceType: "Follow-up Inspection", description: "Need updated suppression cert copy", location: "Dining Area", preferredDate: daysFromToday(4), urgency: "normal", status: "in-review", managerMessage: "Reviewing with assigned tech.", fulfilledJobId: null, createdAt: nowIso(), updatedAt: nowIso() },
    { id: 3, customerId: 2, customerName: "Riverside Elementary School", serviceType: "Emergency Service", description: "Alarm panel fault overnight", location: "Main Building", preferredDate: daysFromToday(0), urgency: "urgent", status: "scheduled", managerMessage: "Tech scheduled for this afternoon.", fulfilledJobId: 5, createdAt: nowIso(), updatedAt: nowIso() },
  ];

  const vans: Van[] = [
    { id: 1, name: "Van 1", licensePlate: "MC-001", make: "Ford", model: "Transit", year: 2022, color: "White", assignedEmployeeId: 1, gpsTrackerId: "GPS-001", gpsTrackerSerial: "SN-001", gpsTrackerModel: "Samsara VG34", gpsTrackerInstalledAt: nowIso(), lat: "39.2037", lng: "-76.8610", speed: 0, heading: 0, lastLocationUpdate: nowIso(), status: "active", notes: null },
    { id: 2, name: "Van 2", licensePlate: "MC-002", make: "Ford", model: "Transit", year: 2021, color: "White", assignedEmployeeId: 2, gpsTrackerId: "GPS-002", gpsTrackerSerial: "SN-002", gpsTrackerModel: "Samsara VG34", gpsTrackerInstalledAt: nowIso(), lat: "39.2150", lng: "-76.8750", speed: 22, heading: 100, lastLocationUpdate: nowIso(), status: "active", notes: null },
    { id: 3, name: "Van 3", licensePlate: "MC-003", make: "Mercedes", model: "Sprinter", year: 2023, color: "White", assignedEmployeeId: 3, gpsTrackerId: "GPS-003", gpsTrackerSerial: "SN-003", gpsTrackerModel: "Samsara VG34", gpsTrackerInstalledAt: nowIso(), lat: "39.1950", lng: "-76.8480", speed: 4, heading: 270, lastLocationUpdate: nowIso(), status: "active", notes: null },
    { id: 4, name: "Van 4", licensePlate: "MC-004", make: "Ford", model: "Transit", year: 2020, color: "Silver", assignedEmployeeId: null, gpsTrackerId: null, gpsTrackerSerial: null, gpsTrackerModel: null, gpsTrackerInstalledAt: null, lat: null, lng: null, speed: 0, heading: 0, lastLocationUpdate: null, status: "active", notes: null },
    { id: 5, name: "Van 5", licensePlate: "MC-005", make: "Ford", model: "Transit", year: 2024, color: "White", assignedEmployeeId: 6, gpsTrackerId: "GPS-005", gpsTrackerSerial: "SN-005", gpsTrackerModel: "Samsara VG34", gpsTrackerInstalledAt: nowIso(), lat: "39.2070", lng: "-76.8540", speed: 0, heading: 0, lastLocationUpdate: nowIso(), status: "active", notes: null },
    { id: 6, name: "Van 6", licensePlate: "MC-006", make: "Ram", model: "ProMaster", year: 2022, color: "White", assignedEmployeeId: 5, gpsTrackerId: null, gpsTrackerSerial: null, gpsTrackerModel: null, gpsTrackerInstalledAt: null, lat: null, lng: null, speed: 0, heading: 0, lastLocationUpdate: null, status: "active", notes: null },
  ];

  return {
    employees,
    customers,
    customerLocations,
    jobs,
    openJobs,
    invoices,
    recurringSchedules,
    timeOffRequests,
    tasks,
    appointments,
    serviceRequests,
    vans,
    conversations: [],
    nextIds: {
      employees: 7,
      customers: 7,
      customerLocations: 9,
      jobs: 9,
      openJobs: 7,
      invoices: 4,
      recurringSchedules: 3,
      timeOffRequests: 4,
      tasks: 4,
      appointments: 4,
      serviceRequests: 4,
      vans: 7,
      conversations: 1,
    },
  };
}

function loadState(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    // ignore
  }
  const initial = createInitialState();
  saveState(initial);
  return initial;
}

function saveState(state: MockState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function empty(status = 204) {
  return new Response(null, { status });
}

function getBody(init?: RequestInit): Promise<any> {
  if (!init?.body) return Promise.resolve(undefined);
  if (typeof init.body === "string") {
    try {
      return Promise.resolve(JSON.parse(init.body));
    } catch {
      return Promise.resolve(undefined);
    }
  }
  return Promise.resolve(undefined);
}

function nextId(state: MockState, key: keyof MockState["nextIds"]) {
  const id = state.nextIds[key];
  state.nextIds[key] += 1;
  return id;
}

function computeSummary(state: MockState) {
  const activeTechs = state.employees.filter((employee) => employee.role !== "admin" && employee.isActive);
  const completedJobs = state.jobs.filter((job) => job.status === "completed");
  const openJobs = state.jobs.filter((job) => ["pending", "in_progress", "in-progress", "return", "reschedule"].includes(job.status)).length + state.openJobs.length;
  const shopDayCostYtd = activeTechs.reduce((sum, employee) => {
    const dailyBurden = (employee.salary * 1.3 + 10000) / 260;
    return sum + dailyBurden * employee.shopDaysUsedYtd;
  }, 0);

  return {
    shopDayCostYtd: Number(shopDayCostYtd.toFixed(2)),
    teamUtilizationPct: activeTechs.length
      ? Number((activeTechs.reduce((sum, employee) => sum + employee.utilizationPct, 0) / activeTechs.length).toFixed(1))
      : 0,
    revenueYtd: completedJobs.reduce((sum, job) => sum + job.revenue, 0),
    activeTechCount: activeTechs.length,
    openJobCount: openJobs,
    returnJobCount: state.jobs.filter((job) => job.status === "return").length,
    rescheduleJobCount: state.jobs.filter((job) => job.status === "reschedule").length,
    projectedAnnualSavings: 48500,
  };
}

function maybeDrift(van: Van) {
  if (!van.gpsTrackerId || !van.lat || !van.lng) return van;
  const lat = Number(van.lat);
  const lng = Number(van.lng);
  const delta = van.speed > 0 ? 0.0012 : 0.0003;
  return {
    ...van,
    lat: (lat + (Math.random() - 0.5) * delta).toFixed(5),
    lng: (lng + (Math.random() - 0.5) * delta).toFixed(5),
    lastLocationUpdate: nowIso(),
  };
}

function createStreamResponse(message: string) {
  const encoder = new TextEncoder();
  let sent = false;
  return new Response(
    new ReadableStream({
      start(controller) {
        if (sent) return;
        sent = true;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: message })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

async function handleApi(input: RequestInfo | URL, init?: RequestInit) {
  const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(requestUrl, window.location.origin);
  const method = (init?.method ?? (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") ?? "GET").toUpperCase();
  const state = loadState();
  const body = await getBody(init);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const segments = path.split("/").filter(Boolean);

  if (path === "/employees" && method === "GET") return json(state.employees);
  if (path === "/employees" && method === "POST") {
    const employee: Employee = {
      id: nextId(state, "employees"),
      name: body?.name ?? "New Employee",
      role: body?.role ?? "helper",
      salary: Number(body?.salary ?? 45000),
      billableRate: Number(body?.billableRate ?? 650),
      homeZip: body?.homeZip ?? "21046",
      certifications: Array.isArray(body?.certifications) ? body.certifications : [],
      allowedShopDays: Number(body?.allowedShopDays ?? 5),
      shopDaysUsedYtd: Number(body?.shopDaysUsedYtd ?? 0),
      allowedTrainingDays: Number(body?.allowedTrainingDays ?? 3),
      trainingDaysUsedYtd: Number(body?.trainingDaysUsedYtd ?? 0),
      utilizationPct: Number(body?.utilizationPct ?? 85),
      hourlyRate: body?.hourlyRate ? Number(body.hourlyRate) : null,
      hoursPerDay: Number(body?.hoursPerDay ?? 8),
      isActive: body?.isActive ?? true,
    };
    state.employees.push(employee);
    saveState(state);
    return json(employee, 201);
  }
  if (segments[0] === "employees" && segments[1] && method === "PUT") {
    const employee = state.employees.find((item) => item.id === Number(segments[1]));
    if (!employee) return json({ message: "Not found" }, 404);
    Object.assign(employee, body ?? {});
    saveState(state);
    return json(employee);
  }
  if (segments[0] === "employees" && segments[1] && method === "DELETE") {
    state.employees = state.employees.filter((item) => item.id !== Number(segments[1]));
    saveState(state);
    return empty();
  }

  if (path === "/customers" && method === "GET") return json(state.customers);
  if (path === "/customers" && method === "POST") {
    const customer: Customer = {
      id: nextId(state, "customers"),
      name: body?.name ?? "New Customer",
      facilityType: body?.facilityType ?? "commercial",
      address: body?.address ?? "",
      contactName: body?.contactName ?? "",
      contactPhone: body?.contactPhone ?? "",
      contactEmail: body?.contactEmail ?? null,
      inspectionFrequency: body?.inspectionFrequency ?? "annual",
      isActive: body?.isActive ?? true,
    };
    state.customers.push(customer);
    saveState(state);
    return json(customer, 201);
  }
  if (segments[0] === "customers" && segments[1] && segments[2] === "locations" && method === "GET") {
    return json(state.customerLocations.filter((item) => item.customerId === Number(segments[1])));
  }
  if (segments[0] === "customers" && segments[1] && method === "PUT") {
    const customer = state.customers.find((item) => item.id === Number(segments[1]));
    if (!customer) return json({ message: "Not found" }, 404);
    Object.assign(customer, body ?? {});
    saveState(state);
    return json(customer);
  }
  if (segments[0] === "customers" && segments[1] && method === "DELETE") {
    state.customers = state.customers.filter((item) => item.id !== Number(segments[1]));
    state.customerLocations = state.customerLocations.filter((item) => item.customerId !== Number(segments[1]));
    saveState(state);
    return empty();
  }

  if (path === "/dashboard/summary" && method === "GET") return json(computeSummary(state));
  if (path === "/dashboard/profit-leaks" && method === "GET") {
    return json([
      { employeeId: 5, employeeName: "Sarah Johnson", message: "Shop days are nearing threshold", severity: "medium", dollarAmount: 1850 },
      { employeeId: 1, employeeName: "Ernest McKinley", message: "Return visits are reducing margin", severity: "high", dollarAmount: 2400 },
    ]);
  }
  if (path === "/dashboard/team-calendar" && method === "GET") {
    return json(
      state.jobs
        .filter((job) => job.scheduledDate)
        .map((job) => ({
          employeeId: job.employeeId ?? 0,
          employeeName: job.employeeName ?? "Unassigned",
          certification: job.certificationRequired,
          date: job.scheduledDate,
          type: job.status === "completed" ? "billable" : job.status,
          revenue: job.revenue,
          jobId: job.id,
          customerName: job.customerName,
          status: job.status,
        })),
    );
  }
  if (path === "/dashboard/employee-roi" && method === "GET") {
    return json(
      state.employees
        .filter((employee) => employee.role !== "admin")
        .map((employee) => {
          const employeeJobs = state.jobs.filter((job) => job.employeeId === employee.id);
          const revenue = employeeJobs.reduce((sum, job) => sum + job.revenue, 0);
          const burdenCost = Number((((employee.salary * 1.3) + 10000) / 12).toFixed(2));
          return {
            employeeId: employee.id,
            name: employee.name,
            role: employee.role,
            revenue,
            burdenCost,
            profit: revenue - burdenCost,
            margin: revenue ? Number((((revenue - burdenCost) / revenue) * 100).toFixed(1)) : 0,
            jobCount: employeeJobs.length,
            utilizationPct: employee.utilizationPct,
            shopDaysUsed: employee.shopDaysUsedYtd,
            shopDaysAllowed: employee.allowedShopDays,
          };
        }),
    );
  }
  if (path === "/dashboard/revenue-by-service" && method === "GET") {
    const byService = new Map<string, { serviceType: string; revenue: number; jobCount: number; avgRevenue: number }>();
    for (const job of state.jobs) {
      const existing = byService.get(job.serviceType) ?? { serviceType: job.serviceType, revenue: 0, jobCount: 0, avgRevenue: 0 };
      existing.revenue += job.revenue;
      existing.jobCount += 1;
      existing.avgRevenue = Number((existing.revenue / existing.jobCount).toFixed(2));
      byService.set(job.serviceType, existing);
    }
    return json(Array.from(byService.values()));
  }

  if (path === "/jobs" && method === "GET") {
    let jobs = [...state.jobs];
    const employeeId = url.searchParams.get("employeeId");
    const customerId = url.searchParams.get("customerId");
    const status = url.searchParams.get("status");
    if (employeeId) jobs = jobs.filter((job) => String(job.employeeId ?? "") === employeeId);
    if (customerId) jobs = jobs.filter((job) => String(job.customerId) === customerId);
    if (status) jobs = jobs.filter((job) => job.status === status);
    return json(jobs);
  }
  if (path === "/jobs/returns" && method === "GET") return json(state.jobs.filter((job) => job.status === "return"));
  if (path === "/jobs/reschedules" && method === "GET") return json(state.jobs.filter((job) => job.status === "reschedule"));
  if (segments[0] === "jobs" && segments[1] && method === "GET") {
    const job = state.jobs.find((item) => item.id === Number(segments[1]));
    return job ? json(job) : json({ message: "Not found" }, 404);
  }
  if (path === "/jobs" && method === "POST") {
    const customer = state.customers.find((item) => item.id === Number(body?.customerId)) ?? state.customers[0];
    const employee = state.employees.find((item) => item.id === Number(body?.employeeId));
    const job: Job = {
      id: nextId(state, "jobs"),
      customerId: Number(body?.customerId ?? customer.id),
      employeeId: body?.employeeId ? Number(body.employeeId) : null,
      locationId: body?.locationId ? Number(body.locationId) : null,
      locationName: body?.locationId ? state.customerLocations.find((item) => item.id === Number(body.locationId))?.name ?? null : null,
      serviceType: body?.serviceType ?? "extinguisher_inspection",
      status: body?.status ?? "pending",
      priority: body?.priority ?? "medium",
      scheduledDate: body?.scheduledDate ?? null,
      dueDate: body?.dueDate ?? body?.scheduledDate ?? null,
      scheduledTime: body?.scheduledTime ?? null,
      revenue: Number(body?.revenue ?? 500),
      quantity: Number(body?.quantity ?? 1),
      notes: body?.notes ?? null,
      requiresFollowUp: body?.requiresFollowUp ?? false,
      followUpConfirmed: body?.followUpConfirmed ?? false,
      certificationRequired: body?.certificationRequired ?? "any",
      customerName: customer.name,
      customerAddress: customer.address,
      employeeName: employee?.name ?? null,
      nonComplianceReason: null,
      nonComplianceNotifiedAt: null,
    };
    state.jobs.push(job);
    saveState(state);
    return json(job, 201);
  }
  if (segments[0] === "jobs" && segments[1] && method === "PUT") {
    const job = state.jobs.find((item) => item.id === Number(segments[1]));
    if (!job) return json({ message: "Not found" }, 404);
    Object.assign(job, body ?? {});
    if (body?.employeeId) {
      const employee = state.employees.find((item) => item.id === Number(body.employeeId));
      job.employeeName = employee?.name ?? null;
    }
    saveState(state);
    return json(job);
  }

  if (path === "/invoices" && method === "GET") return json(state.invoices);
  if (path === "/invoices" && method === "POST") {
    const customer = state.customers.find((item) => item.id === Number(body?.customerId)) ?? state.customers[0];
    const tech = state.employees.find((item) => item.id === Number(body?.techId));
    const invoice: Invoice = {
      id: nextId(state, "invoices"),
      invoiceNumber: body?.invoiceNumber ?? `INV-DEMO-${String(state.nextIds.invoices).padStart(4, "0")}`,
      customerId: Number(body?.customerId ?? customer.id),
      jobId: body?.jobId ? Number(body.jobId) : null,
      techId: tech?.id ?? null,
      techName: tech?.name ?? null,
      lineItems: Array.isArray(body?.lineItems) ? body.lineItems : [],
      totalAmount: Number(body?.totalAmount ?? 0),
      status: body?.status ?? "draft",
      generatedAt: nowIso(),
      customerName: customer.name,
    };
    state.invoices.push(invoice);
    saveState(state);
    return json(invoice, 201);
  }
  if (segments[0] === "invoices" && segments[1] && method === "PUT") {
    const invoice = state.invoices.find((item) => item.id === Number(segments[1]));
    if (!invoice) return json({ message: "Not found" }, 404);
    Object.assign(invoice, body ?? {});
    saveState(state);
    return json(invoice);
  }

  if (path === "/recurring-schedules" && method === "GET") return json(state.recurringSchedules);
  if (path === "/open-jobs" && method === "GET") return json(state.openJobs);
  if (segments[0] === "open-jobs" && segments[1] && method === "PUT") {
    const openJob = state.openJobs.find((item) => item.id === Number(segments[1]));
    if (!openJob) return json({ message: "Not found" }, 404);
    Object.assign(openJob, body ?? {});
    if (body?.assignedEmployeeId) {
      const employee = state.employees.find((item) => item.id === Number(body.assignedEmployeeId));
      openJob.assignedEmployeeName = employee?.name ?? null;
    }
    saveState(state);
    return json(openJob);
  }
  if (segments[0] === "open-jobs" && segments[1] && method === "DELETE") {
    state.openJobs = state.openJobs.filter((item) => item.id !== Number(segments[1]));
    saveState(state);
    return empty();
  }

  if (segments[0] === "time-off" && method === "GET") {
    let requests = [...state.timeOffRequests];
    const employeeId = url.searchParams.get("employeeId");
    const status = url.searchParams.get("status");
    const date = url.searchParams.get("date");
    if (employeeId) requests = requests.filter((item) => String(item.employeeId) === employeeId);
    if (status) requests = requests.filter((item) => item.status === status);
    if (date) requests = requests.filter((item) => item.startDate <= date && item.endDate >= date);
    return json(requests);
  }
  if (segments[0] === "time-off" && segments.length === 1 && method === "POST") {
    const employee = state.employees.find((item) => item.id === Number(body?.employeeId));
    const request: TimeOffRequest = {
      id: nextId(state, "timeOffRequests"),
      employeeId: Number(body?.employeeId),
      employeeName: employee?.name ?? "Unknown",
      type: body?.type ?? "other",
      startDate: body?.startDate ?? daysFromToday(0),
      endDate: body?.endDate ?? body?.startDate ?? daysFromToday(0),
      reason: body?.reason ?? "",
      notes: body?.notes ?? "",
      status: body?.initialStatus ?? "pending",
      denialReason: null,
      reviewedBy: body?.reviewedBy ?? null,
      reviewNote: null,
      createdAt: nowIso(),
    };
    state.timeOffRequests.push(request);
    saveState(state);
    return json(request, 201);
  }
  if (segments[0] === "time-off" && segments[2] === "review" && method === "POST") {
    const request = state.timeOffRequests.find((item) => item.id === Number(segments[1]));
    if (!request) return json({ message: "Not found" }, 404);
    request.status = body?.status ?? request.status;
    request.reviewedBy = body?.reviewedBy ?? request.reviewedBy;
    request.reviewNote = body?.reviewNote ?? request.reviewNote;
    request.denialReason = body?.denialReason ?? request.denialReason;
    saveState(state);
    return json(request);
  }
  if (segments[0] === "time-off" && segments[1] && method === "DELETE") {
    state.timeOffRequests = state.timeOffRequests.filter((item) => item.id !== Number(segments[1]));
    saveState(state);
    return empty();
  }

  if (path === "/tasks" && method === "GET") return json(state.tasks);
  if (path === "/tasks" && method === "POST") {
    const task: Task = {
      id: nextId(state, "tasks"),
      title: body?.title ?? "New Task",
      description: body?.description ?? null,
      createdBy: body?.createdBy ?? "Manager",
      createdByRole: body?.createdByRole ?? "manager",
      assignedTo: body?.assignedTo ?? null,
      priority: body?.priority ?? "medium",
      status: body?.status ?? "open",
      dueDate: body?.dueDate ?? null,
      jobId: body?.jobId ? Number(body.jobId) : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.tasks.push(task);
    saveState(state);
    return json(task, 201);
  }
  if (segments[0] === "tasks" && segments[1] && method === "PUT") {
    const task = state.tasks.find((item) => item.id === Number(segments[1]));
    if (!task) return json({ message: "Not found" }, 404);
    Object.assign(task, body ?? {}, { updatedAt: nowIso() });
    saveState(state);
    return json(task);
  }
  if (segments[0] === "tasks" && segments[1] && method === "DELETE") {
    state.tasks = state.tasks.filter((item) => item.id !== Number(segments[1]));
    saveState(state);
    return empty();
  }

  if (segments[0] === "appointments" && method === "GET") {
    const owner = url.searchParams.get("owner");
    const appointments = owner
      ? state.appointments.filter((item) => item.calendarOwner === owner || item.calendarOwner === "shared")
      : state.appointments;
    return json(appointments);
  }
  if (segments[0] === "appointments" && method === "POST") {
    const appointment: Appointment = {
      id: nextId(state, "appointments"),
      title: body?.title ?? "Appointment",
      description: body?.description ?? null,
      date: body?.date ?? daysFromToday(0),
      startTime: body?.startTime ?? "09:00",
      endTime: body?.endTime ?? null,
      type: body?.type ?? "meeting",
      participants: body?.participants ?? null,
      location: body?.location ?? null,
      notes: body?.notes ?? null,
      createdBy: "Local Demo",
      calendarOwner: body?.calendarOwner ?? "manager",
      createdAt: nowIso(),
    };
    state.appointments.push(appointment);
    saveState(state);
    return json(appointment, 201);
  }
  if (segments[0] === "appointments" && segments[1] && method === "PUT") {
    const appointment = state.appointments.find((item) => item.id === Number(segments[1]));
    if (!appointment) return json({ message: "Not found" }, 404);
    Object.assign(appointment, body ?? {});
    saveState(state);
    return json(appointment);
  }
  if (segments[0] === "appointments" && segments[1] && method === "DELETE") {
    state.appointments = state.appointments.filter((item) => item.id !== Number(segments[1]));
    saveState(state);
    return empty();
  }

  if (segments[0] === "service-requests" && method === "GET") {
    const customerId = url.searchParams.get("customerId");
    const requests = customerId
      ? state.serviceRequests.filter((item) => String(item.customerId) === customerId)
      : state.serviceRequests;
    return json(requests);
  }
  if (segments[0] === "service-requests" && method === "POST") {
    const customer = state.customers.find((item) => item.id === Number(body?.customerId));
    const request: ServiceRequest = {
      id: nextId(state, "serviceRequests"),
      customerId: Number(body?.customerId ?? customer?.id ?? 1),
      customerName: customer?.name ?? "Unknown Customer",
      serviceType: body?.serviceType ?? "Other",
      description: body?.description ?? null,
      location: body?.location ?? null,
      preferredDate: body?.preferredDate ?? null,
      urgency: body?.urgency ?? "normal",
      status: "pending",
      managerMessage: null,
      fulfilledJobId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.serviceRequests.push(request);
    saveState(state);
    return json(request, 201);
  }
  if (segments[0] === "service-requests" && segments[1] && method === "PUT") {
    const request = state.serviceRequests.find((item) => item.id === Number(segments[1]));
    if (!request) return json({ message: "Not found" }, 404);
    Object.assign(request, body ?? {}, { updatedAt: nowIso() });
    saveState(state);
    return json(request);
  }

  if (segments[0] === "vans" && segments.length === 1 && method === "GET") return json(state.vans);
  if (path === "/vans/locations" && method === "GET") {
    state.vans = state.vans.map((van) => maybeDrift(van));
    saveState(state);
    return json(state.vans);
  }
  if (segments[0] === "vans" && segments.length === 1 && method === "POST") {
    const van: Van = {
      id: nextId(state, "vans"),
      name: body?.name ?? "New Van",
      licensePlate: body?.licensePlate ?? "MC-NEW",
      make: body?.make ?? "Ford",
      model: body?.model ?? "Transit",
      year: Number(body?.year ?? 2024),
      color: body?.color ?? "White",
      assignedEmployeeId: body?.assignedEmployeeId ? Number(body.assignedEmployeeId) : null,
      gpsTrackerId: null,
      gpsTrackerSerial: null,
      gpsTrackerModel: null,
      gpsTrackerInstalledAt: null,
      lat: null,
      lng: null,
      speed: 0,
      heading: 0,
      lastLocationUpdate: null,
      status: body?.status ?? "active",
      notes: body?.notes ?? null,
    };
    state.vans.push(van);
    saveState(state);
    return json(van, 201);
  }
  if (segments[0] === "vans" && segments[1] && segments.length === 2 && method === "PUT") {
    const van = state.vans.find((item) => item.id === Number(segments[1]));
    if (!van) return json({ message: "Not found" }, 404);
    Object.assign(van, body ?? {});
    saveState(state);
    return json(van);
  }
  if (segments[0] === "vans" && segments[1] && segments.length === 2 && method === "DELETE") {
    state.vans = state.vans.filter((item) => item.id !== Number(segments[1]));
    saveState(state);
    return empty();
  }
  if (segments[0] === "vans" && segments[2] === "install-tracker" && method === "POST") {
    const van = state.vans.find((item) => item.id === Number(segments[1]));
    if (!van) return json({ message: "Not found" }, 404);
    Object.assign(van, {
      gpsTrackerId: `GPS-${van.id}`,
      gpsTrackerSerial: body?.serial ?? `SN-${van.id}`,
      gpsTrackerModel: body?.model ?? "Samsara VG34",
      gpsTrackerInstalledAt: nowIso(),
      lat: van.lat ?? "39.2037",
      lng: van.lng ?? "-76.8610",
      lastLocationUpdate: nowIso(),
    });
    saveState(state);
    return json(van);
  }
  if (segments[0] === "vans" && segments[2] === "tracker" && method === "DELETE") {
    const van = state.vans.find((item) => item.id === Number(segments[1]));
    if (!van) return json({ message: "Not found" }, 404);
    Object.assign(van, {
      gpsTrackerId: null,
      gpsTrackerSerial: null,
      gpsTrackerModel: null,
      gpsTrackerInstalledAt: null,
      lat: null,
      lng: null,
      speed: 0,
      heading: 0,
      lastLocationUpdate: null,
    });
    saveState(state);
    return json(van);
  }

  if (path === "/invoice-scan" && method === "POST") {
    return json({
      vendor: "Demo Vendor",
      invoiceNumber: "SCAN-DEMO-001",
      total: 245.75,
      lineItems: [{ description: "Suppression agent recharge", quantity: 1, amount: 245.75 }],
      message: "Local demo mode parsed a sample invoice response.",
    });
  }

  if (path === "/admin/seed-demo" && method === "POST") {
    const seeded = createInitialState();
    saveState(seeded);
    return json({ success: true, seeded: { employees: seeded.employees.map((employee) => employee.name), customers: seeded.customers.map((customer) => customer.name), locations: seeded.customerLocations.length, jobs: seeded.jobs.length, invoices: seeded.invoices.length } });
  }
  if (path === "/admin/clear-all" && method === "DELETE") {
    const cleared = createInitialState();
    cleared.jobs = [];
    cleared.openJobs = [];
    cleared.invoices = [];
    cleared.recurringSchedules = [];
    cleared.timeOffRequests = [];
    cleared.tasks = [];
    cleared.appointments = [];
    cleared.serviceRequests = [];
    saveState(cleared);
    return json({ success: true, message: "All demo data cleared." });
  }
  if (path === "/admin/export" && method === "GET") {
    return json({ exportedAt: nowIso(), version: "mock-demo", data: { employees: state.employees, customers: state.customers, customerLocations: state.customerLocations, jobs: state.jobs, openJobs: state.openJobs, invoices: state.invoices, recurringSchedules: state.recurringSchedules } });
  }
  if (path === "/admin/import" && method === "POST") {
    const imported = createInitialState();
    imported.employees = Array.isArray(body?.data?.employees) ? body.data.employees : imported.employees;
    imported.customers = Array.isArray(body?.data?.customers) ? body.data.customers : imported.customers;
    imported.customerLocations = Array.isArray(body?.data?.customerLocations) ? body.data.customerLocations : imported.customerLocations;
    imported.jobs = Array.isArray(body?.data?.jobs) ? body.data.jobs : imported.jobs;
    imported.openJobs = Array.isArray(body?.data?.openJobs) ? body.data.openJobs : imported.openJobs;
    imported.invoices = Array.isArray(body?.data?.invoices) ? body.data.invoices : imported.invoices;
    imported.recurringSchedules = Array.isArray(body?.data?.recurringSchedules) ? body.data.recurringSchedules : imported.recurringSchedules;
    saveState(imported);
    return json({ success: true, imported: { employees: imported.employees.length, customers: imported.customers.length, customerLocations: imported.customerLocations.length, jobs: imported.jobs.length, openJobs: imported.openJobs.length, invoices: imported.invoices.length, recurringSchedules: imported.recurringSchedules.length } });
  }

  if (path === "/openai/conversations" && method === "POST") {
    const conversation = { id: nextId(state, "conversations"), title: body?.title ?? "Local Demo Conversation" };
    state.conversations.push(conversation);
    saveState(state);
    return json(conversation, 201);
  }
  if (segments[0] === "openai" && segments[1] === "conversations" && segments[3] === "messages" && method === "POST") {
    const prompt = body?.content ?? "";
    return createStreamResponse(`Local demo mode is active, so this assistant is using stubbed data. You asked: ${prompt}`);
  }

  return json({ message: `Mock API route not implemented: ${method} ${path}` }, 404);
}

export function installMockApi() {
  if ((window as any)[INSTALL_KEY]) return;

  const originalFetch = window.fetch.bind(window);
  (window as any)[INSTALL_KEY] = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(requestUrl, window.location.origin);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(input, init);
    }

    return originalFetch(input, init);
  };
}
