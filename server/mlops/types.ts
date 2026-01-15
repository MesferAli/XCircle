/**
 * Atlas MLOps - Core Types
 * 
 * Governed Decision Intelligence Types
 * All types enforce explainability and auditability
 */

// ============================================
// Feature Store Types
// ============================================

export interface FeatureDefinition {
  name: string;
  description: string;
  source: 'salla' | 'zid' | 'erp' | 'computed';
  dataType: 'numeric' | 'categorical' | 'temporal' | 'boolean';
  refreshFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  owner: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureValue {
  featureName: string;
  entityId: string;
  entityType: 'product' | 'order' | 'customer' | 'store';
  value: number | string | boolean;
  computedAt: Date;
  version: number;
}

// ============================================
// Model Registry Types
// ============================================

export type ModelStatus = 'draft' | 'pending_approval' | 'approved' | 'deployed' | 'deprecated' | 'rejected';

export interface ModelVersion {
  id: string;
  modelName: string;
  version: string;
  trainingSignature: string;
  metrics: ModelMetrics;
  approvalStatus: ModelStatus;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  artifactPath: string;
  featureSet: string[];
}

export interface ModelMetrics {
  // Regression metrics
  mae?: number;
  rmse?: number;
  mape?: number;
  r2?: number;
  
  // Classification metrics
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  
  // Comparison
  baselineComparison: number; // % improvement over baseline
  backtestingPassed: boolean;
}

// ============================================
// Governance Types
// ============================================

export interface ApprovalRequest {
  id: string;
  modelVersionId: string;
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  comments?: string;
  backtestResults: BacktestResult;
}

export interface BacktestResult {
  passed: boolean;
  testPeriod: {
    start: Date;
    end: Date;
  };
  metrics: ModelMetrics;
  comparisonWithBaseline: number;
  stabilityScore: number;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  isActive: boolean;
  createdAt: Date;
}

export interface PolicyRule {
  condition: string;
  action: 'allow' | 'deny' | 'require_approval';
  threshold?: number;
}

// ============================================
// Decision API Types
// ============================================

export interface DecisionRequest {
  useCase: 'demand_forecast' | 'stockout_risk' | 'anomaly_detection';
  entityId: string;
  entityType: 'product' | 'sku' | 'category';
  context?: Record<string, any>;
  requestedBy: string;
}

export interface DecisionResponse {
  auditId: string;
  recommendation: Recommendation;
  confidence: ConfidenceLevel;
  explanation: Explanation;
  policyResult: PolicyResult;
  timestamp: Date;
  
  // Never expose these to users
  // modelName: string; ❌
  // algorithmType: string; ❌
}

export interface Recommendation {
  action: string;
  value?: number;
  unit?: string;
  timeframe?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ConfidenceLevel {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high';
  interval?: {
    lower: number;
    upper: number;
  };
}

export interface Explanation {
  summary: string; // Human-readable summary in Arabic
  topDrivers: ExplanationDriver[];
  scenario: string;
}

export interface ExplanationDriver {
  factor: string;
  contribution: number; // -100 to +100
  direction: 'positive' | 'negative';
  description: string; // Human-readable in Arabic
}

export interface PolicyResult {
  allowed: boolean;
  appliedPolicies: string[];
  requiresApproval: boolean;
  reason?: string;
}

// ============================================
// Monitoring Types
// ============================================

export interface DriftMetrics {
  featureName: string;
  driftScore: number;
  driftType: 'data' | 'prediction' | 'concept';
  severity: 'none' | 'low' | 'medium' | 'high';
  detectedAt: Date;
  baseline: {
    mean: number;
    std: number;
  };
  current: {
    mean: number;
    std: number;
  };
}

export interface MonitoringAlert {
  id: string;
  type: 'drift' | 'performance' | 'availability' | 'policy_violation';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  modelName: string;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

// ============================================
// Audit Types
// ============================================

export interface AuditRecord {
  id: string;
  timestamp: Date;
  action: 'decision_requested' | 'decision_returned' | 'model_deployed' | 'approval_granted' | 'policy_applied';
  userId: string;
  entityId: string;
  entityType: string;
  details: Record<string, any>;
  modelVersionId?: string;
  policyId?: string;
}

// ============================================
// Training Types
// ============================================

export interface TrainingJob {
  id: string;
  modelName: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  config: TrainingConfig;
  result?: TrainingResult;
}

export interface TrainingConfig {
  featureSet: string[];
  targetVariable: string;
  trainPeriod: {
    start: Date;
    end: Date;
  };
  validationSplit: number;
  hyperparameters: Record<string, any>;
}

export interface TrainingResult {
  modelVersionId: string;
  metrics: ModelMetrics;
  featureImportance: Record<string, number>;
  trainingDuration: number; // seconds
}

// ============================================
// Fail-Safe Types
// ============================================

export interface FallbackDecision {
  type: 'rule_based';
  reason: 'model_failed' | 'drift_too_high' | 'approval_revoked' | 'policy_blocked';
  originalError?: string;
  fallbackLogic: string;
}
