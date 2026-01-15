import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type FlowType = "enterprise" | "smb";

export type EnterpriseStep = 
  | "entry"
  | "select-system"
  | "access-type"
  | "sandbox"
  | "select-use-case"
  | "preview"
  | "execution"
  | "success"
  | "error"
  | "activate-production";

export type SMBStep = 
  | "entry"
  | "select-tools"
  | "instant-connect"
  | "ready-scenario"
  | "run-result"
  | "error"
  | "continue"
  | "upsell"
  | "dashboard-lite";

export type AtlasStep = EnterpriseStep | SMBStep;

export const ENTERPRISE_STEPS: EnterpriseStep[] = [
  "entry",
  "select-system",
  "access-type",
  "sandbox",
  "select-use-case",
  "preview",
  "execution",
  "success",
  "error",
  "activate-production",
];

export const SMB_STEPS: SMBStep[] = [
  "entry",
  "select-tools",
  "instant-connect",
  "ready-scenario",
  "run-result",
  "error",
  "continue",
  "upsell",
  "dashboard-lite",
];

export type SystemType = "sap" | "oracle" | "dynamics" | "custom-rest" | "demo";
export type AccessType = "api-key" | "bearer-token" | "oauth2" | "basic-auth";
export type ToolType = "inventory" | "orders" | "analytics";

export interface AtlasFlowState {
  flowType: FlowType | null;
  currentStep: AtlasStep;
  stepHistory: AtlasStep[];
  selectedSystem: SystemType | null;
  accessType: AccessType | null;
  selectedTools: ToolType[];
  selectedUseCase: string | null;
  sandboxEnabled: boolean;
  previewData: Record<string, unknown> | null;
  executionStatus: "idle" | "running" | "success" | "error";
  errorMessage: string | null;
  isProductionReady: boolean;
}

export interface AtlasFlowContextType {
  state: AtlasFlowState;
  setFlowType: (type: FlowType) => void;
  goToStep: (step: AtlasStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setSelectedSystem: (system: SystemType) => void;
  setAccessType: (type: AccessType) => void;
  toggleTool: (tool: ToolType) => void;
  setSelectedUseCase: (useCase: string) => void;
  setSandboxEnabled: (enabled: boolean) => void;
  setPreviewData: (data: Record<string, unknown>) => void;
  setExecutionStatus: (status: "idle" | "running" | "success" | "error") => void;
  setErrorMessage: (message: string | null) => void;
  setProductionReady: (ready: boolean) => void;
  resetFlow: () => void;
  getCurrentStepIndex: () => number;
  getTotalSteps: () => number;
  getProgress: () => number;
  canProceed: () => boolean;
}

const initialState: AtlasFlowState = {
  flowType: null,
  currentStep: "entry",
  stepHistory: ["entry"],
  selectedSystem: null,
  accessType: null,
  selectedTools: [],
  selectedUseCase: null,
  sandboxEnabled: true,
  previewData: null,
  executionStatus: "idle",
  errorMessage: null,
  isProductionReady: false,
};

const AtlasFlowContext = createContext<AtlasFlowContextType | null>(null);

export function AtlasFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AtlasFlowState>(initialState);

  const setFlowType = useCallback((type: FlowType) => {
    setState(prev => ({
      ...prev,
      flowType: type,
      currentStep: "entry",
      stepHistory: ["entry"],
    }));
  }, []);

  const getSteps = useCallback((): AtlasStep[] => {
    if (state.flowType === "enterprise") return ENTERPRISE_STEPS;
    if (state.flowType === "smb") return SMB_STEPS;
    return [];
  }, [state.flowType]);

  const goToStep = useCallback((step: AtlasStep) => {
    setState(prev => ({
      ...prev,
      currentStep: step,
      stepHistory: [...prev.stepHistory, step],
    }));
  }, []);

  const nextStep = useCallback(() => {
    const steps = getSteps();
    const currentIndex = steps.indexOf(state.currentStep as never);
    if (currentIndex < steps.length - 1) {
      const nextStepValue = steps[currentIndex + 1];
      goToStep(nextStepValue);
    }
  }, [state.currentStep, getSteps, goToStep]);

  const prevStep = useCallback(() => {
    if (state.stepHistory.length > 1) {
      const newHistory = [...state.stepHistory];
      newHistory.pop();
      const previousStep = newHistory[newHistory.length - 1];
      setState(prev => ({
        ...prev,
        currentStep: previousStep,
        stepHistory: newHistory,
      }));
    }
  }, [state.stepHistory]);

  const setSelectedSystem = useCallback((system: SystemType) => {
    setState(prev => ({ ...prev, selectedSystem: system }));
  }, []);

  const setAccessType = useCallback((type: AccessType) => {
    setState(prev => ({ ...prev, accessType: type }));
  }, []);

  const toggleTool = useCallback((tool: ToolType) => {
    setState(prev => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(tool)
        ? prev.selectedTools.filter(t => t !== tool)
        : [...prev.selectedTools, tool],
    }));
  }, []);

  const setSelectedUseCase = useCallback((useCase: string) => {
    setState(prev => ({ ...prev, selectedUseCase: useCase }));
  }, []);

  const setSandboxEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, sandboxEnabled: enabled }));
  }, []);

  const setPreviewData = useCallback((data: Record<string, unknown>) => {
    setState(prev => ({ ...prev, previewData: data }));
  }, []);

  const setExecutionStatus = useCallback((status: "idle" | "running" | "success" | "error") => {
    setState(prev => ({ ...prev, executionStatus: status }));
  }, []);

  const setErrorMessage = useCallback((message: string | null) => {
    setState(prev => ({ ...prev, errorMessage: message }));
  }, []);

  const setProductionReady = useCallback((ready: boolean) => {
    setState(prev => ({ ...prev, isProductionReady: ready }));
  }, []);

  const resetFlow = useCallback(() => {
    setState(initialState);
  }, []);

  const getCurrentStepIndex = useCallback((): number => {
    const steps = getSteps();
    return steps.indexOf(state.currentStep as never);
  }, [state.currentStep, getSteps]);

  const getTotalSteps = useCallback((): number => {
    return getSteps().length;
  }, [getSteps]);

  const getProgress = useCallback((): number => {
    const total = getTotalSteps();
    if (total === 0) return 0;
    return ((getCurrentStepIndex() + 1) / total) * 100;
  }, [getCurrentStepIndex, getTotalSteps]);

  const canProceed = useCallback((): boolean => {
    const step = state.currentStep;
    
    if (state.flowType === "enterprise") {
      switch (step) {
        case "entry":
          return true;
        case "select-system":
          return state.selectedSystem !== null;
        case "access-type":
          return state.accessType !== null;
        case "sandbox":
          return true;
        case "select-use-case":
          return state.selectedUseCase !== null;
        case "preview":
          return true;
        case "execution":
          return state.executionStatus === "success";
        case "success":
          return true;
        case "error":
          return true;
        case "activate-production":
          return state.isProductionReady;
        default:
          return true;
      }
    }
    
    if (state.flowType === "smb") {
      switch (step) {
        case "entry":
          return true;
        case "select-tools":
          return state.selectedTools.length > 0;
        case "instant-connect":
          return true;
        case "ready-scenario":
          return true;
        case "run-result":
          return state.executionStatus === "success";
        case "error":
          return true;
        case "continue":
          return true;
        case "upsell":
          return true;
        case "dashboard-lite":
          return true;
        default:
          return true;
      }
    }
    
    return true;
  }, [state]);

  const value: AtlasFlowContextType = {
    state,
    setFlowType,
    goToStep,
    nextStep,
    prevStep,
    setSelectedSystem,
    setAccessType,
    toggleTool,
    setSelectedUseCase,
    setSandboxEnabled,
    setPreviewData,
    setExecutionStatus,
    setErrorMessage,
    setProductionReady,
    resetFlow,
    getCurrentStepIndex,
    getTotalSteps,
    getProgress,
    canProceed,
  };

  return (
    <AtlasFlowContext.Provider value={value}>
      {children}
    </AtlasFlowContext.Provider>
  );
}

export function useAtlasFlow(): AtlasFlowContextType {
  const context = useContext(AtlasFlowContext);
  if (!context) {
    throw new Error("useAtlasFlow must be used within an AtlasFlowProvider");
  }
  return context;
}
