import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  type?: "project" | "expert" | "assignment";
}

const projectStatusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const expertStatusStyles: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  busy: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const assignmentStatusStyles: Record<string, string> = {
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function StatusBadge({ status, type = "project" }: StatusBadgeProps) {
  const styles = 
    type === "expert" 
      ? expertStatusStyles 
      : type === "assignment" 
        ? assignmentStatusStyles 
        : projectStatusStyles;

  const statusStyle = styles[status.toLowerCase()] || styles.pending;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize no-default-hover-elevate no-default-active-elevate",
        statusStyle
      )}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      {status}
    </Badge>
  );
}
