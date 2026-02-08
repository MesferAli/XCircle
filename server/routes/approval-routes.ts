import { Router, Request, Response } from "express";
import { storage } from "../storage";

const router = Router();

// List approvals (with optional filters)
router.get("/", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const approvalList = await storage.getApprovals(tenantId, status, limit, offset);
    res.json(approvalList);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch approvals",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get pending approvals
router.get("/pending", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const pendingApprovals = await storage.getPendingApprovals(tenantId, limit, offset);
    res.json(pendingApprovals);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch pending approvals",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get single approval
router.get("/:id", async (req, res) => {
  try {
    const approval = await storage.getApproval(req.params.id);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }
    res.json(approval);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch approval",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Request approval (create new approval request)
router.post("/", async (req, res) => {
  try {
    const { tenantId, recommendationId, actionType, actionData, requestedBy, comments, policyContext } = req.body;

    if (!tenantId || !actionType || !requestedBy) {
      return res.status(400).json({
        error: "Missing required fields: tenantId, actionType, and requestedBy are required"
      });
    }

    const approval = await storage.createApproval({
      tenantId,
      recommendationId,
      actionType,
      actionData,
      requestedBy,
      comments,
      policyContext,
    });

    await storage.createAuditLog({
      tenantId,
      userId: requestedBy,
      action: "request_approval",
      resourceType: "approval",
      resourceId: approval.id,
      newState: {
        actionType,
        status: "pending",
      },
      ipAddress: req.ip || "unknown",
    });

    res.status(201).json(approval);
  } catch (error) {
    res.status(500).json({
      error: "Failed to create approval request",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Update approval (approve/reject)
router.patch("/:id", async (req, res) => {
  try {
    const approval = await storage.getApproval(req.params.id);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }

    if (approval.status !== "pending") {
      return res.status(400).json({
        error: "Approval has already been resolved",
        currentStatus: approval.status,
      });
    }

    const { status, approvedBy, comments } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be 'approved' or 'rejected'"
      });
    }

    if (!approvedBy) {
      return res.status(400).json({
        error: "approvedBy is required to resolve an approval"
      });
    }

    const previousStatus = approval.status;
    const updated = await storage.updateApproval(req.params.id, {
      status,
      approvedBy,
      comments: comments || approval.comments,
    });

    await storage.createAuditLog({
      tenantId: approval.tenantId,
      userId: approvedBy,
      action: status === "approved" ? "approve" : "reject",
      resourceType: "approval",
      resourceId: req.params.id,
      previousState: { status: previousStatus },
      newState: { status, approvedBy },
      ipAddress: req.ip || "unknown",
    });

    if (status === "approved" && approval.recommendationId) {
      await storage.updateRecommendation(approval.recommendationId, {
        status: "approved",
        decidedBy: approvedBy,
      });

      await storage.createAuditLog({
        tenantId: approval.tenantId,
        userId: approvedBy,
        action: "execute_recommendation",
        resourceType: "recommendation",
        resourceId: approval.recommendationId,
        previousState: { status: "pending" },
        newState: { status: "approved", approvedViaApprovalId: approval.id },
        ipAddress: req.ip || "unknown",
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: "Failed to update approval",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
