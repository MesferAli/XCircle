import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Building2,
  Lock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface SubscriptionPlan {
  id: string;
  name: string;
  nameAr: string;
}

interface Subscription {
  id: string;
  status: "active" | "trial" | "expired" | "cancelled";
  plan?: SubscriptionPlan;
  startDate?: string;
  endDate?: string;
}

interface Tenant {
  id: string;
  name: string;
  status: "active" | "suspended" | "onboarding";
  subscription?: Subscription;
  userCount?: number;
  createdAt: string;
}

type TenantStatus = "active" | "suspended" | "onboarding";

export default function AdminCustomers() {
  const { t, language, isRTL } = useI18n();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [newStatus, setNewStatus] = useState<TenantStatus | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const isAuthorized = user?.platformRole === "platform_admin";

  const { data: tenants, isLoading, error } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
    enabled: isAuthorized && !authLoading,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TenantStatus }) => {
      const response = await apiRequest("PATCH", `/api/admin/tenants/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({
        title: t.common.success,
        description: language === "ar" ? "تم تحديث حالة العميل بنجاح" : "Customer status updated successfully",
      });
      setConfirmDialogOpen(false);
      setSelectedTenant(null);
      setNewStatus(null);
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: language === "ar" ? "فشل في تحديث حالة العميل" : "Failed to update customer status",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (tenant: Tenant, status: TenantStatus) => {
    if (status !== tenant.status) {
      setSelectedTenant(tenant);
      setNewStatus(status);
      setConfirmDialogOpen(true);
    }
  };

  const confirmStatusChange = () => {
    if (selectedTenant && newStatus) {
      updateStatusMutation.mutate({ id: selectedTenant.id, status: newStatus });
    }
  };

  const getStatusBadgeVariant = (status: TenantStatus) => {
    switch (status) {
      case "active":
        return "default";
      case "suspended":
        return "destructive";
      case "onboarding":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadgeClass = (status: TenantStatus) => {
    switch (status) {
      case "active":
        return "bg-chart-2 text-white";
      case "suspended":
        return "bg-destructive text-destructive-foreground";
      case "onboarding":
        return "bg-chart-4 text-white";
      default:
        return "";
    }
  };

  const getSubscriptionStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-chart-2/10 text-chart-2";
      case "trial":
        return "bg-chart-4/10 text-chart-4";
      case "expired":
        return "bg-muted text-muted-foreground";
      case "cancelled":
        return "bg-destructive/10 text-destructive";
      default:
        return "";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const stats = {
    total: tenants?.length || 0,
    active: tenants?.filter((t) => t.status === "active").length || 0,
    suspended: tenants?.filter((t) => t.status === "suspended").length || 0,
    onboarding: tenants?.filter((t) => t.status === "onboarding").length || 0,
  };

  const getStatusLabel = (status: TenantStatus) => {
    return t.admin.customers.status[status];
  };

  const getSubscriptionStatusLabel = (status: string) => {
    const statusKey = status as keyof typeof t.admin.customers.subscriptionStatus;
    return t.admin.customers.subscriptionStatus[statusKey] || status;
  };

  const getPlanName = (subscription?: Subscription) => {
    if (!subscription?.plan) return t.admin.customers.noPlan;
    return language === "ar" ? subscription.plan.nameAr : subscription.plan.name;
  };

  if (authLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title={t.admin.customers.title}
          description={t.admin.customers.description}
        />
        <ScrollArea className="flex-1">
          <div className="p-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title={t.admin.customers.title}
          description={t.admin.customers.description}
        />
        <ScrollArea className="flex-1">
          <div className="p-6 flex items-center justify-center min-h-[500px]">
            <Card className="max-w-md w-full" data-testid="card-access-denied">
              <CardContent className="p-8 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <Lock className="h-7 w-7" />
                  </div>
                </div>
                <h2 className="text-lg font-semibold">
                  {t.admin.customers.accessDenied}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t.admin.customers.accessDeniedDescription}
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t.admin.customers.title}
        description={t.admin.customers.description}
      />

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-9 w-16 mb-2" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <Card data-testid="stat-total-customers">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          {t.admin.customers.totalCustomers}
                        </span>
                        <span className="text-3xl font-light tracking-tight">{stats.total}</span>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="stat-active-customers">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          {t.admin.customers.activeCustomers}
                        </span>
                        <span className="text-3xl font-light tracking-tight">{stats.active}</span>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                        <UserCheck className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="stat-suspended-customers">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          {t.admin.customers.suspendedCustomers}
                        </span>
                        <span className="text-3xl font-light tracking-tight">{stats.suspended}</span>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <UserX className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="stat-onboarding-customers">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          {t.admin.customers.onboardingCustomers}
                        </span>
                        <span className="text-3xl font-light tracking-tight">{stats.onboarding}</span>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4">
                        <UserPlus className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                      <Skeleton className="h-10 w-10 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-6">
                  <EmptyState
                    icon={Building2}
                    title={t.common.error}
                    description={language === "ar" ? "فشل في تحميل بيانات العملاء" : "Failed to load customer data"}
                  />
                </div>
              ) : tenants && tenants.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={isRTL ? "text-right" : "text-left"}>
                        {t.admin.customers.columns.customerName}
                      </TableHead>
                      <TableHead className={isRTL ? "text-right" : "text-left"}>
                        {t.admin.customers.columns.status}
                      </TableHead>
                      <TableHead className={isRTL ? "text-right" : "text-left"}>
                        {t.admin.customers.columns.subscriptionPlan}
                      </TableHead>
                      <TableHead className={isRTL ? "text-right" : "text-left"}>
                        {t.admin.customers.columns.subscriptionStatus}
                      </TableHead>
                      <TableHead className={isRTL ? "text-right" : "text-left"}>
                        {t.admin.customers.columns.createdAt}
                      </TableHead>
                      <TableHead className={isRTL ? "text-right" : "text-left"}>
                        {t.admin.customers.columns.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{tenant.name}</p>
                              {tenant.userCount !== undefined && (
                                <p className="text-xs text-muted-foreground">
                                  {tenant.userCount} {language === "ar" ? "مستخدم" : "users"}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={getStatusBadgeClass(tenant.status)}
                            data-testid={`badge-status-${tenant.id}`}
                          >
                            {getStatusLabel(tenant.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getPlanName(tenant.subscription)}</span>
                        </TableCell>
                        <TableCell>
                          {tenant.subscription?.status ? (
                            <Badge
                              variant="outline"
                              className={getSubscriptionStatusBadgeClass(tenant.subscription.status)}
                              data-testid={`badge-subscription-${tenant.id}`}
                            >
                              {getSubscriptionStatusLabel(tenant.subscription.status)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(tenant.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={tenant.status}
                            onValueChange={(value) => handleStatusChange(tenant, value as TenantStatus)}
                          >
                            <SelectTrigger
                              className="w-36"
                              data-testid={`select-status-${tenant.id}`}
                            >
                              <SelectValue placeholder={t.admin.customers.changeStatus} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active" data-testid={`option-active-${tenant.id}`}>
                                {t.admin.customers.status.active}
                              </SelectItem>
                              <SelectItem value="suspended" data-testid={`option-suspended-${tenant.id}`}>
                                {t.admin.customers.status.suspended}
                              </SelectItem>
                              <SelectItem value="onboarding" data-testid={`option-onboarding-${tenant.id}`}>
                                {t.admin.customers.status.onboarding}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6">
                  <EmptyState
                    icon={Building2}
                    title={t.admin.customers.noCustomers}
                    description={t.admin.customers.noCustomersDesc}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.admin.customers.confirmStatusChange}</DialogTitle>
            <DialogDescription>
              {t.admin.customers.confirmStatusChangeDesc}{" "}
              <Badge className={newStatus ? getStatusBadgeClass(newStatus) : ""}>
                {newStatus ? getStatusLabel(newStatus) : ""}
              </Badge>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              data-testid="button-cancel-status-change"
            >
              {t.common.cancel}
            </Button>
            <Button
              onClick={confirmStatusChange}
              disabled={updateStatusMutation.isPending}
              data-testid="button-confirm-status-change"
            >
              {updateStatusMutation.isPending ? t.common.loading : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
