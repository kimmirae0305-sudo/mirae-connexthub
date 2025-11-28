import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import Experts from "@/pages/experts";
import Vetting from "@/pages/vetting";
import Assignments from "@/pages/assignments";
import Usage from "@/pages/usage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={Projects} />
      <Route path="/experts" component={Experts} />
      <Route path="/vetting" component={Vetting} />
      <Route path="/assignments" component={Assignments} />
      <Route path="/usage" component={Usage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-auto bg-background">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
