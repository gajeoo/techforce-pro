// ─── Shared Messaging System ─────────────────────────────────────────────
// localStorage-backed, flows across all portals in the same browser session

export type MessageRole = "manager" | "supervisor" | "technician" | "customer";

export type Attachment = {
  name: string;
  type: "image" | "document" | "pdf";
  size: string;
};

export type Message = {
  id: string;
  fromId: string;
  fromName: string;
  fromRole: MessageRole;
  toId: string;
  toName: string;
  toRole: MessageRole;
  subject: string;
  body: string;
  attachments: Attachment[];
  timestamp: string;
  readByRecipient: boolean;
  deletedBySender: boolean;
  deletedByRecipient: boolean;
};

export const MESSAGES_KEY = "tfpro_messages";

export function loadMessages(): Message[] {
  try { return JSON.parse(localStorage.getItem(MESSAGES_KEY) ?? "[]"); } catch { return []; }
}

export function saveMessages(msgs: Message[]) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
}

export function countUnread(userId: string): number {
  try {
    const msgs = loadMessages();
    return msgs.filter(m => m.toId === userId && !m.readByRecipient && !m.deletedByRecipient).length;
  } catch { return 0; }
}

export function sendMessage(
  msg: Omit<Message, "id" | "timestamp" | "readByRecipient" | "deletedBySender" | "deletedByRecipient">
): Message {
  const all = loadMessages();
  const newMsg: Message = {
    ...msg,
    id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    readByRecipient: false,
    deletedBySender: false,
    deletedByRecipient: false,
  };
  saveMessages([newMsg, ...all]);
  return newMsg;
}

export function markAsRead(messageId: string) {
  const all = loadMessages();
  saveMessages(all.map(m => m.id === messageId ? { ...m, readByRecipient: true } : m));
}

export function deleteMessage(messageId: string, userId: string) {
  const all = loadMessages();
  saveMessages(all.map(m => {
    if (m.id !== messageId) return m;
    if (m.fromId === userId) return { ...m, deletedBySender: true };
    if (m.toId === userId) return { ...m, deletedByRecipient: true };
    return m;
  }));
}

// ─── Seed demo messages on first load ────────────────────────────────────

const SEEDED_KEY = "tfpro_messages_seeded";

export function seedMessagesIfNeeded() {
  if (localStorage.getItem(SEEDED_KEY)) return;
  const now = Date.now();
  const seeds: Message[] = [
    {
      id: "MSG-SEED-001",
      fromId: "4", fromName: "James Rodriguez", fromRole: "manager",
      toId: "1", toName: "Sarah Johnson", toRole: "technician",
      subject: "Great work on the Olive Garden job!",
      body: "Sarah, excellent work on the Olive Garden hood suppression inspection today. The client called to compliment your professionalism. Keep it up — your work reflects well on the whole team.",
      attachments: [],
      timestamp: new Date(now - 2 * 3600000).toISOString(),
      readByRecipient: false, deletedBySender: false, deletedByRecipient: false,
    },
    {
      id: "MSG-SEED-002",
      fromId: "C-1", fromName: "Mike Chen (ABC Restaurant)", fromRole: "customer",
      toId: "4", toName: "James Rodriguez", toRole: "manager",
      subject: "Glen Burnie location — scheduling question",
      body: "Hi James, we need to schedule the hood suppression service for our Glen Burnie location before July 15th. We also have a new range hood installed — please bring updated suppression agent. Can you confirm availability?\n\nAttached are the specs for the new unit.",
      attachments: [{ name: "new_hood_specs.pdf", type: "pdf", size: "1.2 MB" }],
      timestamp: new Date(now - 5 * 3600000).toISOString(),
      readByRecipient: false, deletedBySender: false, deletedByRecipient: false,
    },
    {
      id: "MSG-SEED-003",
      fromId: "4", fromName: "James Rodriguez", fromRole: "manager",
      toId: "2", toName: "Derek Williams", toRole: "technician",
      subject: "Metro Office Park — rescheduled to Friday",
      body: "Derek, the Metro Office Park sprinkler test has been rescheduled to Friday June 14 at 8 AM. The property manager confirmed building access will be available. Please update your route accordingly.",
      attachments: [],
      timestamp: new Date(now - 86400000).toISOString(),
      readByRecipient: true, deletedBySender: false, deletedByRecipient: false,
    },
    {
      id: "MSG-SEED-004",
      fromId: "4", fromName: "James Rodriguez", fromRole: "manager",
      toId: "C-6", toName: "Sandra (Olive Garden)", toRole: "customer",
      subject: "Inspection Report — Olive Garden Columbia",
      body: "Hi Sandra, please find the attached inspection report and certificate for today's hood suppression service at your Columbia location. All systems passed — certificate is valid for 12 months. Let us know if you have any questions!",
      attachments: [
        { name: "inspection_report_OG_2026-06-10.pdf", type: "pdf", size: "340 KB" },
        { name: "certificate_OG_2026.pdf", type: "pdf", size: "180 KB" },
      ],
      timestamp: new Date(now - 3 * 3600000).toISOString(),
      readByRecipient: false, deletedBySender: false, deletedByRecipient: false,
    },
    {
      id: "MSG-SEED-005",
      fromId: "5", fromName: "Kevin Park", fromRole: "technician",
      toId: "4", toName: "James Rodriguez", toRole: "manager",
      subject: "Harbor Condos — units need replacement",
      body: "James, during the exit light inspection at Harbor Condos Tower B I found 4 units that need full replacement, not just bulb swap. I don't have the replacement housings on the truck today. Can we schedule a return trip? I've attached a photo of the affected units.",
      attachments: [{ name: "harbor_exit_lights_defect.jpg", type: "image", size: "2.1 MB" }],
      timestamp: new Date(now - 1 * 3600000).toISOString(),
      readByRecipient: false, deletedBySender: false, deletedByRecipient: false,
    },
    {
      id: "MSG-SEED-006",
      fromId: "4", fromName: "James Rodriguez", fromRole: "manager",
      toId: "3", toName: "Marcus Taylor", toRole: "technician",
      subject: "Lincoln Elementary return visit — June 13",
      body: "Marcus, we're scheduling you for the return visit to Lincoln Elementary on June 13 to complete the remaining 6 extinguishers. Please confirm you have the correct tags and pull pins on your truck.",
      attachments: [],
      timestamp: new Date(now - 7 * 3600000).toISOString(),
      readByRecipient: false, deletedBySender: false, deletedByRecipient: false,
    },
  ];
  saveMessages(seeds);
  localStorage.setItem(SEEDED_KEY, "1");
}
