import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  BarChart,
  Bot,
  CheckCircle2,
  FileSearch,
  Layers3,
  Pencil,
  Plus,
  Sparkles,
  XCircle,
} from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CallRecord, Insight, InsertInsight } from "@shared/schema";

const reviewTabs = [
  { value: "ai_draft", label: "AI Drafts" },
  { value: "pm_reviewed", label: "PM Reviewed" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

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
  insightTitle: z.string().min(1, "Insight title is required"),
  coreObservation: z.string().min(1, "Core observation is required"),
  evidenceSummary: z.string().min(1, "Evidence summary is required"),
  businessImplication: z.string().min(1, "Business implication is required"),
  signalType: z.string().optional(),
  confidenceLevel: z.string().min(1, "Confidence level is required"),
  confidenceReason: z.string().optional(),
  recommendedFollowUpQuestionsText: z.string().optional(),
  keyTagsText: z.string().optional(),
  expertSeniority: z.string().optional(),
  callDurationMin: z.string().optional(),
  recordingLink: z.string().optional(),
  transcriptLink: z.string().optional(),
  internalNotes: z.string().optional(),
  reviewStatus: z.string().optional(),
});

type InsightFormData = z.infer<typeof insightFormSchema>;

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "MMM dd, yyyy");
};

const formatMonth = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM yyyy");
};

const normalizeStatus = (insight: Insight) => insight.reviewStatus || "pm_reviewed";

const getInsightTitle = (insight: Insight) =>
  insight.insightTitle || `${insight.industry || "Market"} insight from ${formatDate(insight.callDate)}`;

const getCoreObservation = (insight: Insight) => insight.coreObservation || insight.observedTrend || "-";
const getEvidenceSummary = (insight: Insight) =>
  insight.evidenceSummary || `Captured from consultation ${insight.consultationId || insight.callRecordId || ""}`.trim();
const getBusinessImplication = (insight: Insight) =>
  insight.businessImplication || "Business implication requires PM review before report use.";
const getConfidenceLevel = (insight: Insight) => insight.confidenceLevel || insight.signalStrength || "Medium";
const getConfidenceReason = (insight: Insight) =>
  insight.confidenceReason || "Confidence assessment has not been structured yet.";

const statusBadgeClass = (status: string) => {
  if (status === "approved" || status === "published") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "ai_draft") return "border-blue-500/30 bg-blue-500/10 text-blue-700";
  if (status === "rejected") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "";
};

const toLines = (value?: string | null) =>
  (value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

const defaultFormValues = (): InsightFormData => ({
  consultationId: "",
  callRecordId: "",
  month: format(new Date(), "yyyy-MM"),
  callDate: format(new Date(), "yyyy-MM-dd"),
  clientType: "Client",
  industry: "",
  market: "",
  geography: "",
  clientQuestion: "",
  insightTitle: "",
  coreObservation: "",
  evidenceSummary: "",
  businessImplication: "",
  signalType: "Market Signal",
  confidenceLevel: "Medium",
  confidenceReason: "",
  recommendedFollowUpQuestionsText: "",
  keyTagsText: "",
  expertSeniority: "",
  callDurationMin: "",
  recordingLink: "",
  transcriptLink: "",
  internalNotes: "",
  reviewStatus: "pm_reviewed",
});

export default function InsightHub() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("ai_draft");
  const [editingInsight, setEditingInsight] = useState<Insight | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: insights = [], isLoading } = useQuery<Insight[]>({
    queryKey: ["/api/insights"],
  });

  const { data: callRecords = [] } = useQuery<CallRecord[]>({
    queryKey: ["/api/call-records"],
  });

  const form = useForm<InsightFormData>({
    resolver: zodResolver(insightFormSchema),
    defaultValues: defaultFormValues(),
  });

  const insightByCallRecordId = useMemo(() => {
    const map = new Map<number, Insight>();
    insights.forEach((insight) => {
      if (insight.callRecordId) map.set(insight.callRecordId, insight);
    });
    return map;
  }, [insights]);

  const completedCallsWithoutInsights = useMemo(
    () =>
      callRecords
        .filter((record) => record.status === "completed" && !insightByCallRecordId.has(record.id))
        .slice(0, 8),
    [callRecords, insightByCallRecordId]
  );

  const reportReadyInsights = useMemo(
    () => insights.filter((insight) => ["approved", "published"].includes(normalizeStatus(insight))),
    [insights]
  );

  const summary = useMemo(() => {
    const countByStatus = (status: string) => insights.filter((insight) => normalizeStatus(insight) === status).length;
    return {
      totalDrafts: insights.filter((insight) => ["ai_draft", "pm_reviewed"].includes(normalizeStatus(insight))).length,
      pendingPmReview: countByStatus("ai_draft"),
      pmReviewed: countByStatus("pm_reviewed"),
      approved: countByStatus("approved"),
      reportReady: reportReadyInsights.length,
      published: countByStatus("published"),
    };
  }, [insights, reportReadyInsights.length]);

  const queueByStatus = useMemo(() => {
    return reviewTabs.reduce<Record<string, Insight[]>>((acc, tab) => {
      acc[tab.value] = insights
        .filter((insight) => normalizeStatus(insight) === tab.value)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return acc;
    }, {});
  }, [insights]);

  const generateDraftMutation = useMutation({
    mutationFn: async (callRecordId: number) => {
      const res = await apiRequest("POST", "/api/insights/generate-draft", { callRecordId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      toast({ title: "Insight draft generated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate draft", description: error.message, variant: "destructive" });
    },
  });

  const saveInsightMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: InsertInsight }) => {
      const res = id
        ? await apiRequest("PATCH", `/api/insights/${id}`, data)
        : await apiRequest("POST", "/api/insights", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      setEditingInsight(null);
      setIsCreateOpen(false);
      form.reset(defaultFormValues());
      toast({ title: "Insight saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save insight", description: error.message, variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, reviewStatus }: { id: number; reviewStatus: string }) => {
      const res = await apiRequest("POST", `/api/insights/${id}/review`, { reviewStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      toast({ title: "Insight status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const openManualCreate = () => {
    setEditingInsight(null);
    form.reset(defaultFormValues());
    setIsCreateOpen(true);
  };

  const openEdit = (insight: Insight) => {
    setEditingInsight(insight);
    form.reset({
      consultationId: insight.consultationId || "",
      callRecordId: insight.callRecordId ? String(insight.callRecordId) : "",
      month: insight.month || format(new Date(), "yyyy-MM"),
      callDate: insight.callDate ? format(new Date(insight.callDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      clientType: insight.clientType || "Client",
      industry: insight.industry || "",
      market: insight.market || "",
      geography: insight.geography || "",
      clientQuestion: insight.clientQuestion || "",
      insightTitle: getInsightTitle(insight),
      coreObservation: getCoreObservation(insight),
      evidenceSummary: getEvidenceSummary(insight),
      businessImplication: getBusinessImplication(insight),
      signalType: insight.signalType || "Market Signal",
      confidenceLevel: getConfidenceLevel(insight),
      confidenceReason: insight.confidenceReason || "",
      recommendedFollowUpQuestionsText: (insight.recommendedFollowUpQuestions || []).join("\n"),
      keyTagsText: (insight.keyTags || []).join(", "),
      expertSeniority: insight.expertSeniority || "",
      callDurationMin: insight.callDurationMin ? String(insight.callDurationMin) : "",
      recordingLink: insight.recordingLink || "",
      transcriptLink: insight.transcriptLink || "",
      internalNotes: insight.internalNotes || "",
      reviewStatus: normalizeStatus(insight),
    });
    setIsCreateOpen(true);
  };

  const onSubmit = (data: InsightFormData) => {
    const keyTags = (data.keyTagsText || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    const recommendedFollowUpQuestions = toLines(data.recommendedFollowUpQuestionsText);
    const payload: InsertInsight = {
      consultationId: data.consultationId.trim(),
      callRecordId: data.callRecordId ? Number(data.callRecordId) : undefined,
      month: data.month,
      callDate: new Date(`${data.callDate}T00:00:00`),
      clientType: data.clientType.trim(),
      industry: data.industry.trim(),
      market: data.market.trim(),
      geography: data.geography.trim(),
      clientQuestion: data.clientQuestion.trim(),
      observedTrend: data.coreObservation.trim(),
      keyTags,
      signalStrength: data.confidenceLevel,
      companyMentioned: undefined,
      expertSeniority: data.expertSeniority?.trim() || undefined,
      callDurationMin: data.callDurationMin ? Number(data.callDurationMin) : undefined,
      recordingLink: data.recordingLink?.trim() || undefined,
      transcriptLink: data.transcriptLink?.trim() || undefined,
      pmNotes: data.internalNotes?.trim() || undefined,
      insightTitle: data.insightTitle.trim(),
      coreObservation: data.coreObservation.trim(),
      evidenceSummary: data.evidenceSummary.trim(),
      businessImplication: data.businessImplication.trim(),
      signalType: data.signalType?.trim() || "Market Signal",
      confidenceLevel: data.confidenceLevel,
      confidenceReason: data.confidenceReason?.trim() || undefined,
      recommendedFollowUpQuestions,
      reportVisibility: "internal",
      reviewStatus: data.reviewStatus || "pm_reviewed",
      sourceType: editingInsight?.sourceType || "manual",
      internalNotes: data.internalNotes?.trim() || undefined,
    };
    saveInsightMutation.mutate({ id: editingInsight?.id, data: payload });
  };

  const renderInsightCard = (insight: Insight) => {
    const status = normalizeStatus(insight);
    const followUps = insight.recommendedFollowUpQuestions || [];
    return (
      <Card key={insight.id} className="border-border/80">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">{getInsightTitle(insight)}</CardTitle>
              <CardDescription>
                {[insight.market, insight.geography, insight.industry].filter(Boolean).join(" / ") || "Market context pending"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={statusBadgeClass(status)}>
                {reviewTabs.find((tab) => tab.value === status)?.label || status}
              </Badge>
              <Badge variant="secondary">{getConfidenceLevel(insight)}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <InsightBlock label="Core Observation" value={getCoreObservation(insight)} />
            <InsightBlock label="Business Implication" value={getBusinessImplication(insight)} />
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <Meta label="Project" value={insight.market || "-"} />
            <Meta label="Client" value={insight.clientType || "Internal"} />
            <Meta label="Created" value={formatDate(insight.createdAt)} />
            <Meta label="Source" value={insight.sourceType || "manual"} />
          </div>
          {followUps.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Recommended Follow-up Questions</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {followUps.slice(0, 3).map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => openEdit(insight)} className="gap-1">
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            {status === "ai_draft" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reviewMutation.mutate({ id: insight.id, reviewStatus: "pm_reviewed" })}
                className="gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Mark PM Reviewed
              </Button>
            )}
            {status !== "approved" && status !== "published" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reviewMutation.mutate({ id: insight.id, reviewStatus: "approved" })}
                className="gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Approve
              </Button>
            )}
            {status !== "rejected" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reviewMutation.mutate({ id: insight.id, reviewStatus: "rejected" })}
                className="gap-1 text-destructive"
              >
                <XCircle className="h-3 w-3" />
                Reject
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Insight Hub</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Insight Hub converts expert consultation outputs into structured, validated, and reusable market intelligence.
            Today, PMs capture and review insights manually, but the workflow is designed to become AI-assisted over time.
          </p>
        </div>
        <Button variant="outline" onClick={openManualCreate} className="gap-2" data-testid="button-add-manual-insight">
          <Plus className="h-4 w-4" />
          Add Manual Insight
        </Button>
      </div>

      <Card className="overflow-hidden border-primary/20">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-wide text-primary">Structured intelligence pipeline</p>
              <h2 className="text-2xl font-semibold">From consultation output to report-ready intelligence</h2>
            </div>
            <Badge variant="secondary" className="w-fit">AI-ready workflow, deterministic placeholder generation</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {["Consultation Completed", "Insight Draft Generated", "PM Reviewed", "Management Approved", "Report-Ready Intelligence"].map((step, index) => (
              <div key={step} className="rounded-md border bg-muted/20 p-4">
                <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <p className="text-sm font-medium">{step}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric title="Total Insight Drafts" value={summary.totalDrafts} />
        <Metric title="Pending PM Review" value={summary.pendingPmReview} />
        <Metric title="PM Reviewed" value={summary.pmReviewed} />
        <Metric title="Approved Insights" value={summary.approved} />
        <Metric title="Report-Ready Insights" value={summary.reportReady} />
        <Metric title="Published Insights" value={summary.published} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Report-Ready Intelligence Preview
          </CardTitle>
          <CardDescription>Approved or published insights shown in a lightweight client-report-like format.</CardDescription>
        </CardHeader>
        <CardContent>
          {reportReadyInsights.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="No report-ready intelligence yet"
              description="Approved and published insights will appear here as reusable intelligence assets."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              {reportReadyInsights.slice(0, 3).map((insight) => (
                <Card key={insight.id} className="bg-muted/20">
                  <CardHeader>
                    <CardTitle className="text-base">{getInsightTitle(insight)}</CardTitle>
                    <CardDescription>{[insight.industry, insight.market, insight.geography].filter(Boolean).join(" / ")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <InsightBlock label="Core Observation" value={getCoreObservation(insight)} />
                    <InsightBlock label="Evidence Summary" value={getEvidenceSummary(insight)} />
                    <InsightBlock label="Business Implication" value={getBusinessImplication(insight)} />
                    <InsightBlock label="Confidence" value={`${getConfidenceLevel(insight)} - ${getConfidenceReason(insight)}`} />
                    {(insight.recommendedFollowUpQuestions || []).length > 0 && (
                      <InsightBlock label="Recommended Follow-up" value={(insight.recommendedFollowUpQuestions || []).join("\n")} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Consultation-to-Insight Draft Flow
          </CardTitle>
          <CardDescription>Generate placeholder drafts from completed consultations. Real AI can be connected later.</CardDescription>
        </CardHeader>
        <CardContent>
          {completedCallsWithoutInsights.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No completed consultations awaiting drafts"
              description="Completed consultations that do not yet have insight drafts will appear here."
            />
          ) : (
            <div className="grid gap-3">
              {completedCallsWithoutInsights.map((record) => (
                <div key={record.id} className="flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">Completed consultation #{record.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(record.completedAt || record.callDate)} / {record.actualDurationMinutes || record.durationMinutes} min / {record.cuUsed} CU
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => generateDraftMutation.mutate(record.id)}
                    disabled={generateDraftMutation.isPending}
                    data-testid={`button-generate-insight-${record.id}`}
                  >
                    Generate Insight Draft
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="h-4 w-4" />
            Insight Review Queue
          </CardTitle>
          <CardDescription>PMs validate drafts; management approves report-ready intelligence.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={4} rows={5} />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex h-auto flex-wrap justify-start">
                {reviewTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label} ({queueByStatus[tab.value]?.length || 0})
                  </TabsTrigger>
                ))}
              </TabsList>
              {reviewTabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="mt-4 space-y-4">
                  {(queueByStatus[tab.value]?.length || 0) === 0 ? (
                    <EmptyState
                      icon={FileSearch}
                      title={`No ${tab.label.toLowerCase()} yet`}
                      description="Insights will appear here as the review workflow progresses."
                    />
                  ) : (
                    queueByStatus[tab.value].map(renderInsightCard)
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart className="h-4 w-4" />
            Insight Analytics
          </CardTitle>
          <CardDescription>Analytics become more useful as approved intelligence accumulates.</CardDescription>
        </CardHeader>
        <CardContent>
          {reportReadyInsights.length < 5 ? (
            <EmptyState
              icon={BarChart}
              title="Analytics will unlock after more validated insights"
              description="Capture and approve at least five insights before relying on trend analytics."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <Metric title="Industries Covered" value={new Set(reportReadyInsights.map((item) => item.industry)).size} />
              <Metric title="Markets Covered" value={new Set(reportReadyInsights.map((item) => item.market)).size} />
              <Metric title="High Confidence" value={reportReadyInsights.filter((item) => getConfidenceLevel(item).toLowerCase().includes("high")).length} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) setEditingInsight(null);
      }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInsight ? "Edit Insight" : "Add Manual Insight"}</DialogTitle>
            <DialogDescription>
              Use the same structured fields and review workflow as generated drafts.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <TextField control={form.control} name="consultationId" label="Consultation ID" />
                <TextField control={form.control} name="callRecordId" label="Call Record ID" />
                <TextField control={form.control} name="callDate" label="Call Date" type="date" />
                <TextField control={form.control} name="month" label="Month" type="month" />
                <TextField control={form.control} name="industry" label="Industry" />
                <TextField control={form.control} name="market" label="Market" />
                <TextField control={form.control} name="geography" label="Geography" />
                <TextField control={form.control} name="clientType" label="Client Type" />
                <TextField control={form.control} name="expertSeniority" label="Expert Seniority" />
              </div>
              <TextField control={form.control} name="insightTitle" label="Insight Title" />
              <TextareaField control={form.control} name="clientQuestion" label="Client Question" />
              <TextareaField control={form.control} name="coreObservation" label="Core Observation" />
              <TextareaField control={form.control} name="evidenceSummary" label="Evidence Summary" />
              <TextareaField control={form.control} name="businessImplication" label="Business Implication" />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField control={form.control} name="signalType" label="Signal Type" />
                <FormField
                  control={form.control}
                  name="confidenceLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confidence Level</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Emerging">Emerging</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <TextareaField control={form.control} name="confidenceReason" label="Confidence Reason" />
              <TextareaField control={form.control} name="recommendedFollowUpQuestionsText" label="Recommended Follow-up Questions" placeholder="One question per line" />
              <TextField control={form.control} name="keyTagsText" label="Key Tags" placeholder="Comma-separated tags" />
              <TextareaField control={form.control} name="internalNotes" label="Internal Notes" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveInsightMutation.isPending}>
                  {saveInsightMutation.isPending ? "Saving..." : "Save Insight"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate">{value}</p>
    </div>
  );
}

function InsightBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{value || "-"}</p>
    </div>
  );
}

function TextField({ control, name, label, type = "text", placeholder }: any) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} placeholder={placeholder} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TextareaField({ control, name, label, placeholder }: any) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea rows={4} placeholder={placeholder} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
