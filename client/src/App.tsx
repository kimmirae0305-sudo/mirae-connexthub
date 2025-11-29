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
import Experts from "@/pages/experts";
import Clients from "@/pages/clients";
import InsightHub from "@/pages/insight-hub";
import Assignments from "@/pages/assignments";
import Consultations from "@/pages/consultations";
import Usage from "@/pages/usage";
import Analytics from "@/pages/analytics";
import Employees from "@/pages/employees";
import ExpertRegister from "@/pages/expert-register";
import ExpertInvite from "@/pages/expert-invite";
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
      <Route path="/register/:token">
        {(params) => <ExpertRegister token={params.token} />}
      </Route>
      <Route path="/expert-invite/:token">
        {(params) => <ExpertInvite token={params.token} />}
      </Route>
      <Route path="/">
        <MainLayout><Dashboard /></MainLayout>
      </Route>
      <Route path="/projects">
        <MainLayout><Projects /></MainLayout>
      </Route>
      <Route path="/projects/:id">
        <MainLayout><ProjectDetail /></MainLayout>
      </Route>
      <Route path="/experts">
        <MainLayout><Experts /></MainLayout>
      </Route>
      <Route path="/clients">
        <MainLayout><Clients /></MainLayout>
      </Route>
      <Route path="/insight-hub">
        <MainLayout><InsightHub /></MainLayout>
      </Route>
      <Route path="/assignments">
        <MainLayout><Assignments /></MainLayout>
      </Route>
      <Route path="/consultations">
        <MainLayout><Consultations /></MainLayout>
      </Route>
      <Route path="/usage">
        <MainLayout><Usage /></MainLayout>
      </Route>
      <Route path="/analytics">
        <MainLayout><Analytics /></MainLayout>
      </Route>
      <Route path="/employees">
        <MainLayout><Employees /></MainLayout>
      </Route>
      <Route>
        <MainLayout><NotFound /></MainLayout>
      </Route>
    </Switch>
  );
}

function App() {
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
