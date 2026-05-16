import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

function dayName(d: string) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return days[new Date(d + "T12:00:00").getDay()];
}

export function SchedulePage() {
  const { user } = useAuth();
  const calendar = useQuery(api.dashboard.teamCalendar) ?? [];
  const employees = (useQuery(api.employees.list) ?? []) as any[];

  const today = new Date().toISOString().slice(0,10);
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i - 0);
    return d.toISOString().slice(0,10);
  });

  const byDate = Object.fromEntries(
    days.map(d => [d, (calendar as any[]).filter((e: any) => e.date === d)])
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="size-6" /> Schedule</h1>
        <p className="text-sm text-gray-500">Team schedule — next 7 days</p>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map(d => (
          <div key={d} className={`rounded-xl border p-3 space-y-2 min-h-[140px] ${d === today ? "border-red-400 bg-red-50" : "bg-white"}`}>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-500 uppercase">{dayName(d)}</p>
              <p className={`text-lg font-bold ${d === today ? "text-red-600" : "text-gray-800"}`}>{d.slice(8)}</p>
            </div>
            <div className="space-y-1">
              {(byDate[d] ?? []).map((entry: any) => (
                <div key={entry.employeeId + d} className="bg-white rounded border px-2 py-1">
                  <p className="text-[10px] font-semibold truncate">{entry.employeeName}</p>
                  <p className="text-[10px] text-gray-500">{entry.jobCount} job{entry.jobCount !== 1 ? "s" : ""}</p>
                </div>
              ))}
              {(byDate[d] ?? []).length === 0 && <p className="text-[10px] text-gray-400 text-center">—</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b"><h2 className="font-semibold">Employee Overview</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-center">Shop Days Used</th>
              <th className="px-4 py-3 text-center">Utilization</th>
              <th className="px-4 py-3 text-right">Bill Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.filter((e: any) => e.isActive).map((emp: any) => (
              <tr key={emp._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{emp.name}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{emp.role}</td>
                <td className="px-4 py-3 text-center">{emp.shopDaysUsedYtd} / {emp.allowedShopDays}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.utilizationPct >= 80 ? "bg-green-100 text-green-700" : emp.utilizationPct >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                    {emp.utilizationPct}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{formatCurrency(emp.billableRate)}/hr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
