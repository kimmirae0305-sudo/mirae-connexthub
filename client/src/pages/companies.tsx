import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, ExternalLink, Pencil, Plus, Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { normalizeRole } from "@/lib/permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Company } from "@shared/schema";

type CompanyRow = Company & {
  linkedExpertsCount: number;
};

type CompanyFormState = {
  name: string;
  legalName: string;
  country: string;
  city: string;
  companyType: string;
  industry: string;
  officialWebsite: string;
  linkedinUrl: string;
  description: string;
  ownershipNotes: string;
  notes: string;
  verificationStatus: string;
  status: string;
  dncStatus: string;
};

const companyTypes = [
  { value: "private_company", label: "Private Company" },
  { value: "publicly_listed_company", label: "Publicly Listed Company" },
  { value: "state_owned_enterprise", label: "State-Owned Enterprise" },
  { value: "government_agency", label: "Government Agency" },
  { value: "nonprofit_ngo", label: "Nonprofit / NGO" },
  { value: "academic_research_institution", label: "Academic / Research Institution" },
  { value: "other", label: "Other" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "restricted", label: "Restricted" },
  { value: "dnc", label: "DNC" },
  { value: "archived", label: "Archived" },
];

const dncStatusOptions = [
  { value: "none", label: "None" },
  { value: "do_not_contact", label: "Do Not Contact" },
  { value: "consent_required", label: "Consent Required" },
  { value: "legal_hold", label: "Legal Hold" },
];

const verificationStatusOptions = [
  { value: "unverified", label: "Unverified" },
  { value: "verified", label: "Verified" },
  { value: "needs_review", label: "Needs Review" },
];

const emptyForm = (): CompanyFormState => ({
  name: "",
  legalName: "",
  country: "",
  city: "",
  companyType: "private_company",
  industry: "",
  officialWebsite: "",
  linkedinUrl: "",
  description: "",
  ownershipNotes: "",
  notes: "",
  verificationStatus: "unverified",
  status: "active",
  dncStatus: "none",
});

const labelFor = (options: Array<{ value: string; label: string }>, value?: string | null) =>
  options.find((option) => option.value === value)?.label || value?.replace(/_/g, " ") || "-";

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
    timeZoneName: "short",
  }).format(date);
};

const normalizeUrl = (url?: string | null) => {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const buildPayload = (form: CompanyFormState) => ({
  name: form.name.trim(),
  legalName: form.legalName.trim() || null,
  country: form.country.trim(),
  city: form.city.trim() || null,
  companyType: form.companyType,
  industry: form.industry.trim() || null,
  officialWebsite: form.officialWebsite.trim() || null,
  linkedinUrl: form.linkedinUrl.trim() || null,
  description: form.description.trim() || null,
  ownershipNotes: form.ownershipNotes.trim() || null,
  notes: form.notes.trim() || null,
  verificationStatus: form.verificationStatus,
  status: form.status,
  dncStatus: form.dncStatus,
});

const formFromCompany = (company: CompanyRow): CompanyFormState => ({
  name: company.name || "",
  legalName: company.legalName || "",
  country: company.country || "",
  city: company.city || "",
  companyType: company.companyType || "private_company",
  industry: company.industry || "",
  officialWebsite: company.officialWebsite || "",
  linkedinUrl: company.linkedinUrl || "",
  description: company.description || "",
  ownershipNotes: company.ownershipNotes || "",
  notes: company.notes || "",
  verificationStatus: company.verificationStatus || "unverified",
  status: company.status === "unverified" ? "active" : company.status || "active",
  dncStatus: company.dncStatus || "none",
});

function CompanyStatusBadges({ company }: { company: CompanyRow }) {
  const status = company.status === "unverified" ? "active" : company.status;
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={status === "restricted" || status === "dnc" ? "destructive" : status === "archived" ? "secondary" : "outline"} className="capitalize">
        {labelFor(statusOptions, status)}
      </Badge>
      {company.dncStatus !== "none" && (
        <Badge variant="destructive" className="gap-1">
          <ShieldAlert className="h-3 w-3" />
          {labelFor(dncStatusOptions, company.dncStatus)}
        </Badge>
      )}
    </div>
  );
}

export default function Companies() {
  const { toast } = useToast();
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const canEditCompanies = role === "admin" || role === "ceo" || role === "coo" || role === "ra";
  const canEditCompliance = role === "admin" || role === "ceo" || role === "coo";

  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [companyType, setCompanyType] = useState("all");
  const [status, setStatus] = useState("all");
  const [dncStatus, setDncStatus] = useState("all");
  const [verificationStatus, setVerificationStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [form, setForm] = useState<CompanyFormState>(emptyForm());

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (country !== "all") params.set("country", country);
    if (companyType !== "all") params.set("companyType", companyType);
    if (status !== "all") params.set("status", status);
    if (dncStatus !== "all") params.set("dncStatus", dncStatus);
    if (verificationStatus !== "all") params.set("verificationStatus", verificationStatus);
    return params.toString();
  }, [search, country, companyType, status, dncStatus, verificationStatus]);

  const { data: companies = [], isLoading } = useQuery<CompanyRow[]>({
    queryKey: ["/api/companies", queryString],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/companies${queryString ? `?${queryString}` : ""}`);
      return response.json();
    },
  });

  const countries = useMemo(() => Array.from(new Set(companies.map((company) => company.country).filter(Boolean))).sort(), [companies]);

  const saveCompanyMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form);
      if (!payload.name || !payload.country || !payload.companyType) {
        throw new Error("Company name, country, and company type are required.");
      }
      if (payload.verificationStatus === "verified" && !payload.officialWebsite) {
        throw new Error("Official website is required for verified companies.");
      }
      const response = editingCompany
        ? await apiRequest("PATCH", `/api/companies/${editingCompany.id}`, payload)
        : await apiRequest("POST", "/api/companies", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setDialogOpen(false);
      setEditingCompany(null);
      setForm(emptyForm());
      toast({
        title: editingCompany ? "Company updated" : "Company created",
        description: editingCompany ? "The company record was saved." : "The company is now available for expert work history linking.",
      });
    },
    onError: (error) => {
      toast({
        title: "Company could not be saved",
        description: error instanceof Error ? error.message : "Please review the company fields and try again.",
        variant: "destructive",
      });
    },
  });

  const openCreateDialog = () => {
    setEditingCompany(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (company: CompanyRow) => {
    setEditingCompany(company);
    setForm(formFromCompany(company));
    setDialogOpen(true);
  };

  const updateForm = <K extends keyof CompanyFormState>(field: K, value: CompanyFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="space-y-6 p-6" data-testid="page-companies">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Companies</h1>
          <p className="mt-1 text-muted-foreground">
            Manage reviewed company records used for expert work history linking and network compliance visibility.
          </p>
        </div>
        {canEditCompanies && (
          <Button onClick={openCreateDialog} data-testid="button-create-company">
            <Plus className="mr-2 h-4 w-4" />
            Create Company
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Database</CardTitle>
          <CardDescription>Search and filter internal company records. Client names are not exposed here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative md:col-span-2 xl:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search company name"
                className="pl-9"
                data-testid="input-company-search"
              />
            </div>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger data-testid="select-country-filter">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map((countryOption) => (
                  <SelectItem key={countryOption} value={countryOption}>
                    {countryOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={companyType} onValueChange={setCompanyType}>
              <SelectTrigger data-testid="select-company-type-filter">
                <SelectValue placeholder="Company Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {companyTypes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dncStatus} onValueChange={setDncStatus}>
              <SelectTrigger data-testid="select-dnc-filter">
                <SelectValue placeholder="DNC Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All DNC Statuses</SelectItem>
                {dncStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={verificationStatus} onValueChange={setVerificationStatus}>
              <SelectTrigger data-testid="select-verification-filter">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verification</SelectItem>
                {verificationStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <DataTableSkeleton columns={10} rows={8} />
          ) : companies.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Company Type</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Official Website</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>DNC Status</TableHead>
                    <TableHead>Verification Status</TableHead>
                    <TableHead className="text-right">Linked Experts</TableHead>
                    <TableHead>Updated At</TableHead>
                    {canEditCompanies && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="min-w-[220px] font-medium">{company.name}</TableCell>
                      <TableCell>{company.country}</TableCell>
                      <TableCell>{labelFor(companyTypes, company.companyType)}</TableCell>
                      <TableCell>{company.industry || "-"}</TableCell>
                      <TableCell>
                        {company.officialWebsite ? (
                          <a
                            href={normalizeUrl(company.officialWebsite)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Website
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <CompanyStatusBadges company={company} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.dncStatus === "none" ? "outline" : "destructive"}>
                          {labelFor(dncStatusOptions, company.dncStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.verificationStatus === "verified" ? "default" : company.verificationStatus === "needs_review" ? "secondary" : "outline"}>
                          {labelFor(verificationStatusOptions, company.verificationStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{company.linkedExpertsCount || 0}</TableCell>
                      <TableCell className="min-w-[160px]">{formatDateTime(company.updatedAt)}</TableCell>
                      {canEditCompanies && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(company)} data-testid={`button-edit-company-${company.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Building2}
              title="No companies found"
              description="Create company records from this page or link raw work history names from Expert Detail."
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit Company" : "Create Company"}</DialogTitle>
            <DialogDescription>
              Maintain internal company records for expert work history review. No external enrichment is performed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Legal Name</Label>
              <Input value={form.legalName} onChange={(event) => updateForm("legalName", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.country} onChange={(event) => updateForm("country", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(event) => updateForm("city", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Company Type</Label>
              <Select value={form.companyType} onValueChange={(value) => updateForm("companyType", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companyTypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={form.industry} onChange={(event) => updateForm("industry", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Official Website</Label>
              <Input value={form.officialWebsite} onChange={(event) => updateForm("officialWebsite", event.target.value)} placeholder="https://example.com" />
              {form.verificationStatus === "verified" && !form.officialWebsite.trim() && (
                <p className="text-xs text-destructive">Official website is required for verified companies.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input value={form.linkedinUrl} onChange={(event) => updateForm("linkedinUrl", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Verification Status</Label>
              <Select value={form.verificationStatus} onValueChange={(value) => updateForm("verificationStatus", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {verificationStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => updateForm("status", value)} disabled={!canEditCompliance}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canEditCompliance && <p className="text-xs text-muted-foreground">Restricted and DNC status changes require Admin, CEO, or COO access.</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>DNC Status</Label>
              <Select value={form.dncStatus} onValueChange={(value) => updateForm("dncStatus", value)} disabled={!canEditCompliance}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dncStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Ownership Notes</Label>
              <Textarea value={form.ownershipNotes} onChange={(event) => updateForm("ownershipNotes", event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveCompanyMutation.mutate()}
              disabled={
                saveCompanyMutation.isPending ||
                !form.name.trim() ||
                !form.country.trim() ||
                !form.companyType ||
                (form.verificationStatus === "verified" && !form.officialWebsite.trim())
              }
              data-testid="button-save-company"
            >
              {editingCompany ? "Save Changes" : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
