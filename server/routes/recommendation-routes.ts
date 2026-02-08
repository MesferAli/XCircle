import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { policyEngine } from "../policy-engine";
import { blockAllExecution } from "../execution-lock";
import { requireCapability } from "../capability-guard";
import type { User } from "@shared/schema";

const router = Router();

// Recommendations
router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const recommendations = await storage.getRecommendations(undefined, limit, offset);
  res.json(recommendations);
});

router.get("/:id", async (req, res) => {
  const rec = await storage.getRecommendation(req.params.id);
  if (!rec) {
    return res.status(404).json({ error: "Recommendation not found" });
  }
  res.json(rec);
});

router.patch("/:id", async (req, res) => {
  const user = (req as any).user;
  const rec = await storage.getRecommendation(req.params.id);
  if (!rec) {
    return res.status(404).json({ error: "Recommendation not found" });
  }
  const previousStatus = rec.status;
  const updated = await storage.updateRecommendation(req.params.id, {
    ...req.body,
    decidedBy: user?.id || "admin",
  });
  await storage.createAuditLog({
    tenantId: rec.tenantId,
    userId: user?.id || "admin",
    action: req.body.status === "approved" ? "approve" :
            req.body.status === "rejected" ? "reject" : "update",
    resourceType: "recommendation",
    resourceId: req.params.id,
    previousState: { status: previousStatus },
    newState: { status: req.body.status },
    ipAddress: req.ip || "unknown",
  });
  res.json(updated);
});

// SECURITY: Capability enforcement for recommendation approval
router.post("/:id/approve", requireCapability("recommendation_approve"), async (req, res) => {
  try {
    const user = (req as any).user;
    const rec = await storage.getRecommendation(req.params.id);
    if (!rec) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    // Verify tenant ownership
    if (rec.tenantId !== user.tenantId) {
      await storage.createAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: "approve_recommendation",
        resourceType: "recommendation",
        resourceId: req.params.id,
        eventType: "CAPABILITY_DENIED",
        newState: {
          denied: true,
          reason: "Tenant mismatch",
          userTenant: user.tenantId,
          resourceTenant: rec.tenantId,
        },
        ipAddress: req.ip || "unknown",
      });
      return res.status(403).json({
        error: "Access denied",
        message: "Resource does not belong to your tenant"
      });
    }

    if (rec.status !== "pending") {
      return res.status(400).json({
        error: "Cannot approve recommendation",
        message: `Recommendation is already ${rec.status}`,
      });
    }

    const previousStatus = rec.status;
    const updated = await storage.updateRecommendation(req.params.id, {
      status: "approved",
      decidedBy: user.id,
    });

    await storage.createAuditLog({
      tenantId: rec.tenantId,
      userId: user.id,
      action: "approve_recommendation",
      resourceType: "recommendation",
      resourceId: req.params.id,
      previousState: { status: previousStatus },
      newState: { status: "approved", approvedBy: user.id },
      ipAddress: req.ip || "unknown",
    });

    res.json({
      success: true,
      message: "Recommendation approved successfully",
      recommendation: updated,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to approve recommendation",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/:id/execute", blockAllExecution);

// Check approval requirement for a recommendation
router.post("/:id/check-approval", async (req, res) => {
  try {
    const rec = await storage.getRecommendation(req.params.id);
    if (!rec) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    const userId = req.body.userId || "anonymous";
    const userRole = req.body.userRole || "viewer";

    const user: User = {
      id: userId,
      username: "anonymous",
      email: null,
      password: "",
      googleId: null,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
      tenantId: rec.tenantId,
      role: userRole,
      platformRole: null,
      createdAt: new Date(),
    };

    const result = await policyEngine.checkApprovalRequired(rec, user, rec.tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to check approval requirement",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Anomalies
router.get("/anomalies", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const anomalies = await storage.getAnomalies(undefined, limit, offset);
  res.json(anomalies);
});

router.get("/anomalies/:id", async (req, res) => {
  const anomaly = await storage.getAnomaly(req.params.id);
  if (!anomaly) {
    return res.status(404).json({ error: "Anomaly not found" });
  }
  res.json(anomaly);
});

router.patch("/anomalies/:id", async (req, res) => {
  const anomaly = await storage.updateAnomaly(req.params.id, req.body);
  if (!anomaly) {
    return res.status(404).json({ error: "Anomaly not found" });
  }
  await storage.createAuditLog({
    tenantId: anomaly.tenantId,
    userId: "admin",
    action: "update",
    resourceType: "anomaly",
    resourceId: req.params.id,
    newState: { status: req.body.status },
    ipAddress: req.ip || "unknown",
  });
  res.json(anomaly);
});

export default router;
