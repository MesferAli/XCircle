/**
 * Policy Context Service
 *
 * Extracted business logic for building Zero Trust policy contexts.
 * Used by route handlers and policy middleware.
 */

import { storage } from "../storage";
import { policyEngine } from "../policy-engine";
import type { PolicyContext, Recommendation } from "@shared/schema";

// Supported action types for Zero Trust validation
export const SUPPORTED_ACTION_TYPES = [
  "execute_recommendation",
  "update_stock",
  "adjust_stock",
  "update_item",
];

/**
 * Get tenant ID from authenticated session ONLY
 */
export function getAuthenticatedTenant(req: { user?: { tenantId?: string } }): string | null {
  return (req as any).user?.tenantId || null;
}

/**
 * Get authenticated user ID from session
 */
export function getAuthenticatedUserId(req: { user?: { id?: string } }): string | null {
  return (req as any).user?.id || null;
}

/**
 * Secure tenant ID resolution with multiple priority levels
 */
export function getSecureTenantId(
  req: { user?: { tenantId?: string }; body?: any; query?: any },
  resourceTenantId?: string
): string | null {
  if (resourceTenantId) return resourceTenantId;

  const authenticatedTenant = getAuthenticatedTenant(req);
  if (authenticatedTenant) return authenticatedTenant;

  if (process.env.NODE_ENV === "development") {
    const devTenant = (req as any).body?.tenantId || (req as any).query?.tenantId || null;
    if (devTenant) {
      console.warn("[SECURITY] Using development tenant fallback from request body/query");
    }
    return devTenant;
  }

  return null;
}

/**
 * Derive quantity and affected items from a recommendation's suggestedAction
 */
export function deriveQuantityFromRecommendation(recommendation: Recommendation): {
  quantity: number | null;
  affectedItems: number | null;
  quantityMissing: boolean;
  affectedItemsMissing: boolean;
} {
  const suggestedAction = recommendation.suggestedAction as Record<string, unknown> | null;

  let quantity: number | null = null;
  let affectedItems: number | null = null;
  let quantityMissing = true;
  let affectedItemsMissing = true;

  if (suggestedAction) {
    if (typeof suggestedAction.quantity === "number") {
      quantity = suggestedAction.quantity;
      quantityMissing = false;
    } else if (typeof suggestedAction.orderQuantity === "number") {
      quantity = suggestedAction.orderQuantity;
      quantityMissing = false;
    } else if (typeof suggestedAction.transferQuantity === "number") {
      quantity = suggestedAction.transferQuantity;
      quantityMissing = false;
    } else if (typeof suggestedAction.adjustQuantity === "number") {
      quantity = suggestedAction.adjustQuantity;
      quantityMissing = false;
    }

    if (typeof suggestedAction.affectedItems === "number") {
      affectedItems = suggestedAction.affectedItems;
      affectedItemsMissing = false;
    } else if (typeof suggestedAction.itemCount === "number") {
      affectedItems = suggestedAction.itemCount;
      affectedItemsMissing = false;
    } else if (Array.isArray(suggestedAction.items)) {
      affectedItems = suggestedAction.items.length;
      affectedItemsMissing = false;
    } else if (Array.isArray(suggestedAction.locations)) {
      affectedItems = suggestedAction.locations.length;
      affectedItemsMissing = false;
    }
  }

  return { quantity, affectedItems, quantityMissing, affectedItemsMissing };
}

/**
 * Build a simple policy context from explicit parameters
 */
export function buildPolicyContext(
  tenantId: string,
  userId: string,
  userRole: string,
  actionType: string,
  targetType: string,
  targetId: string,
  actionData: Record<string, unknown>,
  recommendation?: { id: string; type: string; priority: string; confidenceScore: number },
  environment: "production" | "staging" | "development" = "production"
): PolicyContext {
  return {
    tenantId,
    userId,
    userRole,
    action: { type: actionType, targetType, targetId, data: actionData },
    recommendation,
    environment,
    requestTime: new Date(),
  };
}

/**
 * Centralized resource lookup matrix for Zero Trust validation
 */
export async function lookupResourceForAction(
  actionType: string,
  resourceId: string | undefined
): Promise<{ resource: unknown; tenantId: string; targetType: string } | null> {
  if (!resourceId) return null;

  switch (actionType) {
    case "execute_recommendation": {
      const rec = await storage.getRecommendation(resourceId);
      if (!rec) return null;
      return { resource: rec, tenantId: rec.tenantId, targetType: "recommendation" };
    }
    case "update_stock":
    case "adjust_stock": {
      const balance = await storage.getStockBalance(resourceId);
      if (!balance) return null;
      return { resource: balance, tenantId: balance.tenantId, targetType: "stockBalance" };
    }
    case "update_item": {
      const item = await storage.getItem(resourceId);
      if (!item) return null;
      return { resource: item, tenantId: item.tenantId, targetType: "item" };
    }
    default:
      return null;
  }
}

/**
 * Extract action-specific data from a resource for policy context
 */
export function extractActionDataFromResource(
  resource: unknown,
  actionType: string
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (actionType === "execute_recommendation") {
    const rec = resource as Recommendation;
    data.recommendationId = rec.id;
    data.priority = rec.priority;
    data.confidenceScore = rec.confidenceScore;
    data.suggestedAction = rec.suggestedAction;
    data.type = rec.type;

    const { quantity, affectedItems, quantityMissing, affectedItemsMissing } =
      deriveQuantityFromRecommendation(rec);
    data.quantity = quantity;
    data.affectedItems = affectedItems;
    data.quantityMissing = quantityMissing;
    data.affectedItemsMissing = affectedItemsMissing;
  } else if (actionType === "update_item") {
    const item = resource as { id: string; name: string; sku: string };
    data.itemId = item.id;
    data.itemName = item.name;
    data.sku = item.sku;
  } else if (actionType === "update_stock" || actionType === "adjust_stock") {
    const balance = resource as {
      id: string;
      itemId: string;
      locationId: string;
      quantityOnHand: number;
      quantityReserved: number;
      quantityAvailable: number;
    };
    data.itemId = balance.itemId;
    data.locationId = balance.locationId;
    data.quantityOnHand = balance.quantityOnHand;
    data.quantityReserved = balance.quantityReserved;
    data.quantityAvailable = balance.quantityAvailable;
  }

  return data;
}

interface BuildContextResult {
  context: PolicyContext | null;
  violations: Array<{ message: string; code: string }>;
}

/**
 * Build policy context from resource with Zero Trust validation
 */
export async function buildPolicyContextFromResource(
  actionType: string,
  resourceId: string | undefined,
  user: { id: string; tenantId: string; role: string }
): Promise<BuildContextResult> {
  const violations: Array<{ message: string; code: string }> = [];

  if (!SUPPORTED_ACTION_TYPES.includes(actionType)) {
    violations.push({ message: `Unsupported action type: ${actionType}`, code: "UNSUPPORTED_ACTION" });
    await policyEngine.logPolicyDecision({
      tenantId: user.tenantId,
      userId: user.id,
      actionType,
      decision: "denied",
      reason: `Unsupported action type: ${actionType}`,
      policyIds: [],
      context: { actionType, supportedTypes: SUPPORTED_ACTION_TYPES },
    });
    return { context: null, violations };
  }

  if (!resourceId) {
    violations.push({ message: "Missing required parameter: resourceId", code: "MISSING_RESOURCE_ID" });
    await policyEngine.logPolicyDecision({
      tenantId: user.tenantId,
      userId: user.id,
      actionType,
      decision: "denied",
      reason: "Resource ID is required for policy evaluation",
      policyIds: [],
      context: { actionType, resourceId: undefined },
    });
    return { context: null, violations };
  }

  const lookup = await lookupResourceForAction(actionType, resourceId);
  if (!lookup) {
    violations.push({ message: `Resource not found: ${resourceId}`, code: "RESOURCE_NOT_FOUND" });
    await policyEngine.logPolicyDecision({
      tenantId: user.tenantId,
      userId: user.id,
      actionType,
      decision: "denied",
      reason: `Resource not found: ${resourceId}`,
      policyIds: [],
      context: { actionType, resourceId },
    });
    return { context: null, violations };
  }

  if (lookup.tenantId !== user.tenantId) {
    violations.push({ message: "Resource does not belong to your tenant", code: "TENANT_MISMATCH" });
    await policyEngine.logPolicyDecision({
      tenantId: user.tenantId,
      userId: user.id,
      actionType,
      decision: "denied",
      reason: `Tenant mismatch: resource belongs to tenant ${lookup.tenantId}`,
      policyIds: [],
      context: { actionType, resourceId, userTenant: user.tenantId, resourceTenant: lookup.tenantId },
    });
    return { context: null, violations };
  }

  const context: PolicyContext = {
    tenantId: lookup.tenantId,
    userId: user.id,
    userRole: user.role,
    action: {
      type: actionType,
      targetType: lookup.targetType,
      targetId: resourceId,
      data: extractActionDataFromResource(lookup.resource, actionType),
    },
    environment: (process.env.NODE_ENV || "development") as "production" | "staging" | "development",
    requestTime: new Date(),
  };

  return { context, violations: [] };
}
