import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, FileQuestion, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EmptyState } from "@/components/empty-state";
import type { Project, VettingQuestion, InsertVettingQuestion } from "@shared/schema";

const questionFormSchema = z.object({
  projectId: z.coerce.number().min(1, "Please select a project"),
  question: z.string().min(1, "Question is required"),
  isRequired: z.boolean().default(true),
});

type QuestionFormData = z.infer<typeof questionFormSchema>;

export default function Vetting() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<VettingQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<VettingQuestion | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: questions, isLoading: questionsLoading } = useQuery<VettingQuestion[]>({
    queryKey: ["/api/vetting-questions"],
  });

  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      projectId: 0,
      question: "",
      isRequired: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertVettingQuestion) =>
      apiRequest("POST", "/api/vetting-questions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vetting-questions"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Question added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add question", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertVettingQuestion & { id: number }) =>
      apiRequest("PATCH", `/api/vetting-questions/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vetting-questions"] });
      setIsDialogOpen(false);
      setEditingQuestion(null);
      form.reset();
      toast({ title: "Question updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update question", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vetting-questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vetting-questions"] });
      setDeletingQuestion(null);
      toast({ title: "Question deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete question", variant: "destructive" });
    },
  });

  const filteredQuestions = selectedProjectId
    ? questions?.filter((q) => q.projectId === selectedProjectId)
    : questions;

  const getProjectName = (projectId: number) => {
    return projects?.find((p) => p.id === projectId)?.name || "Unknown Project";
  };

  const handleOpenDialog = (question?: VettingQuestion) => {
    if (question) {
      setEditingQuestion(question);
      form.reset({
        projectId: question.projectId,
        question: question.question,
        isRequired: question.isRequired,
      });
    } else {
      setEditingQuestion(null);
      form.reset({
        projectId: selectedProjectId || 0,
        question: "",
        isRequired: true,
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: QuestionFormData) => {
    const questionData: InsertVettingQuestion = {
      ...data,
      orderIndex: filteredQuestions?.length || 0,
    };

    if (editingQuestion) {
      updateMutation.mutate({ ...questionData, id: editingQuestion.id });
    } else {
      createMutation.mutate(questionData);
    }
  };

  const groupedQuestions = questions?.reduce(
    (acc, q) => {
      if (!acc[q.projectId]) {
        acc[q.projectId] = [];
      }
      acc[q.projectId].push(q);
      return acc;
    },
    {} as Record<number, VettingQuestion[]>
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Vetting Questions</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage vetting questions for each project.
          </p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="gap-2"
          disabled={!projects?.length}
          data-testid="button-add-question"
        >
          <Plus className="h-4 w-4" /> Add Question
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={selectedProjectId?.toString() || "all"}
          onValueChange={(val) => setSelectedProjectId(val === "all" ? null : Number(val))}
        >
          <SelectTrigger className="w-64" data-testid="select-project-filter">
            <SelectValue placeholder="Filter by project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id.toString()}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {projectsLoading || questionsLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={FileQuestion}
          title="No projects available"
          description="Create a project first before adding vetting questions."
        />
      ) : selectedProjectId ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <CardTitle className="text-base font-medium">
              {getProjectName(selectedProjectId)}
            </CardTitle>
            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
              {filteredQuestions?.length || 0} questions
            </Badge>
          </CardHeader>
          <CardContent>
            {!filteredQuestions?.length ? (
              <EmptyState
                icon={FileQuestion}
                title="No questions yet"
                description="Add vetting questions for this project."
                action={
                  <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-add-first-question">
                    <Plus className="h-4 w-4" /> Add Question
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredQuestions
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((question, index) => (
                    <div
                      key={question.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
                      data-testid={`question-item-${question.id}`}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-foreground">{question.question}</p>
                        <div className="flex items-center gap-2">
                          {question.isRequired ? (
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary no-default-hover-elevate no-default-active-elevate"
                            >
                              Required
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                              Optional
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(question)}
                          data-testid={`button-edit-question-${question.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingQuestion(question)}
                          data-testid={`button-delete-question-${question.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedQuestions || {}).length === 0 ? (
            <EmptyState
              icon={FileQuestion}
              title="No vetting questions yet"
              description="Add vetting questions to any of your projects."
              action={
                <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-add-first-question-all">
                  <Plus className="h-4 w-4" /> Add Question
                </Button>
              }
            />
          ) : (
            Object.entries(groupedQuestions || {}).map(([projectId, projectQuestions]) => (
              <Card key={projectId}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
                  <CardTitle className="text-base font-medium">
                    {getProjectName(Number(projectId))}
                  </CardTitle>
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                    {projectQuestions.length} questions
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {projectQuestions
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((question, index) => (
                        <div
                          key={question.id}
                          className="flex items-start gap-3 rounded-lg border border-border bg-background p-4"
                          data-testid={`question-item-${question.id}`}
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {index + 1}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="font-medium text-foreground">{question.question}</p>
                            {question.isRequired && (
                              <Badge
                                variant="secondary"
                                className="bg-primary/10 text-primary no-default-hover-elevate no-default-active-elevate"
                              >
                                Required
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(question)}
                              data-testid={`button-edit-question-${question.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingQuestion(question)}
                              data-testid={`button-delete-question-${question.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "Edit Question" : "Add Vetting Question"}
            </DialogTitle>
            <DialogDescription>
              {editingQuestion
                ? "Update the question details."
                : "Create a new vetting question for the project."}
            </DialogDescription>
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
                        <SelectTrigger data-testid="select-question-project">
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
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your vetting question..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="input-question-text"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-required"
                      />
                    </FormControl>
                    <FormLabel className="font-normal">This question is required</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-question"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-question"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingQuestion
                      ? "Update Question"
                      : "Add Question"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingQuestion} onOpenChange={() => setDeletingQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-question">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingQuestion && deleteMutation.mutate(deletingQuestion.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-question"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
