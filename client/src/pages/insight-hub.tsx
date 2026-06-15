import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ArrowRight,
  BarChart,
  Bot,
  CheckCircle2,
  FileSearch,
  FileText,
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

const reportQualityPlaceholderPatterns = [
  /requires?\s+pm\s+review(?:\s+before\s+report\s+use)?\.?$/i,
  /requires?\s+pm\s+validation(?:\s+before\s+approval)?\.?$/i,
  /business\s+implication\s+requires?\s+pm\s+review/i,
  /confidence\s+assessment\s+has\s+not\s+been\s+structured\s+yet\.?$/i,
  /has\s+not\s+been\s+structured\s+yet\.?$/i,
  /^pending\s+review\.?$/i,
  /^tbd\.?$/i,
  /^to\s+be\s+completed\.?$/i,
  /^to\s+be\s+determined\.?$/i,
  /^not\s+provided\.?$/i,
  /^not\s+available\.?$/i,
];

type ReportQualityIssue = { field: string; reason: string };

const getReportQualityTextIssue = (field: string, value?: string | null): ReportQualityIssue | null => {
  const normalized = (value || "").trim();
  if (!normalized) return { field, reason: "Required report-quality field is empty" };

  const matchedPattern = reportQualityPlaceholderPatterns.find((pattern) => pattern.test(normalized));
  if (matchedPattern) {
    return { field, reason: `Contains internal placeholder phrase: ${normalized}` };
  }

  return null;
};

const isReportQualityTextComplete = (value?: string | null) => {
  return !getReportQualityTextIssue("field", value);
};

const getCoreObservation = (insight: Insight) => insight.coreObservation || insight.observedTrend || "-";
const getEvidenceSummary = (insight: Insight) => insight.evidenceSummary || "-";
const getBusinessImplication = (insight: Insight) => insight.businessImplication || "-";
const getConfidenceLevel = (insight: Insight) => {
  if (insight.confidenceLevel) return insight.confidenceLevel;
  if (insight.signalStrength && isReportQualityTextComplete(insight.confidenceReason)) return insight.signalStrength;
  return "Preliminary";
};
const getConfidenceReason = (insight: Insight) => insight.confidenceReason || "-";

const getReportQualityIssues = (insight: Insight) => {
  const issues: ReportQualityIssue[] = [];
  const coreObservationIssue = getReportQualityTextIssue("coreObservation", insight.coreObservation || insight.observedTrend);
  const evidenceSummaryIssue = getReportQualityTextIssue("evidenceSummary", insight.evidenceSummary);
  const businessImplicationIssue = getReportQualityTextIssue("businessImplication", insight.businessImplication);
  const confidenceReasonIssue = getReportQualityTextIssue("confidenceReason", insight.confidenceReason);

  if (coreObservationIssue) issues.push(coreObservationIssue);
  if (evidenceSummaryIssue) issues.push(evidenceSummaryIssue);
  if (businessImplicationIssue) issues.push(businessImplicationIssue);
  if (!getConfidenceLevel(insight).trim()) issues.push({ field: "confidenceLevel", reason: "Confidence level is required" });
  if (confidenceReasonIssue) issues.push(confidenceReasonIssue);
  if (getConfidenceLevel(insight).toLowerCase() === "strong" && confidenceReasonIssue) {
    issues.push({ field: "confidenceReason", reason: "Strong confidence requires a meaningful confidence reason" });
  }
  return issues;
};

const isReportReadyInsight = (insight: Insight) =>
  ["approved", "published"].includes(normalizeStatus(insight)) && getReportQualityIssues(insight).length === 0;

const getErrorMessage = (error: Error) => {
  const jsonStart = error.message.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(error.message.slice(jsonStart));
      if (parsed?.error && Array.isArray(parsed.qualityIssues) && parsed.qualityIssues.length > 0) {
        const details = parsed.qualityIssues
          .map((issue: string | ReportQualityIssue) =>
            typeof issue === "string" ? issue : `${issue.field}: ${issue.reason}`
          )
          .join("; ");
        return `${parsed.error} ${details}`;
      }
      if (parsed?.error) return parsed.error;
    } catch {
      // Fall through to the original error message.
    }
  }
  return error.message;
};

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
  confidenceLevel: "Preliminary",
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

  const approvedOrPublishedInsights = useMemo(
    () => insights.filter((insight) => ["approved", "published"].includes(normalizeStatus(insight))),
    [insights]
  );
  const reportReadyInsights = useMemo(
    () => approvedOrPublishedInsights.filter(isReportReadyInsight),
    [approvedOrPublishedInsights]
  );
  const incompleteApprovedInsights = useMemo(
    () => approvedOrPublishedInsights.filter((insight) => !isReportReadyInsight(insight)),
    [approvedOrPublishedInsights]
  );

  const summary = useMemo(() => {
    const countByStatus = (status: string) => insights.filter((insight) => normalizeStatus(insight) === status).length;
    return {
      totalDrafts: insights.length,
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
      toast({ title: "Failed to update status", description: getErrorMessage(error), variant: "destructive" });
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
      evidenceSummary: insight.evidenceSummary || "",
      businessImplication: insight.businessImplication || "",
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
    const isCurrentReviewActionPending = reviewMutation.isPending && reviewMutation.variables?.id === insight.id;
    const isApproving = isCurrentReviewActionPending && reviewMutation.variables?.reviewStatus === "approved";
    const qualityIssues = getReportQualityIssues(insight);
    const needsReportQualityCompletion = ["approved", "published"].includes(status) && qualityIssues.length > 0;
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
          {needsReportQualityCompletion && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900">
              This approved insight needs report-quality completion before it can appear in the report-ready preview:
              {" "}
              {qualityIssues.map((issue) => issue.field).join(", ")}.
            </div>
          )}
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
                disabled={reviewMutation.isPending}
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
                disabled={reviewMutation.isPending}
                className="gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                {isApproving ? "Approving..." : "Approve"}
              </Button>
            )}
            {status !== "rejected" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reviewMutation.mutate({ id: insight.id, reviewStatus: "rejected" })}
                disabled={reviewMutation.isPending}
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
    <div className="space-y-5 p-8">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 text-primary">Insight Hub</Badge>
            <Badge variant="secondary">Internal intelligence layer</Badge>
          </div>
          <div className="space-y-2">
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-foreground">
              Turning expert consultations into validated, reusable, report-ready market intelligence.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              PMs review structured drafts today; the workflow is built so automated insight capture can be connected later
              without changing the operating model.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={openManualCreate} className="gap-2" data-testid="button-add-manual-insight">
          <Plus className="h-4 w-4" />
          Add Manual Insight
        </Button>
      </div>

      <Card className="overflow-hidden border-primary/20">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Structured intelligence pipeline</p>
              <h2 className="mt-1 text-xl font-semibold">From completed calls to reusable intelligence assets</h2>
            </div>
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              Each step adds review discipline, traceability, and report readiness while keeping confidential expert details internal.
            </p>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center">
              {[
                ["Consultation Completed", "Operational source"],
                ["Insight Draft Generated", "Structured first pass"],
                ["PM Reviewed", "Context validated"],
                ["Management Approved", "Quality gate"],
                ["Report-Ready Intelligence", "Reusable asset"],
              ].map(([title, description], index, steps) => (
                <Fragment key={title}>
                  <PipelineStep index={index + 1} title={title} description={description} />
                  {index < steps.length - 1 && (
                    <div className="hidden justify-center text-muted-foreground lg:flex">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric title="Total Insight Drafts" value={summary.totalDrafts} />
        <Metric title="Pending PM Review" value={summary.pendingPmReview} />
        <Metric title="PM Reviewed" value={summary.pmReviewed} />
        <Metric title="Approved Insights" value={summary.approved} />
        <Metric title="Report-Ready Insights" value={summary.reportReady} />
        <Metric title="Published Insights" value={summary.published} />
      </div>
      <p className="text-xs text-muted-foreground">
        Report-ready requires approval plus complete evidence, implication, and confidence fields.
      </p>

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Report-Ready Intelligence Preview
          </CardTitle>
          <CardDescription>Approved or published insights shown in a lightweight client-report-like format.</CardDescription>
        </CardHeader>
        <CardContent>
          {incompleteApprovedInsights.length > 0 && (
            <div className="mb-4 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900">
              Approved insights exist, but some require report-quality completion before they can appear in the report-ready preview.
            </div>
          )}
          {reportReadyInsights.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                <div className="space-y-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">Report-ready preview will appear after approval</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Approved insights become reusable intelligence assets with observation, evidence, implication,
                      confidence, and follow-up questions ready for future report assembly.
                    </p>
                  </div>
                </div>
                <div className="rounded-md border bg-background p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview format</p>
                  <div className="mt-3 space-y-3">
                    <PreviewLine label="Core Observation" />
                    <PreviewLine label="Evidence Summary" />
                    <PreviewLine label="Business Implication" />
                    <PreviewLine label="Confidence" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              {reportReadyInsights.slice(0, 3).map((insight) => (
                <Card key={insight.id} className="border-primary/20 bg-background shadow-sm">
                  <CardHeader className="border-b pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{getInsightTitle(insight)}</CardTitle>
                        <CardDescription>{[insight.industry, insight.market, insight.geography].filter(Boolean).join(" / ")}</CardDescription>
                      </div>
                      <Badge className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-700" variant="outline">
                        Report-ready
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4 text-sm">
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
            <CompactEmpty
              icon={CheckCircle2}
              title="No completed consultations awaiting drafts"
              description="New completed consultations without insight drafts will appear here."
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
                    <CompactEmpty
                      icon={FileSearch}
                      title={`No ${tab.label.toLowerCase()} yet`}
                      description="This queue will fill as insight drafts move through review."
                    />
                  ) : (
                    <div className="grid gap-4 2xl:grid-cols-2">
                      {queueByStatus[tab.value].map(renderInsightCard)}
                    </div>
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
            <CompactEmpty
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
                          <SelectItem value="Preliminary">Preliminary</SelectItem>
                          <SelectItem value="Strong">Strong</SelectItem>
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
    <Card className="border-border/80">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function PipelineStep({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <div className="rounded-md border bg-background p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {index}
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

function PreviewLine({ label }: { label: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 h-2 w-full rounded-full bg-muted" />
      <div className="mt-1 h-2 w-2/3 rounded-full bg-muted" />
    </div>
  );
}

function CompactEmpty({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed bg-muted/20 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
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
