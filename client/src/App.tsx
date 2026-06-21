import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, ProtectedRoute } from "@/lib/auth";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import ProjectCreate from "@/pages/project-create";
import Experts from "@/pages/experts";
import ExpertDetail from "@/pages/expert-detail";
import Clients from "@/pages/clients";
import Companies from "@/pages/companies";
import InsightHub from "@/pages/insight-hub";
import Consultations from "@/pages/consultations";
import Usage from "@/pages/usage";
import BillableUsage from "@/pages/billable-usage";
import ExpertPayables from "@/pages/expert-payables";
import Contracts from "@/pages/contracts";
import Invoices from "@/pages/invoices";
import Expenses from "@/pages/expenses";
import Analytics from "@/pages/analytics";
import Employees from "@/pages/employees";
import EmailTemplates from "@/pages/email-templates";
import ExpertRegister from "@/pages/expert-register";
import ExpertInvite from "@/pages/expert-invite";
import ExpertOnboarding from "@/pages/expert-onboarding";
import ExpertProjectInvite from "@/pages/expert-project-invite";
import AdvisorProjectReview from "@/pages/advisor-project-review";
import QuickInviteOnboarding from "@/pages/quick-invite-onboarding";
import QuickInviteDecision from "@/pages/quick-invite-decision";
import ExpertProfile from "@/pages/expert-profile";
import Invites from "@/pages/invites";
import RaPerformance from "@/pages/ra-performance";
import PmPerformance from "@/pages/pm-performance";
import ClientShortlist from "@/pages/client-shortlist";
import ChangePassword from "@/pages/change-password";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import NotFound from "@/pages/not-found";

function MainLayout({ children }: { children: React.ReactNode }) {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ProtectedRoute>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto bg-background">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <Login />
      </Route>
      <Route path="/change-password">
        <ProtectedRoute allowChangePassword={true}>
          <ChangePassword />
        </ProtectedRoute>
      </Route>
      <Route path="/register/:token">
        {(params) => <ExpertRegister token={params.token} />}
      </Route>
      <Route path="/expert-invite/:token">
        {(params) => <ExpertInvite token={params.token} />}
      </Route>
      <Route path="/invite/:projectId/:inviteType/:token">
        {(params) => (
          <ExpertOnboarding 
            projectId={params.projectId} 
            inviteType={params.inviteType} 
            token={params.token} 
          />
        )}
      </Route>
      <Route path="/expert/project-invite/:token">
        {(params) => <ExpertProjectInvite />}
      </Route>
      <Route path="/public/advisor-project-review/:token">
        {(params) => <AdvisorProjectReview />}
      </Route>
      <Route path="/invite/onboarding/:token">
        {(params) => <QuickInviteOnboarding />}
      </Route>
      <Route path="/r/:token">
        {(params) => <QuickInviteOnboarding />}
      </Route>
      <Route path="/invite/decide/:token">
        {(params) => <QuickInviteDecision />}
      </Route>
      <Route path="/terms">
        <TermsPage />
      </Route>
      <Route path="/privacy">
        <PrivacyPage />
      </Route>
      <Route path="/app/dashboard">
        <MainLayout><Dashboard /></MainLayout>
      </Route>
      <Route path="/app/projects/new">
        <MainLayout><ProjectCreate /></MainLayout>
      </Route>
      <Route path="/app/projects/:id">
        <MainLayout><ProjectDetail /></MainLayout>
      </Route>
      <Route path="/app/projects">
        <MainLayout><Projects /></MainLayout>
      </Route>
      <Route path="/app/experts/:id">
        <MainLayout><ExpertDetail /></MainLayout>
      </Route>
      <Route path="/app/experts">
        <MainLayout><Experts /></MainLayout>
      </Route>
      <Route path="/app/companies">
        <MainLayout><Companies /></MainLayout>
      </Route>
      <Route path="/app/consultations">
        <MainLayout><Consultations /></MainLayout>
      </Route>
      <Route path="/app/finance">
        <MainLayout><Usage /></MainLayout>
      </Route>
      <Route path="/app/compliance-center">
        <MainLayout><NotFound /></MainLayout>
      </Route>
      <Route path="/app/expertise-coverage">
        <MainLayout><NotFound /></MainLayout>
      </Route>
      <Route path="/app/system-admin">
        <MainLayout><Employees /></MainLayout>
      </Route>
      <Route path="/projects/new">
        <MainLayout><ProjectCreate /></MainLayout>
      </Route>
      <Route path="/projects/:projectId/client-shortlist">
        <MainLayout><ClientShortlist /></MainLayout>
      </Route>
      <Route path="/projects/:id">
        <MainLayout><ProjectDetail /></MainLayout>
      </Route>
      <Route path="/projects">
        <MainLayout><Projects /></MainLayout>
      </Route>
      <Route path="/">
        <MainLayout><Dashboard /></MainLayout>
      </Route>
      <Route path="/experts/:id">
        <MainLayout><ExpertDetail /></MainLayout>
      </Route>
      <Route path="/experts">
        <MainLayout><Experts /></MainLayout>
      </Route>
      <Route path="/expert-profile/:id">
        {(params) => <MainLayout><ExpertProfile /></MainLayout>}
      </Route>
      <Route path="/clients">
        <MainLayout><Clients /></MainLayout>
      </Route>
      <Route path="/companies">
        <MainLayout><Companies /></MainLayout>
      </Route>
      <Route path="/insight-hub">
        <MainLayout><InsightHub /></MainLayout>
      </Route>
      <Route path="/consultations">
        <MainLayout><Consultations /></MainLayout>
      </Route>
      <Route path="/usage">
        <MainLayout><Usage /></MainLayout>
      </Route>
      <Route path="/billable-usage">
        <MainLayout><BillableUsage /></MainLayout>
      </Route>
      <Route path="/expert-payables">
        <MainLayout><ExpertPayables /></MainLayout>
      </Route>
      <Route path="/contracts">
        <MainLayout><Contracts /></MainLayout>
      </Route>
      <Route path="/invoices">
        <MainLayout><Invoices /></MainLayout>
      </Route>
      <Route path="/expenses">
        <MainLayout><Expenses /></MainLayout>
      </Route>
      <Route path="/analytics">
        <MainLayout><Analytics /></MainLayout>
      </Route>
      <Route path="/pm-performance">
        <MainLayout><PmPerformance /></MainLayout>
      </Route>
      <Route path="/employees">
        <MainLayout><Employees /></MainLayout>
      </Route>
      <Route path="/email-templates">
        <MainLayout><EmailTemplates /></MainLayout>
      </Route>
      <Route path="/invites">
        <MainLayout><Invites /></MainLayout>
      </Route>
      <Route path="/ra-performance">
        <MainLayout><RaPerformance /></MainLayout>
      </Route>
      <Route path="/ra-performance/:raId">
        <MainLayout><RaPerformance /></MainLayout>
      </Route>
      <Route>
        <MainLayout><NotFound /></MainLayout>
      </Route>
    </Switch>
  );
}

function isPublicAdvisorProjectReviewPath(pathname: string) {
  return pathname === "/public/advisor-project-review" || pathname.startsWith("/public/advisor-project-review/");
}

function App() {
  const isPublicAdvisorReview =
    typeof window !== "undefined" && isPublicAdvisorProjectReviewPath(window.location.pathname);

  if (isPublicAdvisorReview) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AdvisorProjectReview />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
