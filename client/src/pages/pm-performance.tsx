import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart3, Briefcase, Clock, Search, UsersRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type DateRangePreset = "this_month" | "last_month" | "last_30_days" | "year_to_date" | "all_time" | "custom";
type SortBy = "totalCUUsed" | "completedCalls" | "activeProjects" | "cuPerRequest";
type SortOrder = "asc" | "desc";

interface PmPerformanceRow {
  pmId: number;
  pmName: string;
  pmEmail: string;
  activeProjects: number;
  requestsHandled: number;
  completedCalls: number;
  totalCUUsed: number;
  cuPerRequest: number;
  callsPerRequest: number;
  totalCompletedMinutes: number;
  avgCUPerCall: number;
  signalsCaptured: number;
  lastCompletedCallDate: string | null;
}

interface PmPerformanceResponse {
  summary: {
    totalPMs: number;
    requestsHandled: number;
    completedCalls: number;
    totalCUUsed: number;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  rows: PmPerformanceRow[];
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

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy");
};

const formatNumber = (value: number) => value.toLocaleString();
const formatCu = (value: number) => value.toFixed(2);

export default function PmPerformance() {
  const [datePreset, setDatePreset] = useState<DateRangePreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState(() => toDateInputValue(new Date()));
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("totalCUUsed");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const dateRange = useMemo(
    () => getPresetRange(datePreset, customStartDate, customEndDate),
    [customEndDate, customStartDate, datePreset]
  );

  const selectedPeriodLabel =
    dateRange.start && dateRange.end
      ? `${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`
      : "All available completed calls";

  const reportUrl = useMemo(() => {
    const params = new URLSearchParams({
      sortBy,
      order: sortOrder,
      limit: "100",
      offset: "0",
    });
    if (dateRange.start) params.set("startDate", toQueryDate(dateRange.start));
    if (dateRange.end) params.set("endDate", toQueryDate(dateRange.end));
    if (search.trim()) params.set("search", search.trim());
    return `/api/performance/pm?${params.toString()}`;
  }, [dateRange.end, dateRange.start, search, sortBy, sortOrder]);

  const { data, isLoading } = useQuery<PmPerformanceResponse>({
    queryKey: [reportUrl],
  });

  const summary = data?.summary || {
    totalPMs: 0,
    requestsHandled: 0,
    completedCalls: 0,
    totalCUUsed: 0,
  };
  const rows = data?.rows || [];

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">PM Performance</h1>
        <p className="text-sm text-muted-foreground">
          Backend-aggregated operations report for project manager delivery, request handling, CU usage, and captured signals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Controls</CardTitle>
          <CardDescription>Results for selected period: {selectedPeriodLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={datePreset} onValueChange={(value) => setDatePreset(value as DateRangePreset)}>
                <SelectTrigger data-testid="select-date-range">
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
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sort By</label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                <SelectTrigger data-testid="select-sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totalCUUsed">Total CU Used</SelectItem>
                  <SelectItem value="completedCalls">Completed Calls</SelectItem>
                  <SelectItem value="activeProjects">Active Projects</SelectItem>
                  <SelectItem value="cuPerRequest">CU / Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Direction</label>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                <SelectTrigger data-testid="select-sort-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Desc</SelectItem>
                  <SelectItem value="asc">Asc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search PM name or email..."
              className="pl-9"
              data-testid="input-search-pm"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="PMs"
          value={formatNumber(summary.totalPMs)}
          subtitle="Matching PMs in this report"
          icon={UsersRound}
        />
        <MetricCard
          title="Requests Handled"
          value={formatNumber(summary.requestsHandled)}
          subtitle="Unique projects with completed calls"
          icon={Briefcase}
        />
        <MetricCard
          title="Completed Calls"
          value={formatNumber(summary.completedCalls)}
          subtitle="Completed consultations only"
          icon={Clock}
        />
        <MetricCard
          title="Total CU Used"
          value={formatCu(summary.totalCUUsed)}
          subtitle="From completed call records"
          icon={BarChart3}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PM Operations Table</CardTitle>
          <CardDescription>
            Request efficiency uses unique project requests with at least one completed call during the selected period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={10} rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No PM performance data"
              description="No matching PMs or completed calls were found for the selected period."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PM</TableHead>
                  <TableHead className="text-right">Active Projects</TableHead>
                  <TableHead className="text-right">Requests Handled</TableHead>
                  <TableHead className="text-right">Completed Calls</TableHead>
                  <TableHead className="text-right">Total CU Used</TableHead>
                  <TableHead className="text-right">CU / Request</TableHead>
                  <TableHead className="text-right">Calls / Request</TableHead>
                  <TableHead className="text-right">Avg CU / Call</TableHead>
                  <TableHead className="text-right">Signals Captured</TableHead>
                  <TableHead>Last Completed Call</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.pmId} data-testid={`row-pm-performance-${row.pmId}`}>
                    <TableCell>
                      <div className="font-medium">{row.pmName}</div>
                      <div className="text-xs text-muted-foreground">{row.pmEmail}</div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(row.activeProjects)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.requestsHandled)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.completedCalls)}</TableCell>
                    <TableCell className="text-right">{formatCu(row.totalCUUsed)}</TableCell>
                    <TableCell className="text-right">{row.requestsHandled > 0 ? formatCu(row.cuPerRequest) : "-"}</TableCell>
                    <TableCell className="text-right">{row.requestsHandled > 0 ? formatCu(row.callsPerRequest) : "-"}</TableCell>
                    <TableCell className="text-right">{row.completedCalls > 0 ? formatCu(row.avgCUPerCall) : "-"}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.signalsCaptured)}</TableCell>
                    <TableCell>{formatDate(row.lastCompletedCallDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
