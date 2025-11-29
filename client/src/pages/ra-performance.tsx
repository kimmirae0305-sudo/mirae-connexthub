import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, DollarSign, Calendar, ArrowLeft } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

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

const periodOptions = [
  { label: "All Time", value: "all" },
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "Last 3 Months", value: "last-3-months" },
  { label: "Last 6 Months", value: "last-6-months" },
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

export default function RaPerformance() {
  const { raId } = useParams<{ raId?: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState("all");

  const periodDates = getPeriodDates(selectedPeriod);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">RA Performance</h1>
          <p className="text-sm text-muted-foreground">
            Track RA recruitment incentives and expert sourcing metrics
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48" data-testid="select-period">
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

      {allRaData && (
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Incentive Rate:</span>{" "}
                <Badge variant="secondary">R$ {allRaData.incentivePerCallBRL} per call</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Eligibility Window:</span>{" "}
                <Badge variant="secondary">{allRaData.eligibilityWindowDays} days</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoadingAll ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : allRaData?.summaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No RA Data</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No Research Associates found or no incentive data available for this period.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allRaData?.summaries.map((ra) => (
            <Link key={ra.raId} href={`/ra-performance/${ra.raId}`}>
              <Card className="cursor-pointer transition-colors hover-elevate" data-testid={`card-ra-${ra.raId}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{ra.raName}</CardTitle>
                  <CardDescription>{ra.raEmail}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Recruited</p>
                      <p className="text-xl font-semibold">{ra.totalRecruitedExperts}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Eligible Calls</p>
                      <p className="text-xl font-semibold">{ra.totalEligibleCalls}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <span className="text-sm text-muted-foreground">Total Incentive</span>
                    <span className="text-lg font-bold text-green-600">
                      R$ {ra.totalIncentiveBRL.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
