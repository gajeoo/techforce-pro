import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FileText, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, statusColor } from "../lib/utils";

export function InvoicesPage() {
  const invoices = (useQuery(api.invoices.list, {}) ?? []) as any[];
  const customers = (useQuery(api.customers.list) ?? []) as any[];
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const updateInvoice = useMutation(api.invoices.update);
  const createInvoice = useMutation(api.invoices.create);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: "", service: "", quantity: 1, rate: 0, techId: "" });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!form.customerId || !form.service) { toast.error("Fill in required fields"); return; }
    setSaving(true);
    try {
      const total = form.quantity * form.rate;
      await createInvoice({ customerId: form.customerId as Id<"customers">, lineItems: [{ service: form.service, quantity: form.quantity, rate: form.rate, total }], totalAmount: total, techId: form.techId ? form.techId as Id<"employees"> : undefined });
      toast.success("Invoice created"); setShowForm(false);
    } catch (e) { toast.error(String(e)); } finally { setSaving(false); }
  }

  async function updateStatus(id: Id<"invoices">, status: string) {
    try { await updateInvoice({ id, status }); toast.success(`Invoice marked ${status}`); }
    catch (e) { toast.error(String(e)); }
  }

  const totals = { draft: invoices.filter((i: any) => i.status === "draft").reduce((s: number, i: any) => s + i.totalAmount, 0), sent: invoices.filter((i: any) => i.status === "sent").reduce((s: number, i: any) => s + i.totalAmount, 0), paid: invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.totalAmount, 0) };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="size-6" /> Invoices</h1><p className="text-sm text-gray-500">{invoices.length} total</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus className="size-4" /> New Invoice</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[["Draft", totals.draft,"bg-gray-100 text-gray-700"],["Sent",totals.sent,"bg-blue-100 text-blue-700"],["Paid",totals.paid,"bg-emerald-100 text-emerald-700"]].map(([label,amount,cls]) => (
          <div key={label as string} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-xl font-bold">{formatCurrency(amount as number)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr>
            <th className="px-4 py-3 text-left">Invoice #</th>
            <th className="px-4 py-3 text-left">Customer</th>
            <th className="px-4 py-3 text-left">Technician</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody className="divide-y">
            {invoices.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">No invoices yet</td></tr>}
            {invoices.map((inv: any) => (
              <>
                <tr key={inv._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 font-medium">{inv.customerName}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.techName ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>{inv.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                      {inv.status === "draft" && <button onClick={() => updateStatus(inv._id, "sent")} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Mark Sent</button>}
                      {inv.status === "sent" && <button onClick={() => updateStatus(inv._id, "paid")} className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Mark Paid</button>}
                      <button onClick={() => setExpanded(expanded === inv._id ? null : inv._id)} className="p-1 hover:bg-gray-100 rounded">
                        {expanded === inv._id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded === inv._id && (
                  <tr key={`${inv._id}-detail`} className="bg-gray-50">
                    <td colSpan={6} className="px-6 py-3">
                      <div className="text-xs space-y-1">
                        {inv.lineItems?.map((li: any, i: number) => (
                          <div key={i} className="flex gap-4"><span className="font-medium">{li.service}</span><span>{li.quantity} × {formatCurrency(li.rate)}</span><span className="font-semibold">{formatCurrency(li.total)}</span></div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-lg">New Invoice</h2><button onClick={() => setShowForm(false)}><X className="size-5" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-600 block mb-1">Customer *</label>
              <select value={form.customerId} onChange={e => setForm(f => ({...f, customerId: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Select…</option>{customers.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
              <div><label className="text-xs font-medium text-gray-600 block mb-1">Service *</label><input value={form.service} onChange={e => setForm(f => ({...f, service: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 block mb-1">Quantity</label><input type="number" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: Number(e.target.value)}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
                <div><label className="text-xs font-medium text-gray-600 block mb-1">Rate ($)</label><input type="number" value={form.rate} onChange={e => setForm(f => ({...f, rate: Number(e.target.value)}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 block mb-1">Technician</label>
              <select value={form.techId} onChange={e => setForm(f => ({...f, techId: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">None</option>{employees.map((e: any) => <option key={e._id} value={e._id}>{e.name}</option>)}</select></div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm"><span className="font-medium">Total: {formatCurrency(form.quantity * form.rate)}</span></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">{saving ? "Creating…" : "Create Invoice"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
