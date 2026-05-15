// ─── License types & localStorage helpers ────────────────────────────────────

export interface License {
  id: string;
  empId: string;
  type: string;
  licenseNumber: string;
  issuedBy: string;
  issueDate: string;    // YYYY-MM-DD
  expiryDate: string;   // YYYY-MM-DD
  notes?: string;
}

const LICENSES_KEY = "tfpro_licenses";
const SEEDED_KEY   = "tfpro_licenses_seeded_v3"; // bump version to force re-seed with real IDs

// ─── Seed templates (slot = which employee index gets this license) ───────────
//
// slot 0 → first active employee  (Ernest McKinley — extinguisher tech)
// slot 1 → second active employee (Tyler Beaumont   — suppression lead)
// slot 2 → third active employee  (Ephraim Osei     — sprinkler tech)
//
// "within 60 days" examples kept so the Expiring Soon KPI isn't zero.

type SeedTemplate = {
  slot: number;
  type: string;
  licenseNumber: string;
  issuedBy: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
};

const SEED_TEMPLATES: SeedTemplate[] = [
  // ── Slot 0: extinguisher tech ──────────────────────────────────────────────
  { slot: 0, type: "MD Portable Extinguisher License",    licenseNumber: "EXT-2021-7712",  issuedBy: "State of Maryland", issueDate: "2024-10-15", expiryDate: "2026-10-15", notes: "" },
  { slot: 0, type: "MD Exit Light Inspector Cert",        licenseNumber: "ELI-2022-3304",  issuedBy: "State of Maryland", issueDate: "2024-06-01", expiryDate: "2026-06-20", notes: "Renewal in progress" },

  // ── Slot 1: suppression lead ───────────────────────────────────────────────
  { slot: 1, type: "MD Fire Suppression License",         licenseNumber: "FSL-2019-5541",  issuedBy: "State of Maryland", issueDate: "2024-07-01", expiryDate: "2026-06-30", notes: "" },
  { slot: 1, type: "NICET Level III Certification",       licenseNumber: "NICET-III-38821",issuedBy: "NICET",             issueDate: "2022-06-15", expiryDate: "2026-09-15", notes: "" },
  { slot: 1, type: "Journeyman Fire Protection",          licenseNumber: "JFP-2020-0044",  issuedBy: "State of Maryland", issueDate: "2020-03-01", expiryDate: "2027-03-01", notes: "" },

  // ── Slot 2: sprinkler tech ─────────────────────────────────────────────────
  { slot: 2, type: "MD Sprinkler Fitter License",         licenseNumber: "SF-2020-4410",   issuedBy: "State of Maryland", issueDate: "2024-12-01", expiryDate: "2026-12-01", notes: "" },
  { slot: 2, type: "NICET Level II Certification",        licenseNumber: "NICET-II-29103", issuedBy: "NICET",             issueDate: "2023-08-20", expiryDate: "2027-08-20", notes: "" },
  { slot: 2, type: "MD Portable Extinguisher License",    licenseNumber: "EXT-2022-9921",  issuedBy: "State of Maryland", issueDate: "2025-04-01", expiryDate: "2027-04-01", notes: "" },
  { slot: 2, type: "NICET Level I Certification",         licenseNumber: "NICET-I-51209",  issuedBy: "NICET",             issueDate: "2024-09-01", expiryDate: "2026-09-01", notes: "" },
];

// ─── Seeding ──────────────────────────────────────────────────────────────────

/**
 * Seeds licenses into localStorage using the real employee IDs returned by
 * the API. Safe to call multiple times — does nothing after the first call.
 * Pass an empty array to skip seeding until real IDs are available.
 */
export function seedLicensesIfNeeded(empIds: string[]): void {
  if (localStorage.getItem(SEEDED_KEY)) return;
  if (empIds.length === 0) return;

  const licenses: License[] = SEED_TEMPLATES
    .filter(t => t.slot < empIds.length)
    .map((t, i) => ({
      id:            `L-${String(i + 1).padStart(3, "0")}`,
      empId:         empIds[t.slot],
      type:          t.type,
      licenseNumber: t.licenseNumber,
      issuedBy:      t.issuedBy,
      issueDate:     t.issueDate,
      expiryDate:    t.expiryDate,
      notes:         t.notes,
    }));

  localStorage.setItem(LICENSES_KEY, JSON.stringify(licenses));
  localStorage.setItem(SEEDED_KEY, "1");
}

// ─── CRUD helpers ─────────────────────────────────────────────────────────────

/**
 * Wipe all license data from localStorage, including the seed flag.
 * Call this when all employees are removed so stale licenses don't linger.
 */
export function clearLicenses(): void {
  localStorage.removeItem(LICENSES_KEY);
  Object.keys(localStorage)
    .filter(k => k.startsWith("tfpro_licenses_seeded"))
    .forEach(k => localStorage.removeItem(k));
}

export function loadLicenses(): License[] {
  try {
    const raw = localStorage.getItem(LICENSES_KEY);
    return raw ? (JSON.parse(raw) as License[]) : [];
  } catch { return []; }
}

export function saveLicenses(licenses: License[]): void {
  localStorage.setItem(LICENSES_KEY, JSON.stringify(licenses));
}

export function getLicensesForEmp(empId: string): License[] {
  return loadLicenses().filter(l => l.empId === empId);
}

export function upsertLicense(license: License): void {
  const all = loadLicenses();
  const idx = all.findIndex(l => l.id === license.id);
  if (idx >= 0) all[idx] = license; else all.push(license);
  saveLicenses(all);
}

export function deleteLicense(id: string): void {
  saveLicenses(loadLicenses().filter(l => l.id !== id));
}

export function generateLicenseId(): string {
  return `L-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

export function daysUntilExpiry(expiryDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp   = new Date(expiryDate + "T12:00:00");
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
}

export type ExpiryStatus = "expired" | "critical" | "warning" | "ok";

export function getExpiryStatus(expiryDate: string): ExpiryStatus {
  const d = daysUntilExpiry(expiryDate);
  if (d < 0)   return "expired";
  if (d <= 30) return "critical";
  if (d <= 60) return "warning";
  return "ok";
}

export function getExpiringLicenses(empId?: string): License[] {
  const all = empId ? getLicensesForEmp(empId) : loadLicenses();
  return all.filter(l => getExpiryStatus(l.expiryDate) !== "ok");
}
