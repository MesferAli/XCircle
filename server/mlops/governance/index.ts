/**
 * Atlas MLOps - Governance Gate
 * 
 * Critical governance layer ensuring:
 * - Human approval before deployment
 * - Backtesting validation
 * - Policy enforcement
 * - Full audit trail
 */

import { 
  ApprovalRequest, 
  BacktestResult, 
  Policy, 
  PolicyRule,
  AuditRecord,
  ModelVersion 
} from '../types';
import { modelRegistry } from '../model-registry';

// ============================================
// Default Policies
// ============================================

const DEFAULT_POLICIES: Policy[] = [
  {
    id: 'policy_baseline_improvement',
    name: 'تحسين على الأساس',
    description: 'النموذج يجب أن يكون أفضل من الأساس',
    rules: [
      {
        condition: 'baseline_comparison > 0',
        action: 'allow',
      },
      {
        condition: 'baseline_comparison <= 0',
        action: 'deny',
      },
    ],
    isActive: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'policy_stability',
    name: 'استقرار التفسير',
    description: 'التفسيرات يجب أن تكون مستقرة',
    rules: [
      {
        condition: 'stability_score >= 0.8',
        action: 'allow',
      },
      {
        condition: 'stability_score < 0.8',
        action: 'require_approval',
      },
    ],
    isActive: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'policy_backtesting',
    name: 'اجتياز الاختبار الرجعي',
    description: 'النموذج يجب أن يجتاز الاختبار الرجعي',
    rules: [
      {
        condition: 'backtesting_passed == true',
        action: 'allow',
      },
      {
        condition: 'backtesting_passed == false',
        action: 'deny',
      },
    ],
    isActive: true,
    createdAt: new Date('2024-01-01'),
  },
];

// ============================================
// Governance Gate Class
// ============================================

export class GovernanceGate {
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private policies: Map<string, Policy> = new Map();
  private auditLog: AuditRecord[] = [];
  
  constructor() {
    // Load default policies
    for (const policy of DEFAULT_POLICIES) {
      this.policies.set(policy.id, policy);
    }
  }
  
  // ============================================
  // Approval Workflow
  // ============================================
  
  /**
   * Submit model for approval
   * Step 1: Backtesting must pass first
   */
  async submitForApproval(
    modelVersionId: string,
    requestedBy: string,
    backtestResults: BacktestResult
  ): Promise<ApprovalRequest> {
    const model = modelRegistry.getModelVersion(modelVersionId);
    if (!model) {
      throw new Error(`Model not found: ${modelVersionId}`);
    }
    
    // Validate backtesting
    if (!backtestResults.passed) {
      throw new Error('Cannot submit for approval: Backtesting failed');
    }
    
    // Check policies
    const policyCheck = this.checkPolicies(backtestResults);
    if (!policyCheck.allowed && !policyCheck.requiresApproval) {
      throw new Error(`Policy violation: ${policyCheck.reason}`);
    }
    
    const request: ApprovalRequest = {
      id: `approval_${Date.now()}`,
      modelVersionId,
      requestedBy,
      requestedAt: new Date(),
      status: 'pending',
      backtestResults,
    };
    
    this.approvalRequests.set(request.id, request);
    
    // Update model status
    modelRegistry.updateStatus(modelVersionId, 'pending_approval');
    
    // Audit
    this.addAuditRecord({
      action: 'decision_requested',
      userId: requestedBy,
      entityId: modelVersionId,
      entityType: 'model',
      details: { backtestResults },
      modelVersionId,
    });
    
    console.log(`[GovernanceGate] Approval requested: ${model.modelName} v${model.version}`);
    
    return request;
  }
  
  /**
   * Approve model
   * ❌ Only humans can approve
   */
  approveModel(
    approvalRequestId: string,
    reviewedBy: string,
    comments?: string
  ): ApprovalRequest {
    const request = this.approvalRequests.get(approvalRequestId);
    if (!request) {
      throw new Error(`Approval request not found: ${approvalRequestId}`);
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Request already processed: ${request.status}`);
    }
    
    // Update request
    request.status = 'approved';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date();
    request.comments = comments;
    
    // Update model status
    modelRegistry.updateStatus(request.modelVersionId, 'approved', reviewedBy);
    
    // Audit
    this.addAuditRecord({
      action: 'approval_granted',
      userId: reviewedBy,
      entityId: request.modelVersionId,
      entityType: 'model',
      details: { comments },
      modelVersionId: request.modelVersionId,
    });
    
    console.log(`[GovernanceGate] Model approved by: ${reviewedBy}`);
    
    return request;
  }
  
  /**
   * Reject model
   */
  rejectModel(
    approvalRequestId: string,
    reviewedBy: string,
    reason: string
  ): ApprovalRequest {
    const request = this.approvalRequests.get(approvalRequestId);
    if (!request) {
      throw new Error(`Approval request not found: ${approvalRequestId}`);
    }
    
    request.status = 'rejected';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date();
    request.comments = reason;
    
    modelRegistry.updateStatus(request.modelVersionId, 'rejected');
    
    // Audit
    this.addAuditRecord({
      action: 'approval_granted', // Will show as rejected in details
      userId: reviewedBy,
      entityId: request.modelVersionId,
      entityType: 'model',
      details: { status: 'rejected', reason },
      modelVersionId: request.modelVersionId,
    });
    
    console.log(`[GovernanceGate] Model rejected: ${reason}`);
    
    return request;
  }
  
  // ============================================
  // Policy Management
  // ============================================
  
  /**
   * Check policies against backtest results
   */
  checkPolicies(backtestResults: BacktestResult): {
    allowed: boolean;
    requiresApproval: boolean;
    appliedPolicies: string[];
    reason?: string;
  } {
    const appliedPolicies: string[] = [];
    let allowed = true;
    let requiresApproval = false;
    let reason: string | undefined;
    
    for (const policy of this.policies.values()) {
      if (!policy.isActive) continue;
      
      appliedPolicies.push(policy.id);
      
      for (const rule of policy.rules) {
        const result = this.evaluateRule(rule, backtestResults);
        
        if (result.matches) {
          switch (rule.action) {
            case 'deny':
              allowed = false;
              reason = `${policy.name}: ${rule.condition}`;
              break;
            case 'require_approval':
              requiresApproval = true;
              break;
            case 'allow':
              // Continue checking other rules
              break;
          }
        }
      }
    }
    
    return { allowed, requiresApproval, appliedPolicies, reason };
  }
  
  /**
   * Evaluate a policy rule
   */
  private evaluateRule(
    rule: PolicyRule, 
    backtestResults: BacktestResult
  ): { matches: boolean } {
    const context = {
      baseline_comparison: backtestResults.comparisonWithBaseline,
      stability_score: backtestResults.stabilityScore,
      backtesting_passed: backtestResults.passed,
    };
    
    // Simple rule evaluation
    const condition = rule.condition;
    
    if (condition.includes('baseline_comparison > 0')) {
      return { matches: context.baseline_comparison > 0 };
    }
    if (condition.includes('baseline_comparison <= 0')) {
      return { matches: context.baseline_comparison <= 0 };
    }
    if (condition.includes('stability_score >= 0.8')) {
      return { matches: context.stability_score >= 0.8 };
    }
    if (condition.includes('stability_score < 0.8')) {
      return { matches: context.stability_score < 0.8 };
    }
    if (condition.includes('backtesting_passed == true')) {
      return { matches: context.backtesting_passed === true };
    }
    if (condition.includes('backtesting_passed == false')) {
      return { matches: context.backtesting_passed === false };
    }
    
    return { matches: false };
  }
  
  /**
   * Add custom policy
   */
  addPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
    console.log(`[GovernanceGate] Policy added: ${policy.name}`);
  }
  
  /**
   * Get all policies
   */
  getPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }
  
  // ============================================
  // Audit Trail
  // ============================================
  
  /**
   * Add audit record
   */
  private addAuditRecord(record: Omit<AuditRecord, 'id' | 'timestamp'>): void {
    const auditRecord: AuditRecord = {
      ...record,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    this.auditLog.push(auditRecord);
  }
  
  /**
   * Get audit log
   */
  getAuditLog(filters?: {
    modelVersionId?: string;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): AuditRecord[] {
    let records = [...this.auditLog];
    
    if (filters) {
      if (filters.modelVersionId) {
        records = records.filter(r => r.modelVersionId === filters.modelVersionId);
      }
      if (filters.userId) {
        records = records.filter(r => r.userId === filters.userId);
      }
      if (filters.action) {
        records = records.filter(r => r.action === filters.action);
      }
      if (filters.startDate) {
        records = records.filter(r => r.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        records = records.filter(r => r.timestamp <= filters.endDate!);
      }
    }
    
    return records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Get pending approvals
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.approvalRequests.values())
      .filter(r => r.status === 'pending')
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }
}

// Singleton instance
export const governanceGate = new GovernanceGate();
