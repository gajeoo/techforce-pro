import { useState } from "react";
import {
  AlertTriangle,
  DollarSign,
  Download,
  Edit,
  FileText,
  History,
  Package,
  Percent,
  Plus,
  Search,
  Shield,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { customers } from "@/lib/mockData";

// Per-client rate tables matching the blueprint (Section 10)
const clientRates: { id: string; client: string; suppression: number | null; extinguisher: number | null; sprinkler: number | null; exitLights: number | null; contractType: string; renewal: string }[] = [];

// Service code pricing defaults
const serviceCodePricing = [
  { code: "H", name: "Hydrotest", description: "Hydrostatic pressure test per DOT/NFPA", tier: "Premium", basePrice: 42.00 },
  { code: "6", name: "6-Year Maintenance", description: "Complete teardown, internal inspection & reassembly", tier: "Above Standard", basePrice: 36.00 },
  { code: "R", name: "Recharge", description: "Refill extinguishing agent after use or maintenance", tier: "Standard", basePrice: 25.00 },
  { code: "I", name: "Inspection", description: "Annual/semi-annual visual inspection per NFPA 10", tier: "Base", basePrice: 16.79 },
  { code: "C", name: "Condemned", description: "Unit fails inspection — removed from service", tier: "No Charge", basePrice: 0 },
  { code: "N", name: "Non-Compliance", description: "Unit/area does not meet code — notice issued", tier: "No Charge", basePrice: 0 },
];

// ─── Per-customer product/service pricing ───────────────────────────────
// Admin can set a price for any service + product combination per customer
// These prices apply to ALL jobs under that customer
interface CustomerProductPrice {
  id: string;
  customerId: string;
  customerName: string;
  service: string;       // e.g. "6yr Maintenance", "Recharge", "Inspection", "Hydro Test"
  product: string;       // e.g. "5lb ABC", "10lb ABC", "CO2 5lb", "Class K 6L"
  price: number;
  lastUpdated: string;
}

const initialCustomerPrices: CustomerProductPrice[] = [];

const serviceOptions = ["6yr Maintenance", "Recharge", "Inspection", "Hydro Test", "Conductivity Test", "SS Inspection", "Labor"];
const productOptions = [
  "ABC Dry Chemical 5lb", "ABC Dry Chemical 10lb", "ABC Dry Chemical 20lb",
  "CO2 5lb", "CO2 10lb", "Class K Wet Chemical 6L", "Water 2.5gal",
  "Stored Pressure", "Cartridge", "Large Cylinder",
];

const rateHistory: { date: string; client: string; field: string; oldVal: string; newVal: string; changedBy: string }[] = [];

export function PricingPage() {
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<typeof clientRates[0] | null>(null);
  // Per-customer product pricing state
  const [customerPrices, setCustomerPrices] = useState(initialCustomerPrices);
  const [priceSearch, setPriceSearch] = useState("");
  const [priceCustomerFilter, setPriceCustomerFilter] = useState("all");
  const [priceServiceFilter, setPriceServiceFilter] = useState("all");
  const [addPriceOpen, setAddPriceOpen] = useState(false);
  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<CustomerProductPrice | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditVal, setInlineEditVal] = useState("");
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkPct, setBulkPct] = useState("5");
  const [clientRatesState, setClientRatesState] = useState(clientRates);

  function commitInlineEdit(id: string) {
    const newPrice = parseFloat(inlineEditVal);
    if (!isNaN(newPrice) && newPrice > 0) {
      setCustomerPrices(prev => prev.map(p => p.id === id ? { ...p, price: newPrice, lastUpdated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } : p));
    }
    setInlineEditId(null);
  }

  function applyBulkUpdate() {
    const pct = parseFloat(bulkPct);
    if (isNaN(pct)) return;
    const multiplier = 1 + pct / 100;
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setCustomerPrices(prev => prev.map(p => {
      const matches = (priceCustomerFilter === "all" || p.customerId === priceCustomerFilter) &&
        (priceServiceFilter === "all" || p.service === priceServiceFilter);
      return matches ? { ...p, price: Math.round(p.price * multiplier * 100) / 100, lastUpdated: today } : p;
    }));
    setClientRatesState(prev => prev.map(r => ({
      ...r,
      suppression: r.suppression ? Math.round(r.suppression * multiplier) : null,
      extinguisher: r.extinguisher ? Math.round(r.extinguisher * multiplier) : null,
      sprinkler: r.sprinkler ? Math.round(r.sprinkler * multiplier) : null,
      exitLights: r.exitLights ? Math.round(r.exitLights * multiplier) : null,
    })) as typeof clientRates);
    setBulkUpdateOpen(false);
  }

  function downloadPricingCsv() {
    const rows = [["Customer", "Service", "Product", "Price", "Last Updated"]];
    filteredPrices.forEach(p => rows.push([p.customerName, p.service, p.product, p.price.toFixed(2), p.lastUpdated]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "pricing.csv" });
    a.click();
  }

  function getDaysUntilRenewal(renewal: string): number {
    const d = new Date(renewal + " 1");
    d.setMonth(d.getMonth() + 1, 0);
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }

  const filteredRates = clientRatesState.filter(r =>
    r.client.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPrices = customerPrices.filter(p => {
    const matchesSearch = p.customerName.toLowerCase().includes(priceSearch.toLowerCase()) ||
      p.service.toLowerCase().includes(priceSearch.toLowerCase()) ||
      p.product.toLowerCase().includes(priceSearch.toLowerCase());
    const matchesCustomer = priceCustomerFilter === "all" || p.customerId === priceCustomerFilter;
    const matchesService = priceServiceFilter === "all" || p.service === priceServiceFilter;
    return matchesSearch && matchesCustomer && matchesService;
  });

  // Group prices by customer for summary
  const pricesByCustomer = customerPrices.reduce<Record<string, CustomerProductPrice[]>>((acc, p) => {
    if (!acc[p.customerName]) acc[p.customerName] = [];
    acc[p.customerName].push(p);
    return acc;
  }, {});

  // Quick comparison: same service+product across customers
  const comparisonService = "6yr Maintenance";
  const comparisonProduct = "ABC Dry Chemical 5lb";
  const comparisons = customerPrices.filter(p => p.service === comparisonService && p.product === comparisonProduct);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="size-6 text-primary shrink-0" />
            Customer Pricing & Contracts
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Per-client rate tables, product/service pricing & contract management
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadPricingCsv}>
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkUpdateOpen(true)}>
            <Percent className="size-3.5" /> Bulk Price Update
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> Add Rate Table
          </Button>
        </div>
      </div>

      <Tabs defaultValue="product-pricing" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="product-pricing" className="text-xs gap-1"><Package className="size-3" /> Product & Service Pricing</TabsTrigger>
          <TabsTrigger value="rates" className="text-xs">Client Rate Tables</TabsTrigger>
          <TabsTrigger value="codes" className="text-xs">Service Codes (H/6/R/I/C/N)</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">Rate History</TabsTrigger>
        </TabsList>

        {/* ─── Per-Customer Product & Service Pricing (NEW) ─── */}
        <TabsContent value="product-pricing">
          {/* Quick Price Comparison */}
          <Card className="mb-4 border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="size-4 text-blue-600" />
                Price Comparison — {comparisonService} on {comparisonProduct}
              </CardTitle>
              <CardDescription>Same service + product across customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {comparisons.map(c => (
                  <div key={c.id} className="bg-white dark:bg-background rounded-lg border px-4 py-2 text-center min-w-[140px]">
                    <div className="text-xs text-muted-foreground truncate">{c.customerName.split("(")[0].split("—")[0].trim()}</div>
                    <div className="text-lg font-extrabold text-emerald-600">${c.price.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Search customer, service, product..." className="pl-8" value={priceSearch} onChange={e => setPriceSearch(e.target.value)} />
            </div>
            <Select value={priceCustomerFilter} onValueChange={setPriceCustomerFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Customers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {Object.keys(pricesByCustomer).map(name => {
                  const first = customerPrices.find(p => p.customerName === name);
                  return <SelectItem key={name} value={first?.customerId || name}>{name}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Select value={priceServiceFilter} onValueChange={setPriceServiceFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Services" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-1.5" onClick={() => setAddPriceOpen(true)}>
              <Plus className="size-3.5" /> Set Customer Price
            </Button>
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/20">
                    <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Customer</th>
                    <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Service</th>
                    <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Product</th>
                    <th className="text-right py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Price</th>
                    <th className="text-center py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Last Updated</th>
                    <th className="text-center py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrices.map(p => (
                    <tr key={p.id} className="border-b border-muted/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-2">
                        <div className="font-semibold text-xs">{p.customerName}</div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-[10px]">
                          <Wrench className="size-2.5 mr-0.5" /> {p.service}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary" className="text-[10px]">
                          <Package className="size-2.5 mr-0.5" /> {p.product}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {inlineEditId === p.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-muted-foreground">$</span>
                            <input
                              autoFocus
                              type="number"
                              step="0.01"
                              value={inlineEditVal}
                              onChange={e => setInlineEditVal(e.target.value)}
                              onBlur={() => commitInlineEdit(p.id)}
                              onKeyDown={e => { if (e.key === "Enter") commitInlineEdit(p.id); if (e.key === "Escape") setInlineEditId(null); }}
                              className="w-20 text-right text-sm font-bold border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        ) : (
                          <button
                            className="text-base font-extrabold text-emerald-600 hover:text-primary hover:underline transition-colors cursor-pointer"
                            onClick={() => { setInlineEditId(p.id); setInlineEditVal(p.price.toFixed(2)); }}
                            title="Click to edit price"
                          >
                            ${p.price.toFixed(2)}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center text-xs text-muted-foreground">{p.lastUpdated}</td>
                      <td className="py-3 px-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => { setEditingPrice(p); setEditPriceOpen(true); }}
                        >
                          <Edit className="size-3" /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPrices.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No pricing rules match your filters</div>
              )}
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredPrices.map(p => (
              <Card key={p.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold">{p.customerName}</h3>
                    <span className="text-lg font-extrabold text-emerald-600">${p.price.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    <Badge variant="outline" className="text-[10px]"><Wrench className="size-2.5 mr-0.5" /> {p.service}</Badge>
                    <Badge variant="secondary" className="text-[10px]"><Package className="size-2.5 mr-0.5" /> {p.product}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Updated: {p.lastUpdated}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { setEditingPrice(p); setEditPriceOpen(true); }}>
                      <Edit className="size-2.5" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info note */}
          <Card className="bg-muted/30 mt-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold mb-2">How Customer Pricing Works</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Admin sets a specific price for each <strong>service + product</strong> combination per customer</li>
                <li>• Example: 6yr Maintenance on a 5lb ABC = <strong>$35 for BCOGov</strong>, <strong>$40 for Howard County Schools</strong></li>
                <li>• These prices automatically apply to <strong>all jobs</strong> under that customer</li>
                <li>• If no customer-specific price exists, the <strong>default catalog price</strong> is used</li>
                <li>• All price changes are logged in the <strong>Rate History</strong> tab</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Client Rate Tables ─── */}
        <TabsContent value="rates">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Search clients..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Desktop */}
          <Card className="hidden md:block">
            <CardContent className="pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/20">
                    <th className="text-left py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client</th>
                    <th className="text-right py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Suppression</th>
                    <th className="text-right py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Extinguisher</th>
                    <th className="text-right py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Sprinkler</th>
                    <th className="text-right py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Exit Lights</th>
                    <th className="text-center py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Contract</th>
                    <th className="text-center py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Renewal</th>
                    <th className="text-center py-3 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map(rate => {
                    const renewalDate = new Date(rate.renewal + " 1");
                    const isExpiringSoon = renewalDate <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                    return (
                      <tr key={rate.id} className="border-b border-muted/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-2"><div className="font-semibold text-xs">{rate.client}</div></td>
                        <td className="py-3 px-2 text-right text-xs font-medium">{rate.suppression ? <span className="text-emerald-600">${rate.suppression.toLocaleString()}</span> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-3 px-2 text-right text-xs font-medium">{rate.extinguisher ? <span className="text-emerald-600">${rate.extinguisher.toLocaleString()}</span> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-3 px-2 text-right text-xs font-medium">{rate.sprinkler ? <span className="text-emerald-600">${rate.sprinkler.toLocaleString()}</span> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-3 px-2 text-right text-xs font-medium">{rate.exitLights ? <span className="text-emerald-600">${rate.exitLights.toLocaleString()}</span> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge variant={rate.contractType === "Government" ? "default" : "secondary"} className="text-[10px]">
                            {rate.contractType === "Government" && <Shield className="size-2.5 mr-0.5" />}
                            {rate.contractType}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {(() => {
                            const days = getDaysUntilRenewal(rate.renewal);
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-xs ${isExpiringSoon ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                                  {rate.renewal}
                                </span>
                                <Badge
                                  variant={days < 0 ? "destructive" : days <= 30 ? "destructive" : days <= 90 ? "default" : "secondary"}
                                  className={`text-[9px] px-1.5 ${days > 90 && days <= 180 ? "bg-amber-500" : ""}`}
                                >
                                  {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                                </Badge>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setSelectedClient(rate); setEditOpen(true); }}>
                            <Edit className="size-3" /> Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {filteredRates.map(rate => (
              <Card key={rate.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold">{rate.client}</h3>
                    <Badge variant="secondary" className="text-[10px]">{rate.contractType}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Suppression:</span> <span className="font-medium">{rate.suppression ? `$${rate.suppression}` : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Extinguisher:</span> <span className="font-medium">{rate.extinguisher ? `$${rate.extinguisher}` : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Sprinkler:</span> <span className="font-medium">{rate.sprinkler ? `$${rate.sprinkler}` : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Exit Lights:</span> <span className="font-medium">{rate.exitLights ? `$${rate.exitLights}` : "—"}</span></div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Renewal: {rate.renewal}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { setSelectedClient(rate); setEditOpen(true); }}>
                      <Edit className="size-2.5" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-muted/30 mt-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold mb-2">Pricing Rules</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>Maryland sales tax (6%)</strong> auto-applied on all invoices where applicable</li>
                <li>• <strong>Government contracts</strong> (BCOGov): tax-exempt, net-60 terms, PO reference required</li>
                <li>• <strong>Volume discounts:</strong> configurable per client for high-quantity extinguisher inspections</li>
                <li>• <strong>Contract-based pricing:</strong> rates locked for contract period, auto-flagged when renewal is due</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Service Codes ─── */}
        <TabsContent value="codes">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Service Code Reference (H / 6 / R / I / C / N)
              </CardTitle>
              <CardDescription>
                Standard codes used on Multicorp field tickets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-foreground/20">
                      <th className="text-center py-3 px-2 font-semibold text-xs uppercase">Code</th>
                      <th className="text-left py-3 px-2 font-semibold text-xs uppercase text-muted-foreground">Full Name</th>
                      <th className="text-left py-3 px-2 font-semibold text-xs uppercase text-muted-foreground">Description</th>
                      <th className="text-center py-3 px-2 font-semibold text-xs uppercase text-muted-foreground">Pricing Tier</th>
                      <th className="text-right py-3 px-2 font-semibold text-xs uppercase text-muted-foreground">Base Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceCodePricing.map(sc => (
                      <tr key={sc.code} className="border-b border-muted/50 hover:bg-muted/20">
                        <td className="py-3 px-2 text-center">
                          <span className="inline-flex items-center justify-center size-8 rounded-lg bg-primary text-white text-sm font-extrabold">{sc.code}</span>
                        </td>
                        <td className="py-3 px-2 font-semibold text-xs">{sc.name}</td>
                        <td className="py-3 px-2 text-xs text-muted-foreground">{sc.description}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge variant={sc.tier === "Premium" ? "destructive" : sc.tier === "Above Standard" ? "default" : sc.tier === "Standard" ? "secondary" : sc.tier === "Base" ? "outline" : "secondary"} className="text-[10px]">{sc.tier}</Badge>
                        </td>
                        <td className="py-3 px-2 text-right text-xs font-bold">{sc.basePrice > 0 ? `$${sc.basePrice.toFixed(2)}` : <span className="text-muted-foreground">N/A</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-3">
                {serviceCodePricing.map(sc => (
                  <div key={sc.code} className="border rounded-xl p-3 flex items-start gap-3">
                    <span className="inline-flex items-center justify-center size-10 rounded-lg bg-primary text-white text-base font-extrabold shrink-0">{sc.code}</span>
                    <div>
                      <div className="text-sm font-bold">{sc.name}</div>
                      <div className="text-xs text-muted-foreground">{sc.description}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-[10px]">{sc.tier}</Badge>
                        {sc.basePrice > 0 && <span className="text-xs font-bold text-emerald-600">${sc.basePrice.toFixed(2)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t pt-4">
                <h4 className="text-sm font-bold mb-3">Common Code Combinations</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { combo: "R + I", desc: "Recharge and Inspection — most common combination" },
                    { combo: "6 + R", desc: "6-Year Maintenance plus Recharge — required after 6yr service" },
                    { combo: "H + R", desc: "Hydrotest and Recharge — required after hydro" },
                    { combo: "I only", desc: "Inspection only — unit passed, no service needed" },
                  ].map(c => (
                    <div key={c.combo} className="border rounded-lg p-3 bg-muted/20">
                      <span className="text-sm font-bold text-primary">{c.combo}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Rate History ─── */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="size-4 text-primary" />
                Rate Change Audit Trail
              </CardTitle>
              <CardDescription>Full history of every price change with date and approver</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rateHistory.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                    <div className="size-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <Edit className="size-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{entry.client}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{entry.date}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <strong>{entry.field}</strong>: <span className="text-red-600 line-through">{entry.oldVal}</span> → <span className="text-emerald-600 font-bold">{entry.newVal}</span>
                      </p>
                      <span className="text-[10px] text-muted-foreground">Changed by: {entry.changedBy}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Rate Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="size-5 text-primary" />
              Edit Rates — {selectedClient?.client}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Suppression Rate ($)</Label><Input type="number" defaultValue={selectedClient?.suppression ?? ""} placeholder="—" /></div>
              <div><Label className="text-xs">Extinguisher Rate ($)</Label><Input type="number" defaultValue={selectedClient?.extinguisher ?? ""} placeholder="—" /></div>
              <div><Label className="text-xs">Sprinkler Rate ($)</Label><Input type="number" defaultValue={selectedClient?.sprinkler ?? ""} placeholder="—" /></div>
              <div><Label className="text-xs">Exit Lights Rate ($)</Label><Input type="number" defaultValue={selectedClient?.exitLights ?? ""} placeholder="—" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Contract Type</Label>
                <Select defaultValue={selectedClient?.contractType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Annual">Annual</SelectItem>
                    <SelectItem value="Semi-Annual">Semi-Annual</SelectItem>
                    <SelectItem value="Government">Government</SelectItem>
                    <SelectItem value="Per-Call">Per-Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Contract Renewal</Label><Input type="month" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={() => setEditOpen(false)}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Price Update Dialog */}
      <Dialog open={bulkUpdateOpen} onOpenChange={setBulkUpdateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="size-5 text-primary" />
              Bulk Price Update
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              Apply a percentage increase (or decrease) to all prices matching your current filters.
              {priceCustomerFilter !== "all" && <span className="block mt-1 text-primary font-medium">Customer filter active — only affecting filtered records.</span>}
              {priceServiceFilter !== "all" && <span className="block mt-0.5 text-primary font-medium">Service filter active — only affecting filtered records.</span>}
              {priceCustomerFilter === "all" && priceServiceFilter === "all" && <span className="block mt-1 font-medium text-amber-600">No filter — this will update ALL {customerPrices.length} pricing records and all client rate tables.</span>}
            </div>
            <div>
              <Label className="text-xs font-semibold">Percentage Change</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  step="0.5"
                  value={bulkPct}
                  onChange={e => setBulkPct(e.target.value)}
                  className="w-24"
                  placeholder="5"
                />
                <span className="text-sm font-medium">%</span>
                <span className="text-xs text-muted-foreground ml-1">(use negative to decrease)</span>
              </div>
            </div>
            <div className="rounded-lg border p-3 text-xs space-y-1">
              <div className="font-semibold mb-1.5">Preview:</div>
              {[20, 35, 42, 65].map(price => (
                <div key={price} className="flex justify-between text-muted-foreground">
                  <span>${price.toFixed(2)}</span>
                  <span className="text-primary font-medium">→ ${(price * (1 + parseFloat(bulkPct || "0") / 100)).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setBulkUpdateOpen(false)}>Cancel</Button>
              <Button onClick={applyBulkUpdate} className="gap-1.5">
                <Percent className="size-3.5" /> Apply {bulkPct}% Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Rate Table Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Add Client Rate Table
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Customer</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Suppression ($)</Label><Input type="number" placeholder="0" /></div>
              <div><Label className="text-xs">Extinguisher ($)</Label><Input type="number" placeholder="0" /></div>
              <div><Label className="text-xs">Sprinkler ($)</Label><Input type="number" placeholder="0" /></div>
              <div><Label className="text-xs">Exit Lights ($)</Label><Input type="number" placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Contract Type</Label>
                <Select><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>
                  <SelectItem value="Annual">Annual</SelectItem><SelectItem value="Semi-Annual">Semi-Annual</SelectItem><SelectItem value="Government">Government</SelectItem><SelectItem value="Per-Call">Per-Call</SelectItem>
                </SelectContent></Select>
              </div>
              <div><Label className="text-xs">Renewal Date</Label><Input type="month" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={() => setAddOpen(false)}>Create Rate Table</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Customer Product Price Dialog */}
      <Dialog open={addPriceOpen} onOpenChange={setAddPriceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="size-5 text-primary" />
              Set Customer Product Price
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              Set a specific price for a service + product combination for this customer. This price will apply to all jobs under them.
            </div>
            <div>
              <Label className="text-xs">Customer</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Service</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                  <SelectContent>
                    {serviceOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Product</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                  <SelectContent>
                    {productOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Price ($)</Label>
              <Input type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddPriceOpen(false)}>Cancel</Button>
              <Button onClick={() => setAddPriceOpen(false)}>Set Price</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Product Price Dialog */}
      <Dialog open={editPriceOpen} onOpenChange={setEditPriceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="size-5 text-primary" />
              Edit Price — {editingPrice?.customerName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground">Service</div>
                <div className="text-sm font-semibold">{editingPrice?.service}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground">Product</div>
                <div className="text-sm font-semibold">{editingPrice?.product}</div>
              </div>
            </div>
            <div>
              <Label className="text-xs">New Price ($)</Label>
              <Input type="number" step="0.01" defaultValue={editingPrice?.price} />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              This change will be logged in the audit trail and apply to all future jobs for <strong>{editingPrice?.customerName}</strong>.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditPriceOpen(false)}>Cancel</Button>
              <Button onClick={() => setEditPriceOpen(false)}>Update Price</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
