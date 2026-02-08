import { storage } from "./storage";
import { zaiService, type DemandInsight, type AnomalyAnalysis } from "./zai-service";
import type {
  Item,
  StockBalance,
  StockMovement,
  DemandSignal,
  InsertRecommendation,
  InsertAnomaly,
} from "@shared/schema";

export interface DemandForecastResult {
  itemId: string;
  locationId: string | null;
  movingAverages: {
    window7: number;
    window14: number;
    window30: number;
  };
  trend: {
    direction: "increasing" | "decreasing" | "stable";
    strength: number;
    percentageChange: number;
  };
  forecastedDemand: {
    next7Days: number;
    next14Days: number;
    next30Days: number;
  };
  confidence_score: number;
  signals_used: string[];
  time_window: string;
  explanation: string;
  dataPoints: number;
}

export interface StockoutRiskResult {
  itemId: string;
  locationId: string;
  currentStock: number;
  averageDailyConsumption: number;
  daysUntilStockout: number;
  leadTimeDays: number;
  reorderPoint: number | null;
  riskAssessment: {
    risk7Days: "high" | "medium" | "low" | "none";
    risk14Days: "high" | "medium" | "low" | "none";
    risk30Days: "high" | "medium" | "low" | "none";
  };
  shouldReorder: boolean;
  recommendedQuantity: number;
  confidence_score: number;
  signals_used: string[];
  time_window: string;
  explanation: string;
}

export interface DetectedAnomaly {
  itemId: string | null;
  locationId: string | null;
  type: "demand_spike" | "demand_drop" | "unusual_movement" | "stock_discrepancy";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  detectedValue: number;
  expectedValue: number;
  deviation: number;
  zScore: number;
  confidence_score: number;
  signals_used: string[];
  time_window: string;
  explanation: string;
}

export interface AnalysisResult {
  tenantId: string;
  timestamp: Date;
  demandForecasts: DemandForecastResult[];
  stockoutRisks: StockoutRiskResult[];
  anomalies: DetectedAnomaly[];
  recommendationsCreated: number;
  anomaliesCreated: number;
}

class AIEngine {
  private readonly Z_SCORE_THRESHOLD = 2.0;
  private readonly TREND_STABILITY_THRESHOLD = 0.05;
  private readonly DEFAULT_LEAD_TIME_DAYS = 7;

  async analyzeDemand(
    itemId: string,
    locationId: string | null,
    tenantId: string,
    movements?: StockMovement[],
    demandSignals?: DemandSignal[]
  ): Promise<DemandForecastResult> {
    // Use pre-fetched data if provided, otherwise fetch (for backward compatibility)
    const allMovements = movements ?? await storage.getStockMovements(tenantId);
    const allDemandSignals = demandSignals ?? await storage.getDemandSignals(tenantId);

    const itemMovements = allMovements.filter(
      (m) =>
        m.itemId === itemId &&
        (locationId === null || m.locationId === locationId) &&
        m.movementType === "out"
    );

    const itemDemandSignals = allDemandSignals.filter(
      (d) =>
        d.itemId === itemId &&
        (locationId === null || d.locationId === locationId)
    );

    const now = new Date();
    const signals_used: string[] = [];

    const getMovementsInWindow = (days: number): StockMovement[] => {
      const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return itemMovements.filter(
        (m) => m.timestamp && new Date(m.timestamp) >= windowStart
      );
    };

    const window7 = getMovementsInWindow(7);
    const window14 = getMovementsInWindow(14);
    const window30 = getMovementsInWindow(30);

    if (window7.length > 0) signals_used.push("stock_movements_7d");
    if (window14.length > 0) signals_used.push("stock_movements_14d");
    if (window30.length > 0) signals_used.push("stock_movements_30d");
    if (itemDemandSignals.length > 0) signals_used.push("demand_signals");

    const sumQuantity = (mvmts: StockMovement[]): number =>
      mvmts.reduce((sum, m) => sum + Math.abs(m.quantity), 0);

    const totalDemand7 = sumQuantity(window7);
    const totalDemand14 = sumQuantity(window14);
    const totalDemand30 = sumQuantity(window30);

    const ma7 = window7.length > 0 ? totalDemand7 / 7 : 0;
    const ma14 = window14.length > 0 ? totalDemand14 / 14 : 0;
    const ma30 = window30.length > 0 ? totalDemand30 / 30 : 0;

    let trendDirection: "increasing" | "decreasing" | "stable" = "stable";
    let trendStrength = 0;
    let percentageChange = 0;

    if (ma7 > 0 && ma30 > 0) {
      percentageChange = ((ma7 - ma30) / ma30) * 100;
      trendStrength = Math.min(Math.abs(percentageChange), 100);

      if (percentageChange > this.TREND_STABILITY_THRESHOLD * 100) {
        trendDirection = "increasing";
      } else if (percentageChange < -this.TREND_STABILITY_THRESHOLD * 100) {
        trendDirection = "decreasing";
      }
    }

    const baseRate = ma30 > 0 ? ma30 : ma14 > 0 ? ma14 : ma7;
    const trendMultiplier =
      trendDirection === "increasing"
        ? 1 + trendStrength / 200
        : trendDirection === "decreasing"
        ? 1 - trendStrength / 200
        : 1;

    const forecastedDemand = {
      next7Days: Math.round(baseRate * 7 * trendMultiplier),
      next14Days: Math.round(baseRate * 14 * trendMultiplier),
      next30Days: Math.round(baseRate * 30 * trendMultiplier),
    };

    const dataPoints = window30.length;
    let confidence_score = 0;

    if (dataPoints >= 30) {
      confidence_score = 90;
    } else if (dataPoints >= 14) {
      confidence_score = 70;
    } else if (dataPoints >= 7) {
      confidence_score = 50;
    } else if (dataPoints > 0) {
      confidence_score = 30;
    }

    const movementVariance = this.calculateVariance(
      window30.map((m) => Math.abs(m.quantity))
    );
    const coefficientOfVariation =
      ma30 > 0 ? Math.sqrt(movementVariance) / ma30 : 0;
    if (coefficientOfVariation < 0.3) {
      confidence_score = Math.min(100, confidence_score + 10);
    } else if (coefficientOfVariation > 0.7) {
      confidence_score = Math.max(0, confidence_score - 15);
    }

    const explanation = this.generateDemandExplanation(
      trendDirection,
      percentageChange,
      dataPoints,
      ma7,
      ma30
    );

    return {
      itemId,
      locationId,
      movingAverages: {
        window7: Math.round(ma7 * 100) / 100,
        window14: Math.round(ma14 * 100) / 100,
        window30: Math.round(ma30 * 100) / 100,
      },
      trend: {
        direction: trendDirection,
        strength: Math.round(trendStrength * 100) / 100,
        percentageChange: Math.round(percentageChange * 100) / 100,
      },
      forecastedDemand,
      confidence_score: Math.round(confidence_score),
      signals_used,
      time_window: "30 days",
      explanation,
      dataPoints,
    };
  }

  async predictStockoutRisk(
    itemId: string,
    locationId: string,
    tenantId: string,
    items?: Item[],
    stockBalances?: StockBalance[],
    movements?: StockMovement[]
  ): Promise<StockoutRiskResult> {
    // Use pre-fetched data if provided, otherwise fetch (for backward compatibility)
    const allItems = items ?? await storage.getItems(tenantId);
    const allStockBalances = stockBalances ?? await storage.getStockBalances(tenantId);
    const allMovements = movements ?? await storage.getStockMovements(tenantId);

    const item = allItems.find((i) => i.id === itemId);
    const balance = allStockBalances.find(
      (b) => b.itemId === itemId && b.locationId === locationId
    );

    const signals_used: string[] = [];
    const currentStock = balance?.quantityOnHand ?? 0;
    const reorderPoint = item?.reorderPoint ?? null;
    const leadTimeDays = item?.leadTimeDays ?? this.DEFAULT_LEAD_TIME_DAYS;
    const reorderQuantity = item?.reorderQuantity ?? 0;

    if (balance) signals_used.push("stock_balance");
    if (item) signals_used.push("item_configuration");

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const outboundMovements = allMovements.filter(
      (m) =>
        m.itemId === itemId &&
        m.locationId === locationId &&
        m.movementType === "out" &&
        m.timestamp &&
        new Date(m.timestamp) >= thirtyDaysAgo
    );

    if (outboundMovements.length > 0) signals_used.push("outbound_movements_30d");

    const totalOutbound = outboundMovements.reduce(
      (sum, m) => sum + Math.abs(m.quantity),
      0
    );
    const daysCovered = Math.min(
      30,
      outboundMovements.length > 0
        ? (now.getTime() -
            Math.min(
              ...outboundMovements.map((m) => new Date(m.timestamp!).getTime())
            )) /
            (24 * 60 * 60 * 1000)
        : 30
    );

    const averageDailyConsumption =
      daysCovered > 0 ? totalOutbound / daysCovered : 0;

    const daysUntilStockout =
      averageDailyConsumption > 0
        ? Math.floor(currentStock / averageDailyConsumption)
        : currentStock > 0
        ? Infinity
        : 0;

    const assessRisk = (
      daysHorizon: number
    ): "high" | "medium" | "low" | "none" => {
      if (daysUntilStockout <= 0) return "high";
      if (daysUntilStockout <= daysHorizon * 0.3) return "high";
      if (daysUntilStockout <= daysHorizon * 0.6) return "medium";
      if (daysUntilStockout <= daysHorizon) return "low";
      return "none";
    };

    const riskAssessment = {
      risk7Days: assessRisk(7),
      risk14Days: assessRisk(14),
      risk30Days: assessRisk(30),
    };

    const shouldReorder =
      reorderPoint !== null
        ? currentStock <= reorderPoint
        : daysUntilStockout <= leadTimeDays * 1.5;

    const recommendedQuantity = shouldReorder
      ? reorderQuantity > 0
        ? reorderQuantity
        : Math.ceil(averageDailyConsumption * 30)
      : 0;

    let confidence_score = 0;
    if (outboundMovements.length >= 20) {
      confidence_score = 85;
    } else if (outboundMovements.length >= 10) {
      confidence_score = 70;
    } else if (outboundMovements.length >= 5) {
      confidence_score = 55;
    } else if (outboundMovements.length > 0) {
      confidence_score = 35;
    } else {
      confidence_score = 20;
    }

    if (reorderPoint !== null && leadTimeDays) {
      confidence_score = Math.min(100, confidence_score + 10);
    }

    const explanation = this.generateStockoutExplanation(
      currentStock,
      averageDailyConsumption,
      daysUntilStockout,
      leadTimeDays,
      shouldReorder,
      reorderPoint
    );

    return {
      itemId,
      locationId,
      currentStock,
      averageDailyConsumption: Math.round(averageDailyConsumption * 100) / 100,
      daysUntilStockout:
        daysUntilStockout === Infinity ? 999 : Math.round(daysUntilStockout),
      leadTimeDays,
      reorderPoint,
      riskAssessment,
      shouldReorder,
      recommendedQuantity: Math.round(recommendedQuantity),
      confidence_score: Math.round(confidence_score),
      signals_used,
      time_window: "30 days analysis",
      explanation,
    };
  }

  async detectAnomalies(tenantId: string): Promise<DetectedAnomaly[]> {
    const movements = await storage.getStockMovements(tenantId);
    const stockBalances = await storage.getStockBalances(tenantId);
    const items = await storage.getItems(tenantId);
    const demandSignals = await storage.getDemandSignals(tenantId);

    const anomalies: DetectedAnomaly[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const itemLocationCombos = new Map<
      string,
      { itemId: string; locationId: string }
    >();
    movements.forEach((m) => {
      const key = `${m.itemId}:${m.locationId}`;
      if (!itemLocationCombos.has(key)) {
        itemLocationCombos.set(key, {
          itemId: m.itemId,
          locationId: m.locationId,
        });
      }
    });

    for (const combo of Array.from(itemLocationCombos.values())) {
      const itemMovements = movements.filter(
        (m) =>
          m.itemId === combo.itemId &&
          m.locationId === combo.locationId &&
          m.movementType === "out" &&
          m.timestamp &&
          new Date(m.timestamp) >= thirtyDaysAgo
      );

      if (itemMovements.length < 5) continue;

      const quantities = itemMovements.map((m) => Math.abs(m.quantity));
      const mean = this.calculateMean(quantities);
      const stdDev = Math.sqrt(this.calculateVariance(quantities));

      if (stdDev === 0) continue;

      const recentMovements = itemMovements.filter(
        (m) => m.timestamp && new Date(m.timestamp) >= sevenDaysAgo
      );

      for (const movement of recentMovements) {
        const quantity = Math.abs(movement.quantity);
        const zScore = (quantity - mean) / stdDev;

        if (Math.abs(zScore) >= this.Z_SCORE_THRESHOLD) {
          const isSpike = zScore > 0;
          const severity = this.calculateSeverity(Math.abs(zScore));
          const item = items.find((i) => i.id === combo.itemId);

          anomalies.push({
            itemId: combo.itemId,
            locationId: combo.locationId,
            type: isSpike ? "demand_spike" : "demand_drop",
            severity,
            title: `${isSpike ? "Demand Spike" : "Demand Drop"} Detected${item ? ` for ${item.name}` : ""}`,
            description: `Movement of ${quantity} units is ${Math.abs(zScore).toFixed(1)} standard deviations ${isSpike ? "above" : "below"} the average of ${mean.toFixed(1)} units.`,
            detectedValue: quantity,
            expectedValue: mean,
            deviation: Math.abs(quantity - mean),
            zScore: Math.round(zScore * 100) / 100,
            confidence_score: Math.min(95, 70 + itemMovements.length),
            signals_used: ["stock_movements_30d", "statistical_analysis"],
            time_window: "7 days (compared to 30-day baseline)",
            explanation: this.generateAnomalyExplanation(
              isSpike ? "demand_spike" : "demand_drop",
              quantity,
              mean,
              zScore
            ),
          });
        }
      }
    }

    for (const balance of stockBalances) {
      const item = items.find((i) => i.id === balance.itemId);
      if (!item || !item.reorderPoint) continue;

      const itemMovements = movements.filter(
        (m) =>
          m.itemId === balance.itemId &&
          m.locationId === balance.locationId &&
          m.timestamp &&
          new Date(m.timestamp) >= thirtyDaysAgo
      );

      const expectedFromMovements = itemMovements.reduce((sum, m) => {
        if (m.movementType === "in") return sum + m.quantity;
        if (m.movementType === "out") return sum - Math.abs(m.quantity);
        return sum;
      }, 0);

      if (itemMovements.length >= 3) {
        const discrepancyRatio = Math.abs(
          balance.quantityOnHand / (Math.max(1, Math.abs(expectedFromMovements)))
        );

        if (discrepancyRatio > 1.5 || discrepancyRatio < 0.5) {
          anomalies.push({
            itemId: balance.itemId,
            locationId: balance.locationId,
            type: "stock_discrepancy",
            severity: discrepancyRatio > 2 || discrepancyRatio < 0.3 ? "high" : "medium",
            title: `Stock Discrepancy Detected${item ? ` for ${item.name}` : ""}`,
            description: `Current stock (${balance.quantityOnHand}) shows significant variance from expected movement patterns.`,
            detectedValue: balance.quantityOnHand,
            expectedValue: Math.abs(expectedFromMovements),
            deviation: Math.abs(balance.quantityOnHand - Math.abs(expectedFromMovements)),
            zScore: 0,
            confidence_score: Math.min(80, 50 + itemMovements.length * 3),
            signals_used: ["stock_balance", "movement_analysis"],
            time_window: "30 days",
            explanation: `Stock balance of ${balance.quantityOnHand} units does not align with the net movement pattern observed over the past 30 days. This may indicate unrecorded transactions, shrinkage, or data entry errors.`,
          });
        }
      }
    }

    return anomalies;
  }

  async generateRecommendations(tenantId: string): Promise<AnalysisResult> {
    // Pre-fetch all tenant data once to avoid N+1 queries
    const items = await storage.getItems(tenantId);
    const stockBalances = await storage.getStockBalances(tenantId);
    const locations = await storage.getLocations(tenantId);
    const stockMovements = await storage.getStockMovements(tenantId);
    const demandSignals = await storage.getDemandSignals(tenantId);

    const demandForecasts: DemandForecastResult[] = [];
    const stockoutRisks: StockoutRiskResult[] = [];
    let recommendationsCreated = 0;
    let anomaliesCreated = 0;

    for (const item of items) {
      const itemBalances = stockBalances.filter((b) => b.itemId === item.id);

      for (const balance of itemBalances) {
        try {
          // Pass pre-fetched data to avoid re-querying
          const forecast = await this.analyzeDemand(
            item.id,
            balance.locationId,
            tenantId,
            stockMovements,
            demandSignals
          );
          demandForecasts.push(forecast);

          const stockoutRisk = await this.predictStockoutRisk(
            item.id,
            balance.locationId,
            tenantId,
            items,
            stockBalances,
            stockMovements
          );
          stockoutRisks.push(stockoutRisk);

          if (stockoutRisk.shouldReorder) {
            const location = locations.find((l) => l.id === balance.locationId);
            const priority = this.determinePriority(stockoutRisk);

            const recommendation: InsertRecommendation = {
              tenantId,
              type: "reorder",
              priority,
              itemId: item.id,
              locationId: balance.locationId,
              title: `Reorder ${item.name}`,
              description: `Stock level (${stockoutRisk.currentStock} units) is below optimal. Recommended reorder: ${stockoutRisk.recommendedQuantity} units.`,
              explanation: stockoutRisk.explanation,
              confidenceScore: stockoutRisk.confidence_score,
              suggestedAction: {
                type: "reorder",
                quantity: stockoutRisk.recommendedQuantity,
                itemId: item.id,
                locationId: balance.locationId,
                itemName: item.name,
                locationName: location?.name,
                signals_used: stockoutRisk.signals_used,
                time_window: stockoutRisk.time_window,
              },
            };

            await storage.createRecommendation(recommendation);
            recommendationsCreated++;
          }

          if (
            forecast.trend.direction === "increasing" &&
            forecast.trend.strength > 30
          ) {
            const location = locations.find((l) => l.id === balance.locationId);

            const recommendation: InsertRecommendation = {
              tenantId,
              type: "alert",
              priority: forecast.trend.strength > 50 ? "high" : "medium",
              itemId: item.id,
              locationId: balance.locationId,
              title: `Increasing Demand Trend for ${item.name}`,
              description: `Demand has increased by ${forecast.trend.percentageChange.toFixed(1)}% over the analysis period. Consider adjusting safety stock.`,
              explanation: forecast.explanation,
              confidenceScore: forecast.confidence_score,
              suggestedAction: {
                type: "adjust_safety_stock",
                currentRate: forecast.movingAverages.window30,
                projectedRate: forecast.movingAverages.window7,
                trendStrength: forecast.trend.strength,
                signals_used: forecast.signals_used,
                time_window: forecast.time_window,
              },
            };

            await storage.createRecommendation(recommendation);
            recommendationsCreated++;
          }
        } catch (error) {
          console.error(
            `Error analyzing item ${item.id} at location ${balance.locationId}:`,
            error
          );
        }
      }
    }

    const detectedAnomalies = await this.detectAnomalies(tenantId);
    const anomalies = detectedAnomalies;

    for (const anomaly of detectedAnomalies) {
      const insertAnomaly: InsertAnomaly = {
        tenantId,
        itemId: anomaly.itemId,
        locationId: anomaly.locationId,
        type: anomaly.type,
        severity: anomaly.severity,
        title: anomaly.title,
        description: anomaly.description,
        detectedValue: anomaly.detectedValue,
        expectedValue: anomaly.expectedValue,
        deviation: anomaly.deviation,
      };

      await storage.createAnomaly(insertAnomaly);
      anomaliesCreated++;
    }

    return {
      tenantId,
      timestamp: new Date(),
      demandForecasts,
      stockoutRisks,
      anomalies,
      recommendationsCreated,
      anomaliesCreated,
    };
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateMean(values);
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private calculateSeverity(
    zScore: number
  ): "critical" | "high" | "medium" | "low" {
    if (zScore >= 4) return "critical";
    if (zScore >= 3) return "high";
    if (zScore >= 2.5) return "medium";
    return "low";
  }

  private determinePriority(
    stockoutRisk: StockoutRiskResult
  ): "critical" | "high" | "medium" | "low" {
    if (stockoutRisk.riskAssessment.risk7Days === "high") return "critical";
    if (stockoutRisk.riskAssessment.risk14Days === "high") return "high";
    if (stockoutRisk.riskAssessment.risk30Days === "high") return "medium";
    return "low";
  }

  private generateDemandExplanation(
    trendDirection: string,
    percentageChange: number,
    dataPoints: number,
    ma7: number,
    ma30: number
  ): string {
    const parts: string[] = [];

    parts.push(
      `Analysis based on ${dataPoints} data points over the past 30 days.`
    );

    if (trendDirection === "stable") {
      parts.push("Demand patterns show stable consumption rates.");
    } else {
      parts.push(
        `Demand is ${trendDirection} with a ${Math.abs(percentageChange).toFixed(1)}% change from the 30-day average (${ma30.toFixed(1)} units/day) to the recent 7-day average (${ma7.toFixed(1)} units/day).`
      );
    }

    if (dataPoints < 7) {
      parts.push(
        "Limited historical data reduces forecast confidence. More data will improve accuracy."
      );
    }

    return parts.join(" ");
  }

  private generateStockoutExplanation(
    currentStock: number,
    avgDailyConsumption: number,
    daysUntilStockout: number,
    leadTimeDays: number,
    shouldReorder: boolean,
    reorderPoint: number | null
  ): string {
    const parts: string[] = [];

    parts.push(
      `Current stock: ${currentStock} units. Average daily consumption: ${avgDailyConsumption.toFixed(1)} units.`
    );

    if (daysUntilStockout === Infinity || daysUntilStockout === 999) {
      parts.push("No consumption pattern detected - stockout risk cannot be calculated.");
    } else {
      parts.push(`Estimated ${daysUntilStockout} days until stockout at current consumption rate.`);
    }

    if (shouldReorder) {
      if (reorderPoint !== null) {
        parts.push(
          `Stock is at or below the configured reorder point of ${reorderPoint} units.`
        );
      } else {
        parts.push(
          `Stock level is insufficient to cover the ${leadTimeDays}-day lead time with safety buffer.`
        );
      }
      parts.push("Immediate reorder recommended.");
    }

    return parts.join(" ");
  }

  private generateAnomalyExplanation(
    type: string,
    detectedValue: number,
    expectedValue: number,
    zScore: number
  ): string {
    const deviation = Math.abs(detectedValue - expectedValue);
    const percentDeviation =
      expectedValue > 0 ? ((deviation / expectedValue) * 100).toFixed(1) : "N/A";

    if (type === "demand_spike") {
      return `A demand spike was detected with ${detectedValue} units consumed, which is ${percentDeviation}% above the expected ${expectedValue.toFixed(1)} units (Z-score: ${zScore.toFixed(2)}). This may indicate seasonal demand, promotional activity, or unusual customer behavior.`;
    } else if (type === "demand_drop") {
      return `A demand drop was detected with ${detectedValue} units consumed, which is ${percentDeviation}% below the expected ${expectedValue.toFixed(1)} units (Z-score: ${zScore.toFixed(2)}). This may indicate market changes, stockout at customer locations, or data quality issues.`;
    }

    return `Unusual activity detected: ${detectedValue} units observed vs. ${expectedValue.toFixed(1)} expected (${percentDeviation}% deviation).`;
  }

  /**
   * Get AI-powered insights using Z.ai GLM models
   * This provides enhanced analysis beyond statistical methods
   */
  async getAIInsights(tenantId: string): Promise<DemandInsight | null> {
    if (!zaiService.isConfigured()) {
      console.log("Z.ai service not configured, skipping AI insights");
      return null;
    }

    try {
      const items = await storage.getItems(tenantId);
      const movements = await storage.getStockMovements(tenantId);
      const demandSignals = await storage.getDemandSignals(tenantId);

      const insights = await zaiService.analyzeDemandPatterns({
        items,
        movements,
        demandSignals,
        historicalDays: 30,
      });

      return insights;
    } catch (error) {
      console.error("Error getting AI insights:", error);
      return null;
    }
  }

  /**
   * Get AI-powered anomaly analysis using Z.ai
   */
  async getAnomalyAnalysis(
    anomalyId: string,
    tenantId: string
  ): Promise<AnomalyAnalysis | null> {
    if (!zaiService.isConfigured()) {
      console.log("Z.ai service not configured, skipping anomaly analysis");
      return null;
    }

    try {
      const anomalies = await storage.getAnomalies(tenantId);
      const anomaly = anomalies.find(a => a.id === anomalyId);

      if (!anomaly) {
        return null;
      }

      const items = await storage.getItems(tenantId);
      const movements = await storage.getStockMovements(tenantId);

      const item = anomaly.itemId
        ? items.find(i => i.id === anomaly.itemId)
        : undefined;

      const recentMovements = anomaly.itemId
        ? movements.filter(m =>
            m.itemId === anomaly.itemId &&
            m.timestamp &&
            new Date(m.timestamp) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          )
        : [];

      const relatedAnomalies = anomalies.filter(a =>
        a.id !== anomalyId &&
        a.type === anomaly.type &&
        a.status === "open"
      );

      const analysis = await zaiService.analyzeAnomaly(anomaly, {
        item,
        recentMovements,
        relatedAnomalies,
      });

      return analysis;
    } catch (error) {
      console.error("Error getting anomaly analysis:", error);
      return null;
    }
  }

  /**
   * Enhanced recommendations generation with Z.ai insights
   */
  async generateEnhancedRecommendations(tenantId: string): Promise<AnalysisResult & { aiInsights?: DemandInsight }> {
    // First, run the standard analysis
    const result = await this.generateRecommendations(tenantId);

    // Try to enhance with AI insights
    const aiInsights = await this.getAIInsights(tenantId);

    return {
      ...result,
      aiInsights: aiInsights || undefined,
    };
  }

  /**
   * Ask a natural language question about inventory
   */
  async askQuestion(question: string, tenantId: string): Promise<{
    answer: string;
    answerAr: string;
    dataPoints: string[];
    confidence: number;
  } | null> {
    if (!zaiService.isConfigured()) {
      return null;
    }

    try {
      const items = await storage.getItems(tenantId);
      const balances = await storage.getStockBalances(tenantId);
      const movements = await storage.getStockMovements(tenantId);
      const recommendations = await storage.getRecommendations(tenantId);

      const answer = await zaiService.askQuestion({
        question,
        context: {
          items,
          balances,
          movements,
          recommendations,
        },
      });

      return answer;
    } catch (error) {
      console.error("Error asking question:", error);
      return null;
    }
  }

  /**
   * Generate an inventory report using Z.ai
   */
  async generateReport(
    tenantId: string,
    type: "daily" | "weekly" | "monthly" | "custom" = "daily",
    sections: string[] = ["overview", "inventory_status", "recommendations", "anomalies"]
  ) {
    if (!zaiService.isConfigured()) {
      return null;
    }

    try {
      const items = await storage.getItems(tenantId);
      const balances = await storage.getStockBalances(tenantId);
      const movements = await storage.getStockMovements(tenantId);
      const recommendations = await storage.getRecommendations(tenantId);
      const anomalies = await storage.getAnomalies(tenantId);

      const report = await zaiService.generateReport(
        { type, sections, language: "both" },
        { items, balances, movements, recommendations, anomalies }
      );

      return report;
    } catch (error) {
      console.error("Error generating report:", error);
      return null;
    }
  }
}

export const aiEngine = new AIEngine();
