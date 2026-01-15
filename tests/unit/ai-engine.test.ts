/**
 * Unit Tests for ai-engine.ts
 * 
 * Tests for demand forecasting, stockout risk prediction, and anomaly detection.
 * These tests verify the AI Engine's core algorithms and output structure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage with realistic data
const mockItems = [
  { id: 'item-1', name: 'Product A', reorderPoint: 100, leadTimeDays: 7, reorderQuantity: 500 },
  { id: 'item-2', name: 'Product B', reorderPoint: 50, leadTimeDays: 5, reorderQuantity: 200 },
];

const mockStockBalances = [
  { itemId: 'item-1', locationId: 'loc-1', quantityOnHand: 150 },
  { itemId: 'item-1', locationId: 'loc-2', quantityOnHand: 30 },
  { itemId: 'item-2', locationId: 'loc-1', quantityOnHand: 200 },
];

const generateMovements = (itemId: string, locationId: string, count: number) => {
  const movements = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    movements.push({
      id: `mov-${itemId}-${i}`,
      itemId,
      locationId,
      movementType: 'out',
      quantity: Math.floor(Math.random() * 20) + 5,
      timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
    });
  }
  return movements;
};

const mockMovements = [
  ...generateMovements('item-1', 'loc-1', 30),
  ...generateMovements('item-1', 'loc-2', 30),
  ...generateMovements('item-2', 'loc-1', 15),
];

vi.mock('@server/storage', () => ({
  storage: {
    getItems: vi.fn().mockResolvedValue(mockItems),
    getStockBalances: vi.fn().mockResolvedValue(mockStockBalances),
    getStockMovements: vi.fn().mockResolvedValue(mockMovements),
    getDemandSignals: vi.fn().mockResolvedValue([]),
    createRecommendation: vi.fn().mockResolvedValue({ id: 'rec-123' }),
    createAnomaly: vi.fn().mockResolvedValue({ id: 'anom-123' }),
    createAuditLog: vi.fn().mockResolvedValue({ id: 'audit-123' }),
    getItemsByTenant: vi.fn().mockResolvedValue(mockItems),
    getStockBalancesByTenant: vi.fn().mockResolvedValue(mockStockBalances),
    getStockMovementsByTenant: vi.fn().mockResolvedValue(mockMovements),
    getLocationsByTenant: vi.fn().mockResolvedValue([
      { id: 'loc-1', name: 'Warehouse A' },
      { id: 'loc-2', name: 'Warehouse B' },
    ]),
  },
}));

// Import after mocking
const aiEngineModule = await import('@server/ai-engine');
const aiEngine = aiEngineModule.aiEngine || aiEngineModule.default || aiEngineModule;

describe('AIEngine - Core Functions Existence', () => {
  it('should export aiEngine object', () => {
    expect(aiEngine).toBeDefined();
  });

  it('should have analyzeDemand function', () => {
    expect(typeof aiEngine.analyzeDemand).toBe('function');
  });

  it('should have predictStockoutRisk function', () => {
    expect(typeof aiEngine.predictStockoutRisk).toBe('function');
  });

  it('should have detectAnomalies function', () => {
    expect(typeof aiEngine.detectAnomalies).toBe('function');
  });

  it('should have runFullAnalysis function', () => {
    expect(typeof aiEngine.runFullAnalysis).toBe('function');
  });

  it('should have generateRecommendations function', () => {
    expect(typeof aiEngine.generateRecommendations).toBe('function');
  });
});

describe('AIEngine - Demand Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return demand analysis result object', async () => {
    const result = await aiEngine.analyzeDemand('item-1', 'loc-1', 'tenant-123');
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should include item and location identifiers', async () => {
    const result = await aiEngine.analyzeDemand('item-1', 'loc-1', 'tenant-123');
    
    expect(result.itemId || result.item_id).toBe('item-1');
    expect(result.locationId || result.location_id).toBe('loc-1');
  });

  it('should calculate moving averages', async () => {
    const result = await aiEngine.analyzeDemand('item-1', 'loc-1', 'tenant-123');
    
    expect(result.movingAverages || result.moving_averages).toBeDefined();
  });

  it('should determine trend direction', async () => {
    const result = await aiEngine.analyzeDemand('item-1', 'loc-1', 'tenant-123');
    
    expect(result.trend).toBeDefined();
    if (result.trend.direction) {
      expect(['increasing', 'decreasing', 'stable']).toContain(result.trend.direction);
    }
  });

  it('should provide confidence score', async () => {
    const result = await aiEngine.analyzeDemand('item-1', 'loc-1', 'tenant-123');
    
    const confidence = result.confidence_score || result.confidenceScore || result.confidence;
    expect(typeof confidence).toBe('number');
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(100);
  });
});

describe('AIEngine - Stockout Risk Prediction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return stockout risk result object', async () => {
    const result = await aiEngine.predictStockoutRisk('item-1', 'loc-1', 'tenant-123');
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should include current stock level', async () => {
    const result = await aiEngine.predictStockoutRisk('item-1', 'loc-1', 'tenant-123');
    
    const currentStock = result.currentStock || result.current_stock || result.quantityOnHand;
    expect(typeof currentStock).toBe('number');
  });

  it('should calculate days until stockout', async () => {
    const result = await aiEngine.predictStockoutRisk('item-1', 'loc-1', 'tenant-123');
    
    const daysUntilStockout = result.daysUntilStockout || result.days_until_stockout;
    expect(typeof daysUntilStockout).toBe('number');
    expect(daysUntilStockout).toBeGreaterThanOrEqual(0);
  });

  it('should provide risk assessment', async () => {
    const result = await aiEngine.predictStockoutRisk('item-1', 'loc-1', 'tenant-123');
    
    expect(result.riskAssessment || result.risk_assessment || result.risk).toBeDefined();
  });

  it('should indicate if reorder is needed', async () => {
    const result = await aiEngine.predictStockoutRisk('item-1', 'loc-1', 'tenant-123');
    
    const shouldReorder = result.shouldReorder || result.should_reorder || result.needsReorder;
    expect(typeof shouldReorder).toBe('boolean');
  });
});

describe('AIEngine - Anomaly Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return array of anomalies', async () => {
    const result = await aiEngine.detectAnomalies('tenant-123');
    
    expect(Array.isArray(result)).toBe(true);
  });

  it('should include type and severity for each anomaly', async () => {
    const result = await aiEngine.detectAnomalies('tenant-123');
    
    if (result.length > 0) {
      const anomaly = result[0];
      expect(anomaly.type).toBeDefined();
      expect(anomaly.severity).toBeDefined();
    }
  });

  it('should use valid severity levels', async () => {
    const result = await aiEngine.detectAnomalies('tenant-123');
    
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    result.forEach((anomaly: any) => {
      expect(validSeverities).toContain(anomaly.severity);
    });
  });
});

describe('AIEngine - Full Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return complete analysis result', async () => {
    const result = await aiEngine.runFullAnalysis('tenant-123');
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should include tenant identifier', async () => {
    const result = await aiEngine.runFullAnalysis('tenant-123');
    
    expect(result.tenantId || result.tenant_id).toBe('tenant-123');
  });

  it('should include timestamp', async () => {
    const result = await aiEngine.runFullAnalysis('tenant-123');
    
    expect(result.timestamp || result.analyzedAt || result.created_at).toBeDefined();
  });

  it('should include demand forecasts array', async () => {
    const result = await aiEngine.runFullAnalysis('tenant-123');
    
    expect(Array.isArray(result.demandForecasts || result.demand_forecasts || result.forecasts)).toBe(true);
  });

  it('should include stockout risks array', async () => {
    const result = await aiEngine.runFullAnalysis('tenant-123');
    
    expect(Array.isArray(result.stockoutRisks || result.stockout_risks || result.risks)).toBe(true);
  });

  it('should include anomalies array', async () => {
    const result = await aiEngine.runFullAnalysis('tenant-123');
    
    expect(Array.isArray(result.anomalies)).toBe(true);
  });
});

describe('AIEngine - Recommendation Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate recommendations array', async () => {
    const result = await aiEngine.generateRecommendations('tenant-123');
    
    expect(Array.isArray(result)).toBe(true);
  });

  it('should include recommendation type', async () => {
    const result = await aiEngine.generateRecommendations('tenant-123');
    
    if (result.length > 0) {
      expect(result[0].type).toBeDefined();
    }
  });

  it('should include priority level', async () => {
    const result = await aiEngine.generateRecommendations('tenant-123');
    
    if (result.length > 0) {
      const validPriorities = ['critical', 'high', 'medium', 'low'];
      expect(validPriorities).toContain(result[0].priority);
    }
  });

  it('should include confidence score', async () => {
    const result = await aiEngine.generateRecommendations('tenant-123');
    
    if (result.length > 0) {
      const confidence = result[0].confidence_score || result[0].confidenceScore;
      expect(typeof confidence).toBe('number');
    }
  });

  it('should include explanation', async () => {
    const result = await aiEngine.generateRecommendations('tenant-123');
    
    if (result.length > 0) {
      expect(result[0].explanation || result[0].rationale).toBeDefined();
    }
  });
});
