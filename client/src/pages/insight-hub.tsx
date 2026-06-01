import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { BarChart3, CalendarDays, Database, ExternalLink, Plus, Search, Tags, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CallRecord, Insight, InsertInsight } from "@shared/schema";
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
  ResponsiveContainer,
} from "recharts";

const ALL = "all";

const insightFormSchema = z.object({
  consultationId: z.string().min(1, "Consultation ID is required"),
  callRecordId: z.string().optional(),
  month: z.string().min(1, "Month is required"),
  callDate: z.string().min(1, "Call date is required"),
  clientType: z.string().min(1, "Client type is required"),
  industry: z.string().min(1, "Industry is required"),
  market: z.string().min(1, "Market is required"),
  geography: z.string().min(1, "Geography is required"),
  clientQuestion: z.string().min(1, "Client question is required"),
  observedTrend: z.string().min(1, "Observed trend is required"),
  keyTagsText: z.string().optional(),
  signalStrength: z.string().min(1, "Signal strength is required"),
  companyMentioned: z.string().optional(),
  expertSeniority: z.string().optional(),
  callDurationMin: z.string().optional(),
  recordingLink: z.string().optional(),
  transcriptLink: z.string().optional(),
  internalNotes: z.string().optional(),
});

type InsightFormData = z.infer<typeof insightFormSchema>;

type Filters = {
  industry: string;
  market: string;
  geography: string;
  clientType: string;
  signalStrength: string;
  companyMentioned: string;
  tag: string;
  month: string;
  search: string;
};

const defaultFilters: Filters = {
  industry: ALL,
  market: ALL,
  geography: ALL,
  clientType: ALL,
  signalStrength: ALL,
  companyMentioned: ALL,
  tag: ALL,
  month: ALL,
  search: "",
};

const signalStrengthOptions = ["Strong", "Medium", "Weak", "Emerging"];
const chartColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b)
  );

const toInputDate = (value: Date | string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
};

const formatDate = (value: Date | string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "MMM dd, yyyy");
};

const formatMonth = (value: string) => {
  if (!value) return "-";
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM yyyy");
};

const isStrongSignal = (value?: string | null) => {
  const normalized = (value || "").toLowerCase();
  return normalized.includes("strong") || normalized.includes("high");
};

const buildCountData = (values: Array<string | null | undefined>, limit = 6) => {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const key = value?.trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, limit);
};

const signalStrengthScore = (value?: string | null) => {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("strong") || normalized.includes("high")) return 4;
  if (normalized.includes("emerging")) return 3;
  if (normalized.includes("medium")) return 2;
  if (normalized.includes("weak") || normalized.includes("low")) return 1;
  return 0;
};

export default function InsightHub() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

  const { data: insights = [], isLoading } = useQuery<Insight[]>({
    queryKey: ["/api/insights"],
  });

  const { data: callRecords = [] } = useQuery<CallRecord[]>({
    queryKey: ["/api/call-records"],
  });

  const form = useForm<InsightFormData>({
    resolver: zodResolver(insightFormSchema),
    defaultValues: {
      consultationId: "",
      callRecordId: ALL,
      month: format(new Date(), "yyyy-MM"),
      callDate: format(new Date(), "yyyy-MM-dd"),
      clientType: "",
      industry: "",
      market: "",
      geography: "",
      clientQuestion: "",
      observedTrend: "",
      keyTagsText: "",
      signalStrength: "Strong",
      companyMentioned: "",
      expertSeniority: "",
      callDurationMin: "",
      recordingLink: "",
      transcriptLink: "",
      internalNotes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertInsight) => {
      const res = await apiRequest("POST", "/api/insights", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      setIsCreateOpen(false);
      form.reset({
        consultationId: "",
        callRecordId: ALL,
        month: format(new Date(), "yyyy-MM"),
        callDate: format(new Date(), "yyyy-MM-dd"),
        clientType: "",
        industry: "",
        market: "",
        geography: "",
        clientQuestion: "",
        observedTrend: "",
        keyTagsText: "",
        signalStrength: "Strong",
        companyMentioned: "",
        expertSeniority: "",
        callDurationMin: "",
        recordingLink: "",
        transcriptLink: "",
        internalNotes: "",
      });
      toast({ title: "Insight added" });
    },
    onError: () => {
      toast({ title: "Failed to add insight", variant: "destructive" });
    },
  });

  const filterOptions = useMemo(() => {
    const tags = insights.flatMap((insight) => insight.keyTags || []);
    return {
      industries: uniqueValues(insights.map((insight) => insight.industry)),
      markets: uniqueValues(insights.map((insight) => insight.market)),
      geographies: uniqueValues(insights.map((insight) => insight.geography)),
      clientTypes: uniqueValues(insights.map((insight) => insight.clientType)),
      signalStrengths: uniqueValues(insights.map((insight) => insight.signalStrength)),
      companies: uniqueValues(insights.map((insight) => insight.companyMentioned)),
      tags: uniqueValues(tags),
      months: uniqueValues(insights.map((insight) => insight.month)),
    };
  }, [insights]);

  const filteredInsights = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return insights.filter((insight) => {
      const matchesSearch =
        !search ||
        [
          insight.consultationId,
          insight.clientQuestion,
          insight.observedTrend,
          insight.industry,
          insight.market,
          insight.geography,
          insight.companyMentioned,
          insight.expertSeniority,
          insight.internalNotes,
          ...(insight.keyTags || []),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      return (
        matchesSearch &&
        (filters.industry === ALL || insight.industry === filters.industry) &&
        (filters.market === ALL || insight.market === filters.market) &&
        (filters.geography === ALL || insight.geography === filters.geography) &&
        (filters.clientType === ALL || insight.clientType === filters.clientType) &&
        (filters.signalStrength === ALL || insight.signalStrength === filters.signalStrength) &&
        (filters.companyMentioned === ALL || insight.companyMentioned === filters.companyMentioned) &&
        (filters.tag === ALL || (insight.keyTags || []).includes(filters.tag)) &&
        (filters.month === ALL || insight.month === filters.month)
      );
    });
  }, [filters, insights]);

  const summary = useMemo(() => {
    const topValue = (values: Array<string | null | undefined>) => {
      const counts = new Map<string, number>();
      values.forEach((value) => {
        const key = value?.trim();
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
    };

    return {
      total: insights.length,
      strong: insights.filter((insight) => isStrongSignal(insight.signalStrength)).length,
      topIndustry: topValue(insights.map((insight) => insight.industry)),
      topMarket: topValue(insights.map((insight) => insight.market)),
      topCompany: topValue(insights.map((insight) => insight.companyMentioned)),
    };
  }, [insights]);

  const visualData = useMemo(() => {
    const monthlyCounts = new Map<string, number>();
    filteredInsights.forEach((insight) => {
      if (!insight.month) return;
      monthlyCounts.set(insight.month, (monthlyCounts.get(insight.month) || 0) + 1);
    });

    return {
      signalStrength: buildCountData(filteredInsights.map((insight) => insight.signalStrength), 5),
      industries: buildCountData(filteredInsights.map((insight) => insight.industry), 8),
      markets: buildCountData(filteredInsights.map((insight) => insight.market), 8),
      months: Array.from(monthlyCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, signals]) => ({
          month,
          label: formatMonth(month),
          signals,
        })),
    };
  }, [filteredInsights]);

  const featuredSignals = useMemo(() => {
    return [...filteredInsights]
      .sort((a, b) => {
        const strengthDelta = signalStrengthScore(b.signalStrength) - signalStrengthScore(a.signalStrength);
        if (strengthDelta !== 0) return strengthDelta;
        return new Date(b.callDate).getTime() - new Date(a.callDate).getTime();
      })
      .slice(0, 6);
  }, [filteredInsights]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = (data: InsightFormData) => {
    const tags = (data.keyTagsText || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    createMutation.mutate({
      consultationId: data.consultationId.trim(),
      callRecordId: data.callRecordId && data.callRecordId !== ALL ? Number(data.callRecordId) : undefined,
      month: data.month,
      callDate: new Date(`${data.callDate}T00:00:00`),
      clientType: data.clientType.trim(),
      industry: data.industry.trim(),
      market: data.market.trim(),
      geography: data.geography.trim(),
      clientQuestion: data.clientQuestion.trim(),
      observedTrend: data.observedTrend.trim(),
      keyTags: tags,
      signalStrength: data.signalStrength,
      companyMentioned: data.companyMentioned?.trim() || undefined,
      expertSeniority: data.expertSeniority?.trim() || undefined,
      callDurationMin: data.callDurationMin ? Number(data.callDurationMin) : undefined,
      recordingLink: data.recordingLink?.trim() || undefined,
      transcriptLink: data.transcriptLink?.trim() || undefined,
      internalNotes: data.internalNotes?.trim() || undefined,
    });
  };

  const renderSelectFilter = (
    label: string,
    value: string,
    options: string[],
    onChange: (value: string) => void
  ) => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {label === "Month" ? formatMonth(option) : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const emptyChartState = (label: string) => (
    <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {label}
    </div>
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Insight Hub</h1>
          <p className="text-sm text-muted-foreground">
            Structured market signals captured from expert consultations.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2" data-testid="button-add-insight">
          <Plus className="h-4 w-4" />
          Add Insight
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4" />
              Total Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Strong Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.strong}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-semibold">{summary.topIndustry}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Market</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-semibold">{summary.topMarket}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Most Mentioned Company</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-semibold">{summary.topCompany}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search questions, trends, companies, notes, or tags..."
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            data-testid="input-insight-search"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {renderSelectFilter("Industry", filters.industry, filterOptions.industries, (value) =>
              updateFilter("industry", value)
            )}
            {renderSelectFilter("Market", filters.market, filterOptions.markets, (value) =>
              updateFilter("market", value)
            )}
            {renderSelectFilter("Geography", filters.geography, filterOptions.geographies, (value) =>
              updateFilter("geography", value)
            )}
            {renderSelectFilter("Client Type", filters.clientType, filterOptions.clientTypes, (value) =>
              updateFilter("clientType", value)
            )}
            {renderSelectFilter("Signal Strength", filters.signalStrength, filterOptions.signalStrengths, (value) =>
              updateFilter("signalStrength", value)
            )}
            {renderSelectFilter("Company", filters.companyMentioned, filterOptions.companies, (value) =>
              updateFilter("companyMentioned", value)
            )}
            {renderSelectFilter("Tags", filters.tag, filterOptions.tags, (value) => updateFilter("tag", value))}
            {renderSelectFilter("Month", filters.month, filterOptions.months, (value) => updateFilter("month", value))}
          </div>
          <Button variant="outline" onClick={() => setFilters(defaultFilters)} data-testid="button-clear-insight-filters">
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Visual Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            Filter-responsive views of where signals are clustering across markets, industries, and time.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="p-6">{emptyChartState("Loading signal distribution...")}</CardContent></Card>
            <Card><CardContent className="p-6">{emptyChartState("Loading industry signals...")}</CardContent></Card>
            <Card><CardContent className="p-6">{emptyChartState("Loading market signals...")}</CardContent></Card>
            <Card><CardContent className="p-6">{emptyChartState("Loading monthly trend...")}</CardContent></Card>
          </div>
        ) : filteredInsights.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              {emptyChartState(insights.length === 0 ? "No signal data yet" : "No chart data for the current filters")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signal Strength Distribution</CardTitle>
                <CardDescription>How filtered signals rank by conviction.</CardDescription>
              </CardHeader>
              <CardContent>
                {visualData.signalStrength.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={visualData.signalStrength}
                        cx="50%"
                        cy="50%"
                        dataKey="value"
                        nameKey="name"
                        outerRadius={86}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {visualData.signalStrength.map((_, index) => (
                          <Cell key={`strength-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  emptyChartState("No signal strength data")
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signals by Industry</CardTitle>
                <CardDescription>Industries generating the most structured signals.</CardDescription>
              </CardHeader>
              <CardContent>
                {visualData.industries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={visualData.industries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-35} textAnchor="end" height={80} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" name="Signals" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  emptyChartState("No industry data")
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signals by Market</CardTitle>
                <CardDescription>Market themes appearing most often in captured signals.</CardDescription>
              </CardHeader>
              <CardContent>
                {visualData.markets.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={visualData.markets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-35} textAnchor="end" height={80} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" name="Signals" fill="#16a34a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  emptyChartState("No market data")
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signals Over Time</CardTitle>
                <CardDescription>Monthly signal capture trend for the current filter set.</CardDescription>
              </CardHeader>
              <CardContent>
                {visualData.months.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={visualData.months}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="signals" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  emptyChartState("No monthly signal data")
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Signal Cards</h2>
            <p className="text-sm text-muted-foreground">
              Recent high-conviction takeaways surfaced from the current filter set.
            </p>
          </div>
          <Badge variant="secondary">{featuredSignals.length} featured</Badge>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              {emptyChartState("Loading signal cards...")}
            </CardContent>
          </Card>
        ) : featuredSignals.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              {emptyChartState(insights.length === 0 ? "No signal cards yet" : "No featured signals for these filters")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {featuredSignals.map((insight) => (
              <Card
                key={insight.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => setSelectedInsight(insight)}
                data-testid={`card-signal-${insight.id}`}
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Badge
                      className={
                        isStrongSignal(insight.signalStrength)
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : ""
                      }
                      variant={isStrongSignal(insight.signalStrength) ? "default" : "secondary"}
                    >
                      {insight.signalStrength}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(insight.callDate)}</span>
                  </div>
                  <div>
                    <CardTitle className="line-clamp-2 text-base">{insight.industry}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      {[insight.market, insight.geography].filter(Boolean).join(" / ")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Expert Takeaway</p>
                    <p className="mt-1 line-clamp-4 text-sm">{insight.observedTrend}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Client Question</p>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{insight.clientQuestion}</p>
                  </div>
                  {(insight.keyTags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(insight.keyTags || []).slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {(insight.keyTags || []).length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{(insight.keyTags || []).length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Insight Log
          </CardTitle>
          <Badge variant="secondary">{filteredInsights.length} shown</Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={11} rows={6} />
          ) : filteredInsights.length === 0 ? (
            <EmptyState
              icon={Tags}
              title={insights.length === 0 ? "No insights yet" : "No insights match these filters"}
              description={
                insights.length === 0
                  ? "Add the first structured consultation insight to start building the signal database."
                  : "Try clearing filters or searching another term."
              }
              action={
                insights.length === 0 ? (
                  <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Insight
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase">Call Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Industry</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Market</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Geography</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Client Type</TableHead>
                    <TableHead className="min-w-[240px] text-xs font-semibold uppercase">Client Question</TableHead>
                    <TableHead className="min-w-[260px] text-xs font-semibold uppercase">Observed Trend</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Key Tags</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Signal Strength</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Company</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Expert Seniority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInsights.map((insight) => (
                    <TableRow
                      key={insight.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedInsight(insight)}
                      data-testid={`row-insight-${insight.id}`}
                    >
                      <TableCell className="font-mono text-xs">{formatDate(insight.callDate)}</TableCell>
                      <TableCell>{insight.industry}</TableCell>
                      <TableCell>{insight.market}</TableCell>
                      <TableCell>{insight.geography}</TableCell>
                      <TableCell>{insight.clientType}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{insight.clientQuestion}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{insight.observedTrend}</TableCell>
                      <TableCell>
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {(insight.keyTags || []).slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {(insight.keyTags || []).length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(insight.keyTags || []).length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            isStrongSignal(insight.signalStrength)
                              ? "bg-green-500/10 text-green-600 border-green-500/20"
                              : ""
                          }
                          variant={isStrongSignal(insight.signalStrength) ? "default" : "secondary"}
                        >
                          {insight.signalStrength}
                        </Badge>
                      </TableCell>
                      <TableCell>{insight.companyMentioned || "-"}</TableCell>
                      <TableCell>{insight.expertSeniority || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedInsight} onOpenChange={(open) => !open && setSelectedInsight(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Insight Detail</DialogTitle>
            <DialogDescription>Read-only structured market signal record.</DialogDescription>
          </DialogHeader>
          {selectedInsight && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <DetailField label="Consultation ID" value={selectedInsight.consultationId} />
                <DetailField label="Call Date" value={formatDate(selectedInsight.callDate)} />
                <DetailField label="Month" value={formatMonth(selectedInsight.month)} />
                <DetailField label="Client Type" value={selectedInsight.clientType} />
                <DetailField label="Industry" value={selectedInsight.industry} />
                <DetailField label="Market" value={selectedInsight.market} />
                <DetailField label="Geography" value={selectedInsight.geography} />
                <DetailField label="Signal Strength" value={selectedInsight.signalStrength} />
                <DetailField label="Company Mentioned" value={selectedInsight.companyMentioned || "-"} />
                <DetailField label="Expert Seniority" value={selectedInsight.expertSeniority || "-"} />
                <DetailField
                  label="Call Duration"
                  value={selectedInsight.callDurationMin ? `${selectedInsight.callDurationMin} min` : "-"}
                />
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Consultation Link</p>
                  {selectedInsight.callRecordId ? (
                    <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href="/consultations">
                      Open consultations <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-sm">Stored as text only</p>
                  )}
                </div>
              </div>

              <DetailBlock label="Client Question" value={selectedInsight.clientQuestion} />
              <DetailBlock label="Observed Trend" value={selectedInsight.observedTrend} />

              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Key Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(selectedInsight.keyTags || []).length > 0 ? (
                    selectedInsight.keyTags!.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No tags</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <LinkField label="Recording Link" url={selectedInsight.recordingLink} />
                <LinkField label="Transcript Link" url={selectedInsight.transcriptLink} />
              </div>

              <DetailBlock label="Internal Notes" value={selectedInsight.internalNotes || "-"} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Insight</DialogTitle>
            <DialogDescription>
              Manually add a structured market signal from an expert consultation.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="consultationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consultation ID *</FormLabel>
                      <FormControl>
                        <Input placeholder="CONS-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="callRecordId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Related Consultation</FormLabel>
                      <Select value={field.value || ALL} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={ALL}>Text ID only</SelectItem>
                          {callRecords.map((record) => (
                            <SelectItem key={record.id} value={record.id.toString()}>
                              #{record.id} - {formatDate(record.callDate)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month *</FormLabel>
                      <FormControl>
                        <Input type="month" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="callDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Call Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} onChange={(event) => {
                          field.onChange(event);
                          if (event.target.value) form.setValue("month", event.target.value.slice(0, 7));
                        }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <TextInputField control={form.control} name="clientType" label="Client Type *" placeholder="Corporate, PE, VC..." />
                <TextInputField control={form.control} name="industry" label="Industry *" placeholder="Payments, Healthcare..." />
                <TextInputField control={form.control} name="market" label="Market *" placeholder="Digital wallets" />
                <TextInputField control={form.control} name="geography" label="Geography *" placeholder="Brazil, LATAM..." />
                <FormField
                  control={form.control}
                  name="signalStrength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signal Strength *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {signalStrengthOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <TextInputField control={form.control} name="companyMentioned" label="Company Mentioned" placeholder="Company name" />
                <TextInputField control={form.control} name="expertSeniority" label="Expert Seniority" placeholder="VP, C-level, Director..." />
                <FormField
                  control={form.control}
                  name="callDurationMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Call Duration Min</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="60" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="clientQuestion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Question *</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="What was the client trying to learn?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="observedTrend"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observed Trend *</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="What market signal or pattern was observed?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="keyTagsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="payments, regulation, churn" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <TextInputField control={form.control} name="recordingLink" label="Recording Link" placeholder="https://..." />
                <TextInputField control={form.control} name="transcriptLink" label="Transcript Link" placeholder="https://..." />
              </div>

              <FormField
                control={form.control}
                name="internalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Internal interpretation, caveats, or follow-up notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save Insight"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "-"}</p>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value || "-"}</p>
    </div>
  );
}

function LinkField({ label, url }: { label: string; url?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Open link <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <p className="text-sm">-</p>
      )}
    </div>
  );
}

function TextInputField({
  control,
  name,
  label,
  placeholder,
}: {
  control: any;
  name: keyof InsightFormData;
  label: string;
  placeholder?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
