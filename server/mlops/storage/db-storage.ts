/**
 * Atlas MLOps - Database Storage Layer
 * 
 * Persistent storage for Feature Store, Model Registry, and Monitoring
 * Uses Drizzle ORM with PostgreSQL
 */

import { db } from '../../db';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import {
  featureDefinitions,
  featureValues,
  modelVersions,
  approvalRequests,
  mlPolicies,
  decisionLogs,
  driftMetrics,
  monitoringAlerts,
  trainingJobs,
  featureBaselines,
  type InsertFeatureDefinition,
  type InsertFeatureValue,
  type InsertModelVersion,
  type InsertApprovalRequest,
  type InsertMlPolicy,
  type InsertDecisionLog,
  type InsertDriftMetric,
  type InsertMonitoringAlert,
  type InsertTrainingJob,
  type InsertFeatureBaseline,
} from '../../../shared/mlops-schema';

// ============================================
// Feature Store Storage
// ============================================

export class FeatureStoreStorage {
  /**
   * Get all feature definitions
   */
  async getAllDefinitions() {
    return db.select().from(featureDefinitions).where(eq(featureDefinitions.isActive, true));
  }

  /**
   * Get feature definition by name
   */
  async getDefinition(name: string) {
    const results = await db.select().from(featureDefinitions).where(eq(featureDefinitions.name, name));
    return results[0];
  }

  /**
   * Create or update feature definition
   */
  async upsertDefinition(definition: InsertFeatureDefinition) {
    const existing = await this.getDefinition(definition.name);
    
    if (existing) {
      await db.update(featureDefinitions)
        .set({ ...definition, updatedAt: new Date() })
        .where(eq(featureDefinitions.name, definition.name));
      return { ...existing, ...definition };
    } else {
      const result = await db.insert(featureDefinitions).values(definition).returning();
      return result[0];
    }
  }

  /**
   * Get feature value for entity
   */
  async getFeatureValue(tenantId: string, featureName: string, entityId: string, entityType: string) {
    const results = await db.select()
      .from(featureValues)
      .where(and(
        eq(featureValues.tenantId, tenantId),
        eq(featureValues.featureName, featureName),
        eq(featureValues.entityId, entityId),
        eq(featureValues.entityType, entityType)
      ))
      .orderBy(desc(featureValues.computedAt))
      .limit(1);
    
    return results[0];
  }

  /**
   * Store feature value
   */
  async storeFeatureValue(value: InsertFeatureValue) {
    const result = await db.insert(featureValues).values(value).returning();
    return result[0];
  }

  /**
   * Get feature values for entity
   */
  async getFeatureVector(tenantId: string, entityId: string, entityType: string) {
    return db.select()
      .from(featureValues)
      .where(and(
        eq(featureValues.tenantId, tenantId),
        eq(featureValues.entityId, entityId),
        eq(featureValues.entityType, entityType)
      ));
  }
}

// ============================================
// Model Registry Storage
// ============================================

export class ModelRegistryStorage {
  /**
   * Register new model version
   */
  async registerModel(model: InsertModelVersion) {
    const result = await db.insert(modelVersions).values({
      ...model,
      approvalStatus: 'draft',
    }).returning();
    return result[0];
  }

  /**
   * Get model version by ID
   */
  async getModelVersion(id: string) {
    const results = await db.select().from(modelVersions).where(eq(modelVersions.id, id));
    return results[0];
  }

  /**
   * Get all versions of a model
   */
  async getModelVersions(modelName: string) {
    return db.select()
      .from(modelVersions)
      .where(eq(modelVersions.modelName, modelName))
      .orderBy(desc(modelVersions.createdAt));
  }

  /**
   * Get active (deployed) version
   */
  async getActiveVersion(modelName: string) {
    const results = await db.select()
      .from(modelVersions)
      .where(and(
        eq(modelVersions.modelName, modelName),
        eq(modelVersions.approvalStatus, 'deployed')
      ))
      .limit(1);
    return results[0];
  }

  /**
   * Update model status
   */
  async updateStatus(id: string, status: string, approvedBy?: string) {
    const updateData: any = { approvalStatus: status };
    if (approvedBy) {
      updateData.approvedBy = approvedBy;
      updateData.approvedAt = new Date();
    }
    
    await db.update(modelVersions).set(updateData).where(eq(modelVersions.id, id));
    return this.getModelVersion(id);
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals() {
    return db.select()
      .from(modelVersions)
      .where(eq(modelVersions.approvalStatus, 'pending_approval'))
      .orderBy(desc(modelVersions.createdAt));
  }

  /**
   * Get registry statistics
   */
  async getStats() {
    const allModels = await db.select().from(modelVersions);
    
    const uniqueModels = new Set(allModels.map(m => m.modelName));
    const deployed = allModels.filter(m => m.approvalStatus === 'deployed');
    const pending = allModels.filter(m => m.approvalStatus === 'pending_approval');
    
    return {
      totalModels: uniqueModels.size,
      totalVersions: allModels.length,
      deployedModels: deployed.length,
      pendingApproval: pending.length,
    };
  }
}

// ============================================
// Governance Storage
// ============================================

export class GovernanceStorage {
  /**
   * Create approval request
   */
  async createApprovalRequest(request: InsertApprovalRequest) {
    const result = await db.insert(approvalRequests).values(request).returning();
    return result[0];
  }

  /**
   * Get approval request by ID
   */
  async getApprovalRequest(id: string) {
    const results = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id));
    return results[0];
  }

  /**
   * Update approval request
   */
  async updateApprovalRequest(id: string, status: string, reviewedBy: string, comments?: string) {
    await db.update(approvalRequests)
      .set({
        status,
        reviewedBy,
        reviewedAt: new Date(),
        comments,
      })
      .where(eq(approvalRequests.id, id));
    
    return this.getApprovalRequest(id);
  }

  /**
   * Get pending approval requests
   */
  async getPendingRequests() {
    return db.select()
      .from(approvalRequests)
      .where(eq(approvalRequests.status, 'pending'))
      .orderBy(desc(approvalRequests.requestedAt));
  }

  /**
   * Get all policies
   */
  async getPolicies() {
    return db.select()
      .from(mlPolicies)
      .where(eq(mlPolicies.isActive, true))
      .orderBy(desc(mlPolicies.priority));
  }

  /**
   * Create or update policy
   */
  async upsertPolicy(policy: InsertMlPolicy & { id?: string }) {
    if (policy.id) {
      await db.update(mlPolicies)
        .set({ ...policy, updatedAt: new Date() })
        .where(eq(mlPolicies.id, policy.id));
      const results = await db.select().from(mlPolicies).where(eq(mlPolicies.id, policy.id));
      return results[0];
    } else {
      const result = await db.insert(mlPolicies).values(policy).returning();
      return result[0];
    }
  }
}

// ============================================
// Decision Log Storage
// ============================================

export class DecisionLogStorage {
  /**
   * Log decision
   */
  async logDecision(decision: InsertDecisionLog) {
    const result = await db.insert(decisionLogs).values(decision).returning();
    return result[0];
  }

  /**
   * Get decision by audit ID
   */
  async getDecision(auditId: string) {
    const results = await db.select().from(decisionLogs).where(eq(decisionLogs.auditId, auditId));
    return results[0];
  }

  /**
   * Get decisions for tenant
   */
  async getDecisions(tenantId: string, filters?: {
    useCase?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    let query = db.select()
      .from(decisionLogs)
      .where(eq(decisionLogs.tenantId, tenantId));
    
    // Note: Additional filters would be applied here
    // For now, returning basic query
    
    return query.orderBy(desc(decisionLogs.timestamp)).limit(filters?.limit || 100);
  }

  /**
   * Get decision statistics
   */
  async getStats(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const decisions = await db.select()
      .from(decisionLogs)
      .where(and(
        eq(decisionLogs.tenantId, tenantId),
        gte(decisionLogs.timestamp, startDate)
      ));
    
    const byUseCase = decisions.reduce((acc, d) => {
      acc[d.useCase] = (acc[d.useCase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const fallbacks = decisions.filter(d => d.isFallback).length;
    
    return {
      total: decisions.length,
      byUseCase,
      fallbackRate: decisions.length > 0 ? (fallbacks / decisions.length) * 100 : 0,
    };
  }
}

// ============================================
// Monitoring Storage
// ============================================

export class MonitoringStorage {
  /**
   * Store drift metric
   */
  async storeDriftMetric(metric: InsertDriftMetric) {
    const result = await db.insert(driftMetrics).values(metric).returning();
    return result[0];
  }

  /**
   * Get drift history
   */
  async getDriftHistory(tenantId: string, featureName?: string, limit: number = 100) {
    let conditions = [eq(driftMetrics.tenantId, tenantId)];
    if (featureName) {
      conditions.push(eq(driftMetrics.featureName, featureName));
    }
    
    return db.select()
      .from(driftMetrics)
      .where(and(...conditions))
      .orderBy(desc(driftMetrics.detectedAt))
      .limit(limit);
  }

  /**
   * Create alert
   */
  async createAlert(alert: InsertMonitoringAlert) {
    const result = await db.insert(monitoringAlerts).values(alert).returning();
    return result[0];
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(tenantId: string) {
    return db.select()
      .from(monitoringAlerts)
      .where(and(
        eq(monitoringAlerts.tenantId, tenantId),
        eq(monitoringAlerts.acknowledged, false)
      ))
      .orderBy(desc(monitoringAlerts.createdAt));
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(id: string, acknowledgedBy: string) {
    await db.update(monitoringAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      })
      .where(eq(monitoringAlerts.id, id));
  }

  /**
   * Store baseline
   */
  async storeBaseline(baseline: InsertFeatureBaseline) {
    // Deactivate existing baseline
    await db.update(featureBaselines)
      .set({ isActive: false })
      .where(and(
        eq(featureBaselines.tenantId, baseline.tenantId),
        eq(featureBaselines.featureName, baseline.featureName)
      ));
    
    const result = await db.insert(featureBaselines).values(baseline).returning();
    return result[0];
  }

  /**
   * Get active baseline
   */
  async getBaseline(tenantId: string, featureName: string) {
    const results = await db.select()
      .from(featureBaselines)
      .where(and(
        eq(featureBaselines.tenantId, tenantId),
        eq(featureBaselines.featureName, featureName),
        eq(featureBaselines.isActive, true)
      ))
      .limit(1);
    
    return results[0];
  }
}

// ============================================
// Training Job Storage
// ============================================

export class TrainingJobStorage {
  /**
   * Create training job
   */
  async createJob(job: InsertTrainingJob) {
    const result = await db.insert(trainingJobs).values(job).returning();
    return result[0];
  }

  /**
   * Update job status
   */
  async updateJobStatus(id: string, status: string, result?: any, errorMessage?: string) {
    const updateData: any = { status };
    
    if (status === 'running') {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }
    
    if (result) updateData.result = result;
    if (errorMessage) updateData.errorMessage = errorMessage;
    
    await db.update(trainingJobs).set(updateData).where(eq(trainingJobs.id, id));
  }

  /**
   * Get job by ID
   */
  async getJob(id: string) {
    const results = await db.select().from(trainingJobs).where(eq(trainingJobs.id, id));
    return results[0];
  }

  /**
   * Get jobs for tenant
   */
  async getJobs(tenantId: string, limit: number = 50) {
    return db.select()
      .from(trainingJobs)
      .where(eq(trainingJobs.tenantId, tenantId))
      .orderBy(desc(trainingJobs.createdAt))
      .limit(limit);
  }
}

// ============================================
// Export Singleton Instances
// ============================================

export const featureStoreStorage = new FeatureStoreStorage();
export const modelRegistryStorage = new ModelRegistryStorage();
export const governanceStorage = new GovernanceStorage();
export const decisionLogStorage = new DecisionLogStorage();
export const monitoringStorage = new MonitoringStorage();
export const trainingJobStorage = new TrainingJobStorage();
