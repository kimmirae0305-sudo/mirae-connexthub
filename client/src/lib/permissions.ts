export type UserRole = "admin" | "pm" | "ra" | "finance";

export type PageKey = 
  | "dashboard"
  | "projects"
  | "experts"
  | "clients"
  | "insight-hub"
  | "consultations"
  | "usage"
  | "analytics"
  | "employees"
  | "settings";

/**
 * Normalize role names from database to internal system roles.
 * Maps "Research Associate" to "ra" for backward compatibility.
 */
export function normalizeRole(dbRole: string | null | undefined): UserRole | undefined {
  if (!dbRole) return undefined;
  const normalized = dbRole.toLowerCase();
  if (normalized === "research associate" || normalized === "ra") return "ra";
  if (normalized === "pm" || normalized === "project manager") return "pm";
  if (normalized === "admin" || normalized === "administrator") return "admin";
  if (normalized === "finance") return "finance";
  return undefined;
}

export const ROLE_PERMISSIONS: Record<UserRole, PageKey[]> = {
  admin: [
    "dashboard",
    "projects",
    "experts",
    "clients",
    "insight-hub",
    "consultations",
    "usage",
    "analytics",
    "employees",
    "settings",
  ],
  pm: [
    "dashboard",
    "projects",
    "experts",
    "clients",
    "insight-hub",
    "consultations",
    "usage",
  ],
  ra: [
    "dashboard",
    "projects",
    "experts",
    "clients",
    "insight-hub",
    "consultations",
  ],
  finance: [
    "dashboard",
    "clients",
    "usage",
    "analytics",
  ],
};

export const PAGE_TO_ROUTE: Record<PageKey, string> = {
  dashboard: "/",
  projects: "/projects",
  experts: "/experts",
  clients: "/clients",
  "insight-hub": "/insight-hub",
  consultations: "/consultations",
  usage: "/usage",
  analytics: "/analytics",
  employees: "/employees",
  settings: "/settings",
};

export const ROUTE_TO_PAGE: Record<string, PageKey> = {
  "/": "dashboard",
  "/projects": "projects",
  "/experts": "experts",
  "/clients": "clients",
  "/insight-hub": "insight-hub",
  "/consultations": "consultations",
  "/usage": "usage",
  "/analytics": "analytics",
  "/employees": "employees",
  "/settings": "settings",
};

export function canAccessPage(role: string | undefined, page: PageKey): boolean {
  if (!role) return false;
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  const permissions = ROLE_PERMISSIONS[normalized];
  if (!permissions) return false;
  return permissions.includes(page);
}

export function canAccessRoute(role: string | undefined, route: string): boolean {
  const basePath = route.split("/").slice(0, 2).join("/") || "/";
  const page = ROUTE_TO_PAGE[basePath];
  if (!page) return true;
  return canAccessPage(role, page);
}

export function getAllowedPages(role: string | undefined): PageKey[] {
  if (!role) return [];
  const normalized = normalizeRole(role);
  if (!normalized) return [];
  return ROLE_PERMISSIONS[normalized] || [];
}
