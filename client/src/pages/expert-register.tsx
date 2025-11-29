import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle, AlertCircle, Loader2, User, Building, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ExpertInvitationLink, InsertExpert } from "@shared/schema";

interface ExpertRegisterProps {
  token: string;
}

const expertFormSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  linkedinUrl: z.string().url("Valid LinkedIn URL required").optional().or(z.literal("")),
  country: z.string().min(1, "Country is required"),
  timezone: z.string().optional(),
  whatsapp: z.string().optional(),
  expertise: z.string().min(1, "Primary expertise is required"),
  areasOfExpertise: z.string().optional(),
  industry: z.string().min(1, "Industry is required"),
  company: z.string().min(1, "Company is required"),
  jobTitle: z.string().min(1, "Job title is required"),
  yearsOfExperience: z.number().min(0, "Years must be 0 or greater"),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  bio: z.string().min(50, "Bio must be at least 50 characters"),
  termsAccepted: z.boolean().refine((v) => v === true, "You must accept the terms"),
  lgpdAccepted: z.boolean().refine((v) => v === true, "You must accept the LGPD consent"),
});

type ExpertFormData = z.infer<typeof expertFormSchema>;

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

const timezones = [
  "UTC-12:00",
  "UTC-11:00",
  "UTC-10:00",
  "UTC-09:00",
  "UTC-08:00 (PST)",
  "UTC-07:00 (MST)",
  "UTC-06:00 (CST)",
  "UTC-05:00 (EST)",
  "UTC-04:00",
  "UTC-03:00 (BRT)",
  "UTC-02:00",
  "UTC-01:00",
  "UTC+00:00 (GMT)",
  "UTC+01:00 (CET)",
  "UTC+02:00",
  "UTC+03:00",
  "UTC+04:00",
  "UTC+05:00",
  "UTC+05:30 (IST)",
  "UTC+06:00",
  "UTC+07:00",
  "UTC+08:00 (CST)",
  "UTC+09:00 (JST)",
  "UTC+10:00",
  "UTC+11:00",
  "UTC+12:00",
];

export default function ExpertRegister({ token }: ExpertRegisterProps) {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: invitationLink, isLoading, error } = useQuery<ExpertInvitationLink>({
    queryKey: ["/api/invitation-links", token],
    queryFn: async () => {
      const response = await fetch(`/api/invitation-links/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Invalid invitation link");
      }
      return response.json();
    },
  });

  const form = useForm<ExpertFormData>({
    resolver: zodResolver(expertFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      linkedinUrl: "",
      country: "",
      timezone: "",
      whatsapp: "",
      expertise: "",
      areasOfExpertise: "",
      industry: "",
      company: "",
      jobTitle: "",
      yearsOfExperience: 0,
      hourlyRate: "",
      bio: "",
      termsAccepted: false,
      lgpdAccepted: false,
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: InsertExpert) => apiRequest("POST", `/api/register-expert/${token}`, data),
    onSuccess: () => {
      setIsSubmitted(true);
      toast({ title: "Registration successful! Welcome to Mirae Connext." });
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpertFormData) => {
    const expertData: InsertExpert = {
      ...data,
      phone: data.phone || null,
      linkedinUrl: data.linkedinUrl || null,
      timezone: data.timezone || null,
      whatsapp: data.whatsapp || null,
      areasOfExpertise: data.areasOfExpertise ? data.areasOfExpertise.split(",").map(s => s.trim()).filter(Boolean) : null,
      status: "available",
    };
    registerMutation.mutate(expertData);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Verifying invitation link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitationLink) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Invalid Invitation</h2>
              <p className="mt-2 text-muted-foreground">
                {(error as Error)?.message || "This invitation link is invalid, expired, or has already been used."}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Please contact Mirae Connext for a new invitation link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Registration Complete!</h2>
              <p className="mt-2 text-muted-foreground">
                Thank you for registering with Mirae Connext. Our team will review your profile
                and contact you soon with opportunities that match your expertise.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">M</span>
          </div>
          <h1 className="text-2xl font-bold">Join Mirae Connext</h1>
          <p className="mt-2 text-muted-foreground">
            Complete your expert profile to start receiving consultation opportunities.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Expert Registration</CardTitle>
            <CardDescription>
              Please fill in all required fields accurately. This information will be shared with
              potential clients seeking expert consultations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Personal Information</span>
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} data-testid="input-expert-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} data-testid="input-expert-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 555 123 4567" {...field} data-testid="input-expert-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="whatsapp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 555 123 4567" {...field} data-testid="input-expert-whatsapp" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="linkedinUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn Profile</FormLabel>
                        <FormControl>
                          <Input placeholder="https://linkedin.com/in/yourprofile" {...field} data-testid="input-expert-linkedin" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Location</span>
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country *</FormLabel>
                          <FormControl>
                            <Input placeholder="United States" {...field} data-testid="input-expert-country" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-expert-timezone">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timezones.map((tz) => (
                                <SelectItem key={tz} value={tz}>
                                  {tz}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Professional Information</span>
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company *</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Corp" {...field} data-testid="input-expert-company" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title *</FormLabel>
                          <FormControl>
                            <Input placeholder="Senior Director" {...field} data-testid="input-expert-job-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-expert-industry">
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
                      control={form.control}
                      name="yearsOfExperience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Years of Experience *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-expert-experience"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="expertise"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Expertise *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Machine Learning, Supply Chain" {...field} data-testid="input-expert-expertise" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="areasOfExpertise"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Areas of Expertise</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="List other areas where you can provide expert consultation..."
                            className="resize-none"
                            rows={2}
                            {...field}
                            data-testid="input-expert-areas"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate (USD) *</FormLabel>
                        <FormControl>
                          <Input placeholder="250.00" {...field} data-testid="input-expert-rate" />
                        </FormControl>
                        <FormDescription>
                          Your standard consulting rate per hour in USD.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Professional Bio *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your professional background, key achievements, and areas of expertise..."
                            className="resize-none"
                            rows={4}
                            {...field}
                            data-testid="input-expert-bio"
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum 50 characters. This will be shared with potential clients.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                  <FormField
                    control={form.control}
                    name="termsAccepted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-terms"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            I accept the Terms of Service *
                          </FormLabel>
                          <FormDescription>
                            By checking this box, you agree to Mirae Connext's terms of service
                            and expert network participation guidelines.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lgpdAccepted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-lgpd"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            LGPD Data Processing Consent *
                          </FormLabel>
                          <FormDescription>
                            I consent to the processing of my personal data in accordance with
                            Brazil's General Data Protection Law (LGPD) for the purpose of
                            expert network services.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
