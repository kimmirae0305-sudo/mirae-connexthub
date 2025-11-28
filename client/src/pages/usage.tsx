import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { Plus, Clock, CreditCard, BarChart3, Download, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MetricCard } from "@/components/metric-card";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import type { Project, Expert, UsageRecord, InsertUsageRecord } from "@shared/schema";

const usageFormSchema = z.object({
  projectId: z.coerce.number().min(1, "Please select a project"),
  expertId: z.coerce.number().min(1, "Please select an expert"),
  callDate: z.string().min(1, "Call date is required"),
  durationMinutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
  creditsUsed: z.string().min(1, "Credits used is required"),
  notes: z.string().optional(),
});

type UsageFormData = z.infer<typeof usageFormSchema>;

const CREDIT_RATE = 0.5;
const MONTHLY_CREDIT_BUDGET = 1000;

export default function Usage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<UsageRecord | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: experts, isLoading: expertsLoading } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const { data: usageRecords, isLoading: usageLoading } = useQuery<UsageRecord[]>({
    queryKey: ["/api/usage"],
  });

  const form = useForm<UsageFormData>({
    resolver: zodResolver(usageFormSchema),
    defaultValues: {
      projectId: 0,
      expertId: 0,
      callDate: format(new Date(), "yyyy-MM-dd"),
      durationMinutes: 30,
      creditsUsed: "15",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertUsageRecord) => apiRequest("POST", "/api/usage", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Usage record added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add usage record", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/usage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
      setDeletingRecord(null);
      toast({ title: "Usage record deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete record", variant: "destructive" });
    },
  });

  const totalMinutes = usageRecords?.reduce((sum, r) => sum + r.durationMinutes, 0) || 0;
  const totalCredits = usageRecords?.reduce((sum, r) => sum + Number(r.creditsUsed), 0) || 0;
  const totalCalls = usageRecords?.length || 0;
  const averageDuration = totalCalls > 0 ? Math.round(totalMinutes / totalCalls) : 0;
  const creditUsagePercent = Math.min((totalCredits / MONTHLY_CREDIT_BUDGET) * 100, 100);

  const getProjectName = (projectId: number) =>
    projects?.find((p) => p.id === projectId)?.name || "Unknown";
  const getExpertName = (expertId: number) =>
    experts?.find((e) => e.id === expertId)?.name || "Unknown";

  const handleDurationChange = (minutes: number) => {
    form.setValue("durationMinutes", minutes);
    form.setValue("creditsUsed", (minutes * CREDIT_RATE).toFixed(2));
  };

  const onSubmit = (data: UsageFormData) => {
    const usageData: InsertUsageRecord = {
      ...data,
      callDate: new Date(data.callDate),
      notes: data.notes || null,
    };
    createMutation.mutate(usageData);
  };

  const exportToCSV = () => {
    if (!usageRecords?.length) return;

    const headers = ["Date", "Project", "Expert", "Duration (min)", "Credits Used", "Notes"];
    const rows = usageRecords.map((r) => [
      format(new Date(r.callDate), "yyyy-MM-dd"),
      getProjectName(r.projectId),
      getExpertName(r.expertId),
      r.durationMinutes,
      r.creditsUsed,
      r.notes || "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Report exported successfully" });
  };

  const isLoading = projectsLoading || expertsLoading || usageLoading;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Usage Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Track call durations and credit consumption.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={!usageRecords?.length}
            className="gap-2"
            data-testid="button-export-usage"
          >
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="gap-2"
            disabled={!projects?.length || !experts?.length}
            data-testid="button-log-usage"
          >
            <Plus className="h-4 w-4" /> Log Usage
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Calls"
          value={totalCalls}
          subtitle="All time"
          icon={BarChart3}
        />
        <MetricCard
          title="Total Minutes"
          value={totalMinutes.toLocaleString()}
          subtitle={`~${Math.round(totalMinutes / 60)} hours`}
          icon={Clock}
        />
        <MetricCard
          title="Credits Used"
          value={totalCredits.toFixed(2)}
          subtitle={`of ${MONTHLY_CREDIT_BUDGET} budget`}
          icon={CreditCard}
        />
        <MetricCard
          title="Avg. Duration"
          value={`${averageDuration} min`}
          subtitle="Per call"
          icon={Clock}
        />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-medium">Credit Usage</CardTitle>
            <span className="font-mono text-sm text-muted-foreground">
              {totalCredits.toFixed(2)} / {MONTHLY_CREDIT_BUDGET} CU
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={creditUsagePercent} className="h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {creditUsagePercent.toFixed(1)}% of monthly budget used
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Usage History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={6} rows={5} />
          ) : !usageRecords?.length ? (
            <EmptyState
              icon={BarChart3}
              title="No usage records"
              description="Log your first call to start tracking usage."
              action={
                projects?.length && experts?.length ? (
                  <Button onClick={() => setIsDialogOpen(true)} className="gap-2" data-testid="button-log-first-usage">
                    <Plus className="h-4 w-4" /> Log Usage
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">
                      Duration
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">
                      Credits
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageRecords
                    .sort((a, b) => new Date(b.callDate).getTime() - new Date(a.callDate).getTime())
                    .map((record) => (
                      <TableRow key={record.id} data-testid={`row-usage-${record.id}`}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(record.callDate), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>{getProjectName(record.projectId)}</TableCell>
                        <TableCell>{getExpertName(record.expertId)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {record.durationMinutes} min
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(record.creditsUsed).toFixed(2)} CU
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingRecord(record)}
                            data-testid={`button-delete-usage-${record.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Usage</DialogTitle>
            <DialogDescription>Record a call session with an expert.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project *</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-usage-project">
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
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
                name="expertId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expert *</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-usage-expert">
                          <SelectValue placeholder="Select an expert" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {experts?.map((expert) => (
                          <SelectItem key={expert.id} value={expert.id.toString()}>
                            {expert.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="callDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Call Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-call-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (minutes) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => handleDurationChange(Number(e.target.value))}
                          data-testid="input-duration"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="creditsUsed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credits Used *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        data-testid="input-credits"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Auto-calculated at {CREDIT_RATE} CU per minute
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes about the call..."
                        className="resize-none"
                        rows={2}
                        {...field}
                        data-testid="input-usage-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-usage"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-save-usage"
                >
                  {createMutation.isPending ? "Saving..." : "Log Usage"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Usage Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this usage record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-usage">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRecord && deleteMutation.mutate(deletingRecord.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-usage"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
