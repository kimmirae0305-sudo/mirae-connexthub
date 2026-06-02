import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, FileText, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientOrganization, InsertClientOrganization } from "@shared/schema";

const pricingModels = ["Pay-as-you-go", "Prepaid Credits", "Retainer", "Annual Contract", "Project-based", "Custom"];
const retainerPeriods = ["Monthly", "Quarterly", "Annual", "Contract"];

type ContractFormData = {
  pricingModel: string;
  currency: string;
  defaultCuRate: string;
  purchasedCu: string;
  retainerCuAllowance: string;
  retainerPeriod: string;
  contractedCu: string;
  paymentTerms: string;
  contractStartDate: string;
  contractEndDate: string;
  commercialNotes: string;
};

const emptyForm: ContractFormData = {
  pricingModel: "Pay-as-you-go",
  currency: "USD",
  defaultCuRate: "",
  purchasedCu: "",
  retainerCuAllowance: "",
  retainerPeriod: "",
  contractedCu: "",
  paymentTerms: "",
  contractStartDate: "",
  contractEndDate: "",
  commercialNotes: "",
};

const toDateInput = (value?: Date | string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy");
};

const formatCu = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} CU`;
};

const formatRate = (value?: string | number | null, currency = "USD") => {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const hasMissingRate = (org: ClientOrganization) => {
  const rate = Number(org.defaultCuRate || 0);
  return !Number.isFinite(rate) || rate <= 0;
};

const buildFormData = (org: ClientOrganization): ContractFormData => ({
  pricingModel: org.pricingModel || "Pay-as-you-go",
  currency: "USD",
  defaultCuRate: org.defaultCuRate || "",
  purchasedCu: org.purchasedCu || "",
  retainerCuAllowance: org.retainerCuAllowance || "",
  retainerPeriod: org.retainerPeriod || "",
  contractedCu: org.contractedCu || "",
  paymentTerms: org.paymentTerms || "",
  contractStartDate: toDateInput(org.contractStartDate),
  contractEndDate: toDateInput(org.contractEndDate),
  commercialNotes: org.commercialNotes || "",
});

export default function Contracts() {
  const { toast } = useToast();
  const [editingOrg, setEditingOrg] = useState<ClientOrganization | null>(null);
  const [formData, setFormData] = useState<ContractFormData>(emptyForm);

  const { data: organizations, isLoading } = useQuery<ClientOrganization[]>({
    queryKey: ["/api/client-organizations"],
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: InsertClientOrganization & { id: number }) =>
      apiRequest("PATCH", `/api/client-organizations/${payload.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-organizations"] });
      setEditingOrg(null);
      setFormData(emptyForm);
      toast({ title: "Commercial terms updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update commercial terms",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openEditModal = (org: ClientOrganization) => {
    setEditingOrg(org);
    setFormData(buildFormData(org));
  };

  const updateField = (field: keyof ContractFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    if (!editingOrg) return;

    const payload: InsertClientOrganization & { id: number } = {
      id: editingOrg.id,
      name: editingOrg.name,
      industry: editingOrg.industry,
      clientType: editingOrg.clientType,
      legalEntityName: editingOrg.legalEntityName,
      contractType: editingOrg.contractType,
      pricingModel: formData.pricingModel || null,
      currency: "USD",
      defaultCuRate: formData.defaultCuRate || null,
      purchasedCu: formData.purchasedCu || null,
      retainerCuAllowance: formData.retainerCuAllowance || null,
      retainerPeriod: formData.retainerPeriod || null,
      contractedCu: formData.contractedCu || null,
      paymentTerms: formData.paymentTerms || null,
      contractStartDate: formData.contractStartDate ? new Date(`${formData.contractStartDate}T00:00:00`) : null,
      contractEndDate: formData.contractEndDate ? new Date(`${formData.contractEndDate}T00:00:00`) : null,
      creditBalance: editingOrg.creditBalance,
      retainerBalance: editingOrg.retainerBalance,
      commercialNotes: formData.commercialNotes || null,
      billingAddress: editingOrg.billingAddress,
      mainPmId: editingOrg.mainPmId,
    };

    updateMutation.mutate(payload);
  };

  const rows = organizations || [];

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Contracts</h1>
        <p className="text-sm text-muted-foreground">
          Manage client commercial terms used for CU billing and invoice preparation.
          <span className="block">All client invoices are issued in USD.</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Commercial Terms</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={13} rows={5} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No client contracts found yet."
              description="Add client organizations before configuring commercial terms."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Pricing Model</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Invoice Currency</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Default USD CU Rate</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Payment Terms</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Contract Start</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Contract End</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Purchased CU</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Retainer CU Allowance</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Contracted CU</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">USD Rate Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Commercial Notes</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((org) => (
                    <TableRow key={org.id} data-testid={`row-contract-${org.id}`}>
                      <TableCell>
                        <div className="font-medium">{org.name}</div>
                        <div className="text-xs text-muted-foreground">{org.legalEntityName || org.clientType || "Client organization"}</div>
                      </TableCell>
                      <TableCell>{org.pricingModel || "-"}</TableCell>
                      <TableCell>USD</TableCell>
                      <TableCell className="text-right font-mono">{formatRate(org.defaultCuRate, "USD")}</TableCell>
                      <TableCell>{org.paymentTerms || "-"}</TableCell>
                      <TableCell>{formatDate(org.contractStartDate)}</TableCell>
                      <TableCell>{formatDate(org.contractEndDate)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCu(org.purchasedCu)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCu(org.retainerCuAllowance)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCu(org.contractedCu)}</TableCell>
                      <TableCell>
                        {hasMissingRate(org) ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            USD CU Rate Missing
                          </Badge>
                        ) : (
                          <Badge variant="secondary">USD Rate Set</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate">{org.commercialNotes || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(org)}
                          className="gap-2"
                          data-testid={`button-edit-contract-${org.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit Terms
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

      <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Commercial Terms</DialogTitle>
            <DialogDescription>
              {editingOrg ? `Client: ${editingOrg.name}` : "Update client commercial terms used by Finance."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Pricing Model</Label>
              <Select value={formData.pricingModel} onValueChange={(value) => updateField("pricingModel", value)}>
                <SelectTrigger data-testid="select-contract-pricing-model">
                  <SelectValue placeholder="Select pricing model" />
                </SelectTrigger>
                <SelectContent>
                  {pricingModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Invoice Currency</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium" data-testid="field-contract-invoice-currency">
                USD
              </div>
              <p className="text-xs text-muted-foreground">All client invoices are issued in USD.</p>
            </div>

            <LabeledInput
              label="Default USD CU Rate"
              value={formData.defaultCuRate}
              onChange={(value) => updateField("defaultCuRate", value)}
              type="number"
              placeholder="1150"
            />
            <LabeledInput
              label="Purchased CU"
              value={formData.purchasedCu}
              onChange={(value) => updateField("purchasedCu", value)}
              type="number"
              placeholder="e.g. 100"
            />
            <LabeledInput
              label="Retainer CU Allowance"
              value={formData.retainerCuAllowance}
              onChange={(value) => updateField("retainerCuAllowance", value)}
              type="number"
              placeholder="25"
            />

            <div className="space-y-2">
              <Label>Retainer Period</Label>
              <Select value={formData.retainerPeriod} onValueChange={(value) => updateField("retainerPeriod", value)}>
                <SelectTrigger data-testid="select-contract-retainer-period">
                  <SelectValue placeholder="Select retainer period" />
                </SelectTrigger>
                <SelectContent>
                  {retainerPeriods.map((period) => (
                    <SelectItem key={period} value={period}>
                      {period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <LabeledInput
              label="Contracted CU"
              value={formData.contractedCu}
              onChange={(value) => updateField("contractedCu", value)}
              type="number"
              placeholder="300"
            />
            <LabeledInput
              label="Payment Terms"
              value={formData.paymentTerms}
              onChange={(value) => updateField("paymentTerms", value)}
              placeholder="Net 30, upfront, monthly..."
            />
            <LabeledInput
              label="Contract Start Date"
              value={formData.contractStartDate}
              onChange={(value) => updateField("contractStartDate", value)}
              type="date"
            />
            <LabeledInput
              label="Contract End Date"
              value={formData.contractEndDate}
              onChange={(value) => updateField("contractEndDate", value)}
              type="date"
            />
          </div>

          <div className="space-y-2">
            <Label>Commercial Notes</Label>
            <Textarea
              value={formData.commercialNotes}
              onChange={(event) => updateField("commercialNotes", event.target.value)}
              placeholder="Internal commercial context, renewal notes, negotiated terms..."
              rows={4}
              data-testid="textarea-contract-commercial-notes"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-contract-terms">
              {updateMutation.isPending ? "Saving..." : "Save Terms"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
