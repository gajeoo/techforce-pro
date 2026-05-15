import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    suppression_lead: "Suppression Lead",
    sprinkler_tech: "Sprinkler Tech",
    extinguisher_tech: "Extinguisher Tech",
    helper: "Helper / Apprentice",
    admin: "Admin",
  };
  return map[role] ?? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function serviceTypeLabel(s: string): string {
  const map: Record<string, string> = {
    hood_suppression: "Hood Suppression",
    extinguisher_inspection: "Extinguisher Inspection",
    sprinkler_test: "Sprinkler Test",
    exit_light_check: "Exit Light Check",
    full_inspection: "Full Fire Safety Inspection",
    standpipe_test: "Standpipe Test",
    fire_alarm: "Fire Alarm Inspection",
  };
  return map[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    completed: "bg-emerald-100 text-emerald-700",
    "in-progress": "bg-blue-100 text-blue-700",
    in_progress: "bg-blue-100 text-blue-700",
    return: "bg-orange-100 text-orange-700",
    will_return: "bg-orange-100 text-orange-700",
    reschedule: "bg-red-100 text-red-700",
    paid: "bg-emerald-100 text-emerald-700",
    sent: "bg-blue-100 text-blue-700",
    draft: "bg-gray-100 text-gray-700",
    overdue: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

export function getWeekDates(weekOffset: number): { label: string; date: string }[] {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMon + weekOffset * 7);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, date: d.toISOString().slice(0, 10) };
  });
}
