import { useState, useMemo } from "react";
import {
  Receipt, DollarSign, Download, TrendingDown, TrendingUp,
  AlertCircle, FileText, Calendar, Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAILY_FUEL   = 25;    // $25 fuel per working day per employee
const DAILY_TOOLS  = 15;    // $15 tools/equipment per working day per employee
const BURDEN_RATE  = 0.30;  // 30% payroll burden (FICA, benefits, insurance)
const OVERHEAD_PER_EMP = 10_000; // $10k annual overhead per employee
const ANNUAL_WORK_DAYS = 260;
const EFF_TAX_RATE = 0.25;  // 25% effective tax rate estimate

const QUARTERS = [
  { label: "Q1 (Jan – Mar)", months: [0, 1, 2],  due: "Apr 15" },
  { label: "Q2 (Apr – Jun)", months: [3, 4, 5],  due: "Jun 15" },
  { label: "Q3 (Jul – Sep)", months: [6, 7, 8],  due: "Sep 15" },
  { label: "Q4 (Oct – Dec)", months: [9, 10, 11], due: "Jan 15" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtCurrency(n: number) {
  return "$" + fmt(Math.round(Math.abs(n)));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TaxPage() {
  const invoices  = (useQuery(api.invoices.list)   ?? []) as any[];
  const employees = (useQuery(api.employees.list) ?? []) as any[];
  const [year, setYear] = useState(new Date().getFullYear());

  // ── Revenue for selected year ──
  const yearInvoices = useMemo(
    () => invoices.filter(inv => inv.generatedAt?.startsWith(String(year))),
    [invoices, year],
  );

  const totalRevenue = yearInvoices.reduce((s, inv) => s + inv.totalAmount, 0);

  const quarterlyRevenue = useMemo(() => {
    const q = [0, 0, 0, 0];
    yearInvoices.forEach(inv => {
      const month = new Date(inv.generatedAt).getMonth();
      q[Math.floor(month / 3)] += inv.totalAmount;
    });
    return q;
  }, [yearInvoices]);

  // ── Annual expense estimates ──
  const annualWages = useMemo(
    () => employees.reduce((s, e) => {
      const hr = e.hourlyRate ?? (Number(e.salary) / 2080);
      return s + hr * (e.hoursPerDay ?? 8) * ANNUAL_WORK_DAYS;
    }, 0),
    [employees],
  );

  const annualBurden   = annualWages * BURDEN_RATE;
  const annualFuel     = employees.length * DAILY_FUEL  * ANNUAL_WORK_DAYS;
  const annualTools    = employees.length * DAILY_TOOLS * ANNUAL_WORK_DAYS;
  const annualOverhead = employees.length * OVERHEAD_PER_EMP;

  const expenses = useMemo(() => [
    {
      name:        "Wages (Hourly)",
      value:       annualWages,
      description: `${employees.length} employee${employees.length !== 1 ? "s" : ""} × hourly rate × ${ANNUAL_WORK_DAYS} days`,
      color:       "text-amber-600",
      bg:          "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      name:        `Payroll Burden (${Math.round(BURDEN_RATE * 100)}%)`,
      value:       annualBurden,
      description: "FICA, workers comp, health benefits, unemployment insurance",
      color:       "text-red-600",
      bg:          "bg-red-50 dark:bg-red-900/20",
    },
    {
      name:        "Fuel & Vehicle",
      value:       annualFuel,
      description: `$${DAILY_FUEL}/day × ${ANNUAL_WORK_DAYS} days × ${employees.length} employee${employees.length !== 1 ? "s" : ""}`,
      color:       "text-purple-600",
      bg:          "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      name:        "Tools & Equipment",
      value:       annualTools,
      description: `$${DAILY_TOOLS}/day × ${ANNUAL_WORK_DAYS} days × ${employees.length} employee${employees.length !== 1 ? "s" : ""}`,
      color:       "text-cyan-600",
      bg:          "bg-cyan-50 dark:bg-cyan-900/20",
    },
    {
      name:        "Overhead & Office",
      value:       annualOverhead,
      description: `$${(OVERHEAD_PER_EMP / 1000).toFixed(0)}k/year × ${employees.length} employee${employees.length !== 1 ? "s" : ""} (admin, software, office)`,
      color:       "text-orange-600",
      bg:          "bg-orange-50 dark:bg-orange-900/20",
    },
  ], [annualWages, annualBurden, annualFuel, annualTools, annualOverhead, employees.length]);

  const totalExpenses       = expenses.reduce((s, e) => s + e.value, 0);
  const netIncome           = totalRevenue - totalExpenses;
  const estimatedAnnualTax  = Math.max(0, netIncome * EFF_TAX_RATE);
  const quarterlyTaxPayment = estimatedAnnualTax / 4;

  // ── CSV download ──
  function downloadCsv() {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: (string | number)[][] = [
      [`TechForce Pro — Tax Report ${year}`],
      ["Multicorp Fire Protection Services"],
      ["9693 Gerwig Lane, Columbia MD 21046"],
      [],
      ["REVENUE"],
      ["Quarter", "Revenue", "% of Annual"],
      ...QUARTERS.map((q, i) => [
        q.label,
        quarterlyRevenue[i].toFixed(2),
        totalRevenue > 0 ? ((quarterlyRevenue[i] / totalRevenue) * 100).toFixed(1) + "%" : "0%",
      ]),
      ["Total Revenue", totalRevenue.toFixed(2), "100%"],
      [],
      ["DEDUCTIBLE EXPENSES"],
      ["Category", "Annual Amount", "Description"],
      ...expenses.map(e => [e.name, e.value.toFixed(2), e.description]),
      ["Total Expenses", totalExpenses.toFixed(2), ""],
      [],
      ["NET INCOME"],
      ["Net Taxable Income", netIncome.toFixed(2), netIncome >= 0 ? "Profit" : "Loss"],
      [],
      [`ESTIMATED TAXES (${Math.round(EFF_TAX_RATE * 100)}% effective rate)`],
      ["Annual Tax Estimate", estimatedAnnualTax.toFixed(2), ""],
      ["Q1 Payment", quarterlyTaxPayment.toFixed(2), "Due Apr 15"],
      ["Q2 Payment", quarterlyTaxPayment.toFixed(2), "Due Jun 15"],
      ["Q3 Payment", quarterlyTaxPayment.toFixed(2), "Due Sep 15"],
      ["Q4 Payment", quarterlyTaxPayment.toFixed(2), "Due Jan 15"],
      [],
      ["INVOICE DETAIL"],
      ["Invoice #", "Customer", "Date", "Status", "Amount"],
      ...yearInvoices.map(inv => [
        inv.invoiceNumber,
        inv.customerName,
        new Date(inv.generatedAt).toLocaleDateString("en-US"),
        inv.status,
        inv.totalAmount.toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url, download: `tax-report-${year}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Year options ──
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="size-6 text-primary shrink-0" />
            Tax Tracker
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Annual income, deductible expenses, and estimated quarterly tax payments for Multicorp Fire Protection Services
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-32">
              <Calendar className="size-3.5 text-muted-foreground mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={downloadCsv} disabled={false}>
            <Download className="size-4" /> Download CSV
          </Button>
        </div>
      </div>

      {/* Company banner */}
      <div className="rounded-xl border bg-muted/30 p-4 flex items-center gap-3">
        <Building2 className="size-5 shrink-0 text-muted-foreground" />
        <div>
          <div className="font-semibold text-sm">Multicorp Fire Protection Services</div>
          <div className="text-muted-foreground text-xs">
            9693 Gerwig Lane, Columbia MD 21046 · (410) 876-5000 · Tax Year {year}
          </div>
        </div>
      </div>

      { (
        <>
          {/* KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Gross Revenue",   value: totalRevenue,        icon: DollarSign,   color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30",  sub: `${yearInvoices.length} invoices in ${year}` },
              { label: "Total Expenses",  value: totalExpenses,       icon: TrendingDown, color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-900/30",     sub: "wages, burden, fuel, tools, overhead" },
              { label: "Net Income",      value: netIncome,           icon: TrendingUp,   color: netIncome >= 0 ? "text-emerald-600" : "text-destructive", bg: netIncome >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-destructive/10", sub: "revenue minus expenses" },
              { label: "Est. Annual Tax", value: estimatedAnnualTax,  icon: Receipt,      color: "text-red-600",     bg: "bg-red-100 dark:bg-red-900/30",         sub: `${Math.round(EFF_TAX_RATE * 100)}% effective rate on net income` },
            ].map(kpi => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                    <div className={`size-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                      <kpi.icon className={`size-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <div className={`text-xl font-extrabold ${kpi.color}`}>
                    {kpi.value < 0 ? "−" : ""}{fmtCurrency(kpi.value)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{kpi.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Revenue + Expenses side by side */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Revenue by Quarter */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="size-4 text-emerald-500" />
                  Revenue by Quarter
                </CardTitle>
                <CardDescription>Tax year {year} — from invoices only</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {yearInvoices.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-6">No invoices found for {year}</div>
                ) : (
                  <>
                    {QUARTERS.map((q, i) => {
                      const rev = quarterlyRevenue[i];
                      const pct = totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{q.label}</span>
                            <span className="font-bold text-emerald-600">{fmtCurrency(rev)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[10px] text-muted-foreground flex justify-between">
                            <span>{pct.toFixed(1)}% of annual revenue</span>
                            <span>Est. quarterly tax due: {fmtCurrency(Math.max(0, (rev - totalExpenses / 4)) * EFF_TAX_RATE)}</span>
                          </div>
                        </div>
                      );
                    })}
                    <Separator />
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span>Total Revenue</span>
                      <span className="text-emerald-600">{fmtCurrency(totalRevenue)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="size-4 text-amber-500" />
                  Deductible Expenses
                </CardTitle>
                <CardDescription>Estimated annual — Schedule C deductions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {employees.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-6">No employees found</div>
                ) : (
                  <>
                    {expenses.map(exp => (
                      <div key={exp.name} className={`rounded-lg border p-3 ${exp.bg}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-xs font-semibold ${exp.color}`}>{exp.name}</span>
                          <span className={`text-sm font-bold ${exp.color}`}>{fmtCurrency(exp.value)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{exp.description}</div>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex items-center justify-between font-bold text-sm px-1">
                      <span>Total Deductible Expenses</span>
                      <span className="text-amber-600">{fmtCurrency(totalExpenses)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tax Calculation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="size-4 text-red-500" />
                Estimated Tax Liability — {year}
              </CardTitle>
              <CardDescription>
                {Math.round(EFF_TAX_RATE * 100)}% effective rate on net taxable income — estimated quarterly payment schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Net income calculation */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Gross Revenue</div>
                  <div className="text-xl font-bold text-emerald-600">{fmtCurrency(totalRevenue)}</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Deductible Expenses</div>
                  <div className="text-xl font-bold text-amber-600">− {fmtCurrency(totalExpenses)}</div>
                </div>
                <div className={`rounded-lg p-3 border ${netIncome >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Net Taxable Income</div>
                  <div className={`text-xl font-bold ${netIncome >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {netIncome < 0 ? "−" : ""}{fmtCurrency(netIncome)}
                  </div>
                </div>
              </div>

              {/* Quarterly payments */}
              {netIncome > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {QUARTERS.map(({ label: qlabel, due }, i) => (
                    <div key={i} className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-red-700 dark:text-red-400">Q{i + 1} Payment</span>
                        <Badge variant="outline" className="text-[9px] text-red-600 border-red-300">Due {due}</Badge>
                      </div>
                      <div className="text-xl font-extrabold text-red-600">{fmtCurrency(quarterlyTaxPayment)}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{qlabel.replace(" (", "\n(")}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
                  <AlertCircle className="size-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-emerald-700">No Estimated Tax Due</div>
                    <div className="text-xs text-muted-foreground">
                      Deductible expenses exceed gross revenue for {year}. No quarterly estimated payments required.
                    </div>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>Disclaimer:</strong> These figures are estimates for planning purposes only. Actual tax liability depends on your entity type,
                  depreciation schedules, owner draws, deductible asset purchases, and current tax law. Always consult a qualified CPA or tax professional
                  before filing. Quarterly due dates apply to federal estimated payments; state obligations may differ.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Detail Table */}
          {yearInvoices.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Invoice Detail — {year}
                </CardTitle>
                <CardDescription>{yearInvoices.length} invoices · {fmtCurrency(totalRevenue)} gross revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Invoice #</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Quarter</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearInvoices
                        .slice()
                        .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt))
                        .map(inv => {
                          const month = new Date(inv.generatedAt).getMonth();
                          const quarter = `Q${Math.floor(month / 3) + 1}`;
                          return (
                            <tr key={inv.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                              <td className="py-2.5 px-3 font-mono text-muted-foreground">{inv.invoiceNumber}</td>
                              <td className="py-2.5 px-3 font-medium">{inv.customerName}</td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className="text-[10px]">{quarter}</Badge>
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">
                                {new Date(inv.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : inv.status === "sent" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : ""}`}
                                >
                                  {inv.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">{fmtCurrency(inv.totalAmount)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot className="border-t bg-muted/20">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 font-bold text-xs">Total</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 text-xs">{fmtCurrency(totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
