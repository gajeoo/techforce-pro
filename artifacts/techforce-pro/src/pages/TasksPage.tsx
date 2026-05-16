import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

const PRIORITIES = ["low","medium","high","urgent"];
const STATUSES = ["open","in_progress","completed"];

const priorityColor: Record<string,string> = { urgent:"bg-red-100 text-red-700", high:"bg-orange-100 text-orange-700", medium:"bg-yellow-100 text-yellow-700", low:"bg-gray-100 text-gray-600" };
const statusColor: Record<string,string> = { open:"bg-blue-100 text-blue-700", in_progress:"bg-amber-100 text-amber-700", completed:"bg-green-100 text-green-700" };

export function TasksPage() {
  const { user } = useAuth();
  const tasks = (useQuery(api.tasks.list) ?? []) as any[];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", assignedTo: "", dueDate: "" });

  const create = useMutation(api.tasks.create);
  const update = useMutation(api.tasks.update);
  const remove = useMutation(api.tasks.remove);

  async function handleCreate() {
    if (!form.title) { toast.error("Title required"); return; }
    try {
      await create({ title: form.title, description: form.description || undefined, priority: form.priority as any, assignedTo: form.assignedTo || undefined, dueDate: form.dueDate || undefined, createdBy: user?.name ?? "Unknown", createdByRole: user?.role ?? "manager" });
      toast.success("Task created");
      setShowForm(false);
      setForm({ title: "", description: "", priority: "medium", assignedTo: "", dueDate: "" });
    } catch (e) { toast.error(String(e)); }
  }

  async function toggleStatus(task: any) {
    const next = task.status === "open" ? "in_progress" : task.status === "in_progress" ? "completed" : "open";
    try { await update({ id: task._id, status: next }); } catch (e) { toast.error(String(e)); }
  }

  const open = tasks.filter((t: any) => t.status !== "completed");
  const done = tasks.filter((t: any) => t.status === "completed");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><CheckSquare className="size-6" /> Tasks</h1><p className="text-sm text-gray-500">{open.length} active · {done.length} completed</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus className="size-4" /> Add Task</button>
      </div>

      <div className="space-y-3">
        {tasks.map((task: any) => (
          <div key={task._id} className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${task.status === "completed" ? "opacity-60" : ""}`}>
            <button onClick={() => toggleStatus(task)} className={`mt-0.5 size-5 rounded border-2 flex items-center justify-center shrink-0 ${task.status === "completed" ? "border-green-500 bg-green-500 text-white" : "border-gray-300 hover:border-red-400"}`}>
              {task.status === "completed" && <Check className="size-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`font-medium text-sm ${task.status === "completed" ? "line-through text-gray-400" : ""}`}>{task.title}</p>
                <button onClick={() => remove({ id: task._id })} className="text-gray-300 hover:text-red-500 shrink-0"><X className="size-4" /></button>
              </div>
              {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor[task.priority] ?? ""}`}>{task.priority}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[task.status] ?? ""}`}>{task.status.replace("_"," ")}</span>
                {task.assignedTo && <span className="text-xs text-gray-500">→ {task.assignedTo}</span>}
                {task.dueDate && <span className="text-xs text-gray-500">Due {task.dueDate}</span>}
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-gray-400 text-sm text-center py-12">No tasks yet</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">New Task</h2><button onClick={() => setShowForm(false)}><X className="size-5" /></button></div>
            <div><label className="text-xs font-medium text-gray-600">Title *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} /></div>
            <div><label className="text-xs font-medium text-gray-600">Description</label><textarea rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-600">Priority</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
              <div><label className="text-xs font-medium text-gray-600">Due Date</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dueDate} onChange={e => setForm(f => ({...f, dueDate: e.target.value}))} /></div>
            </div>
            <div><label className="text-xs font-medium text-gray-600">Assign To</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="Name or role" value={form.assignedTo} onChange={e => setForm(f => ({...f, assignedTo: e.target.value}))} /></div>
            <div className="flex gap-2 pt-2"><button onClick={handleCreate} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Create</button><button onClick={() => setShowForm(false)} className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
