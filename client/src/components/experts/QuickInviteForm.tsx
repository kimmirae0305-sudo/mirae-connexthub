import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuickInviteFormProps {
  projectId: number;
  onSuccess: (data: { inviteUrl: string }) => void;
  onCancel?: () => void;
}

const formSchema = z.object({
  candidateName: z.string().min(1, "Candidate name is required"),
  linkedinUrl: z.string().url("Invalid LinkedIn URL").optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phoneNumber: z.string().optional().or(z.literal("")),
}).refine(
  (data) => data.linkedinUrl || data.email || data.phoneNumber,
  {
    message: "At least one of LinkedIn URL, Email, or Phone number is required",
    path: ["linkedinUrl"],
  }
);

type FormData = z.infer<typeof formSchema>;

export function QuickInviteForm({ projectId, onSuccess, onCancel }: QuickInviteFormProps) {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      candidateName: "",
      linkedinUrl: "",
      email: "",
      phoneNumber: "",
    },
  });

  const quickInviteMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest(
        "POST",
        `/api/projects/${projectId}/quick-invite`,
        {
          candidateName: data.candidateName,
          linkedinUrl: data.linkedinUrl || null,
          email: data.email || null,
          phoneNumber: data.phoneNumber || null,
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      setIsSubmitted(true);
      setInviteUrl(data.inviteUrl);
      toast({ title: "Invite link generated successfully" });
      onSuccess({ inviteUrl: data.inviteUrl });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    quickInviteMutation.mutate(data);
  };

  const copyInviteLink = async () => {
    if (inviteUrl) {
      const fullUrl = `${window.location.origin}${inviteUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      toast({ 
        title: "Invite link copied",
        description: "Link copied to clipboard and ready to share"
      });
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (isSubmitted && inviteUrl) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Invite Link Generated</h2>
          <p className="mt-2 text-muted-foreground">Share this link with the candidate</p>
        </div>
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg w-full max-w-md">
          <code className="flex-1 text-sm truncate">
            {`${window.location.origin}${inviteUrl}`}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={copyInviteLink}
            data-testid="button-copy-invite-url"
          >
            {copiedLink ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(inviteUrl, "_blank")}
            data-testid="button-open-invite-url"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        {onCancel && (
          <Button onClick={onCancel} className="mt-4" data-testid="button-close">
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Invite New Expert</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a quick invite link with minimal information
          </p>
        </div>

        <FormField
          control={form.control}
          name="candidateName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Candidate Name <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} data-testid="input-candidate-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="linkedinUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LinkedIn URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://linkedin.com/in/johndoe"
                  {...field}
                  data-testid="input-linkedin-url"
                />
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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  {...field}
                  data-testid="input-email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="+1 (555) 123-4567"
                  {...field}
                  data-testid="input-phone-number"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormDescription>
          At least one of LinkedIn URL, Email, or Phone Number is required
        </FormDescription>

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={quickInviteMutation.isPending}
            data-testid="button-generate-invite"
          >
            {quickInviteMutation.isPending ? "Generating..." : "Generate Invite Link"}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
