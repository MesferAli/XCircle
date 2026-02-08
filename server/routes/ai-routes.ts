import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { aiEngine } from "../ai-engine";
import { zaiService } from "../zai-service";

const router = Router();

// AI Engine Routes
router.post("/analyze", async (req, res) => {
  try {
    const tenantId = req.body.tenantId || "default";
    const result = await aiEngine.generateRecommendations(tenantId);

    await storage.createAuditLog({
      tenantId,
      userId: "admin",
      action: "analyze",
      resourceType: "ai_engine",
      resourceId: "full_analysis",
      newState: {
        recommendationsCreated: result.recommendationsCreated,
        anomaliesCreated: result.anomaliesCreated,
        forecastsGenerated: result.demandForecasts.length,
        stockoutRisksAnalyzed: result.stockoutRisks.length,
      },
      ipAddress: req.ip || "unknown",
    });

    res.json({
      success: true,
      tenantId: result.tenantId,
      timestamp: result.timestamp,
      summary: {
        demandForecasts: result.demandForecasts.length,
        stockoutRisks: result.stockoutRisks.length,
        anomaliesDetected: result.anomalies.length,
        recommendationsCreated: result.recommendationsCreated,
        anomaliesCreated: result.anomaliesCreated,
      },
      demandForecasts: result.demandForecasts,
      stockoutRisks: result.stockoutRisks,
      anomalies: result.anomalies,
    });
  } catch (error) {
    console.error("AI analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run AI analysis",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/forecast/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const locationId = req.query.locationId as string | undefined;
    const tenantId = (req.query.tenantId as string) || "default";

    const item = await storage.getItems(tenantId);
    const foundItem = item.find((i) => i.id === itemId);
    if (!foundItem) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }

    const forecast = await aiEngine.analyzeDemand(
      itemId,
      locationId || null,
      tenantId
    );

    res.json({
      success: true,
      itemId,
      itemName: foundItem.name,
      forecast,
    });
  } catch (error) {
    console.error("Demand forecast error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate demand forecast",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/stockout-risk", async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || "default";
    const itemId = req.query.itemId as string | undefined;
    const locationId = req.query.locationId as string | undefined;

    const items = await storage.getItems(tenantId);
    const stockBalances = await storage.getStockBalances(tenantId);

    const results: Array<{
      itemId: string;
      itemName: string;
      locationId: string;
      risk: Awaited<ReturnType<typeof aiEngine.predictStockoutRisk>>;
    }> = [];

    const balancesToAnalyze = stockBalances.filter((b) => {
      if (itemId && b.itemId !== itemId) return false;
      if (locationId && b.locationId !== locationId) return false;
      return true;
    });

    for (const balance of balancesToAnalyze) {
      const item = items.find((i) => i.id === balance.itemId);
      if (!item) continue;

      const risk = await aiEngine.predictStockoutRisk(
        balance.itemId,
        balance.locationId,
        tenantId
      );

      results.push({
        itemId: balance.itemId,
        itemName: item.name,
        locationId: balance.locationId,
        risk,
      });
    }

    const highRiskCount = results.filter(
      (r) =>
        r.risk.riskAssessment.risk7Days === "high" ||
        r.risk.riskAssessment.risk14Days === "high"
    ).length;

    const shouldReorderCount = results.filter((r) => r.risk.shouldReorder).length;

    res.json({
      success: true,
      tenantId,
      summary: {
        totalAnalyzed: results.length,
        highRiskItems: highRiskCount,
        itemsNeedingReorder: shouldReorderCount,
      },
      risks: results,
    });
  } catch (error) {
    console.error("Stockout risk analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze stockout risk",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/anomalies", async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || "default";
    const anomalies = await aiEngine.detectAnomalies(tenantId);

    const items = await storage.getItems(tenantId);
    const locations = await storage.getLocations(tenantId);

    const enrichedAnomalies = anomalies.map((a) => ({
      ...a,
      itemName: items.find((i) => i.id === a.itemId)?.name,
      locationName: locations.find((l) => l.id === a.locationId)?.name,
    }));

    res.json({
      success: true,
      tenantId,
      summary: {
        total: anomalies.length,
        critical: anomalies.filter((a) => a.severity === "critical").length,
        high: anomalies.filter((a) => a.severity === "high").length,
        medium: anomalies.filter((a) => a.severity === "medium").length,
        low: anomalies.filter((a) => a.severity === "low").length,
      },
      anomalies: enrichedAnomalies,
    });
  } catch (error) {
    console.error("Anomaly detection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to detect anomalies",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ==================== Z.AI ENHANCED ENDPOINTS ====================

/**
 * Get Z.ai service status
 * Returns configuration status and available features
 */
router.get("/zai/status", async (req, res) => {
  try {
    const status = zaiService.getStatus();
    res.json({
      success: true,
      ...status,
      availableFeatures: status.configured ? [
        "demandInsights",
        "anomalyAnalysis",
        "naturalLanguageQuestions",
        "reportGeneration",
        "enhancedRecommendations",
      ] : [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get Z.ai status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Configure Z.ai service with API key
 */
router.post("/zai/configure", async (req, res) => {
  try {
    const { apiKey, baseUrl } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "apiKey is required",
      });
    }

    zaiService.configure(apiKey, baseUrl);

    res.json({
      success: true,
      message: "Z.ai service configured successfully",
      status: zaiService.getStatus(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to configure Z.ai service",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Get AI-powered demand insights using Z.ai GLM models
 */
router.get("/zai/insights", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || "default";

    if (!zaiService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: "Z.ai service not configured",
        message: "Please configure Z.ai API key first using POST /api/ai/zai/configure",
      });
    }

    const insights = await aiEngine.getAIInsights(tenantId);

    if (!insights) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate insights",
      });
    }

    res.json({
      success: true,
      tenantId,
      insights,
    });
  } catch (error) {
    console.error("Z.ai insights error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get AI insights",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Analyze an anomaly using Z.ai for root cause analysis
 */
router.get("/zai/anomaly-analysis/:anomalyId", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || "default";
    const { anomalyId } = req.params;

    if (!zaiService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: "Z.ai service not configured",
      });
    }

    const analysis = await aiEngine.getAnomalyAnalysis(anomalyId, tenantId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: "Anomaly not found or analysis failed",
      });
    }

    res.json({
      success: true,
      anomalyId,
      analysis,
    });
  } catch (error) {
    console.error("Z.ai anomaly analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze anomaly",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Ask a natural language question about inventory
 */
router.post("/zai/ask", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || "default";
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "question is required in request body",
      });
    }

    if (!zaiService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: "Z.ai service not configured",
      });
    }

    const answer = await aiEngine.askQuestion(question, tenantId);

    if (!answer) {
      return res.status(500).json({
        success: false,
        error: "Failed to process question",
      });
    }

    res.json({
      success: true,
      question,
      ...answer,
    });
  } catch (error) {
    console.error("Z.ai question error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to answer question",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Generate an inventory report using Z.ai
 */
router.post("/zai/report", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || "default";
    const {
      type = "daily",
      sections = ["overview", "inventory_status", "recommendations", "anomalies"],
    } = req.body;

    if (!zaiService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: "Z.ai service not configured",
      });
    }

    const report = await aiEngine.generateReport(tenantId, type, sections);

    if (!report) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate report",
      });
    }

    res.json({
      success: true,
      tenantId,
      report,
    });
  } catch (error) {
    console.error("Z.ai report generation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate report",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Run enhanced analysis with Z.ai insights
 */
router.post("/zai/enhanced-analyze", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || "default";

    const result = await aiEngine.generateEnhancedRecommendations(tenantId);

    res.json({
      success: true,
      tenantId,
      timestamp: result.timestamp,
      summary: {
        demandForecastsGenerated: result.demandForecasts.length,
        stockoutRisksAnalyzed: result.stockoutRisks.length,
        anomaliesDetected: result.anomalies.length,
        recommendationsCreated: result.recommendationsCreated,
        anomaliesCreated: result.anomaliesCreated,
        hasAiInsights: !!result.aiInsights,
      },
      demandForecasts: result.demandForecasts,
      stockoutRisks: result.stockoutRisks,
      anomalies: result.anomalies,
      aiInsights: result.aiInsights,
    });
  } catch (error) {
    console.error("Z.ai enhanced analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run enhanced analysis",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
