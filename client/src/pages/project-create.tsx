import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Briefcase,
  ClipboardList,
  ExternalLink,
  FileText,
  GripVertical,
  Layers,
  Plus,
  Save,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InsertProject, User } from "@shared/schema";

type DraftQuestion = {
  question: string;
};

type DraftAngle = {
  title: string;
  description: string;
  questions: DraftQuestion[];
};

const industries = [
  "Technology",
  "Healthcare",
  "Finance",
  "Manufacturing",
  "Energy",
  "Retail",
  "Consulting",
  "Legal",
  "Real Estate",
  "Education",
  "Pharmaceuticals",
  "Telecommunications",
  "Automotive",
  "Aerospace",
  "Agriculture",
  "Other",
];

export default function ProjectCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [createdByPmId, setCreatedByPmId] = useState<string>("");
  const [assignedRaIds, setAssignedRaIds] = useState<number[]>([]);
  const [projectOverview, setProjectOverview] = useState("");
  const [description, setDescription] = useState("");
  const [angles, setAngles] = useState<DraftAngle[]>([
    { title: "", description: "", questions: [{ question: "" }] },
  ]);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const pms = users.filter((user) => {
    const role = user.role?.toLowerCase();
    return user.isActive !== false && (role === "pm" || role === "admin" || role === "project manager");
  });

  const ras = users.filter((user) => {
    const role = user.role?.toLowerCase();
    return user.isActive !== false && (role === "ra" || role === "research associate");
  });

  const updateAngle = (index: number, changes: Partial<DraftAngle>) => {
    setAngles((current) =>
      current.map((angle, angleIndex) => (angleIndex === index ? { ...angle, ...changes } : angle))
    );
  };

  const updateQuestion = (angleIndex: number, questionIndex: number, question: string) => {
    setAngles((current) =>
      current.map((angle, currentAngleIndex) => {
        if (currentAngleIndex !== angleIndex) return angle;
        return {
          ...angle,
          questions: angle.questions.map((item, currentQuestionIndex) =>
            currentQuestionIndex === questionIndex ? { question } : item
          ),
        };
      })
    );
  };

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !clientName.trim() || !industry.trim()) {
        throw new Error("Project title, client name, and sector / industry are required.");
      }

      const projectPayload: InsertProject = {
        name: name.trim(),
        clientName: clientName.trim(),
        industry: industry.trim(),
        region: region.trim() || null,
        projectOverview: projectOverview.trim() || null,
        description: description.trim() || null,
        status: "new",
        createdByPmId: createdByPmId ? Number(createdByPmId) : null,
        assignedRaIds,
      };

      const projectResponse = await apiRequest("POST", "/api/projects", projectPayload);
      const project = await projectResponse.json();

      if (assignedRaIds.length > 0) {
        await apiRequest("POST", `/api/projects/${project.id}/assign-ras`, { raIds: assignedRaIds });
      }

      for (let angleIndex = 0; angleIndex < angles.length; angleIndex++) {
        const angle = angles[angleIndex];
        const angleTitle = angle.title.trim();
        const angleDescription = angle.description.trim();
        const questions = angle.questions
          .map((item) => item.question.trim())
          .filter(Boolean);

        if (!angleTitle && !angleDescription && questions.length === 0) continue;

        let angleId: number | null = null;
        if (angleTitle || angleDescription) {
          const angleResponse = await apiRequest("POST", `/api/projects/${project.id}/angles`, {
            title: angleTitle || `Angle ${angleIndex + 1}`,
            description: angleDescription || null,
            orderIndex: angleIndex,
          });
          const savedAngle = await angleResponse.json();
          angleId = savedAngle.id;
        }

        for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
          await apiRequest("POST", "/api/vetting-questions", {
            projectId: project.id,
            angleId,
            question: questions[questionIndex],
            questionType: "text",
            orderIndex: questionIndex,
            isRequired: true,
          });
        }
      }

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project created successfully" });
      setLocation(window.location.pathname.startsWith("/app/") ? "/app/projects" : "/projects");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")} data-testid="button-back-projects">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">New Project</h1>
            <p className="text-sm text-muted-foreground">
              Create the project setup, angles, vetting questions, and sourcing team in one place.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/projects")} data-testid="button-cancel-project-create">
            Back to list
          </Button>
          <Button
            className="gap-2"
            onClick={() => createProjectMutation.mutate()}
            disabled={createProjectMutation.isPending}
            data-testid="button-save-back-project-list"
          >
            <Save className="h-4 w-4" />
            {createProjectMutation.isPending ? "Saving..." : "Save and back to list"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4" />
                Project Overview
              </CardTitle>
              <CardDescription>Core project details used across sourcing and delivery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="project-title">Project title</label>
                  <Input
                    id="project-title"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Digital payments market scan"
                    data-testid="input-new-project-title"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="client-name">Client name</label>
                  <Input
                    id="client-name"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Client organization"
                    data-testid="input-new-project-client"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sector / industry</label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger data-testid="select-new-project-industry">
                      <SelectValue placeholder="Select sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="project-region">Region(s)</label>
                  <Input
                    id="project-region"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    placeholder="Brazil, Mexico, LATAM"
                    data-testid="input-new-project-region"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="project-overview">Overview</label>
                <Textarea
                  id="project-overview"
                  value={projectOverview}
                  onChange={(event) => setProjectOverview(event.target.value)}
                  rows={4}
                  placeholder="Summarize the client need, target expertise, and intended output."
                  data-testid="textarea-new-project-overview"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="project-description">Additional notes</label>
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Optional delivery notes, context, or constraints."
                  data-testid="textarea-new-project-description"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" />
                Angles and Vetting Questions
              </CardTitle>
              <CardDescription>Define the expert profiles and screening questions before sourcing begins.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {angles.map((angle, angleIndex) => (
                <div key={angleIndex} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      Angle {angleIndex + 1}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAngles((current) => current.filter((_, index) => index !== angleIndex))}
                      disabled={angles.length === 1}
                      data-testid={`button-remove-angle-${angleIndex}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Angle title</label>
                      <Input
                        value={angle.title}
                        onChange={(event) => updateAngle(angleIndex, { title: event.target.value })}
                        placeholder="Merchant acquiring operators"
                        data-testid={`input-angle-title-${angleIndex}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Angle description</label>
                      <Input
                        value={angle.description}
                        onChange={(event) => updateAngle(angleIndex, { description: event.target.value })}
                        placeholder="Profiles with hands-on go-to-market experience"
                        data-testid={`input-angle-description-${angleIndex}`}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Vetting questions</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateAngle(angleIndex, {
                            questions: [...angle.questions, { question: "" }],
                          })
                        }
                        data-testid={`button-add-angle-question-${angleIndex}`}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Add question
                      </Button>
                    </div>
                    {angle.questions.map((item, questionIndex) => (
                      <div key={questionIndex} className="flex gap-2">
                        <Textarea
                          value={item.question}
                          onChange={(event) => updateQuestion(angleIndex, questionIndex, event.target.value)}
                          placeholder="What relevant experience should this expert confirm?"
                          rows={2}
                          data-testid={`textarea-angle-question-${angleIndex}-${questionIndex}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            updateAngle(angleIndex, {
                              questions: angle.questions.filter((_, index) => index !== questionIndex),
                            })
                          }
                          disabled={angle.questions.length === 1}
                          data-testid={`button-remove-angle-question-${angleIndex}-${questionIndex}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setAngles((current) => [...current, { title: "", description: "", questions: [{ question: "" }] }])}
                data-testid="button-add-angle"
              >
                <Plus className="h-4 w-4" />
                Add angle
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-4 w-4" />
                Team
              </CardTitle>
              <CardDescription>Main PM and assigned RAs for sourcing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Main PM</label>
                <Select value={createdByPmId} onValueChange={setCreatedByPmId}>
                  <SelectTrigger data-testid="select-main-pm">
                    <SelectValue placeholder="Select PM" />
                  </SelectTrigger>
                  <SelectContent>
                    {pms.map((pm) => (
                      <SelectItem key={pm.id} value={String(pm.id)}>
                        {pm.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Assigned RA(s)</p>
                {ras.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No active RAs available.</p>
                ) : (
                  ras.map((ra) => (
                    <label key={ra.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <Checkbox
                        checked={assignedRaIds.includes(ra.id)}
                        onCheckedChange={(checked) => {
                          setAssignedRaIds((current) =>
                            checked ? [...current, ra.id] : current.filter((id) => id !== ra.id)
                          );
                        }}
                        data-testid={`checkbox-new-project-ra-${ra.id}`}
                      />
                      <span>
                        <span className="block text-sm font-medium">{ra.fullName}</span>
                        <span className="block text-xs text-muted-foreground">{ra.email}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ExternalLink className="h-4 w-4" />
                Recruitment Links
              </CardTitle>
              <CardDescription>Recruitment links are available after the project exists.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Save the project first to generate recruitment links.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" />
                Experts
              </CardTitle>
              <CardDescription>Attach experts after the project has been saved.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Save the project first to attach experts.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Save Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Saving will create the project, assign selected RAs, create angles, and attach vetting questions.</p>
              <Button
                className="w-full gap-2"
                onClick={() => createProjectMutation.mutate()}
                disabled={createProjectMutation.isPending}
                data-testid="button-sidebar-save-project"
              >
                <Save className="h-4 w-4" />
                {createProjectMutation.isPending ? "Saving..." : "Save and back to list"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
