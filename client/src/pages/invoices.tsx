import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Download, FileText, Receipt, XCircle } from "lucide-react";
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

interface InvoiceListRow {
  id: number;
  draftNumber: string;
  invoiceNumber: string | null;
  clientOrganizationId: number;
  clientName: string;
  invoiceDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  subtotal: string;
  total: string;
  status: string;
  notes: string | null;
  issuedAt: string | null;
  issuedByUserId: number | null;
  sentAt: string | null;
  sentByUserId: number | null;
  sentMethod: string | null;
  sentRecipientEmail: string | null;
  sentNotes: string | null;
  paidAt: string | null;
  paidByUserId: number | null;
  paymentMethod: string | null;
  paymentReferenceNumber: string | null;
  paymentNotes: string | null;
  createdAt: string;
  updatedAt: string;
  lineItemCount: number;
}

interface InvoiceLineItemRow {
  id: number;
  invoiceId: number;
  billableUsageId: number;
  description: string;
  serviceDate: string;
  projectId: number;
  projectName: string;
  expertId: number;
  expertName: string;
  cuUsed: string;
  cuRate: string;
  amount: string;
  createdAt: string;
}

interface InvoiceDetail {
  invoice: InvoiceListRow;
  lineItems: InvoiceLineItemRow[];
}

interface BillableUsageRow {
  id: number;
  clientOrganizationId: number | null;
  resolvedClientOrganizationId?: number | string | null;
  billableUsageClientOrganizationId?: number | string | null;
  projectClientOrganizationId?: number | string | null;
  clientLinkSource?: string | null;
  activeInvoiceId?: number | string | null;
  activeInvoiceStatus?: string | null;
  clientOrganizationID?: number | string | null;
  client_organization_id?: number | string | null;
  clientId?: number | string | null;
  client_id?: number | string | null;
  clientName: string;
  projectName: string;
  expertName: string;
  callDate: string;
  cuUsed: string;
  currency: string;
  invoiceCurrency?: string | null;
  invoice_currency?: string | null;
  cuRate: string | null;
  cu_rate?: string | number | null;
  usdCuRate?: string | number | null;
  usd_cu_rate?: string | number | null;
  usdCuRateUsd?: string | number | null;
  cuRateUsd?: string | number | null;
  cu_rate_usd?: string | number | null;
  amount: string | null;
  amountUsd?: string | number | null;
  amount_usd?: string | number | null;
  billableAmount?: string | number | null;
  billable_amount?: string | number | null;
  billableAmountUsd?: string | number | null;
  billable_amount_usd?: string | number | null;
  usdAmount?: string | number | null;
  usd_amount?: string | number | null;
  status: string;
}

interface BillableUsageResponse {
  rows: BillableUsageRow[];
}

const ELIGIBLE_BILLABLE_USAGE_URL = "/api/billable-usage?status=unbilled";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

const normalizeDateOnly = (value: string | null | undefined) => {
  if (!value) return "";
  const rawValue = String(value).trim();
  const dateOnlyMatch = rawValue.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }
  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
};

const formatDate = (value: string | null | undefined) => {
  const normalizedDate = normalizeDateOnly(value);
  if (!normalizedDate) return "-";
  const [year, month, day] = normalizedDate.split("-").map(Number);
  return format(new Date(year, month - 1, day), "MMM dd, yyyy");
};

const formatDateInput = (value: string | null | undefined) => {
  const normalizedDate = normalizeDateOnly(value);
  return normalizedDate;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy h:mm a");
};

const formatInvoicePeriod = (start: string | null | undefined, end: string | null | undefined) => {
  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);
  if (formattedStart === "-" && formattedEnd === "-") return "-";
  if (formattedStart === "-") return formattedEnd;
  if (formattedEnd === "-") return formattedStart;
  if (formattedStart === formattedEnd) return formattedStart;
  return `${formattedStart} - ${formattedEnd}`;
};

const formatMoney = (value: string | number | null | undefined) => {
  const amount = Number(value || 0);
  return `USD ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatCu = (value: string | number | null | undefined) => parseAmount(value).toFixed(2);

const formatInvoiceStatus = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "draft") return "Draft";
  if (normalized === "canceled") return "Canceled";
  if (normalized === "issued") return "Issued";
  if (normalized === "sent") return "Sent";
  if (normalized === "paid") return "Paid";
  if (normalized === "void") return "Void";
  return status || "-";
};

const invoiceStatusBadgeVariant = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "canceled" || normalized === "void" ? "outline" : "secondary";
};

const invoiceStatusBadgeClassName = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "draft") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "issued") return "border-sky-200 bg-sky-50 text-sky-700";
  if (normalized === "sent") return "border-violet-200 bg-violet-50 text-violet-700";
  if (normalized === "paid") return "border-green-200 bg-green-50 text-green-700";
  if (normalized === "canceled") return "border-slate-300 bg-slate-50 text-slate-600";
  return "";
};

const isDraftInvoice = (status: string | null | undefined) => String(status || "").trim().toLowerCase() === "draft";
const isIssuedInvoice = (status: string | null | undefined) => String(status || "").trim().toLowerCase() === "issued";
const isSentInvoice = (status: string | null | undefined) => String(status || "").trim().toLowerCase() === "sent";
const isPaidInvoice = (status: string | null | undefined) => String(status || "").trim().toLowerCase() === "paid";

const getDisplayInvoiceNumber = (invoice: InvoiceListRow) => invoice.invoiceNumber || invoice.draftNumber;
const getInvoicePdfFileName = (invoice: InvoiceListRow) => `${getDisplayInvoiceNumber(invoice).replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
const formatSentMethod = (method: string | null | undefined) => {
  const normalized = String(method || "manual_email").trim().toLowerCase();
  if (normalized === "manual_email") return "Manual Email";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatPaymentMethod = (method: string | null | undefined) => {
  const normalized = String(method || "").trim().toLowerCase();
  if (!normalized) return "-";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const readJsonResponse = async <T,>(response: Response, requestUrl: string): Promise<T> => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Expected JSON from ${requestUrl}, received ${contentType || "unknown content type"}.`);
  }
  return response.json() as Promise<T>;
};

const readFirstValue = (row: BillableUsageRow | InvoiceLineItemRow, fieldNames: string[]) => {
  const record = row as unknown as Record<string, unknown>;
  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
};

const parseAmount = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;
  const amount = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").replace(/USD/i, "").trim());
  return Number.isFinite(amount) ? amount : 0;
};

const normalizedStatus = (row: BillableUsageRow) => String(row.status || "").trim().toLowerCase();
const normalizedCurrency = (row: BillableUsageRow) =>
  String(readFirstValue(row, ["invoiceCurrency", "invoice_currency", "currency"]) || "USD").trim().toUpperCase();
const getClientOrganizationId = (row: BillableUsageRow) =>
  parseAmount(readFirstValue(row, [
    "clientOrganizationId",
    "resolvedClientOrganizationId",
    "billableUsageClientOrganizationId",
    "projectClientOrganizationId",
    "clientOrganizationID",
    "client_organization_id",
    "clientId",
    "client_id",
  ]));
const getUsdCuRate = (row: BillableUsageRow) =>
  parseAmount(readFirstValue(row, ["cuRate", "cu_rate", "usdCuRate", "usd_cu_rate", "usdCuRateUsd", "cuRateUsd", "cu_rate_usd"]));
const getAmountUsd = (row: BillableUsageRow) =>
  parseAmount(readFirstValue(row, ["amount", "amountUsd", "amount_usd", "billableAmount", "billable_amount", "billableAmountUsd", "billable_amount_usd", "usdAmount", "usd_amount"]));
const hasClientOrganization = (row: BillableUsageRow) => getClientOrganizationId(row) > 0;
const hasValidRate = (row: BillableUsageRow) => getUsdCuRate(row) > 0 && getAmountUsd(row) > 0;
const hasActiveInvoiceLink = (row: BillableUsageRow) => parseAmount(row.activeInvoiceId) > 0;
const isUnbilled = (row: BillableUsageRow) => normalizedStatus(row) === "unbilled";
const isUsd = (row: BillableUsageRow) => normalizedCurrency(row) === "USD";
const isEligibleForInvoiceDraft = (row: BillableUsageRow) =>
  isUnbilled(row) && hasClientOrganization(row) && isUsd(row) && hasValidRate(row) && !hasActiveInvoiceLink(row);

const getExclusionReason = (row: BillableUsageRow) => {
  if (!isUnbilled(row)) return "Status is not unbilled";
  if (!hasValidRate(row)) {
    if (getUsdCuRate(row) <= 0) return "USD CU rate is missing or invalid";
    return "Amount is missing or invalid";
  }
  if (!isUsd(row)) return "Invoice currency is not USD";
  if (!hasClientOrganization(row)) return "Client organization link is missing";
  if (hasActiveInvoiceLink(row)) return "Already linked to an active invoice";
  return "Other eligibility issue";
};

export default function Invoices() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedBillableUsageIds, setSelectedBillableUsageIds] = useState<number[]>([]);
  const [billingPeriodStart, setBillingPeriodStart] = useState("");
  const [billingPeriodEnd, setBillingPeriodEnd] = useState("");
  const [markSentInvoice, setMarkSentInvoice] = useState<InvoiceListRow | null>(null);
  const [sentMethod, setSentMethod] = useState("manual_email");
  const [sentRecipientEmail, setSentRecipientEmail] = useState("");
  const [sentNotes, setSentNotes] = useState("");
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceListRow | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReferenceNumber, setPaymentReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: invoices, isLoading: invoicesLoading } = useQuery<InvoiceListRow[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: billableUsageData, isLoading: billableUsageLoading } = useQuery<BillableUsageResponse>({
    queryKey: [ELIGIBLE_BILLABLE_USAGE_URL],
    queryFn: async () => {
      const response = await apiRequest("GET", ELIGIBLE_BILLABLE_USAGE_URL);
      return response.json();
    },
  });

  const {
    data: selectedInvoice,
    isLoading: invoiceDetailLoading,
    isError: invoiceDetailError,
    error: invoiceDetailErrorDetail,
  } = useQuery<InvoiceDetail>({
    queryKey: ["/api/invoices", selectedInvoiceId],
    queryFn: async () => {
      if (!Number.isInteger(selectedInvoiceId)) {
        throw new Error("Invoice detail requires a valid invoice id.");
      }
      const requestUrl = `/api/invoices/${selectedInvoiceId}`;
      const response = await apiRequest("GET", requestUrl);
      return readJsonResponse<InvoiceDetail>(response, requestUrl);
    },
    enabled: Number.isInteger(selectedInvoiceId),
  });

  const unbilledRows = billableUsageData?.rows || [];
  const eligibleRows = unbilledRows.filter(isEligibleForInvoiceDraft);
  const missingRateRows = unbilledRows.filter((row) => isUnbilled(row) && !hasValidRate(row));
  const missingClientRows = unbilledRows.filter((row) => isUnbilled(row) && hasValidRate(row) && isUsd(row) && !hasClientOrganization(row));
  const nonUsdRows = unbilledRows.filter((row) => isUnbilled(row) && hasValidRate(row) && hasClientOrganization(row) && !isUsd(row));
  const otherIneligibleRows = unbilledRows.filter(
    (row) =>
      !isEligibleForInvoiceDraft(row) &&
      !missingRateRows.includes(row) &&
      !missingClientRows.includes(row) &&
      !nonUsdRows.includes(row)
  );

  const selectedRows = useMemo(
    () => eligibleRows.filter((row) => selectedBillableUsageIds.includes(row.id)),
    [eligibleRows, selectedBillableUsageIds]
  );
  const selectedBillableUsageSignature = useMemo(
    () => [...selectedBillableUsageIds].sort((a, b) => a - b).join(","),
    [selectedBillableUsageIds]
  );
  const selectedClientIds = Array.from(new Set(selectedRows.map(getClientOrganizationId)));
  const hasMixedClients = selectedClientIds.length > 1;
  const selectedTotal = selectedRows.reduce((sum, row) => sum + getAmountUsd(row), 0);
  const selectedCu = selectedRows.reduce((sum, row) => sum + parseAmount(row.cuUsed), 0);
  const billingPeriodInvalid =
    Boolean(billingPeriodStart && billingPeriodEnd) &&
    billingPeriodStart > billingPeriodEnd;

  useEffect(() => {
    if (selectedRows.length === 0) {
      setBillingPeriodStart("");
      setBillingPeriodEnd("");
      return;
    }

    const selectedDates = selectedRows
      .map((row) => formatDateInput(row.callDate))
      .filter(Boolean)
      .sort();

    setBillingPeriodStart(selectedDates[0] || "");
    setBillingPeriodEnd(selectedDates[selectedDates.length - 1] || "");
  }, [selectedBillableUsageSignature]);

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/invoices/draft", {
        billableUsageIds: selectedBillableUsageIds,
        periodStart: billingPeriodStart || undefined,
        periodEnd: billingPeriodEnd || undefined,
      });
      return readJsonResponse<InvoiceDetail>(response, "/api/invoices/draft");
    },
    onSuccess: (result) => {
      const createdInvoiceId = Number(result.invoice?.id);
      if (!Number.isInteger(createdInvoiceId) || createdInvoiceId <= 0) {
        toast({
          title: "Invoice draft created",
          description: "The draft was created, but the response did not include a valid invoice id.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [ELIGIBLE_BILLABLE_USAGE_URL] });
      queryClient.setQueryData(["/api/invoices", createdInvoiceId], result);
      setSelectedBillableUsageIds([]);
      setBillingPeriodStart("");
      setBillingPeriodEnd("");
      setCreateDialogOpen(false);
      setSelectedInvoiceId(createdInvoiceId);
      toast({
        title: "Invoice draft created",
        description: `${result.invoice.draftNumber} is ready for finance review.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create invoice draft",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelDraftMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const requestUrl = `/api/invoices/${invoiceId}/cancel`;
      const response = await apiRequest("POST", requestUrl);
      return readJsonResponse<InvoiceDetail>(response, requestUrl);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [ELIGIBLE_BILLABLE_USAGE_URL] });
      queryClient.setQueryData(["/api/invoices", result.invoice.id], result);
      toast({
        title: "Invoice draft canceled",
        description: `${result.invoice.draftNumber} was canceled and linked billable usage was returned to unbilled.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to cancel invoice draft",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const issueInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const requestUrl = `/api/invoices/${invoiceId}/issue`;
      const response = await apiRequest("POST", requestUrl);
      return readJsonResponse<InvoiceDetail>(response, requestUrl);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [ELIGIBLE_BILLABLE_USAGE_URL] });
      queryClient.setQueryData(["/api/invoices", result.invoice.id], result);
      toast({
        title: "Invoice issued",
        description: `${getDisplayInvoiceNumber(result.invoice)} is now issued and locked for billing review.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to issue invoice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async (invoice: InvoiceListRow) => {
      const requestUrl = `/api/invoices/${invoice.id}/pdf`;
      const response = await apiRequest("GET", requestUrl);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/pdf")) {
        const errorText = await response.text();
        throw new Error(errorText || `Expected PDF from ${requestUrl}, received ${contentType || "unknown content type"}.`);
      }
      return {
        blob: await response.blob(),
        fileName: getInvoicePdfFileName(invoice),
      };
    },
    onSuccess: ({ blob, fileName }) => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast({
        title: "Invoice PDF downloaded",
        description: `${fileName} has been downloaded.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to download invoice PDF",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markSentMutation = useMutation({
    mutationFn: async () => {
      if (!markSentInvoice) throw new Error("Invoice is required.");
      const requestUrl = `/api/invoices/${markSentInvoice.id}/mark-sent`;
      const response = await apiRequest("POST", requestUrl, {
        sentMethod,
        sentRecipientEmail: sentRecipientEmail.trim() || undefined,
        sentNotes: sentNotes.trim() || undefined,
      });
      return readJsonResponse<InvoiceDetail>(response, requestUrl);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.setQueryData(["/api/invoices", result.invoice.id], result);
      setMarkSentInvoice(null);
      setSentMethod("manual_email");
      setSentRecipientEmail("");
      setSentNotes("");
      toast({
        title: "Invoice marked as sent",
        description: `${getDisplayInvoiceNumber(result.invoice)} was recorded as manually sent.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark invoice as sent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!markPaidInvoice) throw new Error("Invoice is required.");
      const requestUrl = `/api/invoices/${markPaidInvoice.id}/mark-paid`;
      const response = await apiRequest("POST", requestUrl, {
        paymentMethod: paymentMethod.trim() || undefined,
        paymentReferenceNumber: paymentReferenceNumber.trim() || undefined,
        paymentNotes: paymentNotes.trim() || undefined,
      });
      return readJsonResponse<InvoiceDetail>(response, requestUrl);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.setQueryData(["/api/invoices", result.invoice.id], result);
      setMarkPaidInvoice(null);
      setPaymentMethod("");
      setPaymentReferenceNumber("");
      setPaymentNotes("");
      toast({
        title: "Invoice marked as paid",
        description: `${getDisplayInvoiceNumber(result.invoice)} was recorded as fully paid.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark invoice as paid",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleIssueInvoice = (invoice: InvoiceListRow) => {
    const confirmed = window.confirm(
      "Issue this invoice? This will finalize the draft invoice and lock its billable usage as invoiced. PDF download will become available after issuing. Manual sent and paid tracking remain separate finance steps."
    );
    if (!confirmed) return;
    issueInvoiceMutation.mutate(invoice.id);
  };

  const handleCancelDraft = (invoice: InvoiceListRow) => {
    const confirmed = window.confirm(
      "Cancel this draft invoice? The invoice and line items will remain for audit history, and linked billable usage will return to Unbilled."
    );
    if (!confirmed) return;
    cancelDraftMutation.mutate(invoice.id);
  };

  const handleDownloadPdf = (invoice: InvoiceListRow) => {
    downloadPdfMutation.mutate(invoice);
  };

  const handleOpenMarkSent = (invoice: InvoiceListRow) => {
    setMarkSentInvoice(invoice);
    setSentMethod(invoice.sentMethod || "manual_email");
    setSentRecipientEmail(invoice.sentRecipientEmail || "");
    setSentNotes(invoice.sentNotes || "");
  };

  const handleOpenMarkPaid = (invoice: InvoiceListRow) => {
    setMarkPaidInvoice(invoice);
    setPaymentMethod(invoice.paymentMethod || "");
    setPaymentReferenceNumber(invoice.paymentReferenceNumber || "");
    setPaymentNotes(invoice.paymentNotes || "");
  };

  const toggleBillableUsage = (id: number) => {
    setSelectedBillableUsageIds((current) =>
      current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id]
    );
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Create, issue, review, and track manual sending and payment confirmation for client invoices generated from approved billable usage.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateDialogOpen(true)} data-testid="button-create-invoice-draft">
          <Receipt className="h-4 w-4" />
          Create Draft
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Invoice review finance layer</AlertTitle>
        <AlertDescription>
          Draft invoices can be reviewed, canceled, or issued. Issued, sent, and paid invoices can be downloaded as PDFs. Manual sent and paid tracking records offline actions without sending email, contacting banks, or mutating call records.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-medium">Invoice Records</CardTitle>
            <p className="text-sm text-muted-foreground">
              Draft, canceled, issued, sent, and paid invoice records remain visible for finance review and audit history.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <DataTableSkeleton columns={10} rows={5} />
          ) : !invoices || invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices found."
              description="Create a draft from reviewed billable usage when finance is ready to prepare a client invoice."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px] text-xs font-semibold uppercase">Invoice Number</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Billing Period</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Total (USD)</TableHead>
                    <TableHead className="text-center text-xs font-semibold uppercase">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Created At</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Issued At</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Sent At</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Paid At</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                      <TableCell>
                        <div className="font-mono text-sm font-medium">{getDisplayInvoiceNumber(invoice)}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.invoiceNumber
                            ? `Draft ${invoice.draftNumber}`
                            : `${invoice.lineItemCount} line item${invoice.lineItemCount === 1 ? "" : "s"}`}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{invoice.clientName}</TableCell>
                      <TableCell>{formatInvoicePeriod(invoice.periodStart, invoice.periodEnd)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatMoney(invoice.total)}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={invoiceStatusBadgeVariant(invoice.status)}
                          className={invoiceStatusBadgeClassName(invoice.status)}
                        >
                          {formatInvoiceStatus(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(invoice.createdAt)}</TableCell>
                      <TableCell>{formatDateTime(invoice.issuedAt)}</TableCell>
                      <TableCell>{formatDateTime(invoice.sentAt)}</TableCell>
                      <TableCell>{formatDateTime(invoice.paidAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                          data-testid={`button-view-invoice-${invoice.id}`}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Create Invoice Draft</DialogTitle>
            <DialogDescription>
              Select eligible unbilled billable usage rows and confirm the billing period for this invoice.
            </DialogDescription>
          </DialogHeader>

          {missingRateRows.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Missing-rate items excluded</AlertTitle>
              <AlertDescription>
                {missingRateRows.length} unbilled item{missingRateRows.length === 1 ? "" : "s"} need USD CU rate review before invoice drafting.
              </AlertDescription>
              <ExcludedBillableUsageTable rows={missingRateRows} getReason={getExclusionReason} />
            </Alert>
          )}

          {missingClientRows.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Client organization link required</AlertTitle>
              <AlertDescription>
                {missingClientRows.length} unbilled item{missingClientRows.length === 1 ? "" : "s"} have valid USD rates, but need a linked client organization before invoice drafting.
              </AlertDescription>
              <ExcludedBillableUsageTable rows={missingClientRows} getReason={getExclusionReason} />
            </Alert>
          )}

          {nonUsdRows.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Non-USD items excluded</AlertTitle>
              <AlertDescription>
                {nonUsdRows.length} unbilled item{nonUsdRows.length === 1 ? "" : "s"} are not marked as USD invoice currency.
              </AlertDescription>
              <ExcludedBillableUsageTable rows={nonUsdRows} getReason={getExclusionReason} />
            </Alert>
          )}

          {otherIneligibleRows.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Other ineligible items</AlertTitle>
              <AlertDescription>
                {otherIneligibleRows.length} item{otherIneligibleRows.length === 1 ? "" : "s"} could not be included in this draft.
              </AlertDescription>
              <ExcludedBillableUsageTable rows={otherIneligibleRows} getReason={getExclusionReason} />
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">Selected Items</div>
                <div className="mt-1 text-2xl font-semibold">{selectedRows.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">Selected CU</div>
                <div className="mt-1 text-2xl font-semibold">{selectedCu.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">Selected Total</div>
                <div className="mt-1 text-2xl font-semibold">{formatMoney(selectedTotal)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="billing-period-start">
                Billing Period Start
              </label>
              <input
                id="billing-period-start"
                type="date"
                value={billingPeriodStart}
                onChange={(event) => setBillingPeriodStart(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="input-invoice-billing-period-start"
              />
              <p className="text-xs text-muted-foreground">
                Defaults to the earliest selected service date.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="billing-period-end">
                Billing Period End
              </label>
              <input
                id="billing-period-end"
                type="date"
                value={billingPeriodEnd}
                onChange={(event) => setBillingPeriodEnd(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="input-invoice-billing-period-end"
              />
              <p className="text-xs text-muted-foreground">
                Defaults to the latest selected service date.
              </p>
            </div>
          </div>

          {billingPeriodInvalid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Billing Period is invalid</AlertTitle>
              <AlertDescription>Billing Period Start must be on or before Billing Period End.</AlertDescription>
            </Alert>
          )}

          {hasMixedClients && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Multiple clients selected</AlertTitle>
              <AlertDescription>Select billable usage for one client organization only.</AlertDescription>
            </Alert>
          )}

          {billableUsageLoading ? (
            <DataTableSkeleton columns={7} rows={5} />
          ) : eligibleRows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No eligible billable usage."
              description="Eligible rows must be unbilled, linked to a client, and have valid USD rate and amount."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Service Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">CU Used</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">USD CU Rate</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Amount (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleRows.map((row) => (
                    <TableRow key={row.id} data-testid={`row-eligible-billable-usage-${row.id}`}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedBillableUsageIds.includes(row.id)}
                          onChange={() => toggleBillableUsage(row.id)}
                          data-testid={`checkbox-billable-usage-${row.id}`}
                        />
                      </TableCell>
                      <TableCell>{formatDate(row.callDate)}</TableCell>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell>{row.projectName}</TableCell>
                      <TableCell>{row.expertName}</TableCell>
                      <TableCell className="text-right font-mono">{formatCu(row.cuUsed)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(getUsdCuRate(row))}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(getAmountUsd(row))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createDraftMutation.mutate()}
              disabled={createDraftMutation.isPending || selectedRows.length === 0 || hasMixedClients || billingPeriodInvalid}
              data-testid="button-submit-invoice-draft"
            >
              {createDraftMutation.isPending ? "Creating..." : "Create Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedInvoiceId !== null} onOpenChange={(open) => !open && setSelectedInvoiceId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <DialogTitle className="font-mono text-xl">
                  {selectedInvoice ? getDisplayInvoiceNumber(selectedInvoice.invoice) : "Invoice Detail"}
                </DialogTitle>
                {selectedInvoice && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={invoiceStatusBadgeVariant(selectedInvoice.invoice.status)}
                      className={invoiceStatusBadgeClassName(selectedInvoice.invoice.status)}
                    >
                      {formatInvoiceStatus(selectedInvoice.invoice.status)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Created {formatDateTime(selectedInvoice.invoice.createdAt)}
                    </span>
                  </div>
                )}
              </div>
              {selectedInvoice &&
                (isDraftInvoice(selectedInvoice.invoice.status) ||
                  isIssuedInvoice(selectedInvoice.invoice.status) ||
                  isSentInvoice(selectedInvoice.invoice.status) ||
                  isPaidInvoice(selectedInvoice.invoice.status)) && (
                <div className="flex flex-wrap gap-2">
                  {isDraftInvoice(selectedInvoice.invoice.status) && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleCancelDraft(selectedInvoice.invoice)}
                        disabled={cancelDraftMutation.isPending || issueInvoiceMutation.isPending}
                        data-testid="button-cancel-invoice-draft"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {cancelDraftMutation.isPending ? "Canceling..." : "Cancel Draft"}
                      </Button>
                      <Button
                        onClick={() => handleIssueInvoice(selectedInvoice.invoice)}
                        disabled={cancelDraftMutation.isPending || issueInvoiceMutation.isPending}
                        data-testid="button-issue-invoice"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {issueInvoiceMutation.isPending ? "Issuing..." : "Issue Invoice"}
                      </Button>
                    </>
                  )}
                  {isIssuedInvoice(selectedInvoice.invoice.status) && (
                    <Button
                      variant="outline"
                      onClick={() => handleOpenMarkSent(selectedInvoice.invoice)}
                      disabled={markSentMutation.isPending}
                      data-testid="button-mark-invoice-sent"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark as Sent
                    </Button>
                  )}
                  {isSentInvoice(selectedInvoice.invoice.status) && (
                    <Button
                      variant="outline"
                      onClick={() => handleOpenMarkPaid(selectedInvoice.invoice)}
                      disabled={markPaidMutation.isPending}
                      data-testid="button-mark-invoice-paid"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark as Paid
                    </Button>
                  )}
                  {(isIssuedInvoice(selectedInvoice.invoice.status) ||
                    isSentInvoice(selectedInvoice.invoice.status) ||
                    isPaidInvoice(selectedInvoice.invoice.status)) && (
                    <Button
                      onClick={() => handleDownloadPdf(selectedInvoice.invoice)}
                      disabled={downloadPdfMutation.isPending}
                      data-testid="button-download-invoice-pdf"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {downloadPdfMutation.isPending ? "Downloading..." : "Download PDF"}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <DialogDescription>
              Review invoice details and line items. Issued, sent, and paid invoices can be downloaded as branded PDFs. Sending and payment confirmation are recorded manually outside automated integrations.
            </DialogDescription>
          </DialogHeader>

          {invoiceDetailLoading && !selectedInvoice ? (
            <DataTableSkeleton columns={7} rows={4} />
          ) : invoiceDetailError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Invoice detail could not be loaded</AlertTitle>
              <AlertDescription>
                {invoiceDetailErrorDetail instanceof Error
                  ? invoiceDetailErrorDetail.message
                  : "Please close this detail view and reopen the invoice draft from the list."}
              </AlertDescription>
            </Alert>
          ) : !selectedInvoice ? (
            <EmptyState
              icon={FileText}
              title="Invoice detail is unavailable."
              description="Close this detail view and reopen the invoice from the list."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs uppercase text-muted-foreground">
                      {selectedInvoice.invoice.invoiceNumber ? "Invoice Number" : "Draft Number"}
                    </div>
                    <div className="mt-1 break-all font-mono text-sm font-semibold">
                      {getDisplayInvoiceNumber(selectedInvoice.invoice)}
                    </div>
                    {selectedInvoice.invoice.invoiceNumber && (
                      <div className="mt-1 text-xs text-muted-foreground">Draft {selectedInvoice.invoice.draftNumber}</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs uppercase text-muted-foreground">Client</div>
                    <div className="mt-1 font-medium">{selectedInvoice.invoice.clientName}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs uppercase text-muted-foreground">Status</div>
                    <div className="mt-1">
                      <Badge
                        variant={invoiceStatusBadgeVariant(selectedInvoice.invoice.status)}
                        className={invoiceStatusBadgeClassName(selectedInvoice.invoice.status)}
                      >
                        {formatInvoiceStatus(selectedInvoice.invoice.status)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs uppercase text-muted-foreground">Billing Period</div>
                    <div className="mt-1 font-medium">{formatInvoicePeriod(selectedInvoice.invoice.periodStart, selectedInvoice.invoice.periodEnd)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs uppercase text-muted-foreground">Total</div>
                    <div className="mt-1 font-medium">{formatMoney(selectedInvoice.invoice.total)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs uppercase text-muted-foreground">
                      {selectedInvoice.invoice.paidAt
                        ? "Paid At"
                        : selectedInvoice.invoice.sentAt
                        ? "Sent At"
                        : selectedInvoice.invoice.issuedAt
                        ? "Issued At"
                        : "Created At"}
                    </div>
                    <div className="mt-1 font-medium">
                      {selectedInvoice.invoice.paidAt
                        ? formatDateTime(selectedInvoice.invoice.paidAt)
                        : selectedInvoice.invoice.sentAt
                        ? formatDateTime(selectedInvoice.invoice.sentAt)
                        : selectedInvoice.invoice.issuedAt
                        ? formatDateTime(selectedInvoice.invoice.issuedAt)
                        : formatDateTime(selectedInvoice.invoice.createdAt)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedInvoice.invoice.sentAt && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Manual Sending Record</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Sent Method</div>
                      <div className="mt-1 font-medium">{formatSentMethod(selectedInvoice.invoice.sentMethod)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Recipient Email</div>
                      <div className="mt-1 font-medium">{selectedInvoice.invoice.sentRecipientEmail || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Sent Notes</div>
                      <div className="mt-1 font-medium">{selectedInvoice.invoice.sentNotes || "-"}</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedInvoice.invoice.paidAt && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Manual Payment Confirmation</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Payment Method</div>
                      <div className="mt-1 font-medium">{formatPaymentMethod(selectedInvoice.invoice.paymentMethod)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Reference Number</div>
                      <div className="mt-1 font-medium">{selectedInvoice.invoice.paymentReferenceNumber || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Payment Notes</div>
                      <div className="mt-1 font-medium">{selectedInvoice.invoice.paymentNotes || "-"}</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedInvoice.lineItems.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No invoice line items found."
                  description="This invoice exists, but no billable usage line items were returned."
                />
              ) : (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Line Items</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedInvoice.lineItems.length} billable usage item{selectedInvoice.lineItems.length === 1 ? "" : "s"} preserved with this invoice record.
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-semibold uppercase">Service Date</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">CU Used</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">USD CU Rate</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Amount (USD)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.lineItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{formatDate(item.serviceDate)}</TableCell>
                            <TableCell className="font-medium">{item.projectName}</TableCell>
                            <TableCell>{item.expertName}</TableCell>
                            <TableCell className="text-right font-mono">{formatCu(item.cuUsed)}</TableCell>
                            <TableCell className="text-right font-mono">{formatMoney(item.cuRate)}</TableCell>
                            <TableCell className="text-right font-mono font-medium">{formatMoney(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!markSentInvoice} onOpenChange={(open) => !open && setMarkSentInvoice(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark Invoice as Sent</DialogTitle>
            <DialogDescription>
              Record that this issued invoice was sent manually. This does not send an email from the CRM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Manual sending only</AlertTitle>
              <AlertDescription>
                Email sending is not automated yet. Mark as Sent records that this invoice was sent manually outside the CRM.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invoice-sent-method">
                Sent Method
              </label>
              <select
                id="invoice-sent-method"
                value={sentMethod}
                onChange={(event) => setSentMethod(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="select-invoice-sent-method"
              >
                <option value="manual_email">Manual Email</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invoice-sent-recipient">
                Recipient Email
              </label>
              <input
                id="invoice-sent-recipient"
                type="email"
                value={sentRecipientEmail}
                onChange={(event) => setSentRecipientEmail(event.target.value)}
                placeholder="client@example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="input-invoice-sent-recipient"
              />
              <p className="text-xs text-muted-foreground">Optional. Use this to record where the invoice was sent.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invoice-sent-notes">
                Sent Notes
              </label>
              <textarea
                id="invoice-sent-notes"
                value={sentNotes}
                onChange={(event) => setSentNotes(event.target.value)}
                placeholder="Optional note about the manual sending step."
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="textarea-invoice-sent-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkSentInvoice(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => markSentMutation.mutate()}
              disabled={markSentMutation.isPending}
              data-testid="button-submit-mark-invoice-sent"
            >
              {markSentMutation.isPending ? "Recording..." : "Mark as Sent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!markPaidInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setMarkPaidInvoice(null);
            setPaymentMethod("");
            setPaymentReferenceNumber("");
            setPaymentNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
            <DialogDescription>
              Record that full payment was confirmed manually. This does not contact a bank or support partial payments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Manual payment confirmation only</AlertTitle>
              <AlertDescription>
                Mark as Paid records that Mirae Connext confirmed this invoice was paid in full outside the CRM. It does not trigger bank integration, email, receipts, or partial payment tracking.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invoice-payment-method">
                Payment Method
              </label>
              <input
                id="invoice-payment-method"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                placeholder="Wire transfer"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="input-invoice-payment-method"
              />
              <p className="text-xs text-muted-foreground">Optional. Use this to record how payment was confirmed.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invoice-payment-reference">
                Reference Number
              </label>
              <input
                id="invoice-payment-reference"
                value={paymentReferenceNumber}
                onChange={(event) => setPaymentReferenceNumber(event.target.value)}
                placeholder="Bank reference or remittance id"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="input-invoice-payment-reference-number"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invoice-payment-notes">
                Notes
              </label>
              <textarea
                id="invoice-payment-notes"
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                placeholder="Optional note about the manual payment confirmation."
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="textarea-invoice-payment-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidInvoice(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => markPaidMutation.mutate()}
              disabled={markPaidMutation.isPending}
              data-testid="button-submit-mark-invoice-paid"
            >
              {markPaidMutation.isPending ? "Recording..." : "Mark as Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExcludedBillableUsageTable({
  rows,
  getReason,
}: {
  rows: BillableUsageRow[];
  getReason: (row: BillableUsageRow) => string;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Currency</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase">USD CU Rate</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase">Amount (USD)</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Exclusion Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.clientName || "-"}</TableCell>
              <TableCell>{row.projectName || "-"}</TableCell>
              <TableCell>{row.expertName || "-"}</TableCell>
              <TableCell>{row.status || "-"}</TableCell>
              <TableCell>{normalizedCurrency(row)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(getUsdCuRate(row))}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(getAmountUsd(row))}</TableCell>
              <TableCell>{getReason(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
