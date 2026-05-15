import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, Circle, Clock, ListTodo, Plus, Trash2,
  AlertTriangle, ChevronDown, User, CalendarDays, Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { getEmployees, type ApiEmployee } from "@/lib/api";
import { toast } from "sonner";

const API = "/api";

type TaskStatus   = "open" | "in-progress" | "done";
type TaskPriority = "high" | "medium" | "low";

interface Task {
  id: number;
  title: string;
  description: string | null;
  createdBy: string;
  createdByRole: string;
  assignedTo: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  jobId: number | null;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  low:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  "open":        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "in-progress": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "done":        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  assignedTo: "",
  priority: "medium" as TaskPriority,
  dueDate: "",
};

export function TasksPage() {
  const { user } = useAuth();
  const isManager    = user?.role === "manager";
  const isTechnician = user?.role === "technician";

  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"all" | TaskStatus>("all");
  const [newOpen, setNewOpen]   = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/tasks`);
      if (r.ok) setTasks(await r.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    getEmployees().then(setEmployees).catch(() => {});
  }, [load]);

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditTask(null);
    setNewOpen(true);
  }

  function openEdit(task: Task) {
    setForm({
      title: task.title,
      description: task.description ?? "",
      assignedTo: task.assignedTo ?? "",
      priority: task.priority,
      dueDate: task.dueDate ?? "",
    });
    setEditTask(task);
    setNewOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editTask) {
        const r = await fetch(`${API}/tasks/${editTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            assignedTo: form.assignedTo || null,
            priority: form.priority,
            dueDate: form.dueDate || null,
          }),
        });
        if (!r.ok) throw new Error();
        toast.success("Task updated.");
      } else {
        const r = await fetch(`${API}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            createdBy: user?.name ?? "Manager",
            createdByRole: user?.role ?? "manager",
            assignedTo: form.assignedTo || null,
            priority: form.priority,
            dueDate: form.dueDate || null,
          }),
        });
        if (!r.ok) throw new Error();
        toast.success("Task created.");
      }
      setNewOpen(false);
      await load();
    } catch {
      toast.error("Failed to save task.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(task: Task) {
    const next: TaskStatus = task.status === "open" ? "in-progress" : task.status === "in-progress" ? "done" : "open";
    try {
      await fetch(`${API}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch {
      toast.error("Failed to update status.");
    }
  }

  async function deleteTask(id: number) {
    if (!confirm("Delete this task?")) return;
    try {
      await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
      toast.success("Task deleted.");
      await load();
    } catch {
      toast.error("Failed to delete.");
    }
  }

  const displayed = tab === "all" ? tasks : tasks.filter(t => t.status === tab);
  const openCount  = tasks.filter(t => t.status === "open").length;
  const inProgCount = tasks.filter(t => t.status === "in-progress").length;
  const doneCount  = tasks.filter(t => t.status === "done").length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ListTodo className="size-6 text-primary shrink-0" /> Team Tasks
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Shared task board — visible to all field staff
          </p>
        </div>
        {!isTechnician && (
          <Button className="gap-1.5 self-start sm:self-auto" onClick={openNew}>
            <Plus className="size-4" /> New Task
          </Button>
        )}
        {isTechnician && (
          <Button className="gap-1.5 self-start sm:self-auto" variant="outline" onClick={openNew}>
            <Plus className="size-4" /> Post Task
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Open</div>
            <div className="text-2xl font-extrabold text-blue-600">{openCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">In Progress</div>
            <div className="text-2xl font-extrabold text-amber-600">{inProgCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Done</div>
            <div className="text-2xl font-extrabold text-emerald-600">{doneCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({openCount})</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress ({inProgCount})</TabsTrigger>
          <TabsTrigger value="done">Done ({doneCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Task list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading tasks…</div>
      ) : displayed.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ListTodo className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
            <Button variant="link" size="sm" className="mt-2" onClick={openNew}>
              Create the first task →
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayed.map(task => (
            <Card key={task.id} className={`overflow-hidden transition-all ${task.status === "done" ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <button
                    className="mt-0.5 shrink-0 hover:scale-110 transition-transform"
                    onClick={() => toggleStatus(task)}
                    title={`Mark as ${task.status === "open" ? "in-progress" : task.status === "in-progress" ? "done" : "open"}`}
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="size-5 text-emerald-500" />
                    ) : task.status === "in-progress" ? (
                      <Clock className="size-5 text-amber-500" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className={`text-[10px] ${PRIORITY_COLOR[task.priority]}`}>
                          {task.priority === "high" && <AlertTriangle className="size-2.5 mr-1" />}
                          {task.priority}
                        </Badge>
                        <Badge variant="secondary" className={`text-[10px] ${STATUS_COLOR[task.status]}`}>
                          {task.status.replace("-", " ")}
                        </Badge>
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="size-3" />
                        Posted by <strong className="text-foreground ml-0.5">{task.createdBy}</strong>
                      </span>
                      {task.assignedTo && (
                        <span className="flex items-center gap-1">
                          <User className="size-3 text-primary" />
                          Assigned to <strong className="text-foreground ml-0.5">{task.assignedTo}</strong>
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3" /> Due {task.dueDate}
                        </span>
                      )}
                      <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(isManager || task.createdBy === user?.name) && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(task)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {(isManager || task.createdBy === user?.name) && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => deleteTask(task.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New / Edit Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="size-5 text-primary" />
              {editTask ? "Edit Task" : "New Task"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title *</Label>
              <Input
                placeholder="What needs to be done?"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                placeholder="Additional details (optional)"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as TaskPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assign To (name or team)</Label>
              <Select
                value={form.assignedTo || "__none__"}
                onValueChange={v => setForm(f => ({ ...f, assignedTo: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned (visible to all)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned — visible to all</SelectItem>
                  <SelectItem value="All Technicians">All Technicians</SelectItem>
                  {employees.filter(e => e.isActive).map(e => (
                    <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNewOpen(false)} disabled={saving}>Cancel</Button>
              <Button disabled={saving || !form.title.trim()} onClick={handleSave}>
                {saving ? "Saving…" : editTask ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
