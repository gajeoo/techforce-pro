import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Database, Play, Trash2, Download, Upload, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function DataManagementPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const seedDemo = useMutation(api.admin.seedDemo);
  const clearAll = useMutation(api.admin.clearAll);
  const exportAll = useQuery(api.admin.exportAll);

  async function handleSeed() {
    setLoading("seed");
    try {
      const result = await seedDemo({});
      toast.success(`Demo data loaded — ${(result as any)?.employees ?? 0} employees, ${(result as any)?.customers ?? 0} customers, ${(result as any)?.jobs ?? 0} jobs`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed demo data");
    } finally {
      setLoading(null);
    }
  }

  async function handleClear() {
    setLoading("clear");
    try {
      await clearAll({});
      toast.success("All data cleared");
      setConfirmClear(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear data");
    } finally {
      setLoading(null);
    }
  }

  function handleExport() {
    if (!exportAll) return;
    const blob = new Blob([JSON.stringify(exportAll, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `techforce-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="size-6" /> Data Management</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your Convex database — seed demo data, export, or clear all records.</p>
      </div>

      {/* Demo Data */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2"><Play className="size-4 text-emerald-600" /> Load Demo Data</h2>
        <p className="text-sm text-gray-500 mb-4">Seeds 3 employees, 3 customers (3 locations each), 6 jobs, and 3 invoices into the Convex database.</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Employees", desc: "Ernest, Tyler, Ephraim" },
            { label: "Customers", desc: "Harbor View, Riverside, Gold Coast" },
            { label: "Jobs & Invoices", desc: "6 jobs + 3 invoices" },
          ].map(item => (
            <div key={item.label} className="rounded-lg bg-gray-50 border p-3">
              <p className="text-xs font-semibold text-gray-700">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
        <button
          onClick={handleSeed}
          disabled={loading === "seed"}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading === "seed" ? (
            <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : <Play className="size-4" />}
          {loading === "seed" ? "Loading…" : "Load Demo Data"}
        </button>
      </div>

      {/* Export */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2"><Download className="size-4 text-blue-600" /> Export All Data</h2>
        <p className="text-sm text-gray-500 mb-4">Download a complete JSON snapshot of all employees, customers, jobs, invoices, and more.</p>
        <button
          onClick={handleExport}
          disabled={!exportAll}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Download className="size-4" />
          Export JSON
        </button>
      </div>

      {/* Clear All */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2 text-red-700"><Trash2 className="size-4" /> Clear All Data</h2>
        <p className="text-sm text-gray-500 mb-4">Permanently deletes all records from every table. This cannot be undone.</p>
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Trash2 className="size-4" /> Clear All Data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-red-600 font-medium flex items-center gap-1">
              <AlertTriangle className="size-4" /> Are you sure? This is permanent.
            </p>
            <button
              onClick={handleClear}
              disabled={loading === "clear"}
              className="flex items-center gap-2 bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50"
            >
              {loading === "clear" ? "Clearing…" : "Yes, delete all"}
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
