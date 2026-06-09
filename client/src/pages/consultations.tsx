import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { Phone, Calendar, Clock, Video, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import type { CallRecord, Project, Expert } from "@shared/schema";

const completeFormSchema = z.object({
  actualDurationMinutes: z.number().min(1, "Duration is required"),
  recordingUrl: z.string().optional(),
  notes: z.string().optional(),
});

type CompleteFormData = z.infer<typeof completeFormSchema>;

function getStatusIcon(status: string) {
  switch (status) {
    case "scheduled":
      return <Calendar className="h-4 w-4 text-blue-500" />;
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    scheduled: "default",
    completed: "secondary",
    cancelled: "destructive",
    pending: "outline",
  };
  return (
    <Badge variant={variants[status] || "outline"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function Consultations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");

  const { data: callRecords, isLoading } = useQuery<CallRecord[]>({
    queryKey: ["/api/call-records"],
  });
  
  const isRA = user?.role === "ra";

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: experts } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const completeForm = useForm<CompleteFormData>({
    resolver: zodResolver(completeFormSchema),
    defaultValues: {
      actualDurationMinutes: 30,
      recordingUrl: "",
      notes: "",
    },
  });

  const completeMutation = useMutation({
    mutationFn: (data: CompleteFormData) =>
      apiRequest("POST", `/api/call-records/${selectedCall?.id}/complete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-records"] });
      setIsCompleteDialogOpen(false);
      setSelectedCall(null);
      completeForm.reset();
      toast({ title: "Call marked as completed" });
    },
    onError: () => {
      toast({ title: "Failed to complete call", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/call-records/${id}/cancel`, { reason: "Cancelled by admin" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-records"] });
      toast({ title: "Call cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel call", variant: "destructive" });
    },
  });

  const filteredRecords = callRecords?.filter((record) => {
    if (statusFilter !== "all" && record.status !== statusFilter) return false;
    const callDate = new Date(record.callDate);
    if (fromDateFilter && callDate < new Date(`${fromDateFilter}T00:00:00`)) return false;
    if (toDateFilter && callDate > new Date(`${toDateFilter}T23:59:59`)) return false;
    return true;
  });

  const onCompleteSubmit = (data: CompleteFormData) => {
    completeMutation.mutate(data);
  };

  const getProjectName = (projectId: number) => {
    return projects?.find((p) => p.id === projectId)?.name || "Unknown";
  };

  const getExpertName = (expertId: number) => {
    return experts?.find((e) => e.id === expertId)?.name || "Unknown";
  };

  const totalCuUsed = callRecords
    ?.filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + parseFloat(r.cuUsed || "0"), 0) || 0;

  const scheduledCalls = callRecords?.filter((r) => r.status === "pending" || r.status === "scheduled").length || 0;
  const completedCalls = callRecords?.filter((r) => r.status === "completed").length || 0;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Consultations</h1>
          <p className="text-sm text-muted-foreground">
            {isRA ? "Monitor calls for your assigned projects." : "Monitor consultations across projects. Schedule new calls from Project Details."}
          </p>
        </div>
      </div>

      <div className={`grid gap-4 ${isRA ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <Calendar className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{scheduledCalls}</p>
              <p className="text-sm text-muted-foreground">Scheduled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCalls}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        {!isRA && (
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCuUsed.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">Total CU Used</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-medium">All Consultations</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={fromDateFilter}
                onChange={(event) => setFromDateFilter(event.target.value)}
                className="w-40"
                data-testid="input-consultations-from-date"
              />
              <Input
                type="date"
                value={toDateFilter}
                onChange={(event) => setToDateFilter(event.target.value)}
                className="w-40"
                data-testid="input-consultations-to-date"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={isRA ? 6 : 7} rows={5} />
          ) : filteredRecords?.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No consultations found"
              description={isRA 
                ? "No consultations yet. Once your projects have scheduled calls, they will appear here."
                : "Schedule calls from the Consultations tab inside Project Details."}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Duration</TableHead>
                    {!isRA && <TableHead className="text-xs font-semibold uppercase">CU</TableHead>}
                    <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                    {!isRA && <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords?.map((record) => (
                    <TableRow key={record.id} data-testid={`row-call-${record.id}`}>
                      <TableCell className="font-medium">{getProjectName(record.projectId)}</TableCell>
                      <TableCell className="text-muted-foreground">{getExpertName(record.expertId)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {format(new Date(record.callDate), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.actualDurationMinutes || record.durationMinutes} min
                      </TableCell>
                      {!isRA && (
                        <TableCell className="font-mono font-medium">
                          {parseFloat(record.cuUsed || "0").toFixed(1)}
                        </TableCell>
                      )}
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      {!isRA && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {(record.status === "pending" || record.status === "scheduled") && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCall(record);
                                    completeForm.reset({
                                      actualDurationMinutes: record.durationMinutes,
                                      notes: record.notes || "",
                                    });
                                    setIsCompleteDialogOpen(true);
                                  }}
                                  data-testid={`button-complete-call-${record.id}`}
                                >
                                  <CheckCircle className="mr-1 h-3 w-3" /> Complete
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => cancelMutation.mutate(record.id)}
                                  className="text-destructive"
                                  data-testid={`button-cancel-call-${record.id}`}
                                >
                                  <XCircle className="mr-1 h-3 w-3" /> Cancel
                                </Button>
                              </>
                            )}
                            {record.zoomLink && (
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                              >
                                <a href={record.zoomLink} target="_blank" rel="noopener noreferrer">
                                  <Video className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete Consultation</DialogTitle>
            <DialogDescription>
              Mark this consultation as completed and record the actual duration.
            </DialogDescription>
          </DialogHeader>
          <Form {...completeForm}>
            <form onSubmit={completeForm.handleSubmit(onCompleteSubmit)} className="space-y-4">
              <FormField
                control={completeForm.control}
                name="actualDurationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual Duration (minutes) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-actual-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={completeForm.control}
                name="recordingUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recording URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} data-testid="input-recording-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={completeForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Call summary..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="input-complete-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCompleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={completeMutation.isPending} data-testid="button-complete-call">
                  {completeMutation.isPending ? "Saving..." : "Mark Complete"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
