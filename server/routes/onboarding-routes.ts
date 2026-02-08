import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { tenants, meetingRequests, useCaseFeatures } from "@shared/schema";

const router = Router();

// Get current tenant onboarding status
router.get("/status", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.tenantId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const tenant = await storage.getTenant(user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Calculate trial days remaining if applicable
    let trialDaysRemaining = null;
    let trialExpired = false;
    if (tenant.trialEndsAt) {
      const now = new Date();
      const trialEnd = new Date(tenant.trialEndsAt);
      const diffTime = trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      trialExpired = trialDaysRemaining < 0;
    }

    res.json({
      onboardingCompleted: tenant.onboardingCompleted,
      companySize: tenant.companySize,
      selectedUseCase: tenant.selectedUseCase,
      allowedFeatures: tenant.allowedFeatures,
      trialEndsAt: tenant.trialEndsAt,
      trialDaysRemaining,
      trialExpired,
      status: tenant.status,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get onboarding status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Complete onboarding
router.post("/complete", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.tenantId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { companySize, selectedUseCase, planId } = req.body;

    if (!companySize || !selectedUseCase) {
      return res.status(400).json({
        error: "Missing required fields: companySize and selectedUseCase are required",
      });
    }

    // Get allowed features for the selected use case
    const allowedFeatures = useCaseFeatures[selectedUseCase as keyof typeof useCaseFeatures] || [];

    // Calculate trial end date - BOTH Enterprise and SMB get 7-day trial
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    const trialEndsAt = trialEnd;
    const status = "active"; // Will be set to trial_expired by cron if expired

    // Update tenant with onboarding data
    const updatedTenant = await db
      .update(tenants)
      .set({
        companySize,
        selectedUseCase,
        allowedFeatures,
        onboardingCompleted: true,
        trialEndsAt,
        status,
      })
      .where(eq(tenants.id, user.tenantId))
      .returning();

    if (updatedTenant.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // If small business with plan selected, create subscription
    if (companySize === "small" && planId) {
      const plan = await storage.getSubscriptionPlan(planId);
      if (plan) {
        await storage.createSubscription({
          tenantId: user.tenantId,
          planId,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
      }
    }

    // Log to audit
    await storage.createAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      eventType: "action_executed",
      action: "complete_onboarding",
      resourceType: "tenant",
      resourceId: user.tenantId,
      newState: {
        companySize,
        selectedUseCase,
        allowedFeatures,
      },
    });

    res.json({
      success: true,
      tenant: updatedTenant[0],
      message: companySize === "enterprise"
        ? "Trial started successfully! You have 7 days to explore the platform."
        : "Account setup complete!",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to complete onboarding",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Request meeting (for enterprise trial expiry)
router.post("/request-meeting", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.tenantId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { contactName, contactEmail, contactPhone, preferredDate, notes } = req.body;

    if (!contactName || !contactEmail) {
      return res.status(400).json({
        error: "Missing required fields: contactName and contactEmail are required",
      });
    }

    // Create meeting request
    const [meetingRequest] = await db
      .insert(meetingRequests)
      .values({
        tenantId: user.tenantId,
        requestedBy: user.id,
        contactName,
        contactEmail,
        contactPhone,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        notes,
        status: "pending",
      })
      .returning();

    // Log to audit
    await storage.createAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      eventType: "action_executed",
      action: "request_meeting",
      resourceType: "meeting_request",
      resourceId: meetingRequest.id,
      newState: {
        contactName,
        contactEmail,
        status: "pending",
      },
    });

    res.status(201).json({
      success: true,
      meetingRequest,
      message: "Meeting request submitted successfully. Our team will contact you shortly.",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to submit meeting request",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get meeting requests for a tenant
router.get("/meeting-requests", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.tenantId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const requests = await db
      .select()
      .from(meetingRequests)
      .where(eq(meetingRequests.tenantId, user.tenantId));

    res.json(requests);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get meeting requests",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
