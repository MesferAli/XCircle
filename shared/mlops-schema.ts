/**
 * Atlas MLOps - Database Schema
 * 
 * Tables for Feature Store, Model Registry, Governance, and Monitoring
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp, real, bigserial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== FEATURE DEFINITIONS ====================
// Canonical feature definitions with metadata
export const featureDefinitions = pgTable("feature_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  source: text("source").notNull(), // salla, zid, erp, computed
  dataType: text("data_type").notNull(), // numeric, categorical, temporal, boolean
  refreshFrequency: text("refresh_frequency").notNull(), // realtime, hourly, daily, weekly
  owner: text("owner").notNull(),
  computationLogic: text("computation_logic"), // SQL or function reference
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFeatureDefinitionSchema = createInsertSchema(featureDefinitions).pick({
  name: true,
  description: true,
  descriptionAr: true,
  source: true,
  dataType: true,
  refreshFrequency: true,
  owner: true,
  computationLogic: true,
});

export type InsertFeatureDefinition = z.infer<typeof insertFeatureDefinitionSchema>;
export type FeatureDefinition = typeof featureDefinitions.$inferSelect;

// ==================== FEATURE VALUES ====================
// Computed feature values for entities
export const featureValues = pgTable("feature_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  featureName: text("feature_name").notNull(),
  entityId: varchar("entity_id").notNull(),
  entityType: text("entity_type").notNull(), // product, order, customer, store
  value: jsonb("value").notNull(), // Can be number, string, or boolean
  version: integer("version").default(1),
  computedAt: timestamp("computed_at").defaultNow(),
}, (table) => ({
  featureEntityIdx: index("feature_entity_idx").on(table.featureName, table.entityId, table.entityType),
  tenantFeatureIdx: index("tenant_feature_idx").on(table.tenantId, table.featureName),
}));

export const insertFeatureValueSchema = createInsertSchema(featureValues).pick({
  tenantId: true,
  featureName: true,
  entityId: true,
  entityType: true,
  value: true,
  version: true,
});

export type InsertFeatureValue = z.infer<typeof insertFeatureValueSchema>;
export type FeatureValue = typeof featureValues.$inferSelect;

// ==================== MODEL VERSIONS ====================
// Model registry with versioning and approval status
export const modelVersions = pgTable("model_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelName: text("model_name").notNull(),
  version: text("version").notNull(),
  trainingSignature: text("training_signature").notNull(), // Hash of training data + params
  metrics: jsonb("metrics").notNull(), // MAE, RMSE, accuracy, etc.
  approvalStatus: text("approval_status").notNull().default("draft"), // draft, pending_approval, approved, deployed, deprecated, rejected
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  artifactPath: text("artifact_path").notNull(), // Path to model file
  featureSet: jsonb("feature_set").notNull(), // List of feature names used
  hyperparameters: jsonb("hyperparameters"), // Model hyperparameters
  trainingDataRange: jsonb("training_data_range"), // { start, end }
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  modelNameIdx: index("model_name_idx").on(table.modelName),
  approvalStatusIdx: index("approval_status_idx").on(table.approvalStatus),
}));

export const modelStatusTypes = ["draft", "pending_approval", "approved", "deployed", "deprecated", "rejected"] as const;
export type ModelStatusType = typeof modelStatusTypes[number];

export const insertModelVersionSchema = createInsertSchema(modelVersions).pick({
  modelName: true,
  version: true,
  trainingSignature: true,
  metrics: true,
  artifactPath: true,
  featureSet: true,
  hyperparameters: true,
  trainingDataRange: true,
});

export type InsertModelVersion = z.infer<typeof insertModelVersionSchema>;
export type ModelVersion = typeof modelVersions.$inferSelect;

// ==================== APPROVAL REQUESTS ====================
// Human approval workflow for model deployment
export const approvalRequests = pgTable("approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelVersionId: varchar("model_version_id").notNull(),
  requestedBy: varchar("requested_by").notNull(),
  requestedAt: timestamp("requested_at").defaultNow(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  comments: text("comments"),
  backtestResults: jsonb("backtest_results").notNull(),
  policyCheckResults: jsonb("policy_check_results"),
});

export const approvalStatusTypes = ["pending", "approved", "rejected"] as const;
export type ApprovalStatusType = typeof approvalStatusTypes[number];

export const insertApprovalRequestSchema = createInsertSchema(approvalRequests).pick({
  modelVersionId: true,
  requestedBy: true,
  backtestResults: true,
  policyCheckResults: true,
});

export type InsertApprovalRequest = z.infer<typeof insertApprovalRequestSchema>;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;

// ==================== MLOPS POLICIES ====================
// Governance policies for model deployment
export const mlPolicies = pgTable("ml_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  rules: jsonb("rules").notNull(), // Array of policy rules
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMlPolicySchema = createInsertSchema(mlPolicies).pick({
  name: true,
  nameAr: true,
  description: true,
  descriptionAr: true,
  rules: true,
  priority: true,
});

export type InsertMlPolicy = z.infer<typeof insertMlPolicySchema>;
export type MlPolicy = typeof mlPolicies.$inferSelect;

// ==================== DECISION LOGS ====================
// Audit trail for all decisions made by the system
export const decisionLogs = pgTable("decision_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  auditId: varchar("audit_id").notNull().unique(),
  tenantId: varchar("tenant_id").notNull(),
  useCase: text("use_case").notNull(), // demand_forecast, stockout_risk, anomaly_detection
  entityId: varchar("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  requestedBy: varchar("requested_by").notNull(),
  modelVersionId: varchar("model_version_id"),
  recommendation: jsonb("recommendation").notNull(),
  confidence: jsonb("confidence").notNull(),
  explanation: jsonb("explanation").notNull(),
  policyResult: jsonb("policy_result").notNull(),
  inputFeatures: jsonb("input_features"), // Features used for decision
  isFallback: boolean("is_fallback").default(false),
  fallbackReason: text("fallback_reason"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  tenantUseCaseIdx: index("tenant_usecase_idx").on(table.tenantId, table.useCase),
  auditIdIdx: index("audit_id_idx").on(table.auditId),
  timestampIdx: index("decision_timestamp_idx").on(table.timestamp),
}));

export const insertDecisionLogSchema = createInsertSchema(decisionLogs).pick({
  auditId: true,
  tenantId: true,
  useCase: true,
  entityId: true,
  entityType: true,
  requestedBy: true,
  modelVersionId: true,
  recommendation: true,
  confidence: true,
  explanation: true,
  policyResult: true,
  inputFeatures: true,
  isFallback: true,
  fallbackReason: true,
});

export type InsertDecisionLog = z.infer<typeof insertDecisionLogSchema>;
export type DecisionLog = typeof decisionLogs.$inferSelect;

// ==================== DRIFT METRICS ====================
// Data drift and model drift tracking
export const driftMetrics = pgTable("drift_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  featureName: text("feature_name").notNull(),
  modelName: text("model_name"),
  driftScore: real("drift_score").notNull(),
  driftType: text("drift_type").notNull(), // data, prediction, concept
  severity: text("severity").notNull(), // none, low, medium, high
  baselineStats: jsonb("baseline_stats").notNull(), // { mean, std }
  currentStats: jsonb("current_stats").notNull(), // { mean, std }
  detectedAt: timestamp("detected_at").defaultNow(),
}, (table) => ({
  tenantFeatureDriftIdx: index("tenant_feature_drift_idx").on(table.tenantId, table.featureName),
  severityIdx: index("drift_severity_idx").on(table.severity),
}));

export const driftSeverityTypes = ["none", "low", "medium", "high"] as const;
export type DriftSeverityType = typeof driftSeverityTypes[number];

export const insertDriftMetricSchema = createInsertSchema(driftMetrics).pick({
  tenantId: true,
  featureName: true,
  modelName: true,
  driftScore: true,
  driftType: true,
  severity: true,
  baselineStats: true,
  currentStats: true,
});

export type InsertDriftMetric = z.infer<typeof insertDriftMetricSchema>;
export type DriftMetric = typeof driftMetrics.$inferSelect;

// ==================== MONITORING ALERTS ====================
// Alerts for drift, performance issues, etc.
export const monitoringAlerts = pgTable("monitoring_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  type: text("type").notNull(), // drift, performance, availability, policy_violation
  severity: text("severity").notNull(), // info, warning, error, critical
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  modelName: text("model_name"),
  featureName: text("feature_name"),
  metadata: jsonb("metadata"),
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedBy: varchar("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantAlertsIdx: index("tenant_alerts_idx").on(table.tenantId, table.acknowledged),
  severityAlertsIdx: index("severity_alerts_idx").on(table.severity),
}));

export const alertSeverityTypes = ["info", "warning", "error", "critical"] as const;
export type AlertSeverityType = typeof alertSeverityTypes[number];

export const insertMonitoringAlertSchema = createInsertSchema(monitoringAlerts).pick({
  tenantId: true,
  type: true,
  severity: true,
  message: true,
  messageAr: true,
  modelName: true,
  featureName: true,
  metadata: true,
});

export type InsertMonitoringAlert = z.infer<typeof insertMonitoringAlertSchema>;
export type MonitoringAlert = typeof monitoringAlerts.$inferSelect;

// ==================== TRAINING JOBS ====================
// Training job tracking
export const trainingJobs = pgTable("training_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  modelName: text("model_name").notNull(),
  status: text("status").notNull().default("queued"), // queued, running, completed, failed
  config: jsonb("config").notNull(), // Training configuration
  result: jsonb("result"), // Training result with metrics
  modelVersionId: varchar("model_version_id"), // Created model version
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trainingJobStatusTypes = ["queued", "running", "completed", "failed"] as const;
export type TrainingJobStatusType = typeof trainingJobStatusTypes[number];

export const insertTrainingJobSchema = createInsertSchema(trainingJobs).pick({
  tenantId: true,
  modelName: true,
  config: true,
});

export type InsertTrainingJob = z.infer<typeof insertTrainingJobSchema>;
export type TrainingJob = typeof trainingJobs.$inferSelect;

// ==================== FEATURE BASELINES ====================
// Baseline distributions for drift detection
export const featureBaselines = pgTable("feature_baselines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  featureName: text("feature_name").notNull(),
  mean: real("mean").notNull(),
  std: real("std").notNull(),
  min: real("min").notNull(),
  max: real("max").notNull(),
  percentiles: jsonb("percentiles").notNull(), // { p25, p50, p75 }
  sampleSize: integer("sample_size").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantFeatureBaselineIdx: index("tenant_feature_baseline_idx").on(table.tenantId, table.featureName),
}));

export const insertFeatureBaselineSchema = createInsertSchema(featureBaselines).pick({
  tenantId: true,
  featureName: true,
  mean: true,
  std: true,
  min: true,
  max: true,
  percentiles: true,
  sampleSize: true,
});

export type InsertFeatureBaseline = z.infer<typeof insertFeatureBaselineSchema>;
export type FeatureBaseline = typeof featureBaselines.$inferSelect;
