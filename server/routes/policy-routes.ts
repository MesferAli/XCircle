import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { policyEngine } from "../policy-engine";
import { requireCapability } from "../capability-guard";
import { buildPolicyContextFromResource } from "../routes";
import type { User } from "@shared/schema";

const router = Router();

router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const policies = await storage.getPolicies(undefined, limit, offset);
  res.json(policies);
});

// Get default policies (must be before /:id route)
router.get("/defaults", async (req, res) => {
  try {
    const defaults = policyEngine.getDefaultPolicies();
    res.json(defaults);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get default policies",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Policy Evaluation Endpoint (must be before /:id route)
// SECURITY: Zero Trust - Uses buildPolicyContextFromResource helper
// All context is derived from authoritative sources (database) only
router.post("/evaluate", async (req, res) => {
  try {
    // STEP 1: Check req.user exists (stub middleware ensures this in dev)
    const user = (req as any).user;
    if (!user?.id || !user?.tenantId) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User authentication required for policy evaluation",
      });
    }

    const { actionType, resourceId } = req.body;

    if (!actionType) {
      return res.status(400).json({
        error: "Missing required field: actionType is required"
      });
    }

    // STEP 2: Use buildPolicyContextFromResource helper for Zero Trust validation
    const { context, violations } = await buildPolicyContextFromResource(
      actionType,
      resourceId,
      { id: user.id, tenantId: user.tenantId, role: user.role || "viewer" }
    );

    // STEP 3: If violations, return error
    if (violations.length > 0) {
      const firstViolation = violations[0];
      const statusCode = firstViolation.code === "RESOURCE_NOT_FOUND" ? 404 :
                        firstViolation.code === "TENANT_MISMATCH" ? 403 : 400;
      return res.status(statusCode).json({
        error: firstViolation.code,
        message: firstViolation.message,
        violations,
      });
    }

    if (!context) {
      return res.status(400).json({
        error: "Cannot determine action context from request",
        message: `Unsupported action type or missing resourceId: ${actionType}`,
      });
    }

    // STEP 4: Evaluate policy
    const result = await policyEngine.evaluatePolicy(context);

    await storage.createAuditLog({
      tenantId: context.tenantId,
      userId: context.userId,
      action: "policy_evaluation_request",
      resourceType: "policy",
      resourceId: result.appliedPolicies.join(",") || "none",
      newState: {
        allowed: result.allowed,
        requiresApproval: result.requiresApproval,
        requiresDryRun: result.requiresDryRun,
        violationCount: result.violations.length,
      },
      ipAddress: req.ip || "unknown",
    });

    res.json(result);
  } catch (error) {
    console.error("Policy evaluation error:", error);
    res.status(500).json({
      error: "Failed to evaluate policies",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Validate action (must be before /:id route)
// SECURITY: Zero Trust - Uses buildPolicyContextFromResource helper
router.post("/validate-action", async (req, res) => {
  try {
    // STEP 1: Check req.user exists (stub middleware ensures this in dev)
    const user = (req as any).user;
    if (!user?.id || !user?.tenantId) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User authentication required for action validation",
      });
    }

    const { actionType, resourceId } = req.body;

    if (!actionType) {
      return res.status(400).json({
        error: "Missing required field: actionType is required"
      });
    }

    // STEP 2: Use buildPolicyContextFromResource helper for Zero Trust validation
    const { context, violations } = await buildPolicyContextFromResource(
      actionType,
      resourceId,
      { id: user.id, tenantId: user.tenantId, role: user.role || "viewer" }
    );

    // STEP 3: If violations, return error
    if (violations.length > 0) {
      const firstViolation = violations[0];
      const statusCode = firstViolation.code === "RESOURCE_NOT_FOUND" ? 404 :
                        firstViolation.code === "TENANT_MISMATCH" ? 403 : 400;
      return res.status(statusCode).json({
        error: firstViolation.code,
        message: firstViolation.message,
        violations,
      });
    }

    if (!context) {
      return res.status(400).json({
        error: "Cannot determine action context from request",
        message: `Unsupported action type or missing resourceId: ${actionType}`,
      });
    }

    // STEP 4: Build user object and validate action
    const userObj: User = {
      id: user.id,
      username: "authenticated_user",
      email: null,
      password: "",
      googleId: null,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
      tenantId: user.tenantId,
      role: user.role || "viewer",
      platformRole: user.platformRole || null,
      createdAt: new Date(),
    };

    const result = await policyEngine.validateAction(context.action as any, userObj, user.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to validate action",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Check blast radius (must be before /:id route)
// SECURITY: Zero Trust - Uses buildPolicyContextFromResource helper
router.post("/check-blast-radius", async (req, res) => {
  try {
    // STEP 1: Check req.user exists (stub middleware ensures this in dev)
    const user = (req as any).user;
    if (!user?.id || !user?.tenantId) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User authentication required for blast radius check",
      });
    }

    const { actionType, resourceId } = req.body;

    if (!actionType) {
      return res.status(400).json({
        error: "Missing required field: actionType is required"
      });
    }

    // STEP 2: Use buildPolicyContextFromResource helper for Zero Trust validation
    const { context, violations } = await buildPolicyContextFromResource(
      actionType,
      resourceId,
      { id: user.id, tenantId: user.tenantId, role: user.role || "viewer" }
    );

    // STEP 3: If violations, return error
    if (violations.length > 0) {
      const firstViolation = violations[0];
      const statusCode = firstViolation.code === "RESOURCE_NOT_FOUND" ? 404 :
                        firstViolation.code === "TENANT_MISMATCH" ? 403 : 400;
      return res.status(statusCode).json({
        error: firstViolation.code,
        message: firstViolation.message,
        violations,
      });
    }

    if (!context) {
      return res.status(400).json({
        error: "Cannot determine action context from request",
        message: `Unsupported action type or missing resourceId: ${actionType}`,
      });
    }

    // STEP 4: Enforce blast radius using context.action
    const result = await policyEngine.enforceBlastRadius(context.action as any, user.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to check blast radius",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Check dry-run requirement (must be before /:id route)
// SECURITY: Zero Trust - Uses buildPolicyContextFromResource helper
router.post("/check-dry-run", async (req, res) => {
  try {
    // STEP 1: Check req.user exists (stub middleware ensures this in dev)
    const user = (req as any).user;
    if (!user?.id || !user?.tenantId) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User authentication required for dry-run check",
      });
    }

    const { actionType, resourceId } = req.body;

    if (!actionType) {
      return res.status(400).json({
        error: "Missing required field: actionType is required"
      });
    }

    // STEP 2: Use buildPolicyContextFromResource helper for Zero Trust validation
    const { context, violations } = await buildPolicyContextFromResource(
      actionType,
      resourceId,
      { id: user.id, tenantId: user.tenantId, role: user.role || "viewer" }
    );

    // STEP 3: If violations, return error
    if (violations.length > 0) {
      const firstViolation = violations[0];
      const statusCode = firstViolation.code === "RESOURCE_NOT_FOUND" ? 404 :
                        firstViolation.code === "TENANT_MISMATCH" ? 403 : 400;
      return res.status(statusCode).json({
        error: firstViolation.code,
        message: firstViolation.message,
        violations,
      });
    }

    if (!context) {
      return res.status(400).json({
        error: "Cannot determine action context from request",
        message: `Unsupported action type or missing resourceId: ${actionType}`,
      });
    }

    // STEP 4: Check dry-run requirement using context.action
    const result = await policyEngine.checkDryRunRequired(context.action as any, user.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to check dry-run requirement",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/:id", async (req, res) => {
  const policy = await storage.getPolicy(req.params.id);
  if (!policy) {
    return res.status(404).json({ error: "Policy not found" });
  }
  res.json(policy);
});

// SECURITY: Capability enforcement for policy write operations
router.post("/", requireCapability("policy_write"), async (req, res) => {
  const user = (req as any).user;
  const policy = await storage.createPolicy(req.body);
  await storage.createAuditLog({
    tenantId: policy.tenantId,
    userId: user?.id || "admin",
    action: "create",
    resourceType: "policy",
    resourceId: policy.id,
    newState: { name: policy.name },
    ipAddress: req.ip || "unknown",
  });
  res.status(201).json(policy);
});

router.patch("/:id", requireCapability("policy_write"), async (req, res) => {
  const policy = await storage.updatePolicy(req.params.id, req.body);
  if (!policy) {
    return res.status(404).json({ error: "Policy not found" });
  }
  res.json(policy);
});

router.delete("/:id", requireCapability("policy_write"), async (req, res) => {
  const user = (req as any).user;
  const policy = await storage.getPolicy(req.params.id);
  if (!policy) {
    return res.status(404).json({ error: "Policy not found" });
  }
  await storage.deletePolicy(req.params.id);
  await storage.createAuditLog({
    tenantId: policy.tenantId,
    userId: user?.id || "admin",
    action: "delete",
    resourceType: "policy",
    resourceId: req.params.id,
    previousState: { name: policy.name },
    ipAddress: req.ip || "unknown",
  });
  res.status(204).send();
});

export default router;
