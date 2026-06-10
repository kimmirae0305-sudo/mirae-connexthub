import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Users, TrendingUp, DollarSign, Calendar, ArrowLeft, Search, UserCheck } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";

interface RaIncentiveSummary {
  raId: number;
  raName: string;
  raEmail: string;
  totalRecruitedExperts: number;
  expertsWithCompletedCalls: number;
  totalEligibleCalls: number;
  totalIncentiveBRL: number;
}

interface RaIncentiveDetail {
  raId: number;
  raName: string;
  raEmail: string;
  totalRecruitedExperts: number;
  expertsWithCompletedCalls: number;
  totalEligibleCalls: number;
  totalIncentiveBRL: number;
  eligibleExperts: Array<{
    expertId: number;
    expertName: string;
    recruitedAt: string | null;
    eligibleCalls: number;
    incentiveBRL: number;
  }>;
  period: {
    fromDate: string | null;
    toDate: string | null;
  };
  incentivePerCallBRL: number;
  eligibilityWindowDays: number;
}

interface AllRaIncentivesResponse {
  period: {
    fromDate: string | null;
    toDate: string | null;
  };
  incentivePerCallBRL: number;
  eligibilityWindowDays: number;
  summaries: RaIncentiveSummary[];
}

type SortBy = "incentivePayable" | "eligibleCompletedCalls" | "expertsSourced" | "acceptedExperts" | "latestActivity";
type SortOrder = "asc" | "desc";

const periodOptions = [
  { label: "All Time", value: "all" },
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "Last 3 Months", value: "last-3-months" },
  { label: "Last 6 Months", value: "last-6-months" },
];

const sortOptions: Array<{ label: string; value: SortBy }> = [
  { label: "Incentive Payable", value: "incentivePayable" },
  { label: "Eligible Completed Calls", value: "eligibleCompletedCalls" },
  { label: "Experts Sourced", value: "expertsSourced" },
  { label: "Accepted Experts", value: "acceptedExperts" },
  { label: "Latest Activity", value: "latestActivity" },
];

function getPeriodDates(period: string): { fromDate?: Date; toDate?: Date } {
  const now = new Date();
  switch (period) {
    case "this-month":
      return { fromDate: startOfMonth(now), toDate: endOfMonth(now) };
    case "last-month":
      return { fromDate: startOfMonth(subMonths(now, 1)), toDate: endOfMonth(subMonths(now, 1)) };
    case "last-3-months":
      return { fromDate: startOfMonth(subMonths(now, 2)), toDate: endOfMonth(now) };
    case "last-6-months":
      return { fromDate: startOfMonth(subMonths(now, 5)), toDate: endOfMonth(now) };
    default:
      return {};
  }
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM d, yyyy");
}

function formatPeriodLabel(period: string, fromDate?: Date, toDate?: Date) {
  if (!fromDate || !toDate) return "All available RA sourcing activity";
  return `${format(fromDate, "MMM d, yyyy")} - ${format(toDate, "MMM d, yyyy")}`;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatBRL(value: number) {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

export default function RaPerformance() {
  const { raId } = useParams<{ raId?: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("incentivePayable");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const periodDates = getPeriodDates(selectedPeriod);
  const selectedPeriodLabel = formatPeriodLabel(selectedPeriod, periodDates.fromDate, periodDates.toDate);
  const queryParams = new URLSearchParams();
  if (periodDates.fromDate) queryParams.set("fromDate", periodDates.fromDate.toISOString());
  if (periodDates.toDate) queryParams.set("toDate", periodDates.toDate.toISOString());
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

  const { data: allRaData, isLoading: isLoadingAll } = useQuery<AllRaIncentivesResponse>({
    queryKey: ["/api/ra-incentives", selectedPeriod],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/ra-incentives${queryString}`);
      return res.json();
    },
    enabled: !raId,
  });

  const { data: raDetail, isLoading: isLoadingDetail } = useQuery<RaIncentiveDetail>({
    queryKey: ["/api/ra-incentives", raId, selectedPeriod],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/ra-incentives/${raId}${queryString}`);
      return res.json();
    },
    enabled: !!raId,
  });

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const sourceRows = allRaData?.summaries || [];
    const filteredRows = normalizedSearch
      ? sourceRows.filter((ra) =>
          `${ra.raName} ${ra.raEmail}`.toLowerCase().includes(normalizedSearch)
        )
      : sourceRows;

    const getSortValue = (row: RaIncentiveSummary) => {
      if (sortBy === "eligibleCompletedCalls") return row.totalEligibleCalls;
      if (sortBy === "expertsSourced") return row.totalRecruitedExperts;
      if (sortBy === "acceptedExperts") return row.expertsWithCompletedCalls;
      if (sortBy === "latestActivity") return row.totalEligibleCalls > 0 || row.totalRecruitedExperts > 0 ? 1 : 0;
      return row.totalIncentiveBRL;
    };

    return [...filteredRows].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      const direction = sortOrder === "desc" ? -1 : 1;
      if (aValue === bValue) return a.raName.localeCompare(b.raName);
      return aValue > bValue ? direction : -direction;
    });
  }, [allRaData?.summaries, search, sortBy, sortOrder]);

  const summary = useMemo(
    () => ({
      totalRAs: rows.length,
      expertsSourced: rows.reduce((sum, row) => sum + row.totalRecruitedExperts, 0),
      eligibleCompletedCalls: rows.reduce((sum, row) => sum + row.totalEligibleCalls, 0),
      incentivePayable: rows.reduce((sum, row) => sum + row.totalIncentiveBRL, 0),
    }),
    [rows]
  );

  if (raId && raDetail) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <Link href="/ra-performance">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{raDetail.raName}</h1>
            <p className="text-sm text-muted-foreground">{raDetail.raEmail}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48" data-testid="select-period-detail">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Recruited</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{raDetail.totalRecruitedExperts}</div>
              <p className="text-xs text-muted-foreground">experts sourced</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Completed Calls</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{raDetail.expertsWithCompletedCalls}</div>
              <p className="text-xs text-muted-foreground">experts with calls</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eligible Calls</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{raDetail.totalEligibleCalls}</div>
              <p className="text-xs text-muted-foreground">within {raDetail.eligibilityWindowDays} days</p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Incentive</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {raDetail.totalIncentiveBRL.toLocaleString("pt-BR")}
              </div>
              <p className="text-xs text-muted-foreground">@ R${raDetail.incentivePerCallBRL}/call</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Eligible Experts</CardTitle>
            <CardDescription>
              Experts who completed calls within {raDetail.eligibilityWindowDays} days of recruitment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {raDetail.eligibleExperts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No eligible experts with completed calls in this period
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expert Name</TableHead>
                    <TableHead>Recruited On</TableHead>
                    <TableHead className="text-right">Eligible Calls</TableHead>
                    <TableHead className="text-right">Incentive (BRL)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {raDetail.eligibleExperts.map((expert) => (
                    <TableRow key={expert.expertId} data-testid={`row-expert-${expert.expertId}`}>
                      <TableCell className="font-medium">{expert.expertName}</TableCell>
                      <TableCell>
                        {expert.recruitedAt
                          ? format(new Date(expert.recruitedAt), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">{expert.eligibleCalls}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        R$ {expert.incentiveBRL.toLocaleString("pt-BR")}
                      </TableCell>
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

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">RA Performance</h1>
        <p className="text-sm text-muted-foreground">
          Track RA recruitment incentives and expert sourcing metrics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Controls</CardTitle>
          <CardDescription>Results for selected period: {selectedPeriodLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger data-testid="select-period">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sort By</label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                <SelectTrigger data-testid="select-sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Order</label>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                <SelectTrigger data-testid="select-sort-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Highest first</SelectItem>
                  <SelectItem value="asc">Lowest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search RA name or email..."
                  className="pl-9"
                  data-testid="input-search-ra"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
            <span className="text-muted-foreground">Incentive metadata:</span>
            <Badge variant="secondary">Incentive Rate: R$ {allRaData?.incentivePerCallBRL ?? 250} per call</Badge>
            <Badge variant="secondary">Eligibility Window: {allRaData?.eligibilityWindowDays ?? 60} days</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="RAs"
          value={formatNumber(summary.totalRAs)}
          subtitle="Matching Research Associates in this report"
          icon={Users}
        />
        <MetricCard
          title="Experts Sourced"
          value={formatNumber(summary.expertsSourced)}
          subtitle="RA-sourced expert profiles"
          icon={UserCheck}
        />
        <MetricCard
          title="Eligible Completed Calls"
          value={formatNumber(summary.eligibleCompletedCalls)}
          subtitle="Completed consultations within the 60-day eligibility window"
          icon={Calendar}
        />
        <MetricCard
          title="Incentive Payable"
          value={formatBRL(summary.incentivePayable)}
          subtitle="Eligible calls x R$250"
          icon={DollarSign}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RA Operations Table</CardTitle>
          <CardDescription>
            RA incentives are calculated when an RA-sourced expert completes a consultation within the eligibility window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAll ? (
            <DataTableSkeleton columns={7} rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No RA performance data yet"
              description="No Research Associates with eligible sourced experts or completed calls were found for the selected period."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RA</TableHead>
                  <TableHead className="text-right">Experts Sourced</TableHead>
                  <TableHead className="text-right">Accepted Experts</TableHead>
                  <TableHead className="text-right">Eligible Completed Calls</TableHead>
                  <TableHead className="text-right">Incentive Payable</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((ra) => (
                  <TableRow key={ra.raId} data-testid={`row-ra-performance-${ra.raId}`}>
                    <TableCell>
                      <Link href={`/ra-performance/${ra.raId}`} className="font-medium text-primary hover:underline">
                        {ra.raName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{ra.raEmail}</div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(ra.totalRecruitedExperts)}</TableCell>
                    <TableCell className="text-right">{formatNumber(ra.expertsWithCompletedCalls)}</TableCell>
                    <TableCell className="text-right">{formatNumber(ra.totalEligibleCalls)}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{formatBRL(ra.totalIncentiveBRL)}</TableCell>
                    <TableCell>{formatDate(null)}</TableCell>
                    <TableCell>
                      <Badge variant={ra.totalEligibleCalls > 0 ? "default" : ra.totalRecruitedExperts > 0 ? "secondary" : "outline"}>
                        {ra.totalEligibleCalls > 0 ? "Eligible Activity" : ra.totalRecruitedExperts > 0 ? "Sourcing" : "No Activity"}
                      </Badge>
                    </TableCell>
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
