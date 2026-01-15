import { describe, it, expect } from 'vitest';
import {
  lightGBMDemandModel,
  xgboostStockoutModel,
  isolationForestModel,
} from '../ml-models';

// ============================================
// LightGBM Demand Model Tests
// ============================================

describe('LightGBM Demand Forecasting Model', () => {
  it('should generate forecast with correct length', async () => {
    const result = await lightGBMDemandModel.predict({
      productId: 'test_product',
      horizon: 7,
      salesHistory: [10, 12, 8, 15, 11, 9, 14, 13, 10, 12, 11, 8, 15, 12, 10, 11, 9, 14, 12, 10],
      currentStock: 50,
      leadTimeDays: 7,
      isPromotional: false,
      seasonalityIndex: 1,
    });

    expect(result.forecast).toHaveLength(7);
    expect(result.predictionInterval.lower).toHaveLength(7);
    expect(result.predictionInterval.upper).toHaveLength(7);
  });

  it('should have positive total forecast', async () => {
    const result = await lightGBMDemandModel.predict({
      productId: 'test_product',
      horizon: 14,
      salesHistory: Array.from({ length: 30 }, () => Math.floor(Math.random() * 20) + 5),
      currentStock: 100,
      leadTimeDays: 7,
      isPromotional: false,
      seasonalityIndex: 1.2,
    });

    expect(result.totalForecast).toBeGreaterThan(0);
  });

  it('should apply seasonality index', async () => {
    const baseResult = await lightGBMDemandModel.predict({
      productId: 'test_product',
      horizon: 7,
      salesHistory: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      currentStock: 50,
      leadTimeDays: 7,
      isPromotional: false,
      seasonalityIndex: 1,
    });

    const seasonalResult = await lightGBMDemandModel.predict({
      productId: 'test_product',
      horizon: 7,
      salesHistory: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      currentStock: 50,
      leadTimeDays: 7,
      isPromotional: false,
      seasonalityIndex: 1.5,
    });

    // Seasonal forecast should be higher
    expect(seasonalResult.totalForecast).toBeGreaterThan(baseResult.totalForecast);
  });

  it('should generate valid explanation', async () => {
    const input = {
      productId: 'test_product',
      horizon: 7,
      salesHistory: [10, 12, 8, 15, 11, 9, 14, 13, 10, 12, 11, 8, 15, 12],
      currentStock: 50,
      leadTimeDays: 7,
      isPromotional: false,
      seasonalityIndex: 1,
    };

    const prediction = await lightGBMDemandModel.predict(input);
    const explanation = lightGBMDemandModel.generateExplanation(input, prediction);

    expect(explanation.summary).toBeDefined();
    expect(explanation.topDrivers.length).toBeLessThanOrEqual(3);
    expect(explanation.scenario).toBeDefined();
  });
});

// ============================================
// XGBoost Stockout Model Tests
// ============================================

describe('XGBoost Stockout Risk Model', () => {
  it('should predict risk for all horizons', async () => {
    const result = await xgboostStockoutModel.predict({
      productId: 'test_product',
      currentStock: 50,
      avgDailySales: 5,
      salesVariability: 0.2,
      leadTimeDays: 7,
      pendingOrders: 0,
      reorderPoint: 35,
      isSeasonalPeak: false,
      supplierReliability: 0.9,
    });

    expect(result.risk7Days).toBeDefined();
    expect(result.risk14Days).toBeDefined();
    expect(result.risk30Days).toBeDefined();
    expect(result.overallRisk).toBeDefined();
  });

  it('should detect high risk when stock is critically low', async () => {
    const result = await xgboostStockoutModel.predict({
      productId: 'test_product',
      currentStock: 5,
      avgDailySales: 10,
      salesVariability: 0.3,
      leadTimeDays: 7,
      pendingOrders: 0,
      reorderPoint: 70,
      isSeasonalPeak: true,
      supplierReliability: 0.7,
    });

    expect(['high', 'critical']).toContain(result.overallRisk);
    expect(result.recommendedAction).toBe('urgent_reorder');
    expect(result.reorderQuantity).toBeGreaterThan(0);
  });

  it('should detect low risk when stock is sufficient', async () => {
    const result = await xgboostStockoutModel.predict({
      productId: 'test_product',
      currentStock: 200,
      avgDailySales: 5,
      salesVariability: 0.1,
      leadTimeDays: 7,
      pendingOrders: 50,
      reorderPoint: 35,
      isSeasonalPeak: false,
      supplierReliability: 0.95,
    });

    expect(result.overallRisk).toBe('low');
    expect(result.recommendedAction).toBe('monitor');
  });

  it('should calculate safety stock level', async () => {
    const result = await xgboostStockoutModel.predict({
      productId: 'test_product',
      currentStock: 50,
      avgDailySales: 10,
      salesVariability: 0.25,
      leadTimeDays: 7,
      pendingOrders: 0,
      reorderPoint: 70,
      isSeasonalPeak: false,
      supplierReliability: 0.9,
    });

    expect(result.safetyStockLevel).toBeGreaterThan(0);
    expect(result.daysUntilStockout).toBeGreaterThan(0);
  });

  it('should generate valid explanation', async () => {
    const input = {
      productId: 'test_product',
      currentStock: 20,
      avgDailySales: 5,
      salesVariability: 0.3,
      leadTimeDays: 7,
      pendingOrders: 0,
      reorderPoint: 35,
      isSeasonalPeak: true,
      supplierReliability: 0.8,
    };

    const prediction = await xgboostStockoutModel.predict(input);
    const explanation = xgboostStockoutModel.generateExplanation(input, prediction);

    expect(explanation.summary).toBeDefined();
    expect(explanation.topDrivers.length).toBeGreaterThan(0);
  });
});

// ============================================
// Isolation Forest Anomaly Model Tests
// ============================================

describe('Isolation Forest Anomaly Detection Model', () => {
  it('should detect no anomaly in normal data', async () => {
    const normalValues = Array.from({ length: 30 }, () => 100 + Math.random() * 10);

    const result = await isolationForestModel.detect({
      entityId: 'test_product',
      entityType: 'product',
      metrics: [{
        name: 'daily_sales',
        currentValue: 105,
        historicalValues: normalValues,
      }],
    });

    expect(result.isAnomaly).toBe(false);
    expect(result.severity).toBe('none');
  });

  it('should detect anomaly in outlier data', async () => {
    const normalValues = Array.from({ length: 30 }, () => 100 + Math.random() * 10);

    const result = await isolationForestModel.detect({
      entityId: 'test_product',
      entityType: 'product',
      metrics: [{
        name: 'daily_sales',
        currentValue: 200, // Clear outlier
        historicalValues: normalValues,
      }],
    });

    expect(result.isAnomaly).toBe(true);
    expect(result.anomalies.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(result.severity);
  });

  it('should handle multiple metrics', async () => {
    const result = await isolationForestModel.detect({
      entityId: 'test_product',
      entityType: 'product',
      metrics: [
        {
          name: 'daily_sales',
          currentValue: 100,
          historicalValues: Array.from({ length: 30 }, () => 100 + Math.random() * 10),
        },
        {
          name: 'returns',
          currentValue: 50, // Anomaly
          historicalValues: Array.from({ length: 30 }, () => 5 + Math.random() * 3),
        },
      ],
    });

    expect(result.isAnomaly).toBe(true);
    expect(result.anomalies.some(a => a.metricName === 'returns')).toBe(true);
  });

  it('should return timestamp', async () => {
    const result = await isolationForestModel.detect({
      entityId: 'test_product',
      entityType: 'product',
      metrics: [{
        name: 'daily_sales',
        currentValue: 100,
        historicalValues: [100, 100, 100],
      }],
    });

    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });

  it('should generate valid explanation', async () => {
    const input = {
      entityId: 'test_product',
      entityType: 'product',
      metrics: [{
        name: 'daily_sales',
        currentValue: 200,
        historicalValues: Array.from({ length: 30 }, () => 100),
      }],
    };

    const prediction = await isolationForestModel.detect(input);
    const explanation = isolationForestModel.generateExplanation(input, prediction);

    expect(explanation.summary).toBeDefined();
    expect(explanation.scenario).toBeDefined();
  });
});
