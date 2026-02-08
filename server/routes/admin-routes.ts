import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { tenants, meetingRequests } from "@shared/schema";
import { stubAuthMiddleware } from "../routes";

const router = Router();

// ==================== ADMIN: CUSTOMER MANAGEMENT ====================
// SECURITY: Platform admin routes require platformRole === "platform_admin"
// This is separate from tenant-level admin role for zero-trust isolation
router.get("/admin/tenants", stubAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.platformRole !== "platform_admin") {
      return res.status(403).json({ error: "Platform admin access required" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const tenantsList = await storage.getTenants(limit, offset);
    const tenantsWithSubscriptions = await Promise.all(
      tenantsList.map(async (tenant) => {
        const subscription = await storage.getSubscriptionByTenant(tenant.id);
        const plan = subscription ? await storage.getSubscriptionPlan(subscription.planId) : null;
        return {
          ...tenant,
          subscription: subscription ? { ...subscription, plan } : null,
        };
      })
    );

    res.json(tenantsWithSubscriptions);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get tenants",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.patch("/admin/tenants/:id/status", stubAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.platformRole !== "platform_admin") {
      return res.status(403).json({ error: "Platform admin access required" });
    }

    const { status } = req.body;
    if (!status || !["active", "suspended", "onboarding"].includes(status)) {
      return res.status(400).json({ error: "Valid status required (active, suspended, onboarding)" });
    }

    const tenant = await storage.getTenant(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const updated = await db.update(tenants)
      .set({ status })
      .where(eq(tenants.id, req.params.id))
      .returning();

    await storage.createAuditLog({
      tenantId: req.params.id,
      userId: user.id,
      action: "update_tenant_status",
      resourceType: "tenant",
      resourceId: req.params.id,
      previousState: { status: tenant.status },
      newState: { status },
      ipAddress: req.ip || "unknown",
    });

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to update tenant status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Admin: Seed default subscription plans
router.post("/admin/seed-plans", stubAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.platformRole !== "platform_admin") {
      return res.status(403).json({ error: "Platform admin access required" });
    }

    const existingPlans = await storage.getSubscriptionPlans();
    if (existingPlans.length > 0) {
      return res.json({ message: "Plans already exist", plans: existingPlans });
    }

    const plans = [
      {
        name: "Basic",
        nameAr: "الأساسية",
        description: "Perfect for small businesses getting started",
        descriptionAr: "مثالية للشركات الصغيرة في البداية",
        priceMonthly: 299,
        priceCurrency: "SAR",
        features: ["1 Connector", "1 User", "100 Items", "Email Support"],
        featuresAr: ["موصل واحد", "مستخدم واحد", "100 منتج", "دعم بالبريد"],
        maxConnectors: 1,
        maxUsers: 1,
        maxItems: 100,
        aiRecommendations: false,
        prioritySupport: false,
        sortOrder: 1,
      },
      {
        name: "Professional",
        nameAr: "الاحترافية",
        description: "For growing businesses with advanced needs",
        descriptionAr: "للشركات النامية ذات الاحتياجات المتقدمة",
        priceMonthly: 799,
        priceCurrency: "SAR",
        features: ["5 Connectors", "5 Users", "1000 Items", "AI Recommendations", "Priority Support"],
        featuresAr: ["5 موصلات", "5 مستخدمين", "1000 منتج", "توصيات الذكاء الاصطناعي", "دعم أولوية"],
        maxConnectors: 5,
        maxUsers: 5,
        maxItems: 1000,
        aiRecommendations: true,
        prioritySupport: true,
        sortOrder: 2,
      },
      {
        name: "Enterprise",
        nameAr: "المؤسسية",
        description: "Unlimited access for large organizations",
        descriptionAr: "وصول غير محدود للمؤسسات الكبيرة",
        priceMonthly: 1999,
        priceCurrency: "SAR",
        features: ["Unlimited Connectors", "Unlimited Users", "Unlimited Items", "AI Recommendations", "Dedicated Support", "SLA Guarantee"],
        featuresAr: ["موصلات غير محدودة", "مستخدمين غير محدودين", "منتجات غير محدودة", "توصيات الذكاء الاصطناعي", "دعم مخصص", "ضمان SLA"],
        maxConnectors: 999,
        maxUsers: 999,
        maxItems: 999999,
        aiRecommendations: true,
        prioritySupport: true,
        sortOrder: 3,
      },
    ];

    const createdPlans = [];
    for (const plan of plans) {
      const created = await storage.createSubscriptionPlan(plan);
      createdPlans.push(created);
    }

    res.status(201).json({ message: "Plans created", plans: createdPlans });
  } catch (error) {
    res.status(500).json({
      error: "Failed to seed plans",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Admin: Get all meeting requests (platform admin only)
router.get("/admin/meeting-requests", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.platformRole !== "platform_admin") {
      return res.status(403).json({ error: "Platform admin privileges required" });
    }

    const requests = await db
      .select()
      .from(meetingRequests);

    res.json(requests);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get meeting requests",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Admin: Update meeting request status (platform admin only)
router.patch("/admin/meeting-requests/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.platformRole !== "platform_admin") {
      return res.status(403).json({ error: "Platform admin privileges required" });
    }

    const { status, scheduledAt, adminNotes } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (scheduledAt) updateData.scheduledAt = new Date(scheduledAt);
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (status === "completed") updateData.completedAt = new Date();

    const [updated] = await db
      .update(meetingRequests)
      .set(updateData)
      .where(eq(meetingRequests.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Meeting request not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: "Failed to update meeting request",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
