import {
  AlertCircle, Building2, ChevronRight, DollarSign, MapPin, Plus, Search, Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCustomers, createCustomer, deleteCustomer, type ApiCustomer } from "@/lib/api";
import { DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FACILITY_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "school", label: "School" },
  { value: "commercial", label: "Commercial" },
  { value: "condo", label: "Condo" },
  { value: "government", label: "Government" },
  { value: "group_home", label: "Group Home" },
  { value: "fleet", label: "Fleet Depot" },
  { value: "retail", label: "Retail" },
  { value: "office", label: "Office" },
  { value: "industrial", label: "Industrial" },
];

function facilityLabel(type: string): string {
  const found = FACILITY_TYPES.find(f => f.value === type);
  return found?.label ?? type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getTypeBadge(type: string) {
  const colors: Record<string, string> = {
    restaurant: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    school: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    commercial: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    group_home: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    condo: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    government: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    fleet: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] ${colors[type] ?? ""}`}>
      {facilityLabel(type)}
    </Badge>
  );
}

function getStatusBadge(active: boolean) {
  return active
    ? <Badge variant="default" className="bg-emerald-600 text-[10px]">Active</Badge>
    : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiCustomer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  // Add form state
  const [addForm, setAddForm] = useState({
    name: "", facilityType: "commercial", contactName: "", contactPhone: "",
    address: "", contactEmail: "", inspectionFrequency: "annual",
  });
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    getCustomers()
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.facilityType.toLowerCase().includes(search.toLowerCase()) ||
    c.contactName.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = customers.filter(c => c.isActive).length;

  async function handleDeleteCustomer() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomer(deleteTarget.id);
      setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete customer");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddCustomer() {
    if (!addForm.name.trim() || !addForm.address.trim() || !addForm.contactName.trim()) {
      toast.error("Name, address, and contact name are required");
      return;
    }
    setAddSaving(true);
    try {
      const newCustomer = await createCustomer({
        name: addForm.name.trim(),
        facilityType: addForm.facilityType,
        address: addForm.address.trim(),
        contactName: addForm.contactName.trim(),
        contactPhone: addForm.contactPhone.trim(),
        contactEmail: addForm.contactEmail.trim() || null,
        inspectionFrequency: addForm.inspectionFrequency,
        isActive: true,
      });
      setCustomers(prev => [...prev, newCustomer]);
      setAddOpen(false);
      setAddForm({ name: "", facilityType: "commercial", contactName: "", contactPhone: "", address: "", contactEmail: "", inspectionFrequency: "annual" });
      toast.success(`${newCustomer.name} added`);
    } catch {
      toast.error("Failed to add customer");
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="size-6 text-primary shrink-0" /> Customers
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {customers.length} clients · Click a customer to view jobs & details
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 self-start sm:self-auto">
              <Plus className="size-3.5" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Company Name *</Label>
                  <Input
                    placeholder="Acme Corp"
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Facility Type</Label>
                  <Select value={addForm.facilityType} onValueChange={v => setAddForm(f => ({ ...f, facilityType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FACILITY_TYPES.map(ft => (
                        <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Contact Name *</Label>
                  <Input
                    placeholder="John Smith"
                    value={addForm.contactName}
                    onChange={e => setAddForm(f => ({ ...f, contactName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input
                    placeholder="(410) 555-0000"
                    value={addForm.contactPhone}
                    onChange={e => setAddForm(f => ({ ...f, contactPhone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Primary Address *</Label>
                <Input
                  placeholder="123 Main St, Columbia, MD 21044"
                  value={addForm.address}
                  onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    placeholder="contact@example.com"
                    value={addForm.contactEmail}
                    onChange={e => setAddForm(f => ({ ...f, contactEmail: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Inspection Frequency</Label>
                  <Select value={addForm.inspectionFrequency} onValueChange={v => setAddForm(f => ({ ...f, inspectionFrequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAddCustomer} disabled={addSaving}>
                  {addSaving ? "Adding…" : "Add Customer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Building2 className="size-4 text-primary mx-auto mb-1" />
            <div className="text-xl font-extrabold">{customers.length}</div>
            <div className="text-xs text-muted-foreground">Total Clients</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="size-4 text-emerald-600 mx-auto mb-1" />
            <div className="text-xl font-extrabold">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="size-4 text-amber-600 mx-auto mb-1" />
            <div className="text-xl font-extrabold text-amber-600">{customers.length - activeCount}</div>
            <div className="text-xs text-muted-foreground">Inactive</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input placeholder="Search customers…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Desktop Table */}
      <Card className="hidden lg:block">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Customer Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-foreground/20">
                  <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Contact</th>
                  <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Phone</th>
                  <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Address</th>
                  <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Frequency</th>
                  <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Loading…</td></tr>
                )}
                {filtered.map(cust => (
                  <tr
                    key={cust.id}
                    className="border-b border-muted/50 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => navigate(`/customers/${cust.id}`)}
                  >
                    <td className="py-3 px-2">
                      <Link to={`/customers/${cust.id}`} className="font-semibold text-primary hover:underline">
                        {cust.name}
                      </Link>
                    </td>
                    <td className="py-3 px-2">{getTypeBadge(cust.facilityType)}</td>
                    <td className="py-3 px-2 text-xs text-muted-foreground">{cust.contactName}</td>
                    <td className="py-3 px-2 text-xs text-muted-foreground">{cust.contactPhone}</td>
                    <td className="py-3 px-2 text-xs text-muted-foreground max-w-[200px] truncate">
                      <span className="flex items-center gap-1"><MapPin className="size-3 shrink-0" />{cust.address}</span>
                    </td>
                    <td className="py-3 px-2 text-xs text-muted-foreground capitalize">{cust.inspectionFrequency}</td>
                    <td className="py-3 px-2">{getStatusBadge(cust.isActive)}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1">
                        <Link to={`/customers/${cust.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                            View <ChevronRight className="size-3" />
                          </Button>
                        </Link>
                        {isManager && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={e => { e.stopPropagation(); setDeleteTarget(cust); }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No customers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {filtered.map(cust => (
          <Card key={cust.id} className="hover:border-primary/30 transition-colors mb-3">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <Link to={`/customers/${cust.id}`} className="flex-1">
                  <div className="font-bold text-sm text-primary">{cust.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {getTypeBadge(cust.facilityType)}
                    {getStatusBadge(cust.isActive)}
                  </div>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  <Link to={`/customers/${cust.id}`}>
                    <ChevronRight className="size-4 text-muted-foreground mt-1" />
                  </Link>
                  {isManager && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(cust)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <Link to={`/customers/${cust.id}`}>
                <div className="text-xs text-muted-foreground mb-2">
                  <span>{cust.contactName} · {cust.contactPhone}</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3 shrink-0" /> {cust.address}
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t text-[11px] text-muted-foreground">
                  <span>Frequency: {cust.inspectionFrequency}</span>
                  <span className="text-primary font-medium">View Details →</span>
                </div>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-4" /> Remove Customer
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove <strong>{deleteTarget?.name}</strong>? This will also remove their locations and associated records.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCustomer} disabled={deleting}>
              {deleting ? "Removing…" : "Remove Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
