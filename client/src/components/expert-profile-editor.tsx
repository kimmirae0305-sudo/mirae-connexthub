import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WorkExperience {
  company: string;
  jobTitle: string;
  fromYear: number;
  toYear: number;
}

interface Expert {
  id: number;
  name: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  workHistory: WorkExperience[];
  biography?: string;
}

interface ExpertProfileEditorProps {
  expertId: number;
}

export function ExpertProfileEditor({ expertId }: ExpertProfileEditorProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Expert | null>(null);

  // Fetch expert data on mount
  const { data: expert, isLoading } = useQuery<Expert>({
    queryKey: ["/api/experts", expertId],
    queryFn: async () => {
      const res = await fetch(`/api/experts/${expertId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch expert");
      return res.json();
    },
    onSuccess: (data) => {
      setFormData(data);
    },
  });

  // Mutation to save expert profile
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Expert>) => {
      const result = await apiRequest("PATCH", `/api/experts/${expertId}`, data);
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts", expertId] });
      setIsEditing(false);
      toast({ title: "Profile saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save profile", variant: "destructive" });
    },
  });

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formData?.name || !formData?.email) {
      toast({ title: "Name and Email are required", variant: "destructive" });
      return;
    }
    await saveMutation.mutateAsync({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      linkedinUrl: formData.linkedinUrl,
      workHistory: formData.workHistory,
      biography: formData.biography,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original data
    if (expert) {
      setFormData(expert);
    }
  };

  const handleAddExperience = () => {
    if (!formData) return;
    setFormData({
      ...formData,
      workHistory: [
        ...(formData.workHistory || []),
        { company: "", jobTitle: "", fromYear: new Date().getFullYear(), toYear: new Date().getFullYear() },
      ],
    });
  };

  const handleRemoveExperience = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      workHistory: formData.workHistory.filter((_, i) => i !== index),
    });
  };

  const handleExperienceChange = (index: number, field: keyof WorkExperience, value: any) => {
    if (!formData) return;
    const updated = [...formData.workHistory];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, workHistory: updated });
  };

  if (isLoading || !formData) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="w-full max-w-4xl">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Advisor #{expertId}</CardTitle>
            <CardDescription>Profile Information</CardDescription>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button onClick={handleEdit} data-testid="button-edit-profile">
                Edit
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saveMutation.isPending}
                  data-testid="button-cancel-profile"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-profile-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-profile-email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Optional"
                  data-testid="input-profile-phone"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">LinkedIn URL</label>
                <Input
                  value={formData.linkedinUrl || ""}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Optional"
                  data-testid="input-profile-linkedin"
                />
              </div>
            </div>
          </div>

          {/* Work History Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Work History</h3>
              {isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddExperience}
                  data-testid="button-add-experience"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Experience
                </Button>
              )}
            </div>

            {formData.workHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No work history added yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    {isEditing && <TableHead className="w-10"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.workHistory.map((exp, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={exp.company}
                          onChange={(e) => handleExperienceChange(index, "company", e.target.value)}
                          disabled={!isEditing}
                          placeholder="Company name"
                          className="border-0 p-0"
                          data-testid={`input-company-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={exp.jobTitle}
                          onChange={(e) => handleExperienceChange(index, "jobTitle", e.target.value)}
                          disabled={!isEditing}
                          placeholder="Job title"
                          className="border-0 p-0"
                          data-testid={`input-jobtitle-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={exp.fromYear}
                          onChange={(e) => handleExperienceChange(index, "fromYear", parseInt(e.target.value))}
                          disabled={!isEditing}
                          className="border-0 p-0 w-20"
                          data-testid={`input-fromyear-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={exp.toYear}
                          onChange={(e) => handleExperienceChange(index, "toYear", parseInt(e.target.value))}
                          disabled={!isEditing}
                          className="border-0 p-0 w-20"
                          data-testid={`input-toyear-${index}`}
                        />
                      </TableCell>
                      {isEditing && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveExperience(index)}
                            data-testid={`button-remove-experience-${index}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Biography Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Biography</h3>
            <p className="text-xs text-muted-foreground">
              Write the biography based on the expert's LinkedIn profile and direct communication.
              Align it with the project's vetting questions when relevant.
            </p>
            <Textarea
              value={formData.biography || ""}
              onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
              disabled={!isEditing}
              placeholder="Enter expert biography..."
              className="min-h-32"
              data-testid="textarea-biography"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
