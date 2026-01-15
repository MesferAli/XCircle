// ===================================================================================
// SECURITY GUARANTEE: EXECUTION HARD LOCK
// ===================================================================================
// Action execution is IMPOSSIBLE BY DESIGN.
// This is NOT a configurable setting - it is hardcoded.
// Even if someone bypasses UI or calls API directly, execution will fail.
// This platform is DRAFT_ONLY - it recommends actions, it does NOT execute them.
//
// The EAL (Enterprise AI Layer) platform is designed for:
// - Generating AI-powered recommendations
// - Human review and approval workflows
// - Policy enforcement and compliance checking
//
// It is NOT designed for:
// - Auto-executing recommendations
// - Writing back to external systems
// - Performing actions without human intervention in the target system
// ===================================================================================

import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

/**
 * HARDCODED execution mode - cannot be changed at runtime
 * This is a compile-time constant, not a configuration option
 */
export const EXECUTION_MODE = "DRAFT_ONLY" as const;

export type ExecutionMode = typeof EXECUTION_MODE;

/**
 * Error thrown when any execution attempt is made
 * This error indicates a fundamental violation of the platform's design
 */
export class ExecutionForbiddenError extends Error {
  public readonly code = "EXECUTION_FORBIDDEN_BY_DESIGN";
  public readonly httpStatus = 403;
  
  constructor(attemptedAction?: string) {
    const message = attemptedAction
      ? `EXECUTION_FORBIDDEN_BY_DESIGN: Attempted action '${attemptedAction}' is blocked. This platform operates in DRAFT_ONLY mode. Action execution is impossible by design.`
      : "EXECUTION_FORBIDDEN_BY_DESIGN: This platform operates in DRAFT_ONLY mode. Action execution is impossible by design.";
    super(message);
    this.name = "ExecutionForbiddenError";
  }
}

/**
 * This function ALWAYS throws - execution is impossible by design
 * There is no code path where this function returns normally
 * 
 * @throws {ExecutionForbiddenError} Always throws - execution is not permitted
 */
export function assertExecutionAllowed(attemptedAction?: string): never {
  throw new ExecutionForbiddenError(attemptedAction);
}

/**
 * Middleware that blocks ALL execution attempts at the API level
 * This is the last line of defense - even if other checks are bypassed,
 * this middleware ensures execution is impossible
 * 
 * @param req Express request
 * @param res Express response  
 * @param next Express next function (never called - always blocks)
 */
export async function blockAllExecution(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const user = (req as any).user;
  const userId = user?.id || "unknown";
  const tenantId = user?.tenantId || "unknown";
  const resourceId = req.params.id || "unknown";
  
  // MANDATORY: Log the blocked execution attempt to audit trail
  // This creates an immutable record of all execution attempts
  try {
    await storage.createAuditLog({
      tenantId,
      userId,
      action: "EXECUTION_ATTEMPT_BLOCKED",
      resourceType: "recommendation",
      resourceId,
      newState: {
        blocked: true,
        reason: "EXECUTION_FORBIDDEN_BY_DESIGN",
        executionMode: EXECUTION_MODE,
        attemptedEndpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        userAgent: req.get("user-agent") || "unknown",
        ipAddress: req.ip || "unknown",
      },
      ipAddress: req.ip || "unknown",
    });
  } catch (auditError) {
    // Even if audit logging fails, we MUST block execution
    console.error("[SECURITY] Failed to log blocked execution attempt:", auditError);
  }

  // Return 403 Forbidden with clear error message
  res.status(403).json({
    success: false,
    error: "EXECUTION_FORBIDDEN_BY_DESIGN",
    code: "EXECUTION_FORBIDDEN_BY_DESIGN",
    message: "This platform operates in DRAFT_ONLY mode. Action execution is impossible by design.",
    explanation: [
      "The EAL platform is designed for recommendation and review workflows only.",
      "AI recommendations are for human review - they cannot be auto-executed.",
      "To implement a recommendation, a human must take action in the target system directly.",
      "This is a security feature, not a bug. It cannot be bypassed or configured."
    ],
    executionMode: EXECUTION_MODE,
    blocked: true,
    recommendationId: resourceId !== "unknown" ? resourceId : undefined,
  });
}

/**
 * Validates that the platform is in DRAFT_ONLY mode
 * This function exists for runtime verification and documentation purposes
 * 
 * @returns true always - the platform is always in DRAFT_ONLY mode
 */
export function isDraftOnlyMode(): true {
  // This is hardcoded - there is no other mode
  return true;
}

/**
 * Get the current execution mode
 * This always returns "DRAFT_ONLY" as that is the only supported mode
 */
export function getExecutionMode(): typeof EXECUTION_MODE {
  return EXECUTION_MODE;
}
