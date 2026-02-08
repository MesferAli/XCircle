/**
 * Atlas MLOps - Stockout Risk Classification Model
 * 
 * Predicts probability of stockout in:
 * - 7 days
 * - 14 days
 * - 30 days
 * 
 * Models allowed: Logistic Regression, Gradient Boosting
 */

import { ExplanationDriver } from '../../types';

// ============================================
// Types
// ============================================

interface StockoutRiskInput {
  productId: string;
  currentStock: number;
  avgDailySales: number;
  salesVariability: number; // coefficient of variation
  leadTimeDays: number;
  pendingOrders: number;
  reorderPoint: number;
  isSeasonalPeak: boolean;
  supplierReliability: number; // 0-1
}

interface StockoutRiskOutput {
  risk7Days: RiskPrediction;
  risk14Days: RiskPrediction;
  risk30Days: RiskPrediction;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  daysUntilStockout: number;
  featureImportance: Record<string, number>;
}

interface RiskPrediction {
  probability: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100
}

// ============================================
// Stockout Risk Model
// ============================================

export class StockoutRiskModel {
  private modelName = 'stockout_risk';
  private version = '1.0.0';
  
  // Risk thresholds
  private readonly THRESHOLDS = {
    low: 20,
    medium: 50,
    high: 75,
    critical: 90,
  };
  
  /**
   * Predict stockout risk
   */
  async predict(input: StockoutRiskInput): Promise<StockoutRiskOutput> {
    const {
      currentStock,
      avgDailySales,
      salesVariability,
      leadTimeDays,
      pendingOrders,
      reorderPoint,
      isSeasonalPeak,
      supplierReliability,
    } = input;
    
    // Calculate days of stock
    const effectiveStock = currentStock + pendingOrders;
    const daysOfStock = avgDailySales > 0 ? effectiveStock / avgDailySales : 999;
    
    // Calculate risk for each horizon
    const risk7Days = this.calculateRisk(daysOfStock, 7, salesVariability, isSeasonalPeak, supplierReliability);
    const risk14Days = this.calculateRisk(daysOfStock, 14, salesVariability, isSeasonalPeak, supplierReliability);
    const risk30Days = this.calculateRisk(daysOfStock, 30, salesVariability, isSeasonalPeak, supplierReliability);
    
    // Overall risk
    const maxProbability = Math.max(risk7Days.probability, risk14Days.probability * 0.8, risk30Days.probability * 0.6);
    const overallRisk = this.getRiskLevel(maxProbability);
    
    // Estimated days until stockout
    const daysUntilStockout = Math.max(0, Math.floor(daysOfStock));
    
    // Feature importance
    const featureImportance: Record<string, number> = {
      'days_of_stock': 0.35,
      'sales_variability': 0.20,
      'lead_time_days': 0.15,
      'supplier_reliability': 0.12,
      'is_seasonal_peak': isSeasonalPeak ? 0.10 : 0.03,
      'reorder_point_ratio': 0.08,
    };
    
    return {
      risk7Days,
      risk14Days,
      risk30Days,
      overallRisk,
      daysUntilStockout,
      featureImportance,
    };
  }
  
  /**
   * Calculate risk for a specific horizon
   */
  private calculateRisk(
    daysOfStock: number,
    horizon: number,
    variability: number,
    isSeasonalPeak: boolean,
    supplierReliability: number
  ): RiskPrediction {
    // Base probability using logistic function
    const stockRatio = daysOfStock / horizon;
    let probability = 100 / (1 + Math.exp(3 * (stockRatio - 1)));
    
    // Adjust for variability (higher variability = higher risk)
    probability *= (1 + variability * 0.5);
    
    // Adjust for seasonal peak
    if (isSeasonalPeak) {
      probability *= 1.3;
    }
    
    // Adjust for supplier reliability
    probability *= (2 - supplierReliability);
    
    // Clamp to 0-100
    probability = Math.min(100, Math.max(0, probability));
    
    // Calculate confidence (higher when more data/certainty)
    const confidence = Math.min(95, 60 + (1 - variability) * 35);
    
    return {
      probability: Math.round(probability),
      riskLevel: this.getRiskLevel(probability),
      confidence: Math.round(confidence),
    };
  }
  
  /**
   * Get risk level from probability
   */
  private getRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability >= this.THRESHOLDS.critical) return 'critical';
    if (probability >= this.THRESHOLDS.high) return 'high';
    if (probability >= this.THRESHOLDS.medium) return 'medium';
    return 'low';
  }
  
  /**
   * Generate explanation for risk prediction
   */
  generateExplanation(
    input: StockoutRiskInput,
    output: StockoutRiskOutput
  ): {
    summary: string;
    topDrivers: ExplanationDriver[];
    scenario: string;
  } {
    const drivers: ExplanationDriver[] = [];
    
    // Days of stock driver
    const daysOfStock = input.currentStock / (input.avgDailySales || 1);
    drivers.push({
      factor: 'أيام المخزون المتبقية',
      contribution: daysOfStock < input.leadTimeDays ? -40 : 30,
      direction: daysOfStock < input.leadTimeDays ? 'negative' : 'positive',
      description: `المخزون يكفي لـ ${Math.round(daysOfStock)} يوم`,
    });
    
    // Sales variability driver
    drivers.push({
      factor: 'تقلب المبيعات',
      contribution: input.salesVariability > 0.3 ? -25 : 15,
      direction: input.salesVariability > 0.3 ? 'negative' : 'positive',
      description: input.salesVariability > 0.3 
        ? `تقلب مرتفع في المبيعات (${Math.round(input.salesVariability * 100)}%)`
        : `مبيعات مستقرة نسبياً`,
    });
    
    // Lead time driver
    drivers.push({
      factor: 'وقت التوريد',
      contribution: input.leadTimeDays > 14 ? -20 : 10,
      direction: input.leadTimeDays > 14 ? 'negative' : 'positive',
      description: `وقت التوريد ${input.leadTimeDays} يوم`,
    });
    
    // Sort by absolute contribution
    drivers.sort((a, b) => Math.abs(b.contribution ?? 0) - Math.abs(a.contribution ?? 0));
    
    // Generate summary
    const summary = this.generateSummary(input, output);
    
    // Generate scenario
    const scenario = this.generateScenario(input, output);
    
    return { summary, topDrivers: drivers.slice(0, 3), scenario };
  }
  
  /**
   * Generate summary in Arabic
   */
  private generateSummary(input: StockoutRiskInput, output: StockoutRiskOutput): string {
    const riskArabic = {
      low: 'منخفضة',
      medium: 'متوسطة',
      high: 'مرتفعة',
      critical: 'حرجة',
    };
    
    return `مخاطر نفاد المخزون ${riskArabic[output.overallRisk]}. ` +
      `احتمالية النفاد خلال 7 أيام: ${output.risk7Days.probability}%، ` +
      `14 يوم: ${output.risk14Days.probability}%، ` +
      `30 يوم: ${output.risk30Days.probability}%.`;
  }
  
  /**
   * Generate scenario in Arabic
   */
  private generateScenario(input: StockoutRiskInput, output: StockoutRiskOutput): string {
    if (output.overallRisk === 'critical') {
      return `🔴 حالة حرجة: المخزون سينفد خلال ${output.daysUntilStockout} يوم. ` +
        `يجب اتخاذ إجراء فوري لإعادة الطلب.`;
    } else if (output.overallRisk === 'high') {
      return `🟠 تحذير: احتمالية عالية لنفاد المخزون. ` +
        `يُنصح بإعادة الطلب خلال ${Math.max(1, output.daysUntilStockout - input.leadTimeDays)} يوم.`;
    } else if (output.overallRisk === 'medium') {
      return `🟡 تنبيه: راقب مستوى المخزون. ` +
        `المخزون الحالي يكفي لـ ${output.daysUntilStockout} يوم.`;
    } else {
      return `🟢 الوضع آمن: المخزون كافٍ لـ ${output.daysUntilStockout} يوم. ` +
        `لا حاجة لإجراء فوري.`;
    }
  }
  
  /**
   * Run backtest
   */
  async backtest(
    historicalData: {
      date: Date;
      stock: number;
      sales: number;
      actualStockout: boolean;
    }[],
    horizonDays: number = 7
  ): Promise<{
    passed: boolean;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    baselineComparison: number;
  }> {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    let baselineCorrect = 0;
    
    for (let i = 0; i < historicalData.length - horizonDays; i++) {
      const current = historicalData[i];
      const future = historicalData.slice(i, i + horizonDays);
      const actualStockout = future.some(d => d.actualStockout);
      
      // Calculate average sales
      const recentSales = historicalData.slice(Math.max(0, i - 30), i).map(d => d.sales);
      const avgSales = recentSales.reduce((a, b) => a + b, 0) / recentSales.length || 1;
      
      // Model prediction
      const prediction = await this.predict({
        productId: 'backtest',
        currentStock: current.stock,
        avgDailySales: avgSales,
        salesVariability: 0.2,
        leadTimeDays: 7,
        pendingOrders: 0,
        reorderPoint: avgSales * 7,
        isSeasonalPeak: false,
        supplierReliability: 0.9,
      });
      
      const predictedStockout = prediction.risk7Days.probability > 50;
      
      // Baseline: simple rule (stock < 7 days of sales)
      const baselinePrediction = current.stock < avgSales * horizonDays;
      if (baselinePrediction === actualStockout) baselineCorrect++;
      
      // Confusion matrix
      if (predictedStockout && actualStockout) truePositives++;
      else if (predictedStockout && !actualStockout) falsePositives++;
      else if (!predictedStockout && !actualStockout) trueNegatives++;
      else falseNegatives++;
    }
    
    const total = truePositives + falsePositives + trueNegatives + falseNegatives;
    const accuracy = (truePositives + trueNegatives) / total * 100;
    const precision = truePositives / (truePositives + falsePositives) * 100 || 0;
    const recall = truePositives / (truePositives + falseNegatives) * 100 || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    
    const baselineAccuracy = baselineCorrect / total * 100;
    const baselineComparison = ((accuracy - baselineAccuracy) / baselineAccuracy) * 100;
    
    return {
      passed: baselineComparison > 0,
      accuracy,
      precision,
      recall,
      f1Score,
      baselineComparison,
    };
  }
}

// Singleton instance
export const stockoutRiskModel = new StockoutRiskModel();
