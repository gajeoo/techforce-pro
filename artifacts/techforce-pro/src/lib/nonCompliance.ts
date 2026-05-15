const STORAGE_NC_KEY = "tfpro_nc_notices";

export interface NCNotice {
  id: string;
  jobId: number;
  customerId: number;
  location: string;
  address: string;
  serviceType: string;
  reason: string;
  sentBy: string;
  sentByRole: string;
  scheduledDate: string | null;
  sentAt: string;
  acknowledged: boolean;
}

export function saveNCNotice(notice: Omit<NCNotice, "id" | "sentAt" | "acknowledged">) {
  const existing = loadNCNotices();
  const newNotice: NCNotice = {
    ...notice,
    id: `nc-${Date.now()}`,
    sentAt: new Date().toISOString(),
    acknowledged: false,
  };
  localStorage.setItem(STORAGE_NC_KEY, JSON.stringify([...existing, newNotice]));
  return newNotice;
}

export function loadNCNotices(): NCNotice[] {
  try {
    const raw = localStorage.getItem(STORAGE_NC_KEY);
    return raw ? (JSON.parse(raw) as NCNotice[]) : [];
  } catch {
    return [];
  }
}

export function acknowledgeNCNotice(id: string) {
  const notices = loadNCNotices();
  const updated = notices.map(n => n.id === id ? { ...n, acknowledged: true } : n);
  localStorage.setItem(STORAGE_NC_KEY, JSON.stringify(updated));
}
