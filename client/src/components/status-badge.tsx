import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  type?: "project" | "expert" | "assignment" | "call";
}

const projectStatusStyles: Record<string, string> = {
  new: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  sourcing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  pending_client_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  client_selected: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  scheduled: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const expertStatusStyles: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  busy: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const assignmentStatusStyles: Record<string, string> = {
  assigned: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  invited: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  declined: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  client_selected: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  scheduled: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const callStatusStyles: Record<string, string> = {
  pending: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  no_show: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

const statusLabels: Record<string, string> = {
  pending_client_review: "Client Review",
  client_selected: "Client Selected",
  no_show: "No Show",
};

export function StatusBadge({ status, type = "project" }: StatusBadgeProps) {
  const styles = 
    type === "expert" 
      ? expertStatusStyles 
      : type === "assignment" 
        ? assignmentStatusStyles 
        : type === "call"
          ? callStatusStyles
          : projectStatusStyles;

  const statusStyle = styles[status.toLowerCase()] || projectStatusStyles.pending;
  const label = statusLabels[status.toLowerCase()] || status.replace(/_/g, " ");

  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize no-default-hover-elevate no-default-active-elevate",
        statusStyle
      )}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      {label}
    </Badge>
  );
}
