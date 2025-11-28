import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TrendingUp, Users, Briefcase, DollarSign } from "lucide-react";
import type { Project, Expert, UsageRecord } from "@shared/schema";

export default function Analytics() {
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  const { data: experts, isLoading: expertsLoading } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });
  const { data: usageRecords, isLoading: usageLoading } = useQuery<UsageRecord[]>({
    queryKey: ["/api/usage"],
  });

  const isLoading = projectsLoading || expertsLoading || usageLoading;

  // Calculate metrics
  const totalProjects = projects?.length || 0;
  const totalExperts = experts?.length || 0;
  const totalCallMinutes =
    usageRecords?.reduce((sum, record) => sum + record.durationMinutes, 0) || 0;
  const totalCreditsUsed =
    usageRecords?.reduce((sum, record) => sum + Number(record.creditsUsed), 0) || 0;

  // Project pipeline by status
  const projectPipelineData = (projects || []).reduce(
    (acc: Record<string, number>, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    },
    {}
  );

  const projectStatusChartData = Object.entries(projectPipelineData).map(
    ([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      status,
    })
  );

  // Expert utilization by industry
  const expertByIndustry = (experts || []).reduce(
    (acc: Record<string, number>, expert) => {
      acc[expert.industry] = (acc[expert.industry] || 0) + 1;
      return acc;
    },
    {}
  );

  const expertUtilizationData = Object.entries(expertByIndustry)
    .map(([industry, count]) => ({
      name: industry,
      experts: count,
    }))
    .sort((a, b) => b.experts - a.experts)
    .slice(0, 8);

  // Revenue metrics by expert
  const revenueByExpert = (usageRecords || []).reduce(
    (acc: Record<string, { calls: number; revenue: number }>, record) => {
      const expertId = record.expertId;
      const expert = experts?.find((e) => e.id === expertId);
      const name = expert?.name || `Expert ${expertId}`;

      if (!acc[name]) {
        acc[name] = { calls: 0, revenue: 0 };
      }
      acc[name].calls += 1;
      acc[name].revenue += Number(record.creditsUsed);
      return acc;
    },
    {}
  );

  const revenueData = Object.entries(revenueByExpert)
    .map(([name, data]) => ({
      name,
      calls: data.calls,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Call volume trend by day
  const callVolumeByDay = (usageRecords || []).reduce(
    (acc: Record<string, number>, record) => {
      const date = new Date(record.callDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    },
    {}
  );

  const callVolumeData = Object.entries(callVolumeByDay)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-14)
    .map(([date, count]) => ({
      date,
      calls: count,
    }));

  const COLORS = ["#3b82f6", "#ef4444", "#8b5cf6", "#f59e0b", "#10b981", "#06b6d4"];

  const SkeletonCard = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-20" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            View detailed metrics and performance insights.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
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
          View detailed metrics and performance insights.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {projects?.filter((p) => p.status !== "completed").length || 0} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expert Network</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExperts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {experts?.filter((e) => e.status === "available").length || 0} available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Call Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{totalCallMinutes}</div>
            <p className="text-xs text-muted-foreground mt-1">minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{totalCreditsUsed.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground mt-1">consumed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {projectStatusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={projectStatusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {projectStatusChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No projects yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expert Utilization by Industry</CardTitle>
          </CardHeader>
          <CardContent>
            {expertUtilizationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={expertUtilizationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="experts" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No experts yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Revenue by Expert</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="calls" fill="#8b5cf6" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No usage records yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Call Volume Trend (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {callVolumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={callVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="calls" stroke="#3b82f6" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No usage records yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
