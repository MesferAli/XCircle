/**
 * Atlas MLOps - Main Entry Point
 * 
 * Governed Decision Intelligence for Enterprise AI Layer
 * 
 * ✅ Human-in-the-loop
 * ✅ Auditability
 * ✅ Policy enforcement
 * ✅ Easy integration
 * 
 * ❌ No auto-execution
 * ❌ No black-box models
 * ❌ No raw predictions
 */

// Core Types
export * from './types';

// Feature Store
export { featureStore, FEATURE_DEFINITIONS } from './feature-store';

// Model Registry
export { modelRegistry } from './model-registry';

// Governance Gate
export { governanceGate } from './governance';

// Models
export { demandForecastingModel } from './models/demand-forecasting';
export { stockoutRiskModel } from './models/stockout-risk';
export { anomalyDetectionModel } from './models/anomaly-detection';

// Decision API
export { decisionAPI } from './decision-api';

// Monitoring
export { monitoringService } from './monitoring';

// ============================================
// Quick Start Example
// ============================================

/**
 * Example usage:
 * 
 * ```typescript
 * import { decisionAPI } from './mlops';
 * 
 * // Get demand forecast decision
 * const decision = await decisionAPI.getDecision({
 *   useCase: 'demand_forecast',
 *   entityId: 'product_123',
 *   entityType: 'product',
 *   requestedBy: 'user@example.com',
 *   context: {
 *     horizon: 14,
 *     salesHistory: [10, 12, 8, 15, 11, 9, 14, 13, 10, 12, 11, 8, 15, 12],
 *     currentStock: 50,
 *     leadTimeDays: 7,
 *     isPromotional: false,
 *   },
 * });
 * 
 * // Response includes:
 * // - recommendation: Human-readable action
 * // - confidence: Score and level
 * // - explanation: Summary and top drivers
 * // - policyResult: Applied policies
 * // - auditId: For traceability
 * ```
 */
