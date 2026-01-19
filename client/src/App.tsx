import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { EnvironmentBanner } from "@/components/environment-banner";
import { TrialBanner } from "@/components/trial-banner";
import { TrialExpiredScreen } from "@/components/trial-expired-screen";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

/**
 * OPTIMIZATION: Route-based code splitting with React.lazy()
 *
 * Pages are loaded on-demand when the user navigates to them.
 * This reduces the initial bundle size significantly, improving
 * Time to First Contentful Paint (FCP) and Largest Contentful Paint (LCP).
 *
 * Dashboard is NOT lazy-loaded as it's the default route.
 */

// Eagerly loaded - the main entry point
import Dashboard from "@/pages/dashboard";

// Lazy loaded pages - only loaded when navigated to
const Connectors = lazy(() => import("@/pages/connectors"));
const Mappings = lazy(() => import("@/pages/mappings"));
const Recommendations = lazy(() => import("@/pages/recommendations"));
const Anomalies = lazy(() => import("@/pages/anomalies"));
const Capabilities = lazy(() => import("@/pages/capabilities"));
const Policies = lazy(() => import("@/pages/policies"));
const Audit = lazy(() => import("@/pages/audit"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const Help = lazy(() => import("@/pages/help"));
const NotFound = lazy(() => import("@/pages/not-found"));
const LoginPage = lazy(() => import("@/pages/login"));
const RegisterPage = lazy(() => import("@/pages/register"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const LandingPage = lazy(() => import("@/pages/landing"));
const AdminCustomers = lazy(() => import("@/pages/admin/customers"));
const SubscriptionPage = lazy(() => import("@/pages/subscription"));

// Eagerly loaded onboarding for fast initial experience
import OnboardingEager from "@/pages/onboarding";

/**
 * Page loading fallback component
 */
function PageLoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading page...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/connectors" component={Connectors} />
        <Route path="/mappings" component={Mappings} />
        <Route path="/recommendations" component={Recommendations} />
        <Route path="/anomalies" component={Anomalies} />
        <Route path="/capabilities" component={Capabilities} />
        <Route path="/policies" component={Policies} />
        <Route path="/audit" component={Audit} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/subscription" component={SubscriptionPage} />
        <Route path="/admin/customers" component={AdminCustomers} />
        <Route path="/help" component={Help} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

interface OnboardingStatus {
  onboardingCompleted: boolean;
  companySize: string | null;
  selectedUseCase: string | null;
  trialExpired?: boolean;
}

interface TenantInfo {
  id: string;
  name: string;
  status: string;
  companySize: string | null;
  trialEndsAt: string | null;
  onboardingCompleted: boolean;
}

function AuthenticatedApp() {
  const [location, navigate] = useLocation();
  const [showMeetingForm, setShowMeetingForm] = useState(false);

  const { data: onboardingStatus, isLoading: isOnboardingLoading, error: onboardingError } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding/status"],
    retry: 2,
    retryDelay: 500,
  });

  const { data: tenant, isLoading: isTenantLoading } = useQuery<TenantInfo>({
    queryKey: ["/api/tenant"],
    enabled: !!onboardingStatus?.onboardingCompleted,
  });

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  useEffect(() => {
    if (onboardingStatus && !onboardingStatus.onboardingCompleted && location !== "/onboarding") {
      navigate("/onboarding");
    }
  }, [onboardingStatus, location, navigate]);

  if (isOnboardingLoading || isTenantLoading) {
    return <LoadingScreen />;
  }

  if (onboardingError || !onboardingStatus?.onboardingCompleted) {
    // Use eagerly loaded onboarding for fast initial experience
    return <OnboardingEager />;
  }

  // Check if trial has expired
  const isTrialExpired = tenant?.status === "trial_expired" || (
    tenant?.trialEndsAt && new Date(tenant.trialEndsAt) < new Date()
  );

  if (isTrialExpired && tenant) {
    const companyType = tenant.companySize === "enterprise" ? "enterprise" : "smb";
    return (
      <TrialExpiredScreen
        companyType={companyType}
        onScheduleMeeting={() => {
          // Navigate to meeting scheduling or show form
          window.open("https://calendly.com/atlas-enterprise", "_blank");
        }}
        onSelectPlan={(planId) => {
          // Navigate to subscription page with plan selection
          navigate(`/subscription?plan=${planId}`);
        }}
      />
    );
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <EnvironmentBanner />
          <TrialBanner />
          <main className="flex-1 flex flex-col overflow-hidden">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function UnauthenticatedRouter() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route component={LandingPage} />
      </Switch>
    </Suspense>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <UnauthenticatedRouter />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
