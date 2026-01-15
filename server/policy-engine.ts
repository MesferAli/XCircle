import { storage } from "./storage";
import type {
  Policy,
  PolicyContext,
  PolicyResult,
  PolicyViolation,
  PolicyCondition,
  PolicyAction,
  Recommendation,
  User,
  InsertAuditLog,
} from "@shared/schema";

export interface DefaultPolicy {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  enabled: boolean;
  priority: number;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
}

const DEFAULT_POLICIES: DefaultPolicy[] = [
  {
    id: "default_recommendation_approval",
    tenantId: "*",
    name: "All Recommendation Executions Require Approval",
    type: "approval_workflow",
    enabled: true,
    priority: 10,
    conditions: [
      { field: "action.type", operator: "equals", value: "execute_recommendation" },
    ],
    actions: [
      { type: "require_approval", config: { approverRoles: ["admin", "operator"] } },
    ],
  },
  {
    id: "default_high_value_approval",
    tenantId: "*",
    name: "High-Value Actions Require Senior Approval",
    type: "action_limit",
    enabled: true,
    priority: 20,
    conditions: [
      { field: "action.data.quantity", operator: "gt", value: 10000 },
    ],
    actions: [
      { type: "require_approval", config: { approverRoles: ["admin"], message: "High-value action requires senior approval" } },
    ],
  },
  {
    id: "default_production_approval",
    tenantId: "*",
    name: "Production Environment Actions Require Approval",
    type: "environment_restriction",
    enabled: true,
    priority: 15,
    conditions: [
      { field: "environment", operator: "equals", value: "production" },
    ],
    actions: [
      { type: "require_approval", config: { approverRoles: ["admin"], message: "Production environment actions require approval" } },
    ],
  },
  {
    id: "default_after_hours_block",
    tenantId: "*",
    name: "Weekend/After-Hours Actions Blocked",
    type: "schedule_restriction",
    enabled: true,
    priority: 5,
    conditions: [],
    actions: [
      { type: "reject", config: { message: "Actions are not allowed during weekends or after business hours (6 PM - 8 AM)" } },
    ],
  },
  {
    id: "default_blast_radius",
    tenantId: "*",
    name: "Blast Radius Limit - Max 100 Items",
    type: "blast_radius",
    enabled: true,
    priority: 25,
    conditions: [
      { field: "action.data.affectedItems", operator: "gt", value: 100 },
    ],
    actions: [
      { type: "reject", config: { maxItems: 100, message: "Action affects too many items (max 100 per action)" } },
    ],
  },
];

export class PolicyEngine {
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private evaluateCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    const contextAsRecord = context as unknown as Record<string, unknown>;
    const value = this.getNestedValue(contextAsRecord, condition.field);
    const targetValue = condition.value;

    switch (condition.operator) {
      case "equals":
        return value === targetValue;
      case "notEquals":
        return value !== targetValue;
      case "contains":
        if (typeof value === "string" && typeof targetValue === "string") {
          return value.includes(targetValue);
        }
        if (Array.isArray(value)) {
          return value.includes(targetValue);
        }
        return false;
      case "gt":
        return typeof value === "number" && typeof targetValue === "number" && value > targetValue;
      case "lt":
        return typeof value === "number" && typeof targetValue === "number" && value < targetValue;
      case "gte":
        return typeof value === "number" && typeof targetValue === "number" && value >= targetValue;
      case "lte":
        return typeof value === "number" && typeof targetValue === "number" && value <= targetValue;
      case "in":
        if (Array.isArray(targetValue)) {
          return targetValue.includes(value);
        }
        return false;
      case "notIn":
        if (Array.isArray(targetValue)) {
          return !targetValue.includes(value);
        }
        return true;
      default:
        return false;
    }
  }

  private isAfterHoursOrWeekend(requestTime: Date): boolean {
    const day = requestTime.getDay();
    const hour = requestTime.getHours();
    const isWeekend = day === 0 || day === 6;
    const isAfterHours = hour < 8 || hour >= 18;
    return isWeekend || isAfterHours;
  }

  private checkScheduleRestriction(policy: DefaultPolicy | Policy, context: PolicyContext): boolean {
    if (policy.type !== "schedule_restriction") return true;
    if (policy.id === "default_after_hours_block") {
      return !this.isAfterHoursOrWeekend(context.requestTime);
    }
    return true;
  }

  async logPolicyDecision(params: {
    tenantId: string;
    userId: string;
    actionType: string;
    decision: "allowed" | "denied" | "requires_approval" | "requires_dry_run";
    reason: string;
    policyIds: string[];
    context: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditLog: InsertAuditLog = {
        tenantId: params.tenantId,
        userId: params.userId,
        action: "policy_decision",
        resourceType: "policy_enforcement",
        resourceId: params.policyIds.join(",") || "default",
        previousState: null,
        newState: {
          decision: params.decision,
          actionType: params.actionType,
          policyIds: params.policyIds,
        },
        metadata: {
          reason: params.reason,
          timestamp: new Date().toISOString(),
          context: {
            actionType: (params.context as any)?.action?.type,
            targetType: (params.context as any)?.action?.targetType,
            environment: (params.context as any)?.environment,
          },
        },
        ipAddress: "server",
      };
      await storage.createAuditLog(auditLog);
    } catch (error) {
      console.error("Failed to log policy decision:", error);
    }
  }

  private async getAllPolicies(tenantId: string): Promise<(Policy | DefaultPolicy)[]> {
    const tenantPolicies = await storage.getPolicies(tenantId);
    const enabledDefaultPolicies = DEFAULT_POLICIES.filter(p => p.enabled);
    const allPolicies = [...enabledDefaultPolicies, ...tenantPolicies.filter(p => p.enabled)];
    return allPolicies.sort((a, b) => a.priority - b.priority);
  }

  async evaluatePolicy(context: PolicyContext): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    const appliedPolicies: string[] = [];
    let requiresApproval = false;
    let requiresDryRun = false;
    let allowed = true;
    const explanations: string[] = [];

    const policies = await this.getAllPolicies(context.tenantId);

    for (const policy of policies) {
      if (!policy.enabled) continue;
      if (policy.type === "schedule_restriction" && policy.id === "default_after_hours_block") {
        if (this.isAfterHoursOrWeekend(context.requestTime)) {
          violations.push({
            policyId: policy.id,
            policyName: policy.name,
            message: "Actions are not allowed during weekends or after business hours (6 PM - 8 AM)",
            severity: "error",
          });
          allowed = false;
          appliedPolicies.push(policy.id);
          explanations.push(`Blocked by ${policy.name}`);
          continue;
        }
      }

      const conditions = policy.conditions as PolicyCondition[];
      const allConditionsMet = conditions.length === 0 || conditions.every(c => this.evaluateCondition(c, context));

      if (allConditionsMet && conditions.length > 0) {
        appliedPolicies.push(policy.id);
        const actions = policy.actions as PolicyAction[];

        for (const action of actions) {
          switch (action.type) {
            case "require_approval":
              requiresApproval = true;
              explanations.push(`Approval required by ${policy.name}`);
              break;
            case "reject":
              allowed = false;
              violations.push({
                policyId: policy.id,
                policyName: policy.name,
                message: (action.config?.message as string) || `Action rejected by policy: ${policy.name}`,
                severity: "error",
              });
              explanations.push(`Rejected by ${policy.name}`);
              break;
            case "require_dry_run":
              requiresDryRun = true;
              explanations.push(`Dry-run required by ${policy.name}`);
              break;
            case "notify":
              explanations.push(`Notification triggered by ${policy.name}`);
              break;
            case "limit_quantity":
              const maxQty = action.config?.maxQuantity as number;
              const currentQty = this.getNestedValue(context as unknown as Record<string, unknown>, "action.data.quantity") as number;
              if (currentQty && maxQty && currentQty > maxQty) {
                violations.push({
                  policyId: policy.id,
                  policyName: policy.name,
                  message: `Quantity ${currentQty} exceeds limit of ${maxQty}`,
                  severity: "error",
                });
                allowed = false;
              }
              break;
            case "allow":
              break;
          }
        }
      }
    }

    if (allowed && !requiresApproval && violations.length === 0) {
      explanations.push("Action allowed by default policy rules");
    }

    const explanation = explanations.join("; ");
    const result = {
      allowed,
      requiresApproval,
      requiresDryRun,
      violations,
      appliedPolicies,
      explanation,
    };

    // Log the policy evaluation
    await this.logPolicyEvaluation(context, result);

    // Log the final policy decision
    let decision: "allowed" | "denied" | "requires_approval" | "requires_dry_run";
    if (!allowed) {
      decision = "denied";
    } else if (requiresApproval) {
      decision = "requires_approval";
    } else if (requiresDryRun) {
      decision = "requires_dry_run";
    } else {
      decision = "allowed";
    }

    await this.logPolicyDecision({
      tenantId: context.tenantId,
      userId: context.userId,
      actionType: context.action.type,
      decision,
      reason: explanation,
      policyIds: appliedPolicies,
      context: context as Record<string, unknown>,
    });

    return result;
  }

  async checkApprovalRequired(
    recommendation: Recommendation,
    user: User,
    tenantId: string
  ): Promise<{ required: boolean; reason: string; approverRoles: string[] }> {
    const context: PolicyContext = {
      tenantId,
      userId: user.id,
      userRole: user.role,
      action: {
        type: "execute_recommendation",
        targetType: recommendation.type,
        targetId: recommendation.id,
        data: {
          recommendationId: recommendation.id,
          priority: recommendation.priority,
          confidenceScore: recommendation.confidenceScore,
          suggestedAction: recommendation.suggestedAction,
        },
      },
      recommendation: {
        id: recommendation.id,
        type: recommendation.type,
        priority: recommendation.priority,
        confidenceScore: recommendation.confidenceScore,
      },
      environment: "production",
      requestTime: new Date(),
    };

    const result = await this.evaluatePolicy(context);
    const approverRoles: string[] = ["admin"];

    let checkResult: { required: boolean; reason: string; approverRoles: string[] };

    if (result.requiresApproval) {
      checkResult = {
        required: true,
        reason: result.explanation,
        approverRoles,
      };
    } else {
      checkResult = {
        required: true,
        reason: "All recommendation executions require human approval",
        approverRoles: ["admin", "operator"],
      };
    }

    await this.logApprovalCheck(tenantId, user.id, recommendation.id, checkResult, result.appliedPolicies);
    return checkResult;
  }

  private async logApprovalCheck(
    tenantId: string,
    userId: string,
    recommendationId: string,
    result: { required: boolean; reason: string; approverRoles: string[] },
    appliedPolicies: string[]
  ): Promise<void> {
    try {
      const auditLog: InsertAuditLog = {
        tenantId,
        userId,
        action: "check_approval_required",
        resourceType: "recommendation",
        resourceId: recommendationId,
        previousState: null,
        newState: {
          required: result.required,
          reason: result.reason,
          approverRoles: result.approverRoles,
          appliedPolicies,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
        ipAddress: "server",
      };
      await storage.createAuditLog(auditLog);
    } catch (error) {
      console.error("Failed to log approval check:", error);
    }
  }

  async validateAction(
    action: { type: string; targetType: string; targetId?: string; data: Record<string, unknown> },
    user: User,
    tenantId: string
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const context: PolicyContext = {
      tenantId,
      userId: user.id,
      userRole: user.role,
      action,
      environment: "production",
      requestTime: new Date(),
    };

    const result = await this.evaluatePolicy(context);
    const errors = result.violations.filter(v => v.severity === "error").map(v => v.message);
    const warnings = result.violations.filter(v => v.severity === "warning").map(v => v.message);

    const validationResult = {
      valid: result.allowed,
      errors,
      warnings,
    };

    await this.logValidateAction(tenantId, user.id, action, validationResult, result.appliedPolicies);

    return validationResult;
  }

  private async logValidateAction(
    tenantId: string,
    userId: string,
    action: { type: string; targetType: string; targetId?: string; data: Record<string, unknown> },
    result: { valid: boolean; errors: string[]; warnings: string[] },
    appliedPolicies: string[]
  ): Promise<void> {
    try {
      const auditLog: InsertAuditLog = {
        tenantId,
        userId,
        action: "validate_action",
        resourceType: action.targetType,
        resourceId: action.targetId || "unknown",
        previousState: null,
        newState: {
          actionType: action.type,
          valid: result.valid,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
          appliedPolicies,
        },
        metadata: {
          errors: result.errors,
          warnings: result.warnings,
          timestamp: new Date().toISOString(),
        },
        ipAddress: "server",
      };
      await storage.createAuditLog(auditLog);
    } catch (error) {
      console.error("Failed to log validate action:", error);
    }
  }

  async enforceBlastRadius(
    action: { type: string; targetType: string; targetId?: string; data: Record<string, unknown> },
    tenantId: string,
    userId?: string
  ): Promise<{ allowed: boolean; reason: string; maxItems: number; affectedItems: number }> {
    const affectedItems = (action.data.affectedItems as number) || 
                          (action.data.itemCount as number) || 
                          (action.data.quantity as number) || 1;
    const maxItems = 100;

    let blastResult: { allowed: boolean; reason: string; maxItems: number; affectedItems: number };

    if (affectedItems > maxItems) {
      blastResult = {
        allowed: false,
        reason: `Action affects ${affectedItems} items, which exceeds the maximum allowed blast radius of ${maxItems} items per action`,
        maxItems,
        affectedItems,
      };
      // Log policy decision before returning
      await this.logPolicyDecision({
        tenantId,
        userId: userId || "system",
        actionType: action.type,
        decision: "denied",
        reason: blastResult.reason,
        policyIds: ["default_blast_radius"],
        context: { action },
      });
    } else {
      blastResult = {
        allowed: true,
        reason: `Action affects ${affectedItems} items, within allowed blast radius of ${maxItems}`,
        maxItems,
        affectedItems,
      };
      // Log policy decision for allowed actions
      await this.logPolicyDecision({
        tenantId,
        userId: userId || "system",
        actionType: action.type,
        decision: "allowed",
        reason: blastResult.reason,
        policyIds: ["default_blast_radius"],
        context: { action },
      });
    }

    await this.logBlastRadiusCheck(tenantId, userId || "system", action, blastResult);
    return blastResult;
  }

  private async logBlastRadiusCheck(
    tenantId: string,
    userId: string,
    action: { type: string; targetType: string; targetId?: string; data: Record<string, unknown> },
    result: { allowed: boolean; reason: string; maxItems: number; affectedItems: number }
  ): Promise<void> {
    try {
      const auditLog: InsertAuditLog = {
        tenantId,
        userId,
        action: "enforce_blast_radius",
        resourceType: action.targetType,
        resourceId: action.targetId || "unknown",
        previousState: null,
        newState: {
          actionType: action.type,
          allowed: result.allowed,
          affectedItems: result.affectedItems,
          maxItems: result.maxItems,
        },
        metadata: {
          reason: result.reason,
          policyId: "default_blast_radius",
          timestamp: new Date().toISOString(),
        },
        ipAddress: "server",
      };
      await storage.createAuditLog(auditLog);
    } catch (error) {
      console.error("Failed to log blast radius check:", error);
    }
  }

  async checkDryRunRequired(
    action: { type: string; targetType: string; targetId?: string; data: Record<string, unknown> },
    tenantId: string,
    userId?: string
  ): Promise<{ required: boolean; reason: string; policyId?: string }> {
    const policies = await this.getAllPolicies(tenantId);
    const evaluatedPolicies: string[] = [];
    
    for (const policy of policies) {
      const actions = policy.actions as PolicyAction[];
      const hasDryRunAction = actions.some(a => a.type === "require_dry_run");
      
      if (hasDryRunAction) {
        evaluatedPolicies.push(policy.id);
        const conditions = policy.conditions as PolicyCondition[];
        const mockContext: PolicyContext = {
          tenantId,
          userId: userId || "",
          userRole: "",
          action,
          environment: "production",
          requestTime: new Date(),
        };
        
        const allConditionsMet = conditions.length === 0 || 
          conditions.every(c => this.evaluateCondition(c, mockContext));
        
        if (allConditionsMet) {
          const dryRunResult = {
            required: true,
            reason: `Dry-run required by policy: ${policy.name}`,
            policyId: policy.id,
          };
          // Log policy decision before returning
          await this.logPolicyDecision({
            tenantId,
            userId: userId || "system",
            actionType: action.type,
            decision: "requires_dry_run",
            reason: dryRunResult.reason,
            policyIds: [policy.id],
            context: { action },
          });
          await this.logDryRunCheck(tenantId, userId || "system", action, dryRunResult, evaluatedPolicies);
          return dryRunResult;
        }
      }
    }

    const affectedItems = (action.data.affectedItems as number) || 
                          (action.data.itemCount as number) || 1;
    if (affectedItems > 50) {
      const dryRunResult = {
        required: true,
        reason: `Dry-run recommended for actions affecting more than 50 items (current: ${affectedItems})`,
        policyId: "threshold_based_dry_run",
      };
      // Log policy decision before returning
      await this.logPolicyDecision({
        tenantId,
        userId: userId || "system",
        actionType: action.type,
        decision: "requires_dry_run",
        reason: dryRunResult.reason,
        policyIds: ["threshold_based_dry_run"],
        context: { action },
      });
      await this.logDryRunCheck(tenantId, userId || "system", action, dryRunResult, evaluatedPolicies);
      return dryRunResult;
    }

    const dryRunResult = {
      required: false,
      reason: "No dry-run required for this action",
    };
    // Log policy decision for allowed dry-run check
    await this.logPolicyDecision({
      tenantId,
      userId: userId || "system",
      actionType: action.type,
      decision: "allowed",
      reason: dryRunResult.reason,
      policyIds: evaluatedPolicies,
      context: { action },
    });
    await this.logDryRunCheck(tenantId, userId || "system", action, dryRunResult, evaluatedPolicies);
    return dryRunResult;
  }

  private async logDryRunCheck(
    tenantId: string,
    userId: string,
    action: { type: string; targetType: string; targetId?: string; data: Record<string, unknown> },
    result: { required: boolean; reason: string; policyId?: string },
    evaluatedPolicies: string[]
  ): Promise<void> {
    try {
      const auditLog: InsertAuditLog = {
        tenantId,
        userId,
        action: "check_dry_run_required",
        resourceType: action.targetType,
        resourceId: action.targetId || "unknown",
        previousState: null,
        newState: {
          actionType: action.type,
          required: result.required,
          policyId: result.policyId,
          evaluatedPolicies,
        },
        metadata: {
          reason: result.reason,
          timestamp: new Date().toISOString(),
        },
        ipAddress: "server",
      };
      await storage.createAuditLog(auditLog);
    } catch (error) {
      console.error("Failed to log dry-run check:", error);
    }
  }

  private async logPolicyEvaluation(context: PolicyContext, result: PolicyResult): Promise<void> {
    try {
      const auditLog: InsertAuditLog = {
        tenantId: context.tenantId,
        userId: context.userId,
        action: "policy_evaluation",
        resourceType: "policy",
        resourceId: result.appliedPolicies.join(",") || "none",
        previousState: null,
        newState: {
          context: {
            actionType: context.action.type,
            targetType: context.action.targetType,
            environment: context.environment,
          },
          result: {
            allowed: result.allowed,
            requiresApproval: result.requiresApproval,
            requiresDryRun: result.requiresDryRun,
            violationCount: result.violations.length,
            appliedPolicies: result.appliedPolicies,
          },
        },
        metadata: {
          explanation: result.explanation,
          violations: result.violations,
        },
        ipAddress: "server",
      };
      await storage.createAuditLog(auditLog);
    } catch (error) {
      console.error("Failed to log policy evaluation:", error);
    }
  }

  getDefaultPolicies(): DefaultPolicy[] {
    return DEFAULT_POLICIES;
  }
}

export const policyEngine = new PolicyEngine();
