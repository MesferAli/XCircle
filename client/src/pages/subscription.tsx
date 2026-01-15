import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoyasarPaymentForm } from "@/components/moyasar-payment-form";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown, Zap, Users, Package, Headphones, Brain, Calendar, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import type { SubscriptionPlan, Subscription } from "@shared/schema";

interface SubscriptionWithPlan extends Subscription {
  plan: SubscriptionPlan;
}

function formatPrice(priceHalalas: number, language: string): string {
  const priceInSAR = priceHalalas / 100;
  if (language === "ar") {
    return `${priceInSAR} ر.س/شهر`;
  }
  return `SAR ${priceInSAR}/month`;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "trial":
      return "secondary";
    case "past_due":
    case "expired":
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function CurrentSubscriptionCard({ subscription, t, language }: { 
  subscription: SubscriptionWithPlan; 
  t: ReturnType<typeof useI18n>["t"];
  language: string;
}) {
  const dateLocale = language === "ar" ? ar : enUS;
  const planName = language === "ar" ? subscription.plan.nameAr : subscription.plan.name;
  const statusLabel = t.subscription?.status?.[subscription.status as keyof typeof t.subscription.status] || subscription.status;

  return (
    <Card className="mb-8 border-primary/20 bg-primary/5" data-testid="card-current-subscription">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t.subscription?.currentPlan || "Current Plan"}</CardTitle>
              <CardDescription>{planName}</CardDescription>
            </div>
          </div>
          <Badge variant={getStatusBadgeVariant(subscription.status)} data-testid="badge-subscription-status">
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t.subscription?.periodStart || "Period Start"}:</span>
            <span className="font-medium">
              {subscription.currentPeriodStart 
                ? format(new Date(subscription.currentPeriodStart), "PPP", { locale: dateLocale })
                : "-"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t.subscription?.periodEnd || "Period End"}:</span>
            <span className="font-medium">
              {subscription.currentPeriodEnd 
                ? format(new Date(subscription.currentPeriodEnd), "PPP", { locale: dateLocale })
                : "-"}
            </span>
          </div>
          {subscription.trialEndsAt && (
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t.subscription?.trialEnds || "Trial Ends"}:</span>
              <span className="font-medium">
                {format(new Date(subscription.trialEndsAt), "PPP", { locale: dateLocale })}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCard({ 
  plan, 
  isCurrentPlan, 
  onSelect, 
  isPending,
  t,
  language 
}: { 
  plan: SubscriptionPlan; 
  isCurrentPlan: boolean;
  onSelect: () => void;
  isPending: boolean;
  t: ReturnType<typeof useI18n>["t"];
  language: string;
}) {
  const planName = language === "ar" ? plan.nameAr : plan.name;
  const planDescription = language === "ar" ? plan.descriptionAr : plan.description;
  const features = (language === "ar" ? plan.featuresAr : plan.features) as string[] || [];

  return (
    <Card 
      className={isCurrentPlan ? "border-primary border-2 relative" : ""} 
      data-testid={`card-plan-${plan.id}`}
    >
      {isCurrentPlan && (
        <Badge 
          className="absolute -top-3 start-4" 
          data-testid={`badge-current-plan-${plan.id}`}
        >
          {t.subscription?.currentPlan || "Current Plan"}
        </Badge>
      )}
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{planName}</CardTitle>
        {planDescription && (
          <CardDescription>{planDescription}</CardDescription>
        )}
        <div className="pt-2">
          <span className="text-3xl font-bold">{formatPrice(plan.priceMonthly, language)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            <span>
              {t.subscription?.maxConnectors || "Max Connectors"}: <strong>{plan.maxConnectors}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-primary" />
            <span>
              {t.subscription?.maxUsers || "Max Users"}: <strong>{plan.maxUsers}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            <span>
              {t.subscription?.maxItems || "Max Items"}: <strong>{plan.maxItems?.toLocaleString()}</strong>
            </span>
          </div>
          {plan.aiRecommendations && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Brain className="h-4 w-4" />
              <span>{t.subscription?.aiRecommendations || "AI Recommendations"}</span>
            </div>
          )}
          {plan.prioritySupport && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Headphones className="h-4 w-4" />
              <span>{t.subscription?.prioritySupport || "Priority Support"}</span>
            </div>
          )}
        </div>
        
        {features.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          variant={isCurrentPlan ? "secondary" : "default"}
          disabled={isCurrentPlan || isPending}
          onClick={onSelect}
          data-testid={`button-select-plan-${plan.id}`}
        >
          {isPending 
            ? (t.common?.loading || "Loading...") 
            : isCurrentPlan 
              ? (t.subscription?.currentPlan || "Current Plan")
              : (t.subscription?.selectPlan || "Select Plan")}
        </Button>
      </CardFooter>
    </Card>
  );
}

function PlansLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
            <Skeleton className="h-8 w-28 mt-4" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default function SubscriptionPage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const qClient = useQueryClient();
  const searchString = useSearch();
  const [, navigate] = useLocation();
  
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentResult, setPaymentResult] = useState<"success" | "failed" | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const { data: currentSubscription, isLoading: subscriptionLoading } = useQuery<SubscriptionWithPlan | null>({
    queryKey: ["/api/subscriptions/current"],
  });

  // Handle URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const planParam = params.get("plan");
    const paymentParam = params.get("payment");

    // Check for payment result from callback
    if (paymentParam === "success") {
      setPaymentResult("success");
      qClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
      qClient.invalidateQueries({ queryKey: ["/api/tenant"] });
      // Clear the URL parameter
      navigate("/subscription", { replace: true });
    } else if (paymentParam === "failed" || paymentParam === "error") {
      setPaymentResult("failed");
      navigate("/subscription", { replace: true });
    }

    // Check for plan selection from trial expired screen
    if (planParam && plans) {
      const plan = plans.find(p => p.id === planParam || p.name.toLowerCase() === planParam.toLowerCase());
      if (plan) {
        setSelectedPlan(plan);
        setShowPaymentModal(true);
        navigate("/subscription", { replace: true });
      }
    }
  }, [searchString, plans, navigate, qClient]);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = (paymentId: string) => {
    setShowPaymentModal(false);
    setPaymentResult("success");
    qClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
    qClient.invalidateQueries({ queryKey: ["/api/tenant"] });
    toast({
      title: language === "ar" ? "تم الدفع بنجاح" : "Payment Successful",
      description: language === "ar" ? "تم تفعيل اشتراكك بنجاح" : "Your subscription has been activated successfully.",
    });
  };

  const handlePaymentError = (error: string) => {
    setShowPaymentModal(false);
    toast({
      title: language === "ar" ? "فشل الدفع" : "Payment Failed",
      description: error,
      variant: "destructive",
    });
  };

  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
    setSelectedPlan(null);
  };

  const sortedPlans = plans?.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) || [];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t.subscription?.title || "Subscription"}
        description={t.subscription?.description || "Manage your subscription and billing"}
      />

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Payment Result Notifications */}
          {paymentResult === "success" && (
            <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950/20" data-testid="card-payment-success">
              <CardContent className="flex items-center gap-4 py-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-200">
                    {language === "ar" ? "تم الدفع بنجاح!" : "Payment Successful!"}
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {language === "ar" ? "تم تفعيل اشتراكك بنجاح." : "Your subscription has been activated."}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="ms-auto"
                  onClick={() => setPaymentResult(null)}
                >
                  {language === "ar" ? "إغلاق" : "Dismiss"}
                </Button>
              </CardContent>
            </Card>
          )}

          {paymentResult === "failed" && (
            <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-950/20" data-testid="card-payment-failed">
              <CardContent className="flex items-center gap-4 py-4">
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200">
                    {language === "ar" ? "فشل الدفع" : "Payment Failed"}
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {language === "ar" ? "حدث خطأ أثناء معالجة الدفع. يرجى المحاولة مرة أخرى." : "An error occurred processing your payment. Please try again."}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="ms-auto"
                  onClick={() => setPaymentResult(null)}
                >
                  {language === "ar" ? "إغلاق" : "Dismiss"}
                </Button>
              </CardContent>
            </Card>
          )}

          {subscriptionLoading ? (
            <Card className="mb-8">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-8">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </CardContent>
            </Card>
          ) : currentSubscription ? (
            <CurrentSubscriptionCard 
              subscription={currentSubscription} 
              t={t} 
              language={language} 
            />
          ) : null}

          <div className="mb-6">
            <h2 className="text-xl font-medium mb-2" data-testid="heading-available-plans">
              {t.subscription?.availablePlans || "Available Plans"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t.subscription?.choosePlan || "Choose the plan that best fits your needs"}
            </p>
          </div>

          {plansLoading ? (
            <PlansLoadingSkeleton />
          ) : sortedPlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrentPlan={currentSubscription?.planId === plan.id}
                  onSelect={() => handleSelectPlan(plan)}
                  isPending={false}
                  t={t}
                  language={language}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {t.subscription?.noPlansAvailable || "No subscription plans available"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => !open && handlePaymentCancel()}>
        <DialogContent className="max-w-lg p-0 overflow-hidden" data-testid="dialog-payment">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {language === "ar" ? "الدفع الآمن" : "Secure Payment"}
            </DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <MoyasarPaymentForm
              planId={selectedPlan.id}
              planName={language === "ar" ? selectedPlan.nameAr : selectedPlan.name}
              amount={selectedPlan.priceMonthly / 100}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              onCancel={handlePaymentCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
