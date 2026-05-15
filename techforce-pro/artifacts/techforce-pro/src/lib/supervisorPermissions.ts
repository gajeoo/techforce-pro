export type SupervisorPermKey =
  | "schedule"
  | "calendar"
  | "appointments"
  | "jobs"
  | "licenses"
  | "clockHistory"
  | "gpsTracking"
  | "messages";

export const SUPERVISOR_PERM_DEFAULTS: Record<SupervisorPermKey, boolean> = {
  schedule:     true,
  calendar:     true,
  appointments: true,
  jobs:         true,
  licenses:     true,
  clockHistory: true,
  gpsTracking:  true,
  messages:     true,
};

export const SUPERVISOR_PERM_META: Record<SupervisorPermKey, { label: string; desc: string }> = {
  schedule:     { label: "Schedule",        desc: "View and manage the team's daily schedule" },
  calendar:     { label: "Job Calendar",    desc: "View jobs on the month calendar" },
  appointments: { label: "Appointments",    desc: "View appointments sent by manager" },
  jobs:         { label: "Jobs",            desc: "View and update active job status" },
  licenses:     { label: "Licenses",        desc: "View technician license and cert status" },
  clockHistory: { label: "Clock History",   desc: "View team clock-in/out records" },
  gpsTracking:  { label: "GPS Tracking",    desc: "View live technician locations on map" },
  messages:     { label: "Messages",        desc: "Send and receive internal messages" },
};

const STORAGE_KEY = "tfpro_supervisor_permissions";

export function getSupervisorPermissions(): Record<SupervisorPermKey, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...SUPERVISOR_PERM_DEFAULTS, ...(JSON.parse(stored) as Partial<Record<SupervisorPermKey, boolean>>) };
    }
  } catch { /* ignore */ }
  return { ...SUPERVISOR_PERM_DEFAULTS };
}

export function setSupervisorPermissions(perms: Record<SupervisorPermKey, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
}

export const PERM_HREF: Partial<Record<string, SupervisorPermKey>> = {
  "/schedule":     "schedule",
  "/calendar":     "calendar",
  "/appointments": "appointments",
  "/jobs":         "jobs",
  "/licenses":     "licenses",
  "/clock-history":"clockHistory",
  "/gps-tracking": "gpsTracking",
  "/messages":     "messages",
};
