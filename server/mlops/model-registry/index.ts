/**
 * Atlas MLOps - Model Registry
 * 
 * Centralized model version management ensuring:
 * - No model reaches Production without approval
 * - Full versioning and traceability
 * - Metrics tracking and comparison
 */

import { ModelVersion, ModelMetrics, ModelStatus } from '../types';

// ============================================
// Model Registry Class
// ============================================

export class ModelRegistry {
  private models: Map<string, ModelVersion[]> = new Map();
  private activeVersions: Map<string, string> = new Map();
  
  /**
   * Register a new model version
   */
  registerModel(model: Omit<ModelVersion, 'id' | 'createdAt' | 'approvalStatus'>): ModelVersion {
    const id = `${model.modelName}_v${model.version}_${Date.now()}`;
    
    const modelVersion: ModelVersion = {
      ...model,
      id,
      approvalStatus: 'draft',
      createdAt: new Date(),
    };
    
    // Add to registry
    const versions = this.models.get(model.modelName) || [];
    versions.push(modelVersion);
    this.models.set(model.modelName, versions);
    
    console.log(`[ModelRegistry] Registered: ${model.modelName} v${model.version}`);
    
    return modelVersion;
  }
  
  /**
   * Get model version by ID
   */
  getModelVersion(modelVersionId: string): ModelVersion | undefined {
    for (const versions of this.models.values()) {
      const found = versions.find(v => v.id === modelVersionId);
      if (found) return found;
    }
    return undefined;
  }
  
  /**
   * Get all versions of a model
   */
  getModelVersions(modelName: string): ModelVersion[] {
    return this.models.get(modelName) || [];
  }
  
  /**
   * Get active (deployed) version of a model
   */
  getActiveVersion(modelName: string): ModelVersion | undefined {
    const activeId = this.activeVersions.get(modelName);
    if (!activeId) return undefined;
    return this.getModelVersion(activeId);
  }
  
  /**
   * Update model status
   * ❌ Cannot directly set to 'deployed' - must go through approval
   */
  updateStatus(
    modelVersionId: string, 
    status: ModelStatus,
    approvedBy?: string
  ): ModelVersion | undefined {
    const model = this.getModelVersion(modelVersionId);
    if (!model) return undefined;
    
    // Enforce governance rules
    if (status === 'deployed' && model.approvalStatus !== 'approved') {
      throw new Error('Cannot deploy model without approval. Use Governance Gate.');
    }
    
    model.approvalStatus = status;
    
    if (status === 'approved' && approvedBy) {
      model.approvedBy = approvedBy;
      model.approvedAt = new Date();
    }
    
    console.log(`[ModelRegistry] Status updated: ${model.modelName} v${model.version} -> ${status}`);
    
    return model;
  }
  
  /**
   * Deploy approved model
   * ❌ Only approved models can be deployed
   */
  deployModel(modelVersionId: string): boolean {
    const model = this.getModelVersion(modelVersionId);
    if (!model) {
      throw new Error(`Model not found: ${modelVersionId}`);
    }
    
    if (model.approvalStatus !== 'approved') {
      throw new Error(`Model must be approved before deployment. Current status: ${model.approvalStatus}`);
    }
    
    // Deprecate previous active version
    const previousActiveId = this.activeVersions.get(model.modelName);
    if (previousActiveId) {
      const previousModel = this.getModelVersion(previousActiveId);
      if (previousModel) {
        previousModel.approvalStatus = 'deprecated';
      }
    }
    
    // Set new active version
    model.approvalStatus = 'deployed';
    this.activeVersions.set(model.modelName, modelVersionId);
    
    console.log(`[ModelRegistry] Deployed: ${model.modelName} v${model.version}`);
    
    return true;
  }
  
  /**
   * Compare model with baseline
   */
  compareWithBaseline(modelVersionId: string, baselineMetrics: ModelMetrics): {
    improvement: number;
    passed: boolean;
  } {
    const model = this.getModelVersion(modelVersionId);
    if (!model) {
      throw new Error(`Model not found: ${modelVersionId}`);
    }
    
    // Compare primary metric (depends on model type)
    let improvement = 0;
    
    if (model.metrics.mae !== undefined && baselineMetrics.mae !== undefined) {
      // For regression: lower MAE is better
      improvement = ((baselineMetrics.mae - model.metrics.mae) / baselineMetrics.mae) * 100;
    } else if (model.metrics.accuracy !== undefined && baselineMetrics.accuracy !== undefined) {
      // For classification: higher accuracy is better
      improvement = ((model.metrics.accuracy - baselineMetrics.accuracy) / baselineMetrics.accuracy) * 100;
    } else if (model.metrics.f1Score !== undefined && baselineMetrics.f1Score !== undefined) {
      improvement = ((model.metrics.f1Score - baselineMetrics.f1Score) / baselineMetrics.f1Score) * 100;
    }
    
    return {
      improvement,
      passed: improvement > 0, // Must be better than baseline
    };
  }
  
  /**
   * Get registry statistics
   */
  getStats(): {
    totalModels: number;
    totalVersions: number;
    deployedModels: number;
    pendingApproval: number;
  } {
    let totalVersions = 0;
    let deployedModels = 0;
    let pendingApproval = 0;
    
    for (const versions of this.models.values()) {
      totalVersions += versions.length;
      for (const v of versions) {
        if (v.approvalStatus === 'deployed') deployedModels++;
        if (v.approvalStatus === 'pending_approval') pendingApproval++;
      }
    }
    
    return {
      totalModels: this.models.size,
      totalVersions,
      deployedModels,
      pendingApproval,
    };
  }
}

// Singleton instance
export const modelRegistry = new ModelRegistry();
