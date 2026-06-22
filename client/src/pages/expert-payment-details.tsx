import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { resolveApiUrl } from "@/lib/apiUrl";
import logoPath from "@assets/Logo_1764384177823.png";

const paymentMethods = [
  "PayPal", "Wise", "Pix", "International Wire Transfer", "Local Bank Transfer",
  "ACH", "SWIFT", "Payoneer", "Other",
];

interface PublicPaymentDetailsContext {
  status: "link_generated" | "sent" | "submitted" | "expired";
  expertName: string;
  payableAmount: string;
  currency: string;
  serviceDate: string;
  durationMinutes: number;
  expiresAt: string;
  submittedAt: string | null;
}

const formatDateOnly = (value?: string | null) => {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit" })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return "-";
};

const formatMoney = (amount: string, currency: string) =>
  `${currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ExpertPaymentDetails() {
  const params = useParams<{ token: string }>();
  const token = params.token || (typeof window !== "undefined"
    ? decodeURIComponent(window.location.pathname.split("/public/expert-payment-details/")[1]?.split("/")[0] || "")
    : "");
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [paymentIdentifier, setPaymentIdentifier] = useState("");
  const [country, setCountry] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmationAccepted, setConfirmationAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery<PublicPaymentDetailsContext>({
    queryKey: ["/api/public/expert-payment-details", token],
    queryFn: async () => {
      const response = await fetch(resolveApiUrl(`/api/public/expert-payment-details/${encodeURIComponent(token)}`));
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "This payment details link is unavailable.");
      return payload;
    },
    enabled: Boolean(token),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(resolveApiUrl(`/api/public/expert-payment-details/${encodeURIComponent(token)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredPaymentMethod,
          accountHolderName,
          paymentIdentifier,
          country,
          paymentDetails,
          notes,
          confirmationAccepted,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to submit payment details.");
      return payload;
    },
    onSuccess: () => {
      setSubmitted(true);
      setValidationError(null);
    },
    onError: (submitError: Error) => setValidationError(submitError.message),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!preferredPaymentMethod || !accountHolderName.trim() || !paymentIdentifier.trim() || !confirmationAccepted) {
      setValidationError("Complete all required fields and accept the confirmation before submitting.");
      return;
    }
    setValidationError(null);
    submitMutation.mutate();
  };

  if (isLoading) {
    return <PublicShell><Loader2 className="h-8 w-8 animate-spin text-primary" /><p>Loading secure request...</p></PublicShell>;
  }
  if (error || !data) {
    return <PublicShell><AlertCircle className="h-10 w-10 text-destructive" /><h1 className="text-xl font-semibold">Payment Details Link Unavailable</h1><p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Please contact Mirae Connext."}</p></PublicShell>;
  }
  if (submitted || data.status === "submitted") {
    return <PublicShell><CheckCircle2 className="h-12 w-12 text-green-600" /><h1 className="text-xl font-semibold">Payment Details Submitted</h1><p className="text-sm text-muted-foreground">Thank you. Your payment details have been submitted securely.</p></PublicShell>;
  }
  if (data.status === "expired") {
    return <PublicShell><AlertCircle className="h-10 w-10 text-amber-600" /><h1 className="text-xl font-semibold">Payment Details Link Expired</h1><p className="text-sm text-muted-foreground">Please contact Mirae Connext for a new secure link.</p></PublicShell>;
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3"><img src={logoPath} alt="Mirae Connext" className="h-10 w-10 object-contain" /><div><div className="font-semibold">Mirae Connext</div><div className="text-sm text-muted-foreground">Payment Details Request</div></div></div>
        <Card>
          <CardHeader><CardTitle>Submit Your Payment Details</CardTitle><CardDescription>Thank you for your participation. Please submit your preferred payment details so we can process your compensation.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Secure submission</AlertTitle><AlertDescription>Please use this form rather than sending sensitive payment information by email.</AlertDescription></Alert>
            <div className="grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-2">
              <Summary label="Expert" value={data.expertName} />
              <Summary label="Service Date" value={formatDateOnly(data.serviceDate)} />
              <Summary label="Duration" value={`${data.durationMinutes} min`} />
              <Summary label="Compensation" value={formatMoney(data.payableAmount, data.currency)} />
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>Preferred Payment Method *</Label><Select value={preferredPaymentMethod} onValueChange={setPreferredPaymentMethod}><SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger><SelectContent>{paymentMethods.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="account-holder">Account Holder / Beneficiary Name *</Label><Input id="account-holder" value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="identifier">Payment Identifier *</Label><Input id="identifier" value={paymentIdentifier} onChange={(event) => setPaymentIdentifier(event.target.value)} placeholder="PayPal email, Wise email, Pix key, bank account identifier, or Payoneer email" /></div>
              <div className="space-y-2"><Label htmlFor="country">Country</Label><Input id="country" value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country associated with the payment account" /></div>
              <div className="space-y-2"><Label htmlFor="details">Payment Details</Label><Textarea id="details" value={paymentDetails} onChange={(event) => setPaymentDetails(event.target.value)} placeholder="Additional bank details, routing/SWIFT/IBAN, Pix notes, Wise details, or other payment instructions" rows={5} /></div>
              <div className="space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Any additional notes for the finance team" /></div>
              <div className="flex items-start gap-3 rounded-md border p-4"><Checkbox id="confirmation" checked={confirmationAccepted} onCheckedChange={(checked) => setConfirmationAccepted(checked === true)} /><Label htmlFor="confirmation" className="font-normal leading-5">I confirm that the payment details provided are accurate and may be used by Mirae Connext to process my compensation.</Label></div>
              {validationError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{validationError}</AlertDescription></Alert>}
              <Button type="submit" className="w-full" disabled={submitMutation.isPending}>{submitMutation.isPending ? "Submitting..." : "Submit Payment Details"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-muted/30 px-4 py-10"><Card className="mx-auto max-w-md"><CardContent className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">{children}</CardContent></Card></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-medium uppercase text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>;
}
