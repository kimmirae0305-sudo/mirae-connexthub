import type React from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, Download, FileText, Paperclip, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { resolveApiUrl } from "@/lib/apiUrl";

const CATEGORIES = [
  "Software",
  "Hosting",
  "Database",
  "Email",
  "Website",
  "Sales Tool",
  "Communication",
  "Legal",
  "Accounting",
  "Admin",
  "AI / Automation",
  "Other",
];

const BILLING_TYPES = ["One-time", "Monthly", "Annual", "Free Plan"];
const STATUSES = ["Active", "Paid", "Cancelled", "Archived"];
const ACCOUNTING_STATUSES = ["Not Applicable", "Pending", "Sent to Accountant", "Booked", "No Cost"];
const CURRENCIES = ["USD", "BRL", "KRW", "EUR", "GBP"];
const VENDOR_SUGGESTIONS = [
  "Render",
  "Neon",
  "Zoom",
  "Zoho",
  "Durable",
  "LinkedIn",
  "GoDaddy",
  "Namecheap",
  "Cloudflare",
  "Registro.br",
  "Accounting Firm",
  "Legal Firm",
];

interface ExpenseRow {
  id: number;
  expenseId: string;
  vendor: string;
  category: string;
  description: string | null;
  amount: string;
  currency: string;
  billingType: string;
  expenseDate: string;
  renewalDate: string | null;
  paymentMethod: string | null;
  status: string;
  ownerName: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  accountingStatus: string;
  notes: string | null;
  receiptFileName: string | null;
  receiptMimeType: string | null;
  receiptFileSize: number | null;
  receiptUploadedAt: string | null;
  hasReceipt: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExpenseReport {
  summary: {
    monthlyOperatingExpenses: number;
    activeSubscriptions: number;
    freePlanTools: number;
    annualizedSoftwareCost: number;
  };
  rows: ExpenseRow[];
}

interface ExpenseFormState {
  vendor: string;
  category: string;
  description: string;
  amount: string;
  currency: string;
  billingType: string;
  expenseDate: string;
  renewalDate: string;
  paymentMethod: string;
  status: string;
  accountingStatus: string;
  notes: string;
}

interface ExpenseFilters {
  search: string;
  category: string;
  status: string;
  currency: string;
  billingType: string;
  accountingStatus: string;
  fromDate: string;
  toDate: string;
}

const defaultFilters: ExpenseFilters = {
  search: "",
  category: "all",
  status: "all",
  currency: "all",
  billingType: "all",
  accountingStatus: "all",
  fromDate: "",
  toDate: "",
};

const defaultFormState: ExpenseFormState = {
  vendor: "",
  category: "Software",
  description: "",
  amount: "0.00",
  currency: "USD",
  billingType: "Monthly",
  expenseDate: format(new Date(), "yyyy-MM-dd"),
  renewalDate: "",
  paymentMethod: "",
  status: "Active",
  accountingStatus: "Pending",
  notes: "",
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy");
};

const formatDateInput = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
};

const formatMoney = (amount: string | number | null | undefined, currency = "USD") => {
  const value = Number(amount || 0);
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const buildExpensesUrl = (filters: ExpenseFilters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  return `/api/expenses${params.toString() ? `?${params.toString()}` : ""}`;
};

const getReceiptStatus = (expense: ExpenseRow) => {
  const amount = Number(expense.amount || 0);
  if (expense.hasReceipt) return "Attached";
  if (amount === 0 || expense.billingType === "Free Plan") return "N/A";
  return "Missing";
};

const receiptBadgeClassName = (status: string) => {
  if (status === "Attached") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Missing") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

const statusBadgeClassName = (status: string) => {
  if (status === "Active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Paid") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "Cancelled" || status === "Archived") return "border-slate-300 bg-slate-50 text-slate-600";
  return "";
};

const toExpensePayload = (form: ExpenseFormState) => ({
  vendor: form.vendor.trim(),
  category: form.category,
  description: form.description.trim() || undefined,
  amount: Number(form.amount || 0),
  currency: form.currency,
  billingType: form.billingType,
  expenseDate: form.expenseDate,
  renewalDate: form.renewalDate || undefined,
  paymentMethod: form.paymentMethod.trim() || undefined,
  status: form.status,
  accountingStatus: form.accountingStatus,
  notes: form.notes.trim() || undefined,
});

const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function Expenses() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ExpenseFilters>(defaultFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [viewingExpense, setViewingExpense] = useState<ExpenseRow | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(defaultFormState);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const expensesUrl = useMemo(() => buildExpensesUrl(filters), [filters]);

  const { data, isLoading } = useQuery<ExpenseReport>({
    queryKey: ["/api/expenses", filters],
    queryFn: async () => {
      const response = await apiRequest("GET", expensesUrl);
      return response.json();
    },
  });

  const expenses = data?.rows || [];
  const summary = data?.summary || {
    monthlyOperatingExpenses: 0,
    activeSubscriptions: 0,
    freePlanTools: 0,
    annualizedSoftwareCost: 0,
  };

  const uploadReceipt = async (expenseId: number, file: File) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Receipt must be a PDF, PNG, JPG, or JPEG file.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Receipt file must be 5MB or smaller.");
    }
    const response = await fetch(resolveApiUrl(`/api/expenses/${expenseId}/receipt`), {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": file.type,
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: await file.arrayBuffer(),
      credentials: "include",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to upload receipt" }));
      throw new Error(error.error || "Failed to upload receipt");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount || 0);
      if (!form.vendor.trim()) throw new Error("Vendor is required.");
      if (!form.category) throw new Error("Category is required.");
      if (!form.currency) throw new Error("Currency is required.");
      if (!form.expenseDate) throw new Error("Expense Date is required.");
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Amount must be 0 or greater.");
      if (amount === 0 && form.billingType !== "Free Plan" && form.accountingStatus !== "No Cost") {
        throw new Error("Amount can be 0 only for Free Plan or No Cost expenses.");
      }

      const requestUrl = editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses";
      const response = await apiRequest(editingExpense ? "PATCH" : "POST", requestUrl, toExpensePayload(form));
      const savedExpense = (await response.json()) as ExpenseRow;
      if (receiptFile) await uploadReceipt(savedExpense.id, receiptFile);
      return savedExpense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setFormOpen(false);
      setEditingExpense(null);
      setReceiptFile(null);
      setForm(defaultFormState);
      toast({ title: "Expense saved", description: "The expense record has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save expense", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      const response = await apiRequest("DELETE", `/api/expenses/${expenseId}`);
      return response.json() as Promise<ExpenseRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense archived", description: "The expense remains available for accountant export." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to archive expense", description: error.message, variant: "destructive" });
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      const response = await apiRequest("DELETE", `/api/expenses/${expenseId}/receipt`);
      return response.json() as Promise<ExpenseRow>;
    },
    onSuccess: (updatedExpense) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setViewingExpense(updatedExpense);
      toast({ title: "Receipt removed", description: "The attachment was removed from this expense." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete receipt", description: error.message, variant: "destructive" });
    },
  });

  const openCreateForm = () => {
    setEditingExpense(null);
    setReceiptFile(null);
    setForm(defaultFormState);
    setFormOpen(true);
  };

  const openEditForm = (expense: ExpenseRow) => {
    setEditingExpense(expense);
    setReceiptFile(null);
    setForm({
      vendor: expense.vendor,
      category: expense.category,
      description: expense.description || "",
      amount: expense.amount,
      currency: expense.currency,
      billingType: expense.billingType,
      expenseDate: formatDateInput(expense.expenseDate),
      renewalDate: formatDateInput(expense.renewalDate),
      paymentMethod: expense.paymentMethod || "",
      status: expense.status,
      accountingStatus: expense.accountingStatus,
      notes: expense.notes || "",
    });
    setFormOpen(true);
  };

  const downloadReceipt = async (expense: ExpenseRow) => {
    try {
      const response = await fetch(resolveApiUrl(`/api/expenses/${expense.id}/receipt`), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to download receipt" }));
        throw new Error(error.error || "Failed to download receipt");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = expense.receiptFileName || `${expense.expenseId}-receipt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast({
        title: "Failed to download receipt",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportCsv = async () => {
    try {
      const response = await fetch(resolveApiUrl(buildExpensesUrl(filters).replace("/api/expenses", "/api/expenses/export.csv")), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to export expenses" }));
        throw new Error(error.error || "Failed to export expenses");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "expenses_export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast({
        title: "Failed to export expenses",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateFilter = (key: keyof ExpenseFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Track software subscriptions and operating expenses with receipt attachments and accountant-ready export.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCsv} data-testid="button-export-expenses">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2" onClick={openCreateForm} data-testid="button-add-expense">
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Internal finance expense tracker</AlertTitle>
        <AlertDescription>
          Expenses are managed inside this CRM for accountant review. This does not sync banks, credit cards, payroll, reimbursements, Zoho Expense, or Zoho Books.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Monthly Operating Expenses</div>
            <div className="mt-1 text-2xl font-semibold">{formatMoney(summary.monthlyOperatingExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Active Subscriptions</div>
            <div className="mt-1 text-2xl font-semibold">{summary.activeSubscriptions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Free Plan Tools</div>
            <div className="mt-1 text-2xl font-semibold">{summary.freePlanTools}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Annualized Software Cost</div>
            <div className="mt-1 text-2xl font-semibold">{formatMoney(summary.annualizedSoftwareCost)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search vendor or description"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="input-expense-search"
          />
          <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All Categories</option>
            {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All Statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={filters.currency} onChange={(event) => updateFilter("currency", event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All Currencies</option>
            {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
          <select value={filters.billingType} onChange={(event) => updateFilter("billingType", event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All Billing Types</option>
            {BILLING_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={filters.accountingStatus} onChange={(event) => updateFilter("accountingStatus", event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All Accounting Statuses</option>
            {ACCOUNTING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input type="date" value={filters.fromDate} onChange={(event) => updateFilter("fromDate", event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="date" value={filters.toDate} onChange={(event) => updateFilter("toDate", event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Expense Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={11} rows={5} />
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No expenses found."
              description="Add software subscriptions and operating expenses when finance is ready to track them."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase">Expense ID</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Vendor</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Category</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Amount</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Currency</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Billing Type</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Expense Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Accounting Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Receipt</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const receiptStatus = getReceiptStatus(expense);
                    return (
                      <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                        <TableCell className="font-mono text-sm">{expense.expenseId}</TableCell>
                        <TableCell className="font-medium">{expense.vendor}</TableCell>
                        <TableCell>{expense.category}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(expense.amount, expense.currency)}</TableCell>
                        <TableCell>{expense.currency}</TableCell>
                        <TableCell>{expense.billingType}</TableCell>
                        <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClassName(expense.status)}>{expense.status}</Badge>
                        </TableCell>
                        <TableCell>{expense.accountingStatus}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={receiptBadgeClassName(receiptStatus)}>{receiptStatus}</Badge>
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button variant="outline" size="sm" onClick={() => setViewingExpense(expense)}>View</Button>
                          <Button variant="outline" size="sm" onClick={() => openEditForm(expense)}>Edit</Button>
                          <Button variant="outline" size="sm" onClick={() => archiveMutation.mutate(expense.id)}>Archive</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
            <DialogDescription>
              Record software subscriptions and operating expenses for accountant review.
            </DialogDescription>
          </DialogHeader>

          <datalist id="expense-vendor-suggestions">
            {VENDOR_SUGGESTIONS.map((vendor) => <option key={vendor} value={vendor} />)}
          </datalist>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vendor">
              <input list="expense-vendor-suggestions" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Amount">
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Currency">
              <select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </Field>
            <Field label="Billing Type">
              <select value={form.billingType} onChange={(event) => setForm({ ...form, billingType: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {BILLING_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Expense Date">
              <input type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Renewal Date">
              <input type="date" value={form.renewalDate} onChange={(event) => setForm({ ...form, renewalDate: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Payment Method">
              <input value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Accounting Status">
              <select value={form.accountingStatus} onChange={(event) => setForm({ ...form, accountingStatus: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {ACCOUNTING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Receipt / Invoice Upload">
              <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPG, or JPEG. Max 5MB.</p>
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingExpense} onOpenChange={(open) => !open && setViewingExpense(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingExpense?.expenseId || "Expense Detail"}</DialogTitle>
            <DialogDescription>Internal operating expense detail for finance review.</DialogDescription>
          </DialogHeader>
          {viewingExpense && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Vendor" value={viewingExpense.vendor} />
                <Detail label="Category" value={viewingExpense.category} />
                <Detail label="Amount" value={formatMoney(viewingExpense.amount, viewingExpense.currency)} />
                <Detail label="Billing Type" value={viewingExpense.billingType} />
                <Detail label="Expense Date" value={formatDate(viewingExpense.expenseDate)} />
                <Detail label="Renewal Date" value={formatDate(viewingExpense.renewalDate)} />
                <Detail label="Status" value={viewingExpense.status} />
                <Detail label="Accounting Status" value={viewingExpense.accountingStatus} />
                <Detail label="Owner" value={viewingExpense.ownerName || "-"} />
                <Detail label="Approved By" value={viewingExpense.approvedByName || "-"} />
              </div>
              <Detail label="Description" value={viewingExpense.description || "-"} />
              <Detail label="Notes" value={viewingExpense.notes || "-"} />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Receipt / Invoice Attachment</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={receiptBadgeClassName(getReceiptStatus(viewingExpense))}>
                    {getReceiptStatus(viewingExpense)}
                  </Badge>
                  {viewingExpense.hasReceipt && (
                    <>
                      <span className="text-sm text-muted-foreground">{viewingExpense.receiptFileName}</span>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadReceipt(viewingExpense)}>
                        <Paperclip className="h-4 w-4" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteReceiptMutation.mutate(viewingExpense.id)}>
                        Delete Receipt
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
