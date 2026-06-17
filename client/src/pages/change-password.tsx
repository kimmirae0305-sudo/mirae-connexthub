import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut } from "lucide-react";
import { resolveApiUrl } from "@/lib/apiUrl";
import { useLocation } from "wouter";

const CRM_MAIN_ROUTE = "/";
const CHANGE_PASSWORD_ROUTE = "/change-password";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function ChangePassword() {
  const { user, logout, updateAuthSession } = useAuth();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordForm) => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(resolveApiUrl("/api/auth/change-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to change password");
      }

      const result = await response.json();
      if (!result?.success || !result?.user || result.user.mustChangePassword) {
        throw new Error("Password change was not confirmed by the server");
      }

      const nextToken = result?.token || token;
      updateAuthSession(result.user, nextToken);

      const meResponse = await fetch(resolveApiUrl("/api/auth/me"), {
        headers: {
          Authorization: `Bearer ${nextToken}`,
        },
        cache: "no-store",
      });
      if (!meResponse.ok) {
        throw new Error("Password changed, but the updated session could not be confirmed");
      }

      const refreshedUser = await meResponse.json();
      if (refreshedUser?.mustChangePassword) {
        throw new Error("Password changed, but the account still requires a password change");
      }
      updateAuthSession(refreshedUser, nextToken);

      toast({ title: "Password updated successfully!" });
      setLocation(CRM_MAIN_ROUTE, { replace: true });
      window.setTimeout(() => {
        const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
        if (currentPath === CHANGE_PASSWORD_ROUTE) {
          window.location.replace(CRM_MAIN_ROUTE);
        }
      }, 500);
    } catch (error) {
      toast({
        title: "Failed to change password",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4" data-testid="page-change-password">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold" data-testid="text-change-password-title">
            Change Password
          </CardTitle>
          <CardDescription>
            For security, please update your password before accessing the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground" data-testid="text-logged-in-as">
              Logged in as <span className="font-medium text-foreground">{user?.email}</span>
            </p>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your current password"
                        autoComplete="current-password"
                        data-testid="input-current-password"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your new password (min 8 characters)"
                        autoComplete="new-password"
                        data-testid="input-new-password"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                        data-testid="input-confirm-password"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                data-testid="button-update-password"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 border-t pt-4">
            <Button
              variant="ghost"
              className="w-full"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
