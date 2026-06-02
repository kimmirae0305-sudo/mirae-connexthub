import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, Briefcase, Clock, CreditCard, PhoneCall } from "lucide-react";

type DateRangePreset = "this_month" | "last_month" | "last_30_days" | "year_to_date" | "all_time" | "custom";

interface OperationsAnalytics {
  summary: {
    activeProjects: number;
    completedCalls: number;
    totalCUUsed: number;
    totalCompletedMinutes: number;
    avgCUPerCall: number;
  };
  charts: {
    callsOverTime: Array<{ period: string; completedCalls: number; cuUsed: number }>;
    cuByIndustry: Array<{ industry: string; cuUsed: number; completedCalls: number }>;
    cuByProject: Array<{ projectId: number; projectName: string; cuUsed: number; completedCalls: number }>;
    completedCallsByExpert: Array<{ expertId: number; expertName: string; completedCalls: number; cuUsed: number }>;
    completedCallsByPM: Array<{ pmId: number | null; pmName: string; completedCalls: number; cuUsed: number }>;
    projectPipeline: Array<{ status: string; count: number }>;
  };
}

const dateRangeLabels: Record<DateRangePreset, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  last_30_days: "Last 30 Days",
  year_to_date: "Year to Date",
  all_time: "All Time",
  custom: "Custom Range",
};

const COLORS = ["#3b82f6", "#ef4444", "#8b5cf6", "#f59e0b", "#10b981", "#06b6d4"];

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

const formatStatus = (status: string) =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const EmptyChart = ({ label }: { label: string }) => (
  <div className="flex h-[300px] items-center justify-center text-muted-foreground">{label}</div>
);

const LowDataChart = () => <EmptyChart label="Not enough data for a meaningful trend yet." />;

const SkeletonCard = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-5 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-64 w-full" />
    </CardContent>
  </Card>
);

export default function Analytics() {
  const [datePreset, setDatePreset] = useState<DateRangePreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState(() => toDateInputValue(new Date()));
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));

  const dateRange = useMemo(
    () => getPresetRange(datePreset, customStartDate, customEndDate),
    [customEndDate, customStartDate, datePreset]
  );

  const analyticsUrl = useMemo(() => {
    const params = new URLSearchParams({ granularity: "month" });
    if (dateRange.start) params.set("startDate", toQueryDate(dateRange.start));
    if (dateRange.end) params.set("endDate", toQueryDate(dateRange.end));
    return `/api/analytics/operations?${params.toString()}`;
  }, [dateRange.end, dateRange.start]);

  const { data, isLoading } = useQuery<OperationsAnalytics>({
    queryKey: [analyticsUrl],
  });

  const summary = data?.summary || {
    activeProjects: 0,
    completedCalls: 0,
    totalCUUsed: 0,
    totalCompletedMinutes: 0,
    avgCUPerCall: 0,
  };
  const charts = data?.charts || {
    callsOverTime: [],
    cuByIndustry: [],
    cuByProject: [],
    completedCallsByExpert: [],
    completedCallsByPM: [],
    projectPipeline: [],
  };
  const projectPipelineData = charts.projectPipeline.map((item) => ({
    name: formatStatus(item.status),
    value: item.count,
  }));
  const selectedPeriodLabel =
    dateRange.start && dateRange.end
      ? `${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`
      : "All available completed calls";
  const callsOverTimeHasTrend = charts.callsOverTime.length > 1;
  const cuByIndustryHasSignal = charts.cuByIndustry.length > 1;
  const cuByProjectHasSignal = charts.cuByProject.length > 1;
  const callsByPmHasSignal = charts.completedCallsByPM.length > 1;

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Backend-aggregated operational metrics from completed consultation records.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Backend-aggregated operational analytics from completed consultation records for the selected period.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <Select value={datePreset} onValueChange={(value) => setDatePreset(value as DateRangePreset)}>
                <SelectTrigger data-testid="select-analytics-period">
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
                    data-testid="input-analytics-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    data-testid="input-analytics-end-date"
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-4 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Selected period: <span className="font-medium text-foreground">{selectedPeriodLabel}</span>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-foreground">Results for selected period</h2>
        <p className="text-sm text-muted-foreground">
          Call and CU metrics below include completed consultation records only.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeProjects}</div>
            <p className="mt-1 text-xs text-muted-foreground">Current non-closed project load</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Calls</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary.completedCalls}</div>
            <p className="mt-1 text-xs text-muted-foreground">{dateRangeLabels[datePreset]}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total CU Used</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary.totalCUUsed.toFixed(2)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Completed calls only</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. CU per Call</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary.avgCUPerCall.toFixed(2)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.totalCompletedMinutes.toLocaleString()} completed minutes
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {projectPipelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={projectPipelineData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {projectPipelineData.map((_, index) => (
                      <Cell key={`pipeline-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No project pipeline data yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Calls Over Time</CardTitle>
            <CardDescription>Completed calls and CU used by month for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {callsOverTimeHasTrend ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={charts.callsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completedCalls" name="Completed Calls" stroke="#3b82f6" />
                  <Line type="monotone" dataKey="cuUsed" name="CU Used" stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            ) : charts.callsOverTime.length === 1 ? (
              <LowDataChart />
            ) : (
              <EmptyChart label="No completed calls for this period" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CU by Industry</CardTitle>
            <CardDescription>Operational delivery concentration by industry.</CardDescription>
          </CardHeader>
          <CardContent>
            {cuByIndustryHasSignal ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.cuByIndustry.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="industry" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cuUsed" name="CU Used" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : charts.cuByIndustry.length === 1 ? (
              <LowDataChart />
            ) : (
              <EmptyChart label="No industry CU data for this period" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CU by Project</CardTitle>
            <CardDescription>Projects with the highest completed CU usage.</CardDescription>
          </CardHeader>
          <CardContent>
            {cuByProjectHasSignal ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.cuByProject.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="projectName" angle={-45} textAnchor="end" height={90} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cuUsed" name="CU Used" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : charts.cuByProject.length === 1 ? (
              <LowDataChart />
            ) : (
              <EmptyChart label="No project CU data for this period" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completed Calls by PM</CardTitle>
            <CardDescription>Operational completion volume by project manager.</CardDescription>
          </CardHeader>
          <CardContent>
            {callsByPmHasSignal ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.completedCallsByPM}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pmName" angle={-45} textAnchor="end" height={90} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completedCalls" name="Completed Calls" fill="#10b981" />
                  <Bar dataKey="cuUsed" name="CU Used" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : charts.completedCallsByPM.length === 1 ? (
              <LowDataChart />
            ) : (
              <EmptyChart label="No PM completion data for this period" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Experts</CardTitle>
          <CardDescription>Secondary operational view of completed calls and CU by expert.</CardDescription>
        </CardHeader>
        <CardContent>
          {charts.completedCallsByExpert.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 font-medium">Expert</th>
                    <th className="py-2 text-right font-medium">Completed Calls</th>
                    <th className="py-2 text-right font-medium">CU Used</th>
                  </tr>
                </thead>
                <tbody>
                  {charts.completedCallsByExpert.map((expert) => (
                    <tr key={expert.expertId} className="border-b last:border-0">
                      <td className="py-3 font-medium">{expert.expertName}</td>
                      <td className="py-3 text-right font-mono">{expert.completedCalls}</td>
                      <td className="py-3 text-right font-mono">{expert.cuUsed.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-md bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
              No expert completion data for this period.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <BarChart3 className="h-4 w-4" />
        Analytics uses completed call records only. Contract, billing, invoice, payment, and revenue logic remain in Finance.
      </div>
    </div>
  );
}
