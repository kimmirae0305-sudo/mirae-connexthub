import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileQuestion,
  UserPlus,
  BarChart3,
  TrendingUp,
  Building2,
  Phone,
  LogOut,
  UsersRound,
  Settings,
  Mail,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { canAccessPage, type PageKey } from "@/lib/permissions";
import logoUrl from "@assets/Logo_1764382033313.png";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  pageKey: PageKey;
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    pageKey: "dashboard",
  },
  {
    title: "Projects",
    url: "/projects",
    icon: Briefcase,
    pageKey: "projects",
  },
  {
    title: "Experts",
    url: "/experts",
    icon: Users,
    pageKey: "experts",
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Building2,
    pageKey: "clients",
  },
];

const managementItems: NavItem[] = [
  {
    title: "Insight Hub",
    url: "/insight-hub",
    icon: FileQuestion,
    pageKey: "insight-hub",
  },
  {
    title: "Consultations",
    url: "/consultations",
    icon: Phone,
    pageKey: "consultations",
  },
  {
    title: "Invites",
    url: "/invites",
    icon: Mail,
    pageKey: "invites",
  },
  {
    title: "Usage Tracker",
    url: "/usage",
    icon: BarChart3,
    pageKey: "usage",
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: TrendingUp,
    pageKey: "analytics",
  },
];

const adminItems: NavItem[] = [
  {
    title: "Employees",
    url: "/employees",
    icon: UsersRound,
    pageKey: "employees",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: "Admin",
      pm: "Project Manager",
      ra: "Research Associate",
      finance: "Finance",
    };
    return roleLabels[role] || role;
  };

  const filterItemsByRole = (items: NavItem[]): NavItem[] => {
    if (!user) return [];
    return items.filter(item => canAccessPage(user.role, item.pageKey));
  };

  const filteredMainItems = filterItemsByRole(mainNavItems);
  const filteredManagementItems = filterItemsByRole(managementItems);
  const filteredAdminItems = filterItemsByRole(adminItems);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <img src={logoUrl} alt="Mirae Connext" className="h-8 w-8 object-contain" />
          <div className="flex flex-col">
            <span className="text-base font-semibold text-sidebar-foreground">Mirae Connext</span>
            <span className="text-xs text-muted-foreground">Knowledge Gateway</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        {filteredMainItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Overview
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                      className="gap-3"
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {filteredManagementItems.length > 0 && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredManagementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="gap-3"
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(' ', '-')}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {filteredAdminItems.length > 0 && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="gap-3"
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <span className="text-xs font-medium" data-testid="text-user-initials">
                {user ? getInitials(user.fullName) : "??"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium" data-testid="text-user-name">
                {user?.fullName || "Loading..."}
              </span>
              <span className="text-xs text-muted-foreground" data-testid="text-user-role">
                {user ? getRoleBadge(user.role) : ""}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            title="Sign out"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
