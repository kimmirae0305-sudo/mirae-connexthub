import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, CreditCard, FileText, RefreshCw, Settings } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type DateRangePreset = "this_month" | "last_month" | "last_30_days" | "year_to_date" | "all_time" | "custom";
type BillableStatus = "all" | "unbilled" | "draft" | "invoiced" | "void";

interface BillableUsageRow {
  id: number;
  callRecordId: number;
  clientOrganizationId: number | null;
  clientName: string;
  projectId: number;
  projectName: string;
  expertId: number;
  expertName: string;
  callDate: string;
  cuUsed: string;
  currency: string;
  cuRate: string | null;
  amount: string | null;
  status: string;
  source: string;
  adjustmentReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BillableUsageResponse {
  summary: {
    unbilledItems: number;
    totalCU: number;
    billableAmount: number;
    missingRateItems: number;
  };
  rows: BillableUsageRow[];
}

const dateRangeLabels: Record<DateRangePreset, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  last_30_days: "Last 30 Days",
  year_to_date: "Year to Date",
  all_time: "All Time",
  custom: "Custom Range",
};

const statusLabels: Record<BillableStatus, string> = {
  all: "All Statuses",
  unbilled: "Unbilled",
  draft: "Draft",
  invoiced: "Invoiced",
  void: "Void",
};

const toDateInputValue = (date: Date) => format(date, "yyyy-MM-dd");
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const toQueryDate = (date: Date | null) => (date ? format(date, "yyyy-MM-dd") : "");

const getPresetRange = (preset: DateRangePreset, customStart: string, customEnd: string) => {
  const now = new Date();

  if (preset === "all_time") return { start: null as Date | null, end: null as Date | null };
  if (preset === "last_month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (preset === "last_30_days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { start: startOfDay(start), end: endOfDay(now) };
  }
  if (preset === "year_to_date") {
    return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
  }
  if (preset === "custom") {
    return {
      start: customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : null,
      end: customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : null,
    };
  }

  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy");
};

const formatMoney = (amount: string | number | null | undefined, currency = "USD") => {
  const numericAmount = Number(amount || 0);
  return `${currency} ${numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatSource = (source: string) =>
  source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function BillableUsage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [datePreset, setDatePreset] = useState<DateRangePreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState(() => toDateInputValue(new Date()));
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));
  const [status, setStatus] = useState<BillableStatus>("all");
  const [missingRateOnly, setMissingRateOnly] = useState(false);

  const dateRange = useMemo(
    () => getPresetRange(datePreset, customStartDate, customEndDate),
    [customEndDate, customStartDate, datePreset]
  );

  const billableUsageUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange.start) params.set("startDate", toQueryDate(dateRange.start));
    if (dateRange.end) params.set("endDate", toQueryDate(dateRange.end));
    if (status !== "all") params.set("status", status);
    const query = params.toString();
    return `/api/billable-usage${query ? `?${query}` : ""}`;
  }, [dateRange.end, dateRange.start, status]);

  const { data, isLoading } = useQuery<BillableUsageResponse>({
    queryKey: [billableUsageUrl],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billable-usage/sync");
      return response.json() as Promise<{ createdCount: number; skippedCount: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [billableUsageUrl] });
      toast({
        title: "Billable usage synced",
        description: `${result.createdCount} created, ${result.skippedCount} skipped as already linked.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const refreshRatesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billable-usage/refresh-rates");
      return response.json() as Promise<{
        updatedCount: number;
        skippedCount: number;
        stillMissingRateCount: number;
      }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [billableUsageUrl] });
      toast({
        title: "Rates refreshed",
        description: `${result.updatedCount} updated, ${result.stillMissingRateCount} still missing rates.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rate refresh failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const allRows = data?.rows || [];
  const rows = missingRateOnly
    ? allRows.filter((row) => !row.cuRate || Number(row.cuRate) <= 0 || !row.amount || Number(row.amount) <= 0)
    : allRows;
  const summary = data?.summary || {
    unbilledItems: 0,
    totalCU: 0,
    billableAmount: 0,
    missingRateItems: 0,
  };
  const primaryCurrency = rows[0]?.currency || "USD";

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Billable Usage</h1>
          <p className="text-sm text-muted-foreground">
            Review billable usage generated from completed consultation records before invoice drafting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.missingRateItems > 0 && (
            <Button asChild variant="outline" className="gap-2" data-testid="button-go-to-contracts">
              <Link href="/contracts">
                <Settings className="h-4 w-4" />
                Go to Contracts
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => refreshRatesMutation.mutate()}
            disabled={refreshRatesMutation.isPending}
            title="Recalculates missing rates for unbilled items using project and client contract rates."
            className="gap-2"
            data-testid="button-refresh-billable-rates"
          >
            <RefreshCw className="h-4 w-4" />
            {refreshRatesMutation.isPending ? "Refreshing..." : "Refresh Rates"}
          </Button>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="gap-2"
            data-testid="button-sync-billable-usage"
          >
            <RefreshCw className="h-4 w-4" />
            {syncMutation.isPending ? "Syncing..." : "Sync from Completed Calls"}
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Finance review layer</AlertTitle>
        <AlertDescription>
          Billable usage is generated from completed call records and reviewed here before invoice drafting. This does not issue invoices or mutate call records.
          <span className="mt-1 block">
            Refresh Rates recalculates missing rates for unbilled items using project and client contract rates.
          </span>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <Select value={datePreset} onValueChange={(value) => setDatePreset(value as DateRangePreset)}>
                <SelectTrigger data-testid="select-billable-usage-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(dateRangeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(value) => setStatus(value as BillableStatus)}>
                <SelectTrigger data-testid="select-billable-usage-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={missingRateOnly}
                  onChange={(event) => setMissingRateOnly(event.target.checked)}
                  data-testid="checkbox-missing-rate-only"
                />
                Missing rate only
              </label>
            </div>
            {datePreset === "custom" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                    data-testid="input-billable-usage-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    data-testid="input-billable-usage-end-date"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Unbilled Items"
          value={summary.unbilledItems}
          subtitle="Ready for finance review"
          icon={FileText}
        />
        <MetricCard
          title="Total CU"
          value={summary.totalCU.toFixed(2)}
          subtitle="Filtered billable usage"
          icon={CreditCard}
        />
        <MetricCard
          title="Billable Amount"
          value={formatMoney(summary.billableAmount, primaryCurrency)}
          subtitle="Based on captured CU rates"
          icon={CreditCard}
        />
        <MetricCard
          title="Missing Rate Items"
          value={summary.missingRateItems}
          subtitle="Need rate review before invoicing"
          icon={AlertCircle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Billable Usage Review</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={10} rows={5} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No billable usage found for the selected filters."
              description="Sync completed calls to generate billable usage."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase">Call Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">CU Used</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">CU Rate</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Amount</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Currency</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} data-testid={`row-billable-usage-${row.id}`}>
                      <TableCell className="font-mono text-sm">{formatDate(row.callDate)}</TableCell>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell>{row.projectName}</TableCell>
                      <TableCell>{row.expertName}</TableCell>
                      <TableCell className="text-right font-mono">{Number(row.cuUsed || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.cuRate ? Number(row.cuRate).toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.amount ? Number(row.amount).toFixed(2) : "-"}
                      </TableCell>
                      <TableCell>{row.currency}</TableCell>
                      <TableCell>{statusLabels[row.status as BillableStatus] || row.status}</TableCell>
                      <TableCell>{formatSource(row.source)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
