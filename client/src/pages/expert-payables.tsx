import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Eye, RefreshCw, Search, XCircle } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type PayableStatus = "all" | "pending_review" | "approved" | "paid" | "void";

interface ExpertPayableRow {
  id: number;
  consultationId: number;
  projectId: number;
  projectName: string;
  expertId: number;
  expertName: string;
  clientOrganizationId: number | null;
  clientName: string;
  serviceDate: string;
  durationMinutes: number;
  expertHourlyRateSnapshot: string;
  payoutCurrency: string;
  payableAmount: string;
  status: string;
  approvedAt: string | null;
  approvedByUserId: number | null;
  approvedByName?: string | null;
  paidAt: string | null;
  paidByUserId: number | null;
  paidByName?: string | null;
  paymentMethod: string | null;
  paymentReferenceNumber: string | null;
  paymentNotes: string | null;
  voidedAt: string | null;
  voidedByUserId: number | null;
  voidedByName?: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EligibleConsultationRow {
  consultationId: number;
  projectId: number;
  projectName: string;
  expertId: number;
  expertName: string;
  clientOrganizationId: number | null;
  clientName: string;
  serviceDate: string;
  durationMinutes: number;
  expertHourlyRate: string;
  rateSource: string;
  payoutCurrency: string;
  estimatedPayableAmount: string;
}

const statusOptions: Array<{ value: PayableStatus; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

const formatDateOnly = (value: string | null | undefined) => {
  if (!value) return "-";
  const rawValue = String(value);
  const dateOnly = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return format(new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])), "MMM dd, yyyy");
  }
  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy");
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "MMM dd, yyyy h:mm a");
};

const formatMoney = (value: string | number | null | undefined, currency = "USD") => {
  const amount = Number(value || 0);
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatRate = (value: string | number | null | undefined, currency = "USD") =>
  `${formatMoney(value, currency)}/hr`;

const formatStatus = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "pending_review") return "Pending Review";
  if (normalized === "approved") return "Approved";
  if (normalized === "paid") return "Paid";
  if (normalized === "void") return "Void";
  return status || "-";
};

const statusBadgeClassName = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "pending_review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "approved") return "border-sky-200 bg-sky-50 text-sky-700";
  if (normalized === "paid") return "border-green-200 bg-green-50 text-green-700";
  if (normalized === "void") return "border-slate-300 bg-slate-50 text-slate-600";
  return "";
};

const formatRateSource = (source: string | null | undefined) => {
  const normalized = String(source || "").trim();
  if (normalized === "project_expert_expected_rate") return "Project expert expected rate";
  if (normalized === "expert_profile_hourly_rate") return "Expert profile hourly rate";
  return normalized
    ? normalized
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "-";
};

const calculationText = (
  durationMinutes: number,
  hourlyRate: string | number,
  amount: string | number,
  currency = "USD",
) => `${durationMinutes} min / 60 x ${formatRate(hourlyRate, currency)} = ${formatMoney(amount, currency)}`;

export default function ExpertPayables() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<PayableStatus>("all");
  const [search, setSearch] = useState("");
  const [creatingFrom, setCreatingFrom] = useState<EligibleConsultationRow | null>(null);
  const [viewingPayable, setViewingPayable] = useState<ExpertPayableRow | null>(null);
  const [markingPaidPayable, setMarkingPaidPayable] = useState<ExpertPayableRow | null>(null);
  const [voidingPayable, setVoidingPayable] = useState<ExpertPayableRow | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReferenceNumber, setPaymentReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const payablesUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    const query = params.toString();
    return `/api/expert-payables${query ? `?${query}` : ""}`;
  }, [search, statusFilter]);

  const { data: payablesData, isLoading: isPayablesLoading } = useQuery<{ rows: ExpertPayableRow[] }>({
    queryKey: [payablesUrl],
  });

  const { data: eligibleData, isLoading: isEligibleLoading } = useQuery<{ rows: EligibleConsultationRow[] }>({
    queryKey: ["/api/expert-payables/eligible-consultations"],
  });

  const refreshLists = () => {
    queryClient.invalidateQueries({ queryKey: [payablesUrl] });
    queryClient.invalidateQueries({ queryKey: ["/api/expert-payables/eligible-consultations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/expert-payables"] });
  };

  const createMutation = useMutation({
    mutationFn: async (consultationId: number) => {
      const response = await apiRequest("POST", "/api/expert-payables", { consultationId });
      return response.json() as Promise<ExpertPayableRow>;
    },
    onSuccess: () => {
      setCreatingFrom(null);
      refreshLists();
      toast({
        title: "Expert payable created",
        description: "The payable is now pending review.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Could not create payable", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/expert-payables/${id}/approve`);
      return response.json() as Promise<ExpertPayableRow>;
    },
    onSuccess: (payable) => {
      setViewingPayable(payable);
      refreshLists();
      toast({ title: "Payable approved", description: "The payable is approved for manual payment." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not approve payable", description: error.message, variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/expert-payables/${id}/mark-paid`, {
        paymentMethod: paymentMethod.trim() || undefined,
        paymentReferenceNumber: paymentReferenceNumber.trim() || undefined,
        paymentNotes: paymentNotes.trim() || undefined,
      });
      return response.json() as Promise<ExpertPayableRow>;
    },
    onSuccess: (payable) => {
      setMarkingPaidPayable(null);
      setViewingPayable(payable);
      setPaymentMethod("");
      setPaymentReferenceNumber("");
      setPaymentNotes("");
      refreshLists();
      toast({ title: "Payable marked as paid", description: "The CRM recorded a manual payment already completed outside the system." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not mark payable as paid", description: error.message, variant: "destructive" });
    },
  });

  const voidMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/expert-payables/${id}/void`, {
        voidReason: voidReason.trim(),
      });
      return response.json() as Promise<ExpertPayableRow>;
    },
    onSuccess: (payable) => {
      setVoidingPayable(null);
      setViewingPayable(payable);
      setVoidReason("");
      refreshLists();
      toast({ title: "Payable voided", description: "The payable remains recorded and will not be paid." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not void payable", description: error.message, variant: "destructive" });
    },
  });

  const payables = payablesData?.rows || [];
  const eligibleConsultations = eligibleData?.rows || [];

  const openMarkPaidDialog = (payable: ExpertPayableRow) => {
    setMarkingPaidPayable(payable);
    setPaymentMethod(payable.paymentMethod || "");
    setPaymentReferenceNumber(payable.paymentReferenceNumber || "");
    setPaymentNotes(payable.paymentNotes || "");
  };

  const openVoidDialog = (payable: ExpertPayableRow) => {
    setVoidingPayable(payable);
    setVoidReason(payable.voidReason || "");
  };

  const renderLifecycleActions = (payable: ExpertPayableRow) => {
    const status = String(payable.status || "").toLowerCase();

    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setViewingPayable(payable)}>
          <Eye className="h-4 w-4" />
          View
        </Button>
        {status === "pending_review" && (
          <>
            <Button
              size="sm"
              className="gap-1"
              onClick={() => approveMutation.mutate(payable.id)}
              disabled={approveMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openVoidDialog(payable)}>
              <XCircle className="h-4 w-4" />
              Void
            </Button>
          </>
        )}
        {status === "approved" && (
          <>
            <Button size="sm" className="gap-1" onClick={() => openMarkPaidDialog(payable)}>
              <CheckCircle2 className="h-4 w-4" />
              Mark Paid
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openVoidDialog(payable)}>
              <XCircle className="h-4 w-4" />
              Void
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expert Payables</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts Payable workflow for external expert compensation after completed consultations.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={refreshLists}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Separate from client invoices</AlertTitle>
        <AlertDescription>
          Expert payables use actual consultation minutes and the expert hourly rate snapshot. Client CU logic,
          invoice amounts, and client rates are not used.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Payables</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Review, approve, record manual payment, or void expert payables.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search expert, project, client"
                className="pl-9 md:w-72"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PayableStatus)}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isPayablesLoading ? (
            <DataTableSkeleton columns={10} rows={5} />
          ) : payables.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No expert payables found"
              description="Create payables from eligible completed consultations below."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expert</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Service Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Hourly Rate</TableHead>
                    <TableHead>Payable Amount</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payables.map((payable) => (
                    <TableRow key={payable.id}>
                      <TableCell className="font-medium">{payable.expertName}</TableCell>
                      <TableCell>{payable.projectName}</TableCell>
                      <TableCell>{payable.clientName || "-"}</TableCell>
                      <TableCell>{formatDateOnly(payable.serviceDate)}</TableCell>
                      <TableCell>{payable.durationMinutes} min</TableCell>
                      <TableCell>{formatRate(payable.expertHourlyRateSnapshot, payable.payoutCurrency)}</TableCell>
                      <TableCell className="font-medium">{formatMoney(payable.payableAmount, payable.payoutCurrency)}</TableCell>
                      <TableCell>{payable.payoutCurrency}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClassName(payable.status)}>
                          {formatStatus(payable.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(payable.createdAt)}</TableCell>
                      <TableCell className="min-w-56 text-right">{renderLifecycleActions(payable)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eligible Completed Consultations</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed consultations without an existing expert payable. Creation is manual and requires confirmation.
          </p>
        </CardHeader>
        <CardContent>
          {isEligibleLoading ? (
            <DataTableSkeleton columns={8} rows={4} />
          ) : eligibleConsultations.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No eligible consultations"
              description="Completed consultations with duration, expert, rate, and no existing payable will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expert</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Service Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Rate Source</TableHead>
                    <TableHead>Estimated Payable</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleConsultations.map((row) => (
                    <TableRow key={row.consultationId}>
                      <TableCell className="font-medium">{row.expertName}</TableCell>
                      <TableCell>{row.projectName}</TableCell>
                      <TableCell>{row.clientName || "-"}</TableCell>
                      <TableCell>{formatDateOnly(row.serviceDate)}</TableCell>
                      <TableCell>{row.durationMinutes} min</TableCell>
                      <TableCell>
                        <div>{formatRate(row.expertHourlyRate, row.payoutCurrency)}</div>
                        <div className="text-xs text-muted-foreground">{formatRateSource(row.rateSource)}</div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatMoney(row.estimatedPayableAmount, row.payoutCurrency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setCreatingFrom(row)}>
                          Create Payable
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

      <Dialog open={!!creatingFrom} onOpenChange={(open) => !open && setCreatingFrom(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Expert Payable</DialogTitle>
            <DialogDescription>
              Confirm the source consultation and rate snapshot before creating a pending review payable.
            </DialogDescription>
          </DialogHeader>
          {creatingFrom && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-md border p-4 text-sm md:grid-cols-2">
                <Detail label="Expert" value={creatingFrom.expertName} />
                <Detail label="Project" value={creatingFrom.projectName} />
                <Detail label="Client" value={creatingFrom.clientName || "-"} />
                <Detail label="Service Date" value={formatDateOnly(creatingFrom.serviceDate)} />
                <Detail label="Duration Minutes" value={`${creatingFrom.durationMinutes} min`} />
                <Detail label="Hourly Rate Snapshot" value={formatRate(creatingFrom.expertHourlyRate, creatingFrom.payoutCurrency)} />
                <Detail label="Calculated Payable Amount" value={formatMoney(creatingFrom.estimatedPayableAmount, creatingFrom.payoutCurrency)} />
                <Detail label="Currency" value={creatingFrom.payoutCurrency} />
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Calculation</AlertTitle>
                <AlertDescription>
                  {calculationText(
                    creatingFrom.durationMinutes,
                    creatingFrom.expertHourlyRate,
                    creatingFrom.estimatedPayableAmount,
                    creatingFrom.payoutCurrency,
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingFrom(null)}>Cancel</Button>
            <Button
              onClick={() => creatingFrom && createMutation.mutate(creatingFrom.consultationId)}
              disabled={!creatingFrom || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Pending Review Payable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingPayable} onOpenChange={(open) => !open && setViewingPayable(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Expert Payable Detail</DialogTitle>
            <DialogDescription>Source consultation, payable calculation, and manual payment status.</DialogDescription>
          </DialogHeader>
          {viewingPayable && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{viewingPayable.expertName}</div>
                  <div className="text-sm text-muted-foreground">{viewingPayable.projectName}</div>
                </div>
                <Badge variant="outline" className={statusBadgeClassName(viewingPayable.status)}>
                  {formatStatus(viewingPayable.status)}
                </Badge>
              </div>
              <div className="grid gap-3 rounded-md border p-4 text-sm md:grid-cols-2">
                <Detail label="Client" value={viewingPayable.clientName || "-"} />
                <Detail label="Consultation ID" value={String(viewingPayable.consultationId)} />
                <Detail label="Service Date" value={formatDateOnly(viewingPayable.serviceDate)} />
                <Detail label="Duration" value={`${viewingPayable.durationMinutes} min`} />
                <Detail label="Hourly Rate Snapshot" value={formatRate(viewingPayable.expertHourlyRateSnapshot, viewingPayable.payoutCurrency)} />
                <Detail label="Payable Amount" value={formatMoney(viewingPayable.payableAmount, viewingPayable.payoutCurrency)} />
                <Detail label="Currency" value={viewingPayable.payoutCurrency} />
                <Detail label="Created At" value={formatDateTime(viewingPayable.createdAt)} />
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Calculation</AlertTitle>
                <AlertDescription>
                  {calculationText(
                    viewingPayable.durationMinutes,
                    viewingPayable.expertHourlyRateSnapshot,
                    viewingPayable.payableAmount,
                    viewingPayable.payoutCurrency,
                  )}
                </AlertDescription>
              </Alert>
              <div className="grid gap-3 rounded-md border p-4 text-sm md:grid-cols-2">
                <Detail
                  label="Approved"
                  value={viewingPayable.approvedAt ? `${formatDateTime(viewingPayable.approvedAt)} by ${viewingPayable.approvedByName || "Unknown"}` : "-"}
                />
                <Detail
                  label="Paid"
                  value={viewingPayable.paidAt ? `${formatDateTime(viewingPayable.paidAt)} by ${viewingPayable.paidByName || "Unknown"}` : "-"}
                />
                <Detail label="Payment Method" value={viewingPayable.paymentMethod || "-"} />
                <Detail label="Reference Number" value={viewingPayable.paymentReferenceNumber || "-"} />
                <Detail label="Payment Notes" value={viewingPayable.paymentNotes || "-"} />
                <Detail
                  label="Voided"
                  value={viewingPayable.voidedAt ? `${formatDateTime(viewingPayable.voidedAt)} by ${viewingPayable.voidedByName || "Unknown"}` : "-"}
                />
                <Detail label="Void Reason" value={viewingPayable.voidReason || "-"} />
              </div>
            </div>
          )}
          <DialogFooter>
            {viewingPayable?.status === "pending_review" && (
              <>
                <Button variant="outline" onClick={() => openVoidDialog(viewingPayable)}>Void Payable</Button>
                <Button onClick={() => approveMutation.mutate(viewingPayable.id)} disabled={approveMutation.isPending}>
                  Approve Payable
                </Button>
              </>
            )}
            {viewingPayable?.status === "approved" && (
              <>
                <Button variant="outline" onClick={() => openVoidDialog(viewingPayable)}>Void Payable</Button>
                <Button onClick={() => openMarkPaidDialog(viewingPayable)}>Mark as Paid</Button>
              </>
            )}
            <Button variant="outline" onClick={() => setViewingPayable(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!markingPaidPayable} onOpenChange={(open) => !open && setMarkingPaidPayable(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark Payable as Paid</DialogTitle>
            <DialogDescription>
              This only records a manual payment already completed outside the CRM. It does not send money or contact a payment provider.
            </DialogDescription>
          </DialogHeader>
          {markingPaidPayable && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Manual payment record</AlertTitle>
                <AlertDescription>
                  {formatMoney(markingPaidPayable.payableAmount, markingPaidPayable.payoutCurrency)} for {markingPaidPayable.expertName}
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Input id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-reference">Reference Number</Label>
                <Input id="payment-reference" value={paymentReferenceNumber} onChange={(event) => setPaymentReferenceNumber(event.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-notes">Notes</Label>
                <Textarea id="payment-notes" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Optional internal payment notes" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkingPaidPayable(null)}>Cancel</Button>
            <Button
              onClick={() => markingPaidPayable && markPaidMutation.mutate(markingPaidPayable.id)}
              disabled={!markingPaidPayable || markPaidMutation.isPending}
            >
              {markPaidMutation.isPending ? "Recording..." : "Record Manual Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!voidingPayable} onOpenChange={(open) => !open && setVoidingPayable(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Void Expert Payable</DialogTitle>
            <DialogDescription>
              Void keeps the payable record but removes it from the payable workflow. Paid payables cannot be voided in this MVP.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="void-reason">Void Reason</Label>
            <Textarea
              id="void-reason"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Explain why this payable should not be paid"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidingPayable(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => voidingPayable && voidMutation.mutate(voidingPayable.id)}
              disabled={!voidingPayable || !voidReason.trim() || voidMutation.isPending}
            >
              {voidMutation.isPending ? "Voiding..." : "Void Payable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="break-words">{value}</div>
    </div>
  );
}
