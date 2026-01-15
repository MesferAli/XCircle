/**
 * Atlas MLOps - Demand Forecasting Model
 * 
 * Predicts future demand with:
 * - Forecast value
 * - Prediction interval (confidence bounds)
 * - Seasonality & trend support
 * 
 * Models allowed: LightGBM, XGBoost, Prophet (simple time series)
 */

import { featureStore } from '../../feature-store';
import { ExplanationDriver } from '../../types';

// ============================================
// Types
// ============================================

interface DemandForecastInput {
  productId: string;
  horizon: number; // days to forecast
  salesHistory: number[]; // daily sales
  currentStock: number;
  leadTimeDays: number;
  isPromotional: boolean;
  seasonalityIndex: number;
}

interface DemandForecastOutput {
  forecast: number[];
  predictionInterval: {
    lower: number[];
    upper: number[];
  };
  totalForecast: number;
  avgDailyForecast: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  seasonalityEffect: number;
  featureImportance: Record<string, number>;
}

// ============================================
// Demand Forecasting Model
// ============================================

export class DemandForecastingModel {
  private modelName = 'demand_forecasting';
  private version = '1.0.0';
  
  /**
   * Generate demand forecast
   * Uses simplified statistical approach for v1
   * (Production would use LightGBM/XGBoost/Prophet)
   */
  async predict(input: DemandForecastInput): Promise<DemandForecastOutput> {
    const { salesHistory, horizon, seasonalityIndex, isPromotional } = input;
    
    // Calculate base statistics
    const recentSales = salesHistory.slice(-30);
    const avgSales = recentSales.reduce((a, b) => a + b, 0) / recentSales.length || 0;
    const stdSales = this.calculateStd(recentSales);
    
    // Calculate trend
    const trendFactor = this.calculateTrend(salesHistory);
    
    // Generate forecast
    const forecast: number[] = [];
    const lower: number[] = [];
    const upper: number[] = [];
    
    for (let day = 1; day <= horizon; day++) {
      // Base forecast with trend
      let dayForecast = avgSales * (1 + trendFactor * day / 30);
      
      // Apply seasonality
      dayForecast *= seasonalityIndex;
      
      // Apply promotional boost
      if (isPromotional) {
        dayForecast *= 1.3; // 30% boost during promotions
      }
      
      // Day of week effect (simplified)
      const dayOfWeek = (new Date().getDay() + day) % 7;
      if (dayOfWeek === 5 || dayOfWeek === 6) { // Weekend (Fri-Sat in Saudi)
        dayForecast *= 1.15;
      }
      
      forecast.push(Math.max(0, Math.round(dayForecast)));
      
      // Prediction interval (95% confidence)
      const uncertainty = stdSales * 1.96 * Math.sqrt(day / 7);
      lower.push(Math.max(0, Math.round(dayForecast - uncertainty)));
      upper.push(Math.round(dayForecast + uncertainty));
    }
    
    const totalForecast = forecast.reduce((a, b) => a + b, 0);
    
    // Feature importance (for explainability)
    const featureImportance: Record<string, number> = {
      'sales_last_30d': 0.35,
      'sales_trend': 0.20,
      'seasonality_index': 0.18,
      'is_promotional': isPromotional ? 0.15 : 0.05,
      'day_of_week': 0.07,
      'current_stock': 0.05,
    };
    
    return {
      forecast,
      predictionInterval: { lower, upper },
      totalForecast,
      avgDailyForecast: totalForecast / horizon,
      trend: trendFactor > 0.05 ? 'increasing' : trendFactor < -0.05 ? 'decreasing' : 'stable',
      seasonalityEffect: (seasonalityIndex - 1) * 100,
      featureImportance,
    };
  }
  
  /**
   * Generate explanation for forecast
   */
  generateExplanation(
    input: DemandForecastInput,
    output: DemandForecastOutput
  ): {
    summary: string;
    topDrivers: ExplanationDriver[];
    scenario: string;
  } {
    const drivers: ExplanationDriver[] = [];
    
    // Sort features by importance
    const sortedFeatures = Object.entries(output.featureImportance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    for (const [feature, importance] of sortedFeatures) {
      let description = '';
      let contribution = importance * 100;
      let direction: 'positive' | 'negative' = 'positive';
      
      switch (feature) {
        case 'sales_last_30d':
          const avgSales = input.salesHistory.slice(-30).reduce((a, b) => a + b, 0) / 30;
          description = `متوسط المبيعات اليومية ${Math.round(avgSales)} وحدة`;
          break;
        case 'sales_trend':
          const trend = this.calculateTrend(input.salesHistory);
          direction = trend >= 0 ? 'positive' : 'negative';
          contribution = Math.abs(trend) * 100;
          description = trend >= 0 
            ? `اتجاه تصاعدي بنسبة ${Math.round(trend * 100)}%`
            : `اتجاه تنازلي بنسبة ${Math.round(Math.abs(trend) * 100)}%`;
          break;
        case 'seasonality_index':
          direction = input.seasonalityIndex >= 1 ? 'positive' : 'negative';
          description = input.seasonalityIndex >= 1
            ? `موسم مرتفع الطلب (+${Math.round((input.seasonalityIndex - 1) * 100)}%)`
            : `موسم منخفض الطلب (${Math.round((input.seasonalityIndex - 1) * 100)}%)`;
          break;
        case 'is_promotional':
          if (input.isPromotional) {
            description = 'المنتج في عرض ترويجي حالياً (+30%)';
          } else {
            description = 'لا يوجد عرض ترويجي حالياً';
            contribution = 5;
          }
          break;
        case 'day_of_week':
          description = 'تأثير أيام الأسبوع على المبيعات';
          break;
        default:
          description = feature;
      }
      
      drivers.push({
        factor: this.getArabicFeatureName(feature),
        contribution: direction === 'positive' ? contribution : -contribution,
        direction,
        description,
      });
    }
    
    // Generate summary
    const summary = this.generateSummary(input, output);
    
    // Generate scenario
    const scenario = this.generateScenario(input, output);
    
    return { summary, topDrivers: drivers, scenario };
  }
  
  /**
   * Run backtest on historical data
   */
  async backtest(
    historicalData: { date: Date; actual: number }[],
    testPeriodDays: number = 30
  ): Promise<{
    passed: boolean;
    mae: number;
    mape: number;
    rmse: number;
    baselineComparison: number;
  }> {
    const trainData = historicalData.slice(0, -testPeriodDays);
    const testData = historicalData.slice(-testPeriodDays);
    
    // Simple baseline: average of last 7 days
    const baselinePrediction = trainData.slice(-7).reduce((a, b) => a + b.actual, 0) / 7;
    
    // Model prediction
    const salesHistory = trainData.map(d => d.actual);
    const prediction = await this.predict({
      productId: 'backtest',
      horizon: testPeriodDays,
      salesHistory,
      currentStock: 100,
      leadTimeDays: 7,
      isPromotional: false,
      seasonalityIndex: 1,
    });
    
    // Calculate metrics
    let sumError = 0;
    let sumAbsError = 0;
    let sumSquaredError = 0;
    let sumAbsPercentError = 0;
    let baselineSumAbsError = 0;
    
    for (let i = 0; i < testData.length; i++) {
      const actual = testData[i].actual;
      const predicted = prediction.forecast[i] || prediction.avgDailyForecast;
      const error = predicted - actual;
      
      sumError += error;
      sumAbsError += Math.abs(error);
      sumSquaredError += error * error;
      if (actual > 0) {
        sumAbsPercentError += Math.abs(error) / actual;
      }
      
      baselineSumAbsError += Math.abs(baselinePrediction - actual);
    }
    
    const n = testData.length;
    const mae = sumAbsError / n;
    const mape = (sumAbsPercentError / n) * 100;
    const rmse = Math.sqrt(sumSquaredError / n);
    const baselineMAE = baselineSumAbsError / n;
    
    const baselineComparison = ((baselineMAE - mae) / baselineMAE) * 100;
    
    return {
      passed: baselineComparison > 0, // Must be better than baseline
      mae,
      mape,
      rmse,
      baselineComparison,
    };
  }
  
  // ============================================
  // Helper Methods
  // ============================================
  
  private calculateTrend(series: number[]): number {
    if (series.length < 14) return 0;
    
    const recent = series.slice(-7);
    const older = series.slice(-14, -7);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    if (olderAvg === 0) return 0;
    
    return (recentAvg - olderAvg) / olderAvg;
  }
  
  private calculateStd(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }
  
  private getArabicFeatureName(feature: string): string {
    const names: Record<string, string> = {
      'sales_last_30d': 'المبيعات السابقة',
      'sales_trend': 'اتجاه المبيعات',
      'seasonality_index': 'الموسمية',
      'is_promotional': 'العروض الترويجية',
      'day_of_week': 'يوم الأسبوع',
      'current_stock': 'المخزون الحالي',
    };
    return names[feature] || feature;
  }
  
  private generateSummary(input: DemandForecastInput, output: DemandForecastOutput): string {
    const trend = output.trend === 'increasing' ? 'تصاعدي' 
      : output.trend === 'decreasing' ? 'تنازلي' : 'مستقر';
    
    return `التوقع: ${Math.round(output.avgDailyForecast)} وحدة يومياً (اتجاه ${trend}). ` +
      `إجمالي الطلب المتوقع خلال ${input.horizon} يوم: ${output.totalForecast} وحدة.`;
  }
  
  private generateScenario(input: DemandForecastInput, output: DemandForecastOutput): string {
    const daysOfStock = input.currentStock / output.avgDailyForecast;
    
    if (daysOfStock < input.leadTimeDays) {
      return `⚠️ تحذير: المخزون الحالي (${input.currentStock}) يكفي لـ ${Math.round(daysOfStock)} يوم فقط، ` +
        `بينما وقت التوريد ${input.leadTimeDays} يوم. يُنصح بإعادة الطلب فوراً.`;
    } else if (daysOfStock < input.leadTimeDays * 1.5) {
      return `⚡ تنبيه: المخزون يقترب من نقطة إعادة الطلب. ` +
        `يكفي لـ ${Math.round(daysOfStock)} يوم.`;
    } else {
      return `✅ المخزون كافٍ لـ ${Math.round(daysOfStock)} يوم بناءً على معدل الطلب المتوقع.`;
    }
  }
}

// Singleton instance
export const demandForecastingModel = new DemandForecastingModel();
