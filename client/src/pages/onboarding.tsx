import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Building2,
  Store,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { AtlasFlowProvider, useAtlasFlow, type FlowType } from "@/lib/atlas-flow";
import { EnterpriseFlow } from "@/components/atlas/enterprise-flow";
import { SMBFlow } from "@/components/atlas/smb-flow";
import type { CompanySizeType } from "@shared/schema";

function FlowTypeSelector() {
  const { t, isRTL } = useI18n();
  const { setFlowType, nextStep } = useAtlasFlow();
  const [selected, setSelected] = useState<FlowType | null>(null);

  const companyTypeTranslations = t.onboarding?.companyType as Record<string, string> | undefined;

  const handleSelect = (type: FlowType) => {
    setSelected(type);
  };

  const handleContinue = () => {
    if (selected) {
      setFlowType(selected);
      nextStep();
    }
  };

  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <div className="border-b bg-card/50 px-6 py-6">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-medium text-foreground">
            {t.onboarding?.title || "إعداد الحساب"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {companyTypeTranslations?.title || "ما هو نوع شركتك؟"}
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          <Card
            className={cn(
              "cursor-pointer transition-all hover-elevate",
              selected === "enterprise" && "border-primary border-2 bg-primary/5"
            )}
            onClick={() => handleSelect("enterprise")}
            data-testid="card-flow-type-enterprise"
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0",
                  selected === "enterprise" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Building2 className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium">
                    {companyTypeTranslations?.enterprise || "مؤسسة / شركة كبيرة"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {companyTypeTranslations?.enterpriseDesc || "حلول مخصصة مع دعم متخصص"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "cursor-pointer transition-all hover-elevate",
              selected === "smb" && "border-primary border-2 bg-primary/5"
            )}
            onClick={() => handleSelect("smb")}
            data-testid="card-flow-type-smb"
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0",
                  selected === "smb" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Store className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium">
                    {companyTypeTranslations?.smb || "شركة صغيرة / متوسطة"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {companyTypeTranslations?.smbDesc || "حلول جاهزة للشركات الناشئة"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full h-12"
            disabled={!selected}
            onClick={handleContinue}
            data-testid="button-continue-flow"
          >
            {t.onboarding?.next || "التالي"}
            <ArrowIcon className="h-4 w-4 ms-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AtlasOnboardingContent() {
  const { state } = useAtlasFlow();
  const { toast } = useToast();
  const { t } = useI18n();

  const completeOnboardingMutation = useMutation({
    mutationFn: async (data: { companySize: CompanySizeType; selectedUseCase: string }) => {
      return apiRequest("POST", "/api/onboarding/complete", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
      window.location.href = "/dashboard";
    },
    onError: () => {
      toast({
        title: t.common?.error || "خطأ",
        description: "فشل إكمال الإعداد.",
        variant: "destructive",
      });
    },
  });

  if (!state.flowType) {
    return <FlowTypeSelector />;
  }

  if (state.flowType === "enterprise") {
    return (
      <EnterpriseFlow 
        onComplete={() => {
          completeOnboardingMutation.mutate({
            companySize: "enterprise",
            selectedUseCase: state.selectedUseCase || "inventory",
          });
        }}
      />
    );
  }

  if (state.flowType === "smb") {
    return (
      <SMBFlow 
        onComplete={() => {
          completeOnboardingMutation.mutate({
            companySize: "smb",
            selectedUseCase: state.selectedUseCase || "inventory",
          });
        }}
      />
    );
  }

  return <FlowTypeSelector />;
}

export default function Onboarding() {
  return (
    <AtlasFlowProvider>
      <AtlasOnboardingContent />
    </AtlasFlowProvider>
  );
}
