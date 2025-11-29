import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, Building2, Users, UserPlus, Briefcase } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import type { ClientOrganization, InsertClientOrganization, ClientPoc, InsertClientPoc } from "@shared/schema";

const orgFormSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  industry: z.string().min(1, "Industry is required"),
  billingAddress: z.string().optional(),
});

const pocFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
});

type OrgFormData = z.infer<typeof orgFormSchema>;
type PocFormData = z.infer<typeof pocFormSchema>;

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
  "Other",
];

export default function Clients() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [isPocDialogOpen, setIsPocDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<ClientOrganization | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<ClientOrganization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<ClientOrganization | null>(null);

  const { data: organizations, isLoading } = useQuery<ClientOrganization[]>({
    queryKey: ["/api/client-organizations"],
  });

  const { data: pocs } = useQuery<ClientPoc[]>({
    queryKey: ["/api/client-pocs", selectedOrg?.id],
    enabled: !!selectedOrg,
  });

  const orgForm = useForm<OrgFormData>({
    resolver: zodResolver(orgFormSchema),
    defaultValues: {
      name: "",
      industry: "",
      billingAddress: "",
    },
  });

  const pocForm = useForm<PocFormData>({
    resolver: zodResolver(pocFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      jobTitle: "",
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: (data: InsertClientOrganization) => apiRequest("POST", "/api/client-organizations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-organizations"] });
      setIsOrgDialogOpen(false);
      orgForm.reset();
      toast({ title: "Client organization created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create client organization", variant: "destructive" });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: (data: InsertClientOrganization & { id: number }) =>
      apiRequest("PATCH", `/api/client-organizations/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-organizations"] });
      setIsOrgDialogOpen(false);
      setEditingOrg(null);
      orgForm.reset();
      toast({ title: "Client organization updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update client organization", variant: "destructive" });
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/client-organizations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-organizations"] });
      setDeletingOrg(null);
      if (selectedOrg?.id === deletingOrg?.id) {
        setSelectedOrg(null);
      }
      toast({ title: "Client organization deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete client organization", variant: "destructive" });
    },
  });

  const createPocMutation = useMutation({
    mutationFn: (data: InsertClientPoc) => apiRequest("POST", "/api/client-pocs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-pocs", selectedOrg?.id] });
      setIsPocDialogOpen(false);
      pocForm.reset();
      toast({ title: "Contact added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add contact", variant: "destructive" });
    },
  });

  const filteredOrgs = organizations?.filter((org) =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenOrgDialog = (org?: ClientOrganization) => {
    if (org) {
      setEditingOrg(org);
      orgForm.reset({
        name: org.name,
        industry: org.industry || "",
        billingAddress: org.billingAddress || "",
      });
    } else {
      setEditingOrg(null);
      orgForm.reset();
    }
    setIsOrgDialogOpen(true);
  };

  const onOrgSubmit = (data: OrgFormData) => {
    const orgData: InsertClientOrganization = {
      ...data,
      billingAddress: data.billingAddress || null,
    };

    if (editingOrg) {
      updateOrgMutation.mutate({ ...orgData, id: editingOrg.id });
    } else {
      createOrgMutation.mutate(orgData);
    }
  };

  const onPocSubmit = (data: PocFormData) => {
    if (!selectedOrg) return;
    
    const pocData: InsertClientPoc = {
      ...data,
      organizationId: selectedOrg.id,
      phone: data.phone || null,
      jobTitle: data.jobTitle || null,
    };
    createPocMutation.mutate(pocData);
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Client Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Manage client organizations and their points of contact.
          </p>
        </div>
        <Button onClick={() => handleOpenOrgDialog()} className="gap-2" data-testid="button-add-client">
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3">
              <CardTitle className="text-base font-medium">Organizations</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-clients"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <DataTableSkeleton columns={1} rows={5} />
            ) : filteredOrgs?.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No clients found"
                description="Add your first client organization to get started."
              />
            ) : (
              <div className="space-y-2">
                {filteredOrgs?.map((org) => (
                  <div
                    key={org.id}
                    className={`cursor-pointer rounded-md border p-3 transition-colors hover-elevate ${
                      selectedOrg?.id === org.id ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setSelectedOrg(org)}
                    data-testid={`card-client-${org.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.industry}</p>
                      </div>
                      <Badge variant="default" className="shrink-0">
                        {parseFloat(org.totalCuUsed || "0").toFixed(1)} CU
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedOrg ? (
            <>
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-xl">{selectedOrg.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{selectedOrg.industry}</p>
                    {selectedOrg.billingAddress && (
                      <p className="mt-1 text-xs text-muted-foreground">{selectedOrg.billingAddress}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenOrgDialog(selectedOrg)}
                      data-testid="button-edit-client"
                    >
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingOrg(selectedOrg)}
                      className="text-destructive"
                      data-testid="button-delete-client"
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pocs">
                  <TabsList>
                    <TabsTrigger value="pocs" className="gap-2">
                      <Users className="h-4 w-4" /> Contacts
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="gap-2">
                      <Briefcase className="h-4 w-4" /> Projects
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="pocs" className="mt-4">
                    <div className="flex items-center justify-between pb-4">
                      <p className="text-sm text-muted-foreground">
                        {pocs?.length || 0} point(s) of contact
                      </p>
                      <Button
                        size="sm"
                        onClick={() => {
                          pocForm.reset();
                          setIsPocDialogOpen(true);
                        }}
                        className="gap-1"
                        data-testid="button-add-poc"
                      >
                        <UserPlus className="h-3 w-3" /> Add Contact
                      </Button>
                    </div>
                    {pocs?.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="No contacts yet"
                        description="Add a point of contact for this organization."
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                            <TableHead className="text-xs font-semibold uppercase">Email</TableHead>
                            <TableHead className="text-xs font-semibold uppercase">Job Title</TableHead>
                            <TableHead className="text-xs font-semibold uppercase">Phone</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pocs?.map((poc) => (
                            <TableRow key={poc.id} data-testid={`row-poc-${poc.id}`}>
                              <TableCell className="font-medium">{poc.name}</TableCell>
                              <TableCell className="text-muted-foreground">{poc.email}</TableCell>
                              <TableCell className="text-muted-foreground">{poc.jobTitle || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{poc.phone || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                  <TabsContent value="projects" className="mt-4">
                    <EmptyState
                      icon={Briefcase}
                      title="No projects yet"
                      description="Projects linked to this organization will appear here."
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex h-[400px] items-center justify-center">
              <EmptyState
                icon={Building2}
                title="Select an organization"
                description="Choose an organization from the list to view details."
              />
            </CardContent>
          )}
        </Card>
      </div>

      <Dialog open={isOrgDialogOpen} onOpenChange={setIsOrgDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOrg ? "Edit Organization" : "Add Client Organization"}</DialogTitle>
            <DialogDescription>
              {editingOrg
                ? "Update the organization details below."
                : "Fill in the details to add a new client organization."}
            </DialogDescription>
          </DialogHeader>
          <Form {...orgForm}>
            <form onSubmit={orgForm.handleSubmit(onOrgSubmit)} className="space-y-4">
              <FormField
                control={orgForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter organization name" {...field} data-testid="input-org-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={orgForm.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-org-industry">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {industries.map((industry) => (
                          <SelectItem key={industry} value={industry}>
                            {industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={orgForm.control}
                name="billingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter billing address..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="input-org-billing"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOrgDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createOrgMutation.isPending || updateOrgMutation.isPending}
                  data-testid="button-save-org"
                >
                  {createOrgMutation.isPending || updateOrgMutation.isPending
                    ? "Saving..."
                    : editingOrg
                      ? "Update"
                      : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPocDialogOpen} onOpenChange={setIsPocDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Point of Contact</DialogTitle>
            <DialogDescription>
              Add a contact person for {selectedOrg?.name}.
            </DialogDescription>
          </DialogHeader>
          <Form {...pocForm}>
            <form onSubmit={pocForm.handleSubmit(onPocSubmit)} className="space-y-4">
              <FormField
                control={pocForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter name" {...field} data-testid="input-poc-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pocForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email" {...field} data-testid="input-poc-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={pocForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter phone" {...field} data-testid="input-poc-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pocForm.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Director" {...field} data-testid="input-poc-job-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPocDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPocMutation.isPending}
                  data-testid="button-save-poc"
                >
                  {createPocMutation.isPending ? "Saving..." : "Add Contact"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingOrg} onOpenChange={() => setDeletingOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingOrg?.name}"? This action cannot be undone
              and will also remove all associated contacts and project links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingOrg && deleteOrgMutation.mutate(deletingOrg.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrgMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
