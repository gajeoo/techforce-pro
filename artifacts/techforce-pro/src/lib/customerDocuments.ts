export type CustomerDocType = "invoice" | "certificate" | "report" | "photo" | "signature" | "other";

export interface CustomerDocument {
  id: string;
  customerId: number;
  customerName: string;
  invoiceId?: number;
  invoiceNumber?: string;
  name: string;
  type: CustomerDocType;
  description?: string;
  sentBy: string;
  sentByRole: string;
  sentAt: string;
  viewed: boolean;
  amount?: number;
  invoiceStatus?: string;
}

const STORAGE_KEY = "tfpro_customer_documents";

function loadAll(): CustomerDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomerDocument[]) : [];
  } catch {
    return [];
  }
}

function saveAll(docs: CustomerDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

export function saveCustomerDocument(
  doc: Omit<CustomerDocument, "id" | "sentAt" | "viewed">,
): CustomerDocument {
  const full: CustomerDocument = {
    ...doc,
    id: `cdoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sentAt: new Date().toISOString(),
    viewed: false,
  };
  const all = loadAll();
  // De-duplicate: if this is an invoice doc, replace previous record for same invoice
  const filtered = doc.invoiceId
    ? all.filter(d => d.invoiceId !== doc.invoiceId || d.type !== doc.type)
    : all;
  saveAll([...filtered, full]);
  return full;
}

export function loadCustomerDocuments(customerId: number): CustomerDocument[] {
  return loadAll()
    .filter(d => d.customerId === customerId)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function markDocumentViewed(id: string): void {
  const all = loadAll();
  saveAll(all.map(d => d.id === id ? { ...d, viewed: true } : d));
}

export function countUnviewedDocuments(customerId: number): number {
  return loadAll().filter(d => d.customerId === customerId && !d.viewed).length;
}

export function updateDocumentInvoiceStatus(invoiceId: number, status: string): void {
  const all = loadAll();
  saveAll(all.map(d => d.invoiceId === invoiceId ? { ...d, invoiceStatus: status } : d));
}
