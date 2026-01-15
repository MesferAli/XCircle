/**
 * SECURITY GUARANTEE:
 * Capabilities are enforced server-side, not UI.
 * Even if UI is bypassed, server will reject unauthorized requests.
 *
 * This module provides capability-based access control that:
 * 1. Maps roles to capabilities
 * 2. Provides middleware to enforce capability requirements
 * 3. Logs all capability denials to audit
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export type Capability =
  | "inventory_read"
  | "inventory_write"
  | "connector_read"
  | "connector_write"
  | "recommendation_read"
  | "recommendation_approve"
  | "recommendation_execute"
  | "policy_read"
  | "policy_write"
  | "audit_read"
  | "mapping_read"
  | "mapping_write";

export interface CapabilityCheckResult {
  allowed: boolean;
  missingCapabilities: Capability[];
  userCapabilities: Capability[];
}

/**
 * Role-to-capability mapping
 * - admin: ALL capabilities
 * - operator: inventory_read, inventory_write, connector_read, recommendation_read, recommendation_approve, audit_read, mapping_read
 * - viewer: inventory_read, connector_read, recommendation_read, audit_read, mapping_read
 */
const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  admin: [
    "inventory_read",
    "inventory_write",
    "connector_read",
    "connector_write",
    "recommendation_read",
    "recommendation_approve",
    "recommendation_execute",
    "policy_read",
    "policy_write",
    "audit_read",
    "mapping_read",
    "mapping_write",
  ],
  operator: [
    "inventory_read",
    "inventory_write",
    "connector_read",
    "recommendation_read",
    "recommendation_approve",
    "audit_read",
    "mapping_read",
  ],
  viewer: [
    "inventory_read",
    "connector_read",
    "recommendation_read",
    "audit_read",
    "mapping_read",
  ],
};

/**
 * Get capabilities for a given role
 * Returns empty array for unknown roles (fail closed)
 */
export function getCapabilitiesForRole(role: string): Capability[] {
  return ROLE_CAPABILITIES[role] || [];
}

/**
 * Check if a user has the required capabilities
 * Returns detailed result with missing capabilities
 */
export function checkCapabilities(
  userRole: string,
  requiredCapabilities: Capability[]
): CapabilityCheckResult {
  const userCapabilities = getCapabilitiesForRole(userRole);
  const missingCapabilities: Capability[] = [];

  for (const capability of requiredCapabilities) {
    if (!userCapabilities.includes(capability)) {
      missingCapabilities.push(capability);
    }
  }

  return {
    allowed: missingCapabilities.length === 0,
    missingCapabilities,
    userCapabilities,
  };
}

/**
 * Middleware factory to enforce capability requirements
 * 
 * Usage:
 *   app.post("/api/connectors", requireCapability("connector_write"), handler)
 *   app.delete("/api/policies/:id", requireCapability("policy_write"), handler)
 * 
 * SECURITY: This middleware MUST run BEFORE the route handler.
 * Even if UI is bypassed, server will reject unauthorized requests.
 */
export function requireCapability(...capabilities: Capability[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      // Fail closed: If no user identity, reject
      if (!user) {
        return res.status(401).json({
          error: "Authentication required",
          message: "User authentication is required to access this resource",
        });
      }

      const { id: userId, tenantId, role } = user;

      // Fail closed: If no tenant or role, reject
      if (!tenantId || !role) {
        return res.status(401).json({
          error: "Incomplete authentication",
          message: "User identity must include tenantId and role",
        });
      }

      // Check capabilities
      const result = checkCapabilities(role, capabilities);

      if (!result.allowed) {
        // MANDATORY: Log capability denial to audit
        await storage.createAuditLog({
          tenantId,
          userId: userId || "unknown",
          action: "capability_check",
          resourceType: "capability",
          resourceId: capabilities.join(","),
          eventType: "CAPABILITY_DENIED",
          newState: {
            denied: true,
            requiredCapabilities: capabilities,
            missingCapabilities: result.missingCapabilities,
            userRole: role,
            userCapabilities: result.userCapabilities,
            requestPath: req.path,
            requestMethod: req.method,
          },
          ipAddress: req.ip || "unknown",
        });

        return res.status(403).json({
          error: "Insufficient capabilities",
          message: `Your role (${role}) does not have the required capabilities for this action`,
          requiredCapabilities: capabilities,
          missingCapabilities: result.missingCapabilities,
        });
      }

      // All capabilities present, proceed
      next();
    } catch (error) {
      console.error("Capability check error:", error);
      return res.status(500).json({
        error: "Capability check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}

/**
 * Convenience middleware for multiple capability requirements (ANY)
 * Passes if user has ANY of the specified capabilities
 */
export function requireAnyCapability(...capabilities: Capability[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          error: "Authentication required",
          message: "User authentication is required to access this resource",
        });
      }

      const { id: userId, tenantId, role } = user;

      if (!tenantId || !role) {
        return res.status(401).json({
          error: "Incomplete authentication",
          message: "User identity must include tenantId and role",
        });
      }

      const userCapabilities = getCapabilitiesForRole(role);
      const hasAny = capabilities.some((cap) => userCapabilities.includes(cap));

      if (!hasAny) {
        await storage.createAuditLog({
          tenantId,
          userId: userId || "unknown",
          action: "capability_check",
          resourceType: "capability",
          resourceId: capabilities.join(","),
          eventType: "CAPABILITY_DENIED",
          newState: {
            denied: true,
            requiredAnyOf: capabilities,
            userRole: role,
            userCapabilities,
            requestPath: req.path,
            requestMethod: req.method,
          },
          ipAddress: req.ip || "unknown",
        });

        return res.status(403).json({
          error: "Insufficient capabilities",
          message: `Your role (${role}) does not have any of the required capabilities for this action`,
          requiredAnyOf: capabilities,
          userCapabilities,
        });
      }

      next();
    } catch (error) {
      console.error("Capability check error:", error);
      return res.status(500).json({
        error: "Capability check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
