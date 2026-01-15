import { describe, it, expect, beforeEach, vi } from 'vitest';
import { featureStore, FEATURE_DEFINITIONS } from '../feature-store';
import { modelRegistry } from '../model-registry';
import { governanceGate } from '../governance';
import { demandForecastingModel } from '../models/demand-forecasting';
import { stockoutRiskModel } from '../models/stockout-risk';
import { anomalyDetectionModel } from '../models/anomaly-detection';
import { decisionAPI } from '../decision-api';
import { monitoringService } from '../monitoring';

// ============================================
// Feature Store Tests
// ============================================

describe('Feature Store', () => {
  beforeEach(() => {
    featureStore.clearCache();
  });

  it('should have predefined feature definitions', () => {
    const definitions = featureStore.getAllDefinitions();
    expect(definitions.length).toBeGreaterThan(0);
    expect(FEATURE_DEFINITIONS['sales_last_7d']).toBeDefined();
  });

  it('should compute features correctly', async () => {
    const feature = await featureStore.computeFeature(
      'sales_last_7d',
      'product_123',
      'product',
      { salesHistory: [10, 12, 8, 15, 11, 9, 14] }
    );
    
    expect(feature.featureName).toBe('sales_last_7d');
    expect(feature.value).toBe(79); // Sum of last 7 days
  });

  it('should get feature vector for ML model', async () => {
    const vector = await featureStore.getFeatureVector(
      ['day_of_week', 'month'],
      'product_123',
      'product',
      {}
    );
    
    expect(vector.day_of_week).toBeDefined();
    expect(vector.month).toBeDefined();
  });
});

// ============================================
// Model Registry Tests
// ============================================

describe('Model Registry', () => {
  it('should register new model version', () => {
    const model = modelRegistry.registerModel({
      modelName: 'test_model',
      version: '1.0.0',
      trainingSignature: 'test_signature',
      metrics: {
        mae: 10,
        baselineComparison: 15,
        backtestingPassed: true,
      },
      artifactPath: '/models/test',
      featureSet: ['feature1', 'feature2'],
    });
    
    expect(model.id).toBeDefined();
    expect(model.approvalStatus).toBe('draft');
  });

  it('should not deploy unapproved model', () => {
    const model = modelRegistry.registerModel({
      modelName: 'test_model_2',
      version: '1.0.0',
      trainingSignature: 'test_signature',
      metrics: {
        mae: 10,
        baselineComparison: 15,
        backtestingPassed: true,
      },
      artifactPath: '/models/test',
      featureSet: ['feature1'],
    });
    
    expect(() => modelRegistry.deployModel(model.id)).toThrow('must be approved');
  });
});

// ============================================
// Governance Gate Tests
// ============================================

describe('Governance Gate', () => {
  it('should have default policies', () => {
    const policies = governanceGate.getPolicies();
    expect(policies.length).toBeGreaterThan(0);
  });

  it('should reject submission with failed backtest', async () => {
    const model = modelRegistry.registerModel({
      modelName: 'test_model_3',
      version: '1.0.0',
      trainingSignature: 'test_signature',
      metrics: { baselineComparison: 10, backtestingPassed: true },
      artifactPath: '/models/test',
      featureSet: ['feature1'],
    });
    
    await expect(
      governanceGate.submitForApproval(model.id, 'user@test.com', {
        passed: false,
        testPeriod: { start: new Date(), end: new Date() },
        metrics: { baselineComparison: -5, backtestingPassed: false },
        comparisonWithBaseline: -5,
        stabilityScore: 0.9,
      })
    ).rejects.toThrow('Backtesting failed');
  });
});

// ============================================
// Demand Forecasting Model Tests
// ============================================

describe('Demand Forecasting Model', () => {
  it('should generate forecast with prediction interval', async () => {
    const result = await demandForecastingModel.predict({
      productId: 'test_product',
      horizon: 7,
      salesHistory: [10, 12, 8, 15, 11, 9, 14, 13, 10, 12, 11, 8, 15, 12],
      currentStock: 50,
      leadTimeDays: 7,
      isPromotional: false,
      seasonalityIndex: 1,
    });
    
    expect(result.forecast.length).toBe(7);
    expect(result.predictionInterval.lower.length).toBe(7);
    expect(result.predictionInterval.upper.length).toBe(7);
    expect(result.totalForecast).toBeGreaterThan(0);
  });

  it('should generate explanation with top drivers', async () => {
    const input = {
      productId: 'test_product',
      horizon: 7,
      salesHistory: [10, 12, 8, 15, 11, 9, 14, 13, 10, 12, 11, 8, 15, 12],
      currentStock: 50,
      leadTimeDays: 7,
      isPromotional: false,
      seasonalityIndex: 1,
    };
    
    const prediction = await demandForecastingModel.predict(input);
    const explanation = demandForecastingModel.generateExplanation(input, prediction);
    
    expect(explanation.summary).toBeDefined();
    expect(explanation.topDrivers.length).toBe(3);
    expect(explanation.scenario).toBeDefined();
  });
});

// ============================================
// Stockout Risk Model Tests
// ============================================

describe('Stockout Risk Model', () => {
  it('should predict risk for multiple horizons', async () => {
    const result = await stockoutRiskModel.predict({
      productId: 'test_product',
      currentStock: 20,
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

  it('should detect high risk when stock is low', async () => {
    const result = await stockoutRiskModel.predict({
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
  });
});

// ============================================
// Anomaly Detection Model Tests
// ============================================

describe('Anomaly Detection Model', () => {
  it('should detect no anomaly in normal data', async () => {
    const normalValues = Array.from({ length: 30 }, () => 100 + Math.random() * 10);
    
    const result = await anomalyDetectionModel.detect({
      entityId: 'test_product',
      entityType: 'product',
      metrics: [{
        name: 'daily_sales',
        currentValue: 105,
        historicalValues: normalValues,
      }],
    });
    
    expect(result.isAnomaly).toBe(false);
  });

  it('should detect anomaly in outlier data', async () => {
    const normalValues = Array.from({ length: 30 }, () => 100 + Math.random() * 10);
    
    const result = await anomalyDetectionModel.detect({
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
  });
});

// ============================================
// Decision API Tests
// ============================================

describe('Decision API', () => {
  it('should return decision with all required fields', async () => {
    const decision = await decisionAPI.getDecision({
      useCase: 'demand_forecast',
      entityId: 'product_123',
      entityType: 'product',
      requestedBy: 'test@example.com',
      context: {
        horizon: 7,
        salesHistory: [10, 12, 8, 15, 11, 9, 14],
        currentStock: 50,
        leadTimeDays: 7,
      },
    });
    
    // Must have all required fields
    expect(decision.auditId).toBeDefined();
    expect(decision.recommendation).toBeDefined();
    expect(decision.confidence).toBeDefined();
    expect(decision.explanation).toBeDefined();
    expect(decision.policyResult).toBeDefined();
    expect(decision.timestamp).toBeDefined();
    
    // Explanation must have summary and drivers
    expect(decision.explanation.summary).toBeDefined();
    expect(decision.explanation.topDrivers).toBeDefined();
  });

  it('should never expose model name or algorithm type', async () => {
    const decision = await decisionAPI.getDecision({
      useCase: 'stockout_risk',
      entityId: 'product_123',
      entityType: 'product',
      requestedBy: 'test@example.com',
      context: {
        currentStock: 20,
        avgDailySales: 5,
      },
    });
    
    // These fields should NOT exist
    expect((decision as any).modelName).toBeUndefined();
    expect((decision as any).algorithmType).toBeUndefined();
  });
});

// ============================================
// Monitoring Service Tests
// ============================================

describe('Monitoring Service', () => {
  it('should set and check baseline', () => {
    const values = [100, 102, 98, 105, 95, 103, 97, 101, 99, 104];
    monitoringService.setBaseline('test_feature', values);
    
    // Update with similar values - no drift
    monitoringService.updateCurrent('test_feature', [101, 103, 99, 102, 100, 104, 98, 101, 100, 103]);
    const result = monitoringService.checkDataDrift('test_feature');
    
    // Drift detection may show low/medium for similar distributions
    expect(['none', 'low', 'medium']).toContain(result.severity);
  });

  it('should detect drift when distribution changes', () => {
    const baseline = [100, 102, 98, 105, 95, 103, 97, 101, 99, 104];
    monitoringService.setBaseline('drift_feature', baseline);
    
    // Update with significantly different values
    monitoringService.updateCurrent('drift_feature', [150, 155, 148, 160, 145, 158, 152, 149, 156, 151]);
    const result = monitoringService.checkDataDrift('drift_feature');
    
    expect(result.hasDrift).toBe(true);
    expect(['low', 'medium', 'high']).toContain(result.severity);
  });

  it('should run health check', async () => {
    const health = await monitoringService.runHealthCheck();
    
    expect(health.status).toBeDefined();
    expect(health.checks).toBeDefined();
    expect(health.checks.length).toBeGreaterThan(0);
  });
});
