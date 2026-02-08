import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { stubAuthMiddleware } from "../routes";

const router = Router();

// ==================== SUBSCRIPTION PLANS (Public) ====================
router.get("/subscription-plans", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const plans = await storage.getSubscriptionPlans(limit, offset);
    res.json(plans);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get subscription plans",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/subscription-plans/:id", async (req, res) => {
  try {
    const plan = await storage.getSubscriptionPlan(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get subscription plan",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ==================== SUBSCRIPTIONS (Protected) ====================
router.get("/subscriptions", stubAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const subscriptions = await storage.getSubscriptions(user.tenantId, limit, offset);
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get subscriptions",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/subscriptions/current", stubAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const subscription = await storage.getSubscriptionByTenant(user.tenantId);
    if (!subscription) {
      return res.json(null);
    }
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    res.json({ ...subscription, plan });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get current subscription",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/subscriptions", stubAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: "planId is required" });
    }

    const plan = await storage.getSubscriptionPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const subscription = await storage.createSubscription({
      tenantId: user.tenantId,
      planId,
      status: "trial",
      trialEndsAt,
    });

    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({
      error: "Failed to create subscription",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ==================== PAYMENTS (Protected) ====================
router.get("/payments", stubAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const payments = await storage.getPayments(user.tenantId, limit, offset);
    res.json(payments);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get payments",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/payments/:id", stubAuthMiddleware, async (req, res) => {
  try {
    const payment = await storage.getPayment(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get payment",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/payments/initiate", stubAuthMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { planId, paymentMethod, token } = req.body;

    if (!planId) {
      return res.status(400).json({ error: "planId is required" });
    }

    if (!paymentMethod || !["mada", "creditcard"].includes(paymentMethod)) {
      return res.status(400).json({ error: "Valid paymentMethod is required (mada or creditcard)" });
    }

    if (!token) {
      return res.status(400).json({ error: "Payment token is required" });
    }

    // Get the subscription plan to determine the amount
    const plan = await storage.getSubscriptionPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: "Subscription plan not found" });
    }

    // Get or create subscription for this tenant
    let subscription = await storage.getSubscriptionByTenant(user.tenantId);
    if (!subscription) {
      subscription = await storage.createSubscription({
        tenantId: user.tenantId,
        planId: plan.id,
        status: "trial",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    // Create payment record
    const amountInHalalas = plan.priceMonthly; // Already in halalas
    const payment = await storage.createPayment({
      tenantId: user.tenantId,
      subscriptionId: subscription.id,
      amount: amountInHalalas,
      currency: "SAR",
      status: "initiated",
      description: `Subscription: ${plan.name}`,
    });

    // If Moyasar secret key is configured, process payment through Moyasar
    if (process.env.MOYASAR_SECRET_KEY) {
      try {
        const { moyasarClient } = await import("../moyasar");

        const callbackUrl = `${process.env.APP_URL || "https://" + process.env.REPL_SLUG + "." + process.env.REPL_OWNER + ".repl.co"}/api/payments/callback`;

        // Use token-based payment (PCI-compliant)
        // The token was created client-side via Moyasar's frontend tokenization
        const source = {
          type: "token" as const,
          token: token,
        };

        const moyasarResponse = await moyasarClient.createPayment(
          amountInHalalas,
          "SAR",
          `Atlas Subscription: ${plan.name}`,
          callbackUrl,
          source as any, // Token source type
          {
            tenant_id: user.tenantId,
            payment_id: payment.id,
            plan_id: planId,
          }
        );

        // Update payment with Moyasar ID
        await storage.updatePayment(payment.id, {
          moyasarPaymentId: moyasarResponse.id,
          status: moyasarResponse.status,
        });

        // If 3D Secure is required, return the transaction URL
        if (moyasarResponse.source?.transaction_url) {
          return res.status(200).json({
            paymentId: payment.id,
            status: "pending_3ds",
            redirectUrl: moyasarResponse.source.transaction_url,
          });
        }

        // Payment completed successfully
        if (moyasarResponse.status === "paid") {
          await storage.updatePayment(payment.id, {
            status: "paid",
            paidAt: new Date(),
          });

          // Activate subscription
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await storage.updateSubscription(subscription.id, {
            planId: plan.id,
            status: "active",
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
          });

          // Update tenant status
          await storage.updateTenant(user.tenantId, { status: "active" });

          return res.status(200).json({
            paymentId: payment.id,
            status: "paid",
            message: "Payment successful",
          });
        }

        return res.status(200).json({
          paymentId: payment.id,
          status: moyasarResponse.status,
        });
      } catch (moyasarError) {
        console.error("Moyasar payment error:", moyasarError);
        await storage.updatePayment(payment.id, {
          status: "failed",
          failedAt: new Date(),
          failureReason: moyasarError instanceof Error ? moyasarError.message : "Payment processing failed",
        });
        return res.status(400).json({
          error: "Payment processing failed",
          message: moyasarError instanceof Error ? moyasarError.message : "Unknown error",
        });
      }
    } else {
      // No Moyasar key - return payment as initiated (for testing)
      console.log("[Payment] Moyasar not configured, returning simulated response");
      return res.status(200).json({
        paymentId: payment.id,
        status: "initiated",
        message: "Payment initiated (test mode - Moyasar not configured)",
      });
    }
  } catch (error) {
    console.error("Payment initiation error:", error);
    res.status(500).json({
      error: "Failed to initiate payment",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Payment callback for 3D Secure redirect
// SECURITY: We verify the payment status with Moyasar API, not from query params
router.get("/payments/callback", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      console.error("[Payment Callback] Missing payment ID");
      return res.redirect("/subscription?payment=error");
    }

    // Find payment by Moyasar ID
    const payment = await storage.getPaymentByMoyasarId(id);
    if (!payment) {
      console.error("[Payment Callback] Payment not found for Moyasar ID:", id);
      return res.redirect("/subscription?payment=error");
    }

    // SECURITY: Verify payment status directly with Moyasar API
    // DO NOT trust query params - always fetch from gateway
    if (process.env.MOYASAR_SECRET_KEY) {
      try {
        const { moyasarClient } = await import("../moyasar");
        const moyasarPayment = await moyasarClient.getPayment(id);

        // Only trust the status from Moyasar's verified response
        if (moyasarPayment.status === "paid") {
          await storage.updatePayment(payment.id, {
            status: "paid",
            paidAt: new Date(),
          });

          // Activate subscription
          if (payment.subscriptionId) {
            const periodEnd = new Date();
            periodEnd.setMonth(periodEnd.getMonth() + 1);
            const subscription = await storage.getSubscription(payment.subscriptionId);
            if (subscription) {
              await storage.updateSubscription(subscription.id, {
                status: "active",
                currentPeriodStart: new Date(),
                currentPeriodEnd: periodEnd,
              });
              await storage.updateTenant(payment.tenantId, { status: "active" });

              // Audit log for successful payment
              await storage.createAuditLog({
                tenantId: payment.tenantId,
                action: "payment_verified",
                resourceType: "payment",
                resourceId: payment.id,
                metadata: { moyasarId: id, status: "paid", verified: true },
                ipAddress: req.ip || "unknown",
              });
            }
          }

          return res.redirect("/subscription?payment=success");
        } else if (moyasarPayment.status === "failed") {
          await storage.updatePayment(payment.id, {
            status: "failed",
            failedAt: new Date(),
            failureReason: moyasarPayment.source?.message || "Payment failed",
          });
          return res.redirect("/subscription?payment=failed");
        } else {
          // Payment still processing or in another state
          console.log("[Payment Callback] Payment in status:", moyasarPayment.status);
          return res.redirect("/subscription?payment=pending");
        }
      } catch (verifyError) {
        console.error("[Payment Callback] Verification failed:", verifyError);
        // If we can't verify, don't activate - redirect with error
        return res.redirect("/subscription?payment=error");
      }
    } else {
      // No Moyasar key - testing mode, just redirect
      console.log("[Payment Callback] Test mode - Moyasar not configured");
      return res.redirect("/subscription?payment=error");
    }
  } catch (error) {
    console.error("Payment callback error:", error);
    res.redirect("/subscription?payment=error");
  }
});

// ==================== MOYASAR WEBHOOK ====================
router.post("/webhooks/moyasar", async (req, res) => {
  try {
    const { id, status, amount, metadata } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing payment id" });
    }

    const payment = await storage.getPaymentByMoyasarId(id);
    if (!payment) {
      console.log("Webhook received for unknown payment:", id);
      return res.status(200).json({ received: true });
    }

    const updates: any = { status };
    if (status === "paid") {
      updates.paidAt = new Date();

      if (payment.subscriptionId) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await storage.updateSubscription(payment.subscriptionId, {
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        });
      }
    } else if (status === "failed") {
      updates.failedAt = new Date();
      updates.failureReason = req.body.message || "Payment failed";
    }

    await storage.updatePayment(payment.id, updates);

    await storage.createAuditLog({
      tenantId: payment.tenantId,
      action: "webhook_received",
      resourceType: "payment",
      resourceId: payment.id,
      metadata: { moyasarId: id, status, amount },
      ipAddress: req.ip || "unknown",
    });

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
