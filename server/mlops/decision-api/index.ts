/**
 * Atlas MLOps - Decision API
 * 
 * ❌ This is NOT a Prediction API
 * ✅ This is a Governed Decision API
 * 
 * Every response MUST include:
 * - recommendation
 * - confidence
 * - explanation
 * - policy_result
 * - audit_id
 * 
 * ❌ No raw predictions
 * ❌ No execution commands
 */

import { 
  DecisionRequest, 
  DecisionResponse, 
  Recommendation,
  ConfidenceLevel,
  Explanation,
  PolicyResult,
  FallbackDecision,
  AuditRecord
} from '../types';
import { demandForecastingModel } from '../models/demand-forecasting';
import { stockoutRiskModel } from '../models/stockout-risk';
import { anomalyDetectionModel } from '../models/anomaly-detection';
import { governanceGate } from '../governance';
import { modelRegistry } from '../model-registry';
import { featureStore } from '../feature-store';

// ============================================
// Decision API Class
// ============================================

export class DecisionAPI {
  private auditLog: AuditRecord[] = [];
  
  /**
   * Main Decision Endpoint
   * POST /decision/{use_case}
   */
  async getDecision(request: DecisionRequest): Promise<DecisionResponse> {
    const auditId = this.generateAuditId();
    
    try {
      // Log request
      this.logAudit({
        action: 'decision_requested',
        userId: request.requestedBy,
        entityId: request.entityId,
        entityType: request.entityType,
        details: { useCase: request.useCase },
      });
      
      // Check if model is deployed and approved
      const modelCheck = this.checkModelAvailability(request.useCase);
      if (!modelCheck.available) {
        return this.createFallbackResponse(auditId, request, {
          type: 'rule_based',
          reason: 'approval_revoked',
          fallbackLogic: 'Using rule-based logic as model is not available',
        });
      }
      
      // Get decision based on use case
      let response: DecisionResponse;
      
      switch (request.useCase) {
        case 'demand_forecast':
          response = await this.getDemandForecastDecision(auditId, request);
          break;
        case 'stockout_risk':
          response = await this.getStockoutRiskDecision(auditId, request);
          break;
        case 'anomaly_detection':
          response = await this.getAnomalyDetectionDecision(auditId, request);
          break;
        default:
          throw new Error(`Unknown use case: ${request.useCase}`);
      }
      
      // Log response
      this.logAudit({
        action: 'decision_returned',
        userId: request.requestedBy,
        entityId: request.entityId,
        entityType: request.entityType,
        details: { 
          auditId,
          recommendation: response.recommendation.action,
          confidence: response.confidence.score,
        },
      });
      
      return response;
      
    } catch (error) {
      // Fail-safe: return rule-based fallback
      console.error('[DecisionAPI] Error:', error);
      
      return this.createFallbackResponse(auditId, request, {
        type: 'rule_based',
        reason: 'model_failed',
        originalError: error instanceof Error ? error.message : 'Unknown error',
        fallbackLogic: 'Using rule-based logic due to model error',
      });
    }
  }
  
  // ============================================
  // Demand Forecast Decision
  // ============================================
  
  private async getDemandForecastDecision(
    auditId: string,
    request: DecisionRequest
  ): Promise<DecisionResponse> {
    const context = request.context || {};
    
    // Get features from feature store
    const features = await featureStore.getFeatureVector(
      ['sales_last_30d', 'avg_daily_sales', 'sales_trend', 'seasonality_index', 'current_stock', 'lead_time_days'],
      request.entityId,
      request.entityType as any,
      context
    );
    
    // Run model
    const prediction = await demandForecastingModel.predict({
      productId: request.entityId,
      horizon: context.horizon || 14,
      salesHistory: context.salesHistory || [],
      currentStock: features.current_stock as number || 0,
      leadTimeDays: features.lead_time_days as number || 7,
      isPromotional: context.isPromotional || false,
      seasonalityIndex: features.seasonality_index as number || 1,
    });
    
    // Generate explanation
    const explanationData = demandForecastingModel.generateExplanation(
      {
        productId: request.entityId,
        horizon: context.horizon || 14,
        salesHistory: context.salesHistory || [],
        currentStock: features.current_stock as number || 0,
        leadTimeDays: features.lead_time_days as number || 7,
        isPromotional: context.isPromotional || false,
        seasonalityIndex: features.seasonality_index as number || 1,
      },
      prediction
    );
    
    // Build recommendation
    const recommendation: Recommendation = {
      action: this.getDemandRecommendation(prediction, features),
      value: prediction.totalForecast,
      unit: 'وحدة',
      timeframe: `${context.horizon || 14} يوم`,
      priority: this.getDemandPriority(prediction, features),
    };
    
    // Build confidence
    const confidence: ConfidenceLevel = {
      score: this.calculateDemandConfidence(prediction, context.salesHistory?.length || 0),
      level: this.getConfidenceLevel(this.calculateDemandConfidence(prediction, context.salesHistory?.length || 0)),
      interval: {
        lower: prediction.predictionInterval.lower.reduce((a, b) => a + b, 0),
        upper: prediction.predictionInterval.upper.reduce((a, b) => a + b, 0),
      },
    };
    
    // Build explanation
    const explanation: Explanation = {
      summary: explanationData.summary,
      topDrivers: explanationData.topDrivers,
      scenario: explanationData.scenario,
    };
    
    // Check policies
    const policyResult = this.checkPolicies(request, prediction);
    
    return {
      auditId,
      recommendation,
      confidence,
      explanation,
      policyResult,
      timestamp: new Date(),
    };
  }
  
  // ============================================
  // Stockout Risk Decision
  // ============================================
  
  private async getStockoutRiskDecision(
    auditId: string,
    request: DecisionRequest
  ): Promise<DecisionResponse> {
    const context = request.context || {};
    
    // Run model
    const prediction = await stockoutRiskModel.predict({
      productId: request.entityId,
      currentStock: context.currentStock || 0,
      avgDailySales: context.avgDailySales || 1,
      salesVariability: context.salesVariability || 0.2,
      leadTimeDays: context.leadTimeDays || 7,
      pendingOrders: context.pendingOrders || 0,
      reorderPoint: context.reorderPoint || 10,
      isSeasonalPeak: context.isSeasonalPeak || false,
      supplierReliability: context.supplierReliability || 0.9,
    });
    
    // Generate explanation
    const explanationData = stockoutRiskModel.generateExplanation(
      {
        productId: request.entityId,
        currentStock: context.currentStock || 0,
        avgDailySales: context.avgDailySales || 1,
        salesVariability: context.salesVariability || 0.2,
        leadTimeDays: context.leadTimeDays || 7,
        pendingOrders: context.pendingOrders || 0,
        reorderPoint: context.reorderPoint || 10,
        isSeasonalPeak: context.isSeasonalPeak || false,
        supplierReliability: context.supplierReliability || 0.9,
      },
      prediction
    );
    
    // Build recommendation
    const recommendation: Recommendation = {
      action: this.getStockoutRecommendation(prediction),
      value: prediction.daysUntilStockout,
      unit: 'يوم',
      timeframe: 'حتى نفاد المخزون',
      priority: prediction.overallRisk === 'critical' ? 'critical' 
        : prediction.overallRisk === 'high' ? 'high'
        : prediction.overallRisk === 'medium' ? 'medium' : 'low',
    };
    
    // Build confidence
    const confidence: ConfidenceLevel = {
      score: prediction.risk7Days.confidence,
      level: this.getConfidenceLevel(prediction.risk7Days.confidence),
    };
    
    // Build explanation
    const explanation: Explanation = {
      summary: explanationData.summary,
      topDrivers: explanationData.topDrivers,
      scenario: explanationData.scenario,
    };
    
    // Check policies
    const policyResult = this.checkPolicies(request, prediction);
    
    return {
      auditId,
      recommendation,
      confidence,
      explanation,
      policyResult,
      timestamp: new Date(),
    };
  }
  
  // ============================================
  // Anomaly Detection Decision
  // ============================================
  
  private async getAnomalyDetectionDecision(
    auditId: string,
    request: DecisionRequest
  ): Promise<DecisionResponse> {
    const context = request.context || {};
    
    // Prepare metrics
    const metrics = context.metrics || [
      {
        name: 'daily_sales',
        currentValue: context.currentSales || 0,
        historicalValues: context.salesHistory || [],
      },
    ];
    
    // Run model
    const prediction = await anomalyDetectionModel.detect({
      entityId: request.entityId,
      entityType: request.entityType as any,
      metrics,
      context,
    });
    
    // Generate explanation
    const explanationData = anomalyDetectionModel.generateExplanation(
      {
        entityId: request.entityId,
        entityType: request.entityType as any,
        metrics,
        context,
      },
      prediction
    );
    
    // Build recommendation
    const recommendation: Recommendation = {
      action: this.getAnomalyRecommendation(prediction),
      priority: prediction.severity === 'critical' ? 'critical'
        : prediction.severity === 'high' ? 'high'
        : prediction.severity === 'medium' ? 'medium' : 'low',
    };
    
    // Build confidence
    const confidence: ConfidenceLevel = {
      score: prediction.overallConfidence,
      level: this.getConfidenceLevel(prediction.overallConfidence),
    };
    
    // Build explanation
    const explanation: Explanation = {
      summary: explanationData.summary,
      topDrivers: explanationData.topDrivers,
      scenario: explanationData.scenario,
    };
    
    // Check policies
    const policyResult = this.checkPolicies(request, prediction);
    
    return {
      auditId,
      recommendation,
      confidence,
      explanation,
      policyResult,
      timestamp: new Date(),
    };
  }
  
  // ============================================
  // Helper Methods
  // ============================================
  
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private checkModelAvailability(useCase: string): { available: boolean; reason?: string } {
    // In production, check model registry for deployed model
    // For v1, always return available (using built-in models)
    return { available: true };
  }
  
  private checkPolicies(request: DecisionRequest, prediction: any): PolicyResult {
    // Simple policy check for v1
    return {
      allowed: true,
      appliedPolicies: ['policy_baseline_improvement', 'policy_stability'],
      requiresApproval: false,
    };
  }
  
  private getDemandRecommendation(prediction: any, features: any): string {
    const daysOfStock = features.current_stock / (prediction.avgDailyForecast || 1);
    const leadTime = features.lead_time_days || 7;
    
    if (daysOfStock < leadTime) {
      return 'إعادة طلب فورية مطلوبة';
    } else if (daysOfStock < leadTime * 1.5) {
      return 'يُنصح بإعادة الطلب قريباً';
    } else {
      return 'المخزون كافٍ، لا حاجة لإجراء';
    }
  }
  
  private getDemandPriority(prediction: any, features: any): 'low' | 'medium' | 'high' | 'critical' {
    const daysOfStock = features.current_stock / (prediction.avgDailyForecast || 1);
    const leadTime = features.lead_time_days || 7;
    
    if (daysOfStock < leadTime * 0.5) return 'critical';
    if (daysOfStock < leadTime) return 'high';
    if (daysOfStock < leadTime * 1.5) return 'medium';
    return 'low';
  }
  
  private calculateDemandConfidence(prediction: any, dataPoints: number): number {
    // Base confidence from data availability
    let confidence = Math.min(60, 30 + dataPoints);
    
    // Adjust for trend stability
    if (prediction.trend === 'stable') confidence += 15;
    else confidence += 5;
    
    // Adjust for prediction interval width
    const intervalWidth = prediction.predictionInterval.upper[0] - prediction.predictionInterval.lower[0];
    const avgForecast = prediction.avgDailyForecast;
    if (avgForecast > 0) {
      const relativeWidth = intervalWidth / avgForecast;
      if (relativeWidth < 0.3) confidence += 15;
      else if (relativeWidth < 0.5) confidence += 10;
      else confidence += 5;
    }
    
    return Math.min(95, confidence);
  }
  
  private getConfidenceLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }
  
  private getStockoutRecommendation(prediction: any): string {
    switch (prediction.overallRisk) {
      case 'critical':
        return 'إعادة طلب فورية - خطر نفاد وشيك';
      case 'high':
        return 'إعادة طلب مستعجلة مطلوبة';
      case 'medium':
        return 'مراقبة المخزون والتخطيط لإعادة الطلب';
      default:
        return 'الوضع آمن، لا حاجة لإجراء فوري';
    }
  }
  
  private getAnomalyRecommendation(prediction: any): string {
    if (!prediction.isAnomaly) {
      return 'لا يوجد سلوك غير طبيعي';
    }
    
    switch (prediction.severity) {
      case 'critical':
        return 'تحقيق فوري مطلوب - سلوك غير طبيعي حرج';
      case 'high':
        return 'مراجعة مطلوبة - سلوك غير معتاد';
      case 'medium':
        return 'للمتابعة - تغير ملحوظ';
      default:
        return 'للعلم - تغير طفيف';
    }
  }
  
  private createFallbackResponse(
    auditId: string,
    request: DecisionRequest,
    fallback: FallbackDecision
  ): DecisionResponse {
    return {
      auditId,
      recommendation: {
        action: 'استخدام القواعد الأساسية - النموذج غير متاح',
        priority: 'medium',
      },
      confidence: {
        score: 50,
        level: 'medium',
      },
      explanation: {
        summary: `تم استخدام المنطق القاعدي بسبب: ${this.getArabicReason(fallback.reason)}`,
        topDrivers: [],
        scenario: fallback.fallbackLogic,
      },
      policyResult: {
        allowed: true,
        appliedPolicies: ['fallback_policy'],
        requiresApproval: false,
        reason: fallback.reason,
      },
      timestamp: new Date(),
    };
  }
  
  private getArabicReason(reason: string): string {
    const reasons: Record<string, string> = {
      'model_failed': 'فشل النموذج',
      'drift_too_high': 'انحراف البيانات مرتفع',
      'approval_revoked': 'تم سحب الموافقة',
      'policy_blocked': 'محظور بواسطة السياسة',
    };
    return reasons[reason] || reason;
  }
  
  private logAudit(record: Omit<AuditRecord, 'id' | 'timestamp'>): void {
    this.auditLog.push({
      ...record,
      id: this.generateAuditId(),
      timestamp: new Date(),
    });
  }
  
  /**
   * Get audit log
   */
  getAuditLog(): AuditRecord[] {
    return [...this.auditLog];
  }
}

// Singleton instance
export const decisionAPI = new DecisionAPI();
