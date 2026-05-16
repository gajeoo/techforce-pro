import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    suppression_lead: "Suppression Lead",
    sprinkler_tech: "Sprinkler Tech",
    extinguisher_tech: "Extinguisher Tech",
    helper: "Helper / Apprentice",
    admin: "Admin",
  };
  return (
    labels[role] ??
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    in_progress: "bg-blue-100 text-blue-700",
    pending: "bg-gray-100 text-gray-600",
    return: "bg-amber-100 text-amber-700",
    will_return: "bg-amber-100 text-amber-700",
    reschedule: "bg-red-100 text-red-700",
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-emerald-100 text-emerald-700",
    overdue: "bg-red-100 text-red-700",
    active: "bg-emerald-100 text-emerald-700",
    inactive: "bg-gray-100 text-gray-500",
    open: "bg-blue-100 text-blue-700",
    paused: "bg-yellow-100 text-yellow-700",
  };
  return colors[status] ?? "bg-gray-100 text-gray-600";
}

export function serviceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    extinguisher_inspection: "Extinguisher Inspection",
    sprinkler_test: "Sprinkler Test",
    hood_suppression: "Hood Suppression",
    exit_light_check: "Exit Light Check",
    alarm_inspection: "Alarm Inspection",
    kitchen_suppression: "Kitchen Suppression",
    backflow_testing: "Backflow Testing",
    standpipe_inspection: "Standpipe Inspection",
    emergency: "Emergency Dispatch",
  };
  return (
    labels[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function getWeekDates(offsetWeeks = 0): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1 + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// Legacy exports kept for any remaining Express-API pages
export const STATUS_ICONS: Record<string, string> = {
  completed: "✅",
  in_progress: "🔄",
  pending: "⏳",
  return: "🔁",
  will_return: "🔁",
  reschedule: "📅",
};

export const ROLE_LABELS: Record<string, string> = {
  suppression_lead: "Suppression Lead",
  sprinkler_tech: "Sprinkler Tech",
  extinguisher_tech: "Extinguisher Tech",
  helper: "Helper / Apprentice",
  admin: "Admin",
};

export const CERT_LABELS: Record<string, string> = {
  suppression: "Suppression",
  sprinkler: "Sprinkler",
  extinguisher: "Extinguisher",
  exit_lights: "Exit Lights",
  standpipe: "Standpipe",
  any: "Any",
};
