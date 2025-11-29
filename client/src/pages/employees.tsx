import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Key, Edit, ToggleLeft, ToggleRight, Shield, UserCheck, Users, Calculator, Phone, DollarSign, Clock, X, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { RoleGuard } from "@/lib/auth";

interface EmployeeOverview {
  employee: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    status: string;
    joinedAt: string;
  };
  kpi: {
    period: {
      month: number;
      year: number;
      timezone: string;
    };
    totalCU: number;
    completedCalls: number;
    incentive: number;
  };
  accounts: {
    clientId: number | null;
    clientName: string;
    totalCUThisMonth: number;
    completedCallsThisMonth: number;
    revenueThisMonthUSD: number;
    contractedCU: number | null;
    usageRate: number | null;
    lastActivityAt: string | null;
  }[];
}

type UserRole = "admin" | "pm" | "ra" | "finance";

const ROLES: { value: UserRole; label: string; icon: any }[] = [
  { value: "admin", label: "Admin", icon: Shield },
  { value: "pm", label: "Project Manager", icon: UserCheck },
  { value: "ra", label: "Research Associate", icon: Users },
  { value: "finance", label: "Finance", icon: Calculator },
];

function getRoleIcon(role: string) {
  const roleConfig = ROLES.find(r => r.value === role);
  return roleConfig?.icon || Users;
}

function getRoleLabel(role: string): string {
  const roleConfig = ROLES.find(r => r.value === role);
  return roleConfig?.label || role;
}

function getRoleVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "admin": return "destructive";
    case "pm": return "default";
    case "ra": return "secondary";
    case "finance": return "outline";
    default: return "secondary";
  }
}

function EmployeesContent() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [detailEmployeeId, setDetailEmployeeId] = useState<number | null>(null);
  
  const [createForm, setCreateForm] = useState({
    fullName: "",
    localPart: "",
    role: "ra" as UserRole,
    tempPassword: "",
  });
  
  const [editForm, setEditForm] = useState({
    fullName: "",
    role: "ra" as UserRole,
    isActive: true,
  });
  
  const [resetPasswordForm, setResetPasswordForm] = useState({
    tempPassword: "",
  });

  const { data: employees, isLoading } = useQuery<User[]>({
    queryKey: ["/api/employees"],
  });

  const { data: employeeOverview, isLoading: isOverviewLoading } = useQuery<EmployeeOverview>({
    queryKey: [`/api/employees/${detailEmployeeId}/overview`],
    enabled: !!detailEmployeeId && isDetailOpen,
  });

  const handleEmployeeClick = (employee: User) => {
    setDetailEmployeeId(employee.id);
    setIsDetailOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => 
      apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsCreateOpen(false);
      setCreateForm({ fullName: "", localPart: "", role: "ra", tempPassword: "" });
      toast({ title: "Employee created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create employee", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof editForm> }) =>
      apiRequest("PUT", `/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsEditOpen(false);
      setSelectedEmployee(null);
      toast({ title: "Employee updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update employee", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, tempPassword }: { id: number; tempPassword: string }) =>
      apiRequest("POST", `/api/employees/${id}/reset-password`, { tempPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsResetPasswordOpen(false);
      setSelectedEmployee(null);
      setResetPasswordForm({ tempPassword: "" });
      toast({ title: "Password reset successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to reset password", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(createForm);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee) {
      updateMutation.mutate({ id: selectedEmployee.id, data: editForm });
    }
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee) {
      resetPasswordMutation.mutate({ id: selectedEmployee.id, tempPassword: resetPasswordForm.tempPassword });
    }
  };

  const handleEditClick = (employee: User) => {
    setSelectedEmployee(employee);
    setEditForm({
      fullName: employee.fullName,
      role: employee.role as UserRole,
      isActive: employee.isActive ?? true,
    });
    setIsEditOpen(true);
  };

  const handleResetPasswordClick = (employee: User) => {
    setSelectedEmployee(employee);
    setResetPasswordForm({ tempPassword: "" });
    setIsResetPasswordOpen(true);
  };

  const handleToggleActive = (employee: User) => {
    updateMutation.mutate({ 
      id: employee.id, 
      data: { isActive: !(employee.isActive ?? true) } 
    });
  };

  const activeCount = employees?.filter(e => e.isActive !== false).length ?? 0;
  const inactiveCount = employees?.filter(e => e.isActive === false).length ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Employees</h1>
          <p className="text-muted-foreground">Manage internal team members and their access levels</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-employee">
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-count">{employees?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <ToggleRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-count">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground" data-testid="text-inactive-count">{inactiveCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-admin-count">
              {employees?.filter(e => e.role === "admin").length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : employees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No employees found. Add your first employee to get started.
                  </TableCell>
                </TableRow>
              ) : (
                employees?.map((employee) => {
                  const RoleIcon = getRoleIcon(employee.role);
                  return (
                    <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                      <TableCell className="font-medium" data-testid={`text-name-${employee.id}`}>
                        <button
                          onClick={() => handleEmployeeClick(employee)}
                          className="text-left hover:text-primary hover:underline cursor-pointer"
                          data-testid={`button-view-${employee.id}`}
                        >
                          {employee.fullName}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-email-${employee.id}`}>
                        {employee.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleVariant(employee.role)} className="gap-1" data-testid={`badge-role-${employee.id}`}>
                          <RoleIcon className="h-3 w-3" />
                          {getRoleLabel(employee.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={employee.isActive !== false ? "default" : "secondary"}
                          className={employee.isActive !== false ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
                          data-testid={`badge-status-${employee.id}`}
                        >
                          {employee.isActive !== false ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${employee.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(employee)} data-testid={`button-edit-${employee.id}`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPasswordClick(employee)} data-testid={`button-reset-password-${employee.id}`}>
                              <Key className="mr-2 h-4 w-4" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleActive(employee)} data-testid={`button-toggle-status-${employee.id}`}>
                              {employee.isActive !== false ? (
                                <>
                                  <ToggleLeft className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <ToggleRight className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new employee account with a @miraeconnext.com email address.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="John Doe"
                  required
                  data-testid="input-fullname"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="localPart">Email Username</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="localPart"
                    value={createForm.localPart}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, localPart: e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, '') }))}
                    placeholder="john.doe"
                    required
                    className="flex-1"
                    data-testid="input-localpart"
                  />
                  <span className="text-muted-foreground">@miraeconnext.com</span>
                </div>
                {createForm.localPart && (
                  <p className="text-xs text-muted-foreground">
                    Email will be: {createForm.localPart}@miraeconnext.com
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value: UserRole) => setCreateForm(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          <role.icon className="h-4 w-4" />
                          {role.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tempPassword">Temporary Password</Label>
                <Input
                  id="tempPassword"
                  type="password"
                  value={createForm.tempPassword}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, tempPassword: e.target.value }))}
                  placeholder="Enter temporary password"
                  required
                  data-testid="input-password"
                />
                <p className="text-xs text-muted-foreground">
                  Share this password securely with the employee. They should change it after first login.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                {createMutation.isPending ? "Creating..." : "Create Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information for {selectedEmployee?.fullName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editFullName">Full Name</Label>
                <Input
                  id="editFullName"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                  required
                  data-testid="input-edit-fullname"
                />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={selectedEmployee?.email ?? ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editRole">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value: UserRole) => setEditForm(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          <role.icon className="h-4 w-4" />
                          {role.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for {selectedEmployee?.fullName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPasswordSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="newTempPassword">New Temporary Password</Label>
                <Input
                  id="newTempPassword"
                  type="password"
                  value={resetPasswordForm.tempPassword}
                  onChange={(e) => setResetPasswordForm({ tempPassword: e.target.value })}
                  placeholder="Enter new temporary password"
                  required
                  data-testid="input-new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Share this password securely with the employee.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsResetPasswordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending} data-testid="button-submit-reset">
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailOpen} onOpenChange={(open) => {
        setIsDetailOpen(open);
        if (!open) setDetailEmployeeId(null);
      }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="sheet-employee-detail">
          <SheetHeader>
            <SheetTitle>Employee Details</SheetTitle>
          </SheetHeader>
          
          {isOverviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : employeeOverview ? (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {employeeOverview.employee.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold" data-testid="text-detail-name">
                    {employeeOverview.employee.fullName}
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-detail-email">
                    {employeeOverview.employee.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={getRoleVariant(employeeOverview.employee.role)} className="gap-1">
                      {(() => {
                        const RoleIcon = getRoleIcon(employeeOverview.employee.role);
                        return <RoleIcon className="h-3 w-3" />;
                      })()}
                      {getRoleLabel(employeeOverview.employee.role)}
                    </Badge>
                    <Badge 
                      variant={employeeOverview.employee.status === "active" ? "default" : "secondary"}
                      className={employeeOverview.employee.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
                    >
                      {employeeOverview.employee.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {employeeOverview.employee.joinedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Employee since {new Date(employeeOverview.employee.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">
                  Monthly Performance ({employeeOverview.kpi.period.month}/{employeeOverview.kpi.period.year})
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Total CU
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="text-xl font-bold" data-testid="text-detail-cu">
                        {employeeOverview.kpi.totalCU}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Calls
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="text-xl font-bold" data-testid="text-detail-calls">
                        {employeeOverview.kpi.completedCalls}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Incentive
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="text-xl font-bold" data-testid="text-detail-incentive">
                        {employeeOverview.employee.role === "admin" || employeeOverview.employee.role === "finance" 
                          ? "N/A" 
                          : `R$ ${employeeOverview.kpi.incentive.toLocaleString()}`}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {employeeOverview.employee.role === "pm" && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Accounts ({employeeOverview.accounts.length})
                </h4>
                {employeeOverview.accounts.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6 border rounded-md">
                    No accounts with activity this month
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead className="text-right">CU</TableHead>
                          <TableHead className="text-right">Calls</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Last Activity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeOverview.accounts.map((account, index) => (
                          <TableRow key={index} data-testid={`row-account-${index}`}>
                            <TableCell className="font-medium">
                              {account.clientName}
                            </TableCell>
                            <TableCell className="text-right">
                              {account.totalCUThisMonth}
                            </TableCell>
                            <TableCell className="text-right">
                              {account.completedCallsThisMonth}
                            </TableCell>
                            <TableCell className="text-right">
                              ${account.revenueThisMonthUSD.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm">
                              {account.lastActivityAt 
                                ? new Date(account.lastActivityAt).toLocaleDateString() 
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Failed to load employee details
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <RoleGuard requiredPage="employees">
      <EmployeesContent />
    </RoleGuard>
  );
}
