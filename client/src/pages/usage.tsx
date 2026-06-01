import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart3, Clock, CreditCard, Download, FileText } from "lucide-react";
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

type DateRangePreset = "this_month" | "last_month" | "last_30_days" | "year_to_date" | "all_time" | "custom";

interface CuLedgerRow {
  callRecordId: number;
  callDate: string;
  projectId: number;
  projectName: string;
  clientName: string;
  clientOrganizationId: number | null;
  expertId: number;
  expertName: string;
  pmId: number | null;
  pmName: string | null;
  raId: number | null;
  raName: string | null;
  durationMinutes: number;
  actualDurationMinutes: number | null;
  cuUsed: string;
  completedAt: string | null;
  recordingUrl: string | null;
  source: "Completed Call Record";
}

interface CuLedgerResponse {
  summary: {
    completedCalls: number;
    totalCUUsed: number;
    totalCompletedMinutes: number;
    avgCUPerCall: number;
  };
  rows: CuLedgerRow[];
}

const dateRangeLabels: Record<DateRangePreset, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  last_30_days: "Last 30 Days",
  year_to_date: "Year to Date",
  all_time: "All Time",
  custom: "Custom Range",
};

const toDateInputValue = (date: Date) => format(date, "yyyy-MM-dd");

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const getPresetRange = (preset: DateRangePreset, customStart: string, customEnd: string) => {
  const now = new Date();

  if (preset === "all_time") {
    return { start: null as Date | null, end: null as Date | null };
  }

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

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy");
};

const formatDateTime = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy HH:mm");
};

const csvEscape = (value: string | number | null | undefined) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

const toQueryDate = (date: Date | null) => (date ? format(date, "yyyy-MM-dd") : "");

export default function Usage() {
  const { toast } = useToast();
  const [datePreset, setDatePreset] = useState<DateRangePreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState(() => toDateInputValue(new Date()));
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));

  const dateRange = useMemo(
    () => getPresetRange(datePreset, customStartDate, customEndDate),
    [customEndDate, customStartDate, datePreset]
  );

  const ledgerUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange.start) params.set("startDate", toQueryDate(dateRange.start));
    if (dateRange.end) params.set("endDate", toQueryDate(dateRange.end));
    const query = params.toString();
    return `/api/cu-ledger${query ? `?${query}` : ""}`;
  }, [dateRange.end, dateRange.start]);

  const { data: ledgerData, isLoading } = useQuery<CuLedgerResponse>({
    queryKey: [ledgerUrl],
  });

  const ledgerRows = ledgerData?.rows || [];
  const summary = ledgerData?.summary || {
    completedCalls: 0,
    totalCUUsed: 0,
    totalCompletedMinutes: 0,
    avgCUPerCall: 0,
  };
  const totalCompletedMinutes = summary.totalCompletedMinutes;
  const totalCuUsed = summary.totalCUUsed;
  const averageCuPerCall = summary.avgCUPerCall;
  const completedCalls = summary.completedCalls;

  const exportToCSV = () => {
    if (!ledgerRows.length) return;

    const headers = [
      "Call Date",
      "Project",
      "Client",
      "Expert",
      "PM",
      "RA",
      "Duration",
      "CU Used",
      "Completed At",
      "Recording",
      "Source",
    ];
    const rows = ledgerRows.map((record) => [
      formatDate(record.callDate),
      record.projectName,
      record.clientName,
      record.expertName,
      record.pmName || "-",
      record.raName || "-",
      `${record.actualDurationMinutes || record.durationMinutes || 0} min`,
      Number(record.cuUsed || 0).toFixed(2),
      formatDateTime(record.completedAt),
      record.recordingUrl || "",
      "Completed Call Record",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cu-ledger-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "CU ledger exported successfully" });
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">CU Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Read-only CU ledger generated from completed consultation records.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportToCSV}
          disabled={!ledgerRows.length}
          className="gap-2"
          data-testid="button-export-cu-ledger"
        >
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      <Alert>
        <AlertTitle>Completed calls are the source of truth</AlertTitle>
        <AlertDescription>
          Legacy manual usage records are no longer the source of truth. CU usage is calculated from completed call records.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <Select value={datePreset} onValueChange={(value) => setDatePreset(value as DateRangePreset)}>
                <SelectTrigger data-testid="select-cu-ledger-period">
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

            {datePreset === "custom" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                    data-testid="input-cu-ledger-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    data-testid="input-cu-ledger-end-date"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Completed Calls"
          value={completedCalls}
          subtitle={dateRangeLabels[datePreset]}
          icon={BarChart3}
        />
        <MetricCard
          title="Total CU Used"
          value={totalCuUsed.toFixed(2)}
          subtitle="Completed calls only"
          icon={CreditCard}
        />
        <MetricCard
          title="Total Completed Minutes"
          value={totalCompletedMinutes.toLocaleString()}
          subtitle={`~${Math.round(totalCompletedMinutes / 60)} hours`}
          icon={Clock}
        />
        <MetricCard
          title="Avg. CU per Call"
          value={averageCuPerCall.toFixed(2)}
          subtitle="Read-only ledger"
          icon={Clock}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Completed Call CU Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={11} rows={5} />
          ) : !ledgerRows.length ? (
            <EmptyState
              icon={FileText}
              title="No completed call records for this period."
              description="CU usage will appear here after consultations are completed."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase">Call Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">PM</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">RA</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Duration</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">CU Used</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Completed At</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Recording</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerRows.map((record) => (
                    <TableRow key={record.callRecordId} data-testid={`row-cu-ledger-${record.callRecordId}`}>
                      <TableCell className="font-mono text-sm">{formatDate(record.callDate)}</TableCell>
                      <TableCell>{record.projectName}</TableCell>
                      <TableCell>{record.clientName}</TableCell>
                      <TableCell>{record.expertName}</TableCell>
                      <TableCell>{record.pmName || "-"}</TableCell>
                      <TableCell>{record.raName || "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {record.actualDurationMinutes || record.durationMinutes || 0} min
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(record.cuUsed || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatDateTime(record.completedAt)}</TableCell>
                      <TableCell>
                        {record.recordingUrl ? (
                          <a
                            href={record.recordingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{record.source}</TableCell>
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
