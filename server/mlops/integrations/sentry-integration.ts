/**
 * Atlas MLOps - Sentry Integration
 * 
 * Connects MLOps monitoring with Sentry for:
 * - Drift alerts
 * - Model performance degradation
 * - Approval workflow events
 * - Decision audit trail
 */

import * as Sentry from '@sentry/node';
import { captureMessage, captureException, trackAIExecution } from '../../monitoring/sentry';

// ============================================
// Alert Types
// ============================================

export type MLOpsAlertType = 
  | 'drift_detected'
  | 'model_performance_degradation'
  | 'approval_required'
  | 'approval_granted'
  | 'approval_rejected'
  | 'fallback_triggered'
  | 'policy_violation'
  | 'training_failed'
  | 'training_completed';

export interface MLOpsAlert {
  type: MLOpsAlertType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  tenantId: string;
  message: string;
  messageAr?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Sentry MLOps Integration
// ============================================

export class SentryMLOpsIntegration {
  private enabled: boolean;

  constructor() {
    this.enabled = !!process.env.SENTRY_DSN;
  }

  /**
   * Send MLOps alert to Sentry
   */
  sendAlert(alert: MLOpsAlert): void {
    if (!this.enabled) {
      console.log(`[MLOps Alert] ${alert.type}: ${alert.message}`);
      return;
    }

    // Add breadcrumb for context
    Sentry.addBreadcrumb({
      category: 'mlops',
      message: alert.message,
      level: this.mapSeverity(alert.severity),
      data: {
        type: alert.type,
        tenantId: alert.tenantId,
        ...alert.metadata,
      },
    });

    // Capture as message with appropriate level
    const level = this.mapSeverityToSentry(alert.severity);
    captureMessage(`[MLOps] ${alert.message}`, level, {
      alertType: alert.type,
      tenantId: alert.tenantId,
      ...alert.metadata,
    });
  }

  /**
   * Track drift detection event
   */
  trackDriftDetected(
    tenantId: string,
    featureName: string,
    driftScore: number,
    severity: 'low' | 'medium' | 'high'
  ): void {
    this.sendAlert({
      type: 'drift_detected',
      severity: severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'info',
      tenantId,
      message: `Data drift detected in feature "${featureName}" (score: ${driftScore.toFixed(2)}%)`,
      messageAr: `تم اكتشاف انحراف في البيانات للخاصية "${featureName}" (النسبة: ${driftScore.toFixed(2)}%)`,
      metadata: {
        featureName,
        driftScore,
        driftSeverity: severity,
      },
    });
  }

  /**
   * Track model performance degradation
   */
  trackPerformanceDegradation(
    tenantId: string,
    modelName: string,
    currentMetric: number,
    baselineMetric: number,
    metricName: string
  ): void {
    const degradation = ((currentMetric - baselineMetric) / baselineMetric) * 100;
    
    this.sendAlert({
      type: 'model_performance_degradation',
      severity: Math.abs(degradation) > 20 ? 'error' : 'warning',
      tenantId,
      message: `Model "${modelName}" performance degraded by ${degradation.toFixed(1)}% (${metricName})`,
      messageAr: `انخفض أداء النموذج "${modelName}" بنسبة ${degradation.toFixed(1)}% (${metricName})`,
      metadata: {
        modelName,
        metricName,
        currentMetric,
        baselineMetric,
        degradationPercent: degradation,
      },
    });
  }

  /**
   * Track approval workflow events
   */
  trackApprovalEvent(
    tenantId: string,
    modelName: string,
    version: string,
    event: 'requested' | 'approved' | 'rejected',
    userId: string,
    comments?: string
  ): void {
    const typeMap = {
      requested: 'approval_required' as const,
      approved: 'approval_granted' as const,
      rejected: 'approval_rejected' as const,
    };

    const severityMap = {
      requested: 'info' as const,
      approved: 'info' as const,
      rejected: 'warning' as const,
    };

    this.sendAlert({
      type: typeMap[event],
      severity: severityMap[event],
      tenantId,
      message: `Model "${modelName}" v${version} ${event} by ${userId}`,
      messageAr: `النموذج "${modelName}" الإصدار ${version} تم ${event === 'requested' ? 'طلب الموافقة عليه' : event === 'approved' ? 'الموافقة عليه' : 'رفضه'} بواسطة ${userId}`,
      metadata: {
        modelName,
        version,
        event,
        userId,
        comments,
      },
    });
  }

  /**
   * Track fallback trigger
   */
  trackFallbackTriggered(
    tenantId: string,
    useCase: string,
    reason: string,
    entityId: string
  ): void {
    this.sendAlert({
      type: 'fallback_triggered',
      severity: 'warning',
      tenantId,
      message: `Fallback triggered for ${useCase}: ${reason}`,
      messageAr: `تم تفعيل الآلية البديلة لـ ${useCase}: ${reason}`,
      metadata: {
        useCase,
        reason,
        entityId,
      },
    });
  }

  /**
   * Track policy violation
   */
  trackPolicyViolation(
    tenantId: string,
    policyName: string,
    violationDetails: string,
    modelName?: string
  ): void {
    this.sendAlert({
      type: 'policy_violation',
      severity: 'error',
      tenantId,
      message: `Policy "${policyName}" violated: ${violationDetails}`,
      messageAr: `تم انتهاك السياسة "${policyName}": ${violationDetails}`,
      metadata: {
        policyName,
        violationDetails,
        modelName,
      },
    });
  }

  /**
   * Track training job events
   */
  trackTrainingEvent(
    tenantId: string,
    modelName: string,
    jobId: string,
    event: 'started' | 'completed' | 'failed',
    duration?: number,
    error?: string
  ): void {
    const typeMap = {
      started: 'training_completed' as const, // Will be updated
      completed: 'training_completed' as const,
      failed: 'training_failed' as const,
    };

    this.sendAlert({
      type: typeMap[event],
      severity: event === 'failed' ? 'error' : 'info',
      tenantId,
      message: `Training job ${jobId} for "${modelName}" ${event}${duration ? ` (${duration}ms)` : ''}`,
      messageAr: `مهمة التدريب ${jobId} للنموذج "${modelName}" ${event === 'started' ? 'بدأت' : event === 'completed' ? 'اكتملت' : 'فشلت'}`,
      metadata: {
        modelName,
        jobId,
        event,
        duration,
        error,
      },
    });

    // Also track as AI execution
    if (event !== 'started') {
      trackAIExecution(
        tenantId,
        `training_${modelName}`,
        duration || 0,
        event === 'completed',
        { jobId, error }
      );
    }
  }

  /**
   * Track decision made
   */
  trackDecision(
    tenantId: string,
    auditId: string,
    useCase: string,
    entityId: string,
    confidence: number,
    isFallback: boolean
  ): void {
    Sentry.addBreadcrumb({
      category: 'mlops-decision',
      message: `Decision made for ${useCase}`,
      level: 'info',
      data: {
        auditId,
        tenantId,
        useCase,
        entityId,
        confidence,
        isFallback,
      },
    });
  }

  /**
   * Capture MLOps error
   */
  captureError(error: Error, context: {
    tenantId: string;
    operation: string;
    modelName?: string;
    metadata?: Record<string, any>;
  }): void {
    if (!this.enabled) {
      console.error(`[MLOps Error] ${context.operation}:`, error);
      return;
    }

    captureException(error, {
      tags: {
        tenant_id: context.tenantId,
        mlops_operation: context.operation,
        model_name: context.modelName || 'unknown',
      },
      extra: context.metadata,
      level: 'error',
    });
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapSeverity(severity: 'info' | 'warning' | 'error' | 'critical'): 'info' | 'warning' | 'error' {
    if (severity === 'critical') return 'error';
    return severity;
  }

  private mapSeverityToSentry(severity: 'info' | 'warning' | 'error' | 'critical'): 'fatal' | 'error' | 'warning' | 'info' {
    switch (severity) {
      case 'critical': return 'fatal';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }
}

// ============================================
// Export Singleton
// ============================================

export const sentryMLOps = new SentryMLOpsIntegration();

// ============================================
// Convenience Functions
// ============================================

export function trackDrift(
  tenantId: string,
  featureName: string,
  driftScore: number,
  severity: 'low' | 'medium' | 'high'
): void {
  sentryMLOps.trackDriftDetected(tenantId, featureName, driftScore, severity);
}

export function trackApproval(
  tenantId: string,
  modelName: string,
  version: string,
  event: 'requested' | 'approved' | 'rejected',
  userId: string,
  comments?: string
): void {
  sentryMLOps.trackApprovalEvent(tenantId, modelName, version, event, userId, comments);
}

export function trackFallback(
  tenantId: string,
  useCase: string,
  reason: string,
  entityId: string
): void {
  sentryMLOps.trackFallbackTriggered(tenantId, useCase, reason, entityId);
}

export function trackMLOpsError(
  error: Error,
  tenantId: string,
  operation: string,
  metadata?: Record<string, any>
): void {
  sentryMLOps.captureError(error, { tenantId, operation, metadata });
}
