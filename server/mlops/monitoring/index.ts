/**
 * Atlas MLOps - Monitoring & Drift Detection
 * 
 * Tracks:
 * - Data drift
 * - Prediction distribution drift
 * - Feature stability
 * 
 * Action: Alert only (No auto-adaptation in v1)
 */

import { DriftMetrics, MonitoringAlert } from '../types';

// ============================================
// Types
// ============================================

interface FeatureDistribution {
  featureName: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
  };
  sampleSize: number;
  timestamp: Date;
}

interface DriftCheckResult {
  hasDrift: boolean;
  driftScore: number;
  driftType: 'data' | 'prediction' | 'concept';
  severity: 'none' | 'low' | 'medium' | 'high';
  details: string;
}

// ============================================
// Monitoring Service
// ============================================

export class MonitoringService {
  private baselineDistributions: Map<string, FeatureDistribution> = new Map();
  private currentDistributions: Map<string, FeatureDistribution> = new Map();
  private alerts: MonitoringAlert[] = [];
  private driftHistory: DriftMetrics[] = [];
  
  // Thresholds
  private readonly DRIFT_THRESHOLDS = {
    low: 0.1,
    medium: 0.2,
    high: 0.3,
  };
  
  // ============================================
  // Baseline Management
  // ============================================
  
  /**
   * Set baseline distribution for a feature
   */
  setBaseline(featureName: string, values: number[]): void {
    const distribution = this.calculateDistribution(featureName, values);
    this.baselineDistributions.set(featureName, distribution);
    console.log(`[Monitoring] Baseline set for: ${featureName}`);
  }
  
  /**
   * Update current distribution for a feature
   */
  updateCurrent(featureName: string, values: number[]): void {
    const distribution = this.calculateDistribution(featureName, values);
    this.currentDistributions.set(featureName, distribution);
  }
  
  // ============================================
  // Drift Detection
  // ============================================
  
  /**
   * Check for data drift using Population Stability Index (PSI)
   */
  checkDataDrift(featureName: string): DriftCheckResult {
    const baseline = this.baselineDistributions.get(featureName);
    const current = this.currentDistributions.get(featureName);
    
    if (!baseline || !current) {
      return {
        hasDrift: false,
        driftScore: 0,
        driftType: 'data',
        severity: 'none',
        details: 'Insufficient data for drift detection',
      };
    }
    
    // Calculate PSI-like metric using mean and std
    const meanShift = Math.abs(current.mean - baseline.mean) / (baseline.std || 1);
    const stdRatio = current.std / (baseline.std || 1);
    
    // Combined drift score
    const driftScore = (meanShift * 0.6 + Math.abs(1 - stdRatio) * 0.4);
    
    const severity = this.getDriftSeverity(driftScore);
    const hasDrift = severity !== 'none';
    
    // Log drift metrics
    const driftMetrics: DriftMetrics = {
      featureName,
      driftScore,
      driftType: 'data',
      severity,
      detectedAt: new Date(),
      baseline: { mean: baseline.mean, std: baseline.std },
      current: { mean: current.mean, std: current.std },
    };
    this.driftHistory.push(driftMetrics);
    
    // Create alert if needed
    if (hasDrift) {
      this.createAlert({
        type: 'drift',
        severity: severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'info',
        message: `انحراف في البيانات: ${featureName} (${(driftScore * 100).toFixed(1)}%)`,
        modelName: 'all',
      });
    }
    
    return {
      hasDrift,
      driftScore,
      driftType: 'data',
      severity,
      details: `Mean shift: ${meanShift.toFixed(2)}, Std ratio: ${stdRatio.toFixed(2)}`,
    };
  }
  
  /**
   * Check for prediction drift
   */
  checkPredictionDrift(
    modelName: string,
    baselinePredictions: number[],
    currentPredictions: number[]
  ): DriftCheckResult {
    const baselineDist = this.calculateDistribution('baseline_pred', baselinePredictions);
    const currentDist = this.calculateDistribution('current_pred', currentPredictions);
    
    // KS-statistic approximation
    const meanShift = Math.abs(currentDist.mean - baselineDist.mean) / (baselineDist.std || 1);
    const medianShift = Math.abs(currentDist.percentiles.p50 - baselineDist.percentiles.p50) / (baselineDist.std || 1);
    
    const driftScore = (meanShift + medianShift) / 2;
    const severity = this.getDriftSeverity(driftScore);
    const hasDrift = severity !== 'none';
    
    if (hasDrift) {
      this.createAlert({
        type: 'drift',
        severity: severity === 'high' ? 'error' : 'warning',
        message: `انحراف في التوقعات: ${modelName} (${(driftScore * 100).toFixed(1)}%)`,
        modelName,
      });
    }
    
    return {
      hasDrift,
      driftScore,
      driftType: 'prediction',
      severity,
      details: `Prediction distribution shift detected`,
    };
  }
  
  /**
   * Check feature stability
   */
  checkFeatureStability(featureName: string, recentValues: number[]): {
    isStable: boolean;
    stabilityScore: number;
    trend: 'stable' | 'increasing' | 'decreasing' | 'volatile';
  } {
    if (recentValues.length < 10) {
      return { isStable: true, stabilityScore: 1, trend: 'stable' };
    }
    
    // Calculate coefficient of variation
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const std = Math.sqrt(
      recentValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recentValues.length
    );
    const cv = mean !== 0 ? std / Math.abs(mean) : 0;
    
    // Calculate trend
    const firstHalf = recentValues.slice(0, Math.floor(recentValues.length / 2));
    const secondHalf = recentValues.slice(Math.floor(recentValues.length / 2));
    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const trendChange = (secondMean - firstMean) / (firstMean || 1);
    
    let trend: 'stable' | 'increasing' | 'decreasing' | 'volatile';
    if (cv > 0.5) {
      trend = 'volatile';
    } else if (trendChange > 0.1) {
      trend = 'increasing';
    } else if (trendChange < -0.1) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }
    
    const stabilityScore = Math.max(0, 1 - cv);
    const isStable = stabilityScore > 0.7 && trend === 'stable';
    
    return { isStable, stabilityScore, trend };
  }
  
  // ============================================
  // Alert Management
  // ============================================
  
  /**
   * Create monitoring alert
   */
  createAlert(alert: Omit<MonitoringAlert, 'id' | 'createdAt' | 'acknowledged'>): void {
    const newAlert: MonitoringAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      acknowledged: false,
    };
    
    this.alerts.push(newAlert);
    console.log(`[Monitoring] Alert created: ${alert.message}`);
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(): MonitoringAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }
  
  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      return true;
    }
    return false;
  }
  
  /**
   * Get all alerts
   */
  getAllAlerts(filters?: {
    type?: string;
    severity?: string;
    modelName?: string;
    acknowledged?: boolean;
  }): MonitoringAlert[] {
    let filtered = [...this.alerts];
    
    if (filters) {
      if (filters.type) filtered = filtered.filter(a => a.type === filters.type);
      if (filters.severity) filtered = filtered.filter(a => a.severity === filters.severity);
      if (filters.modelName) filtered = filtered.filter(a => a.modelName === filters.modelName);
      if (filters.acknowledged !== undefined) filtered = filtered.filter(a => a.acknowledged === filters.acknowledged);
    }
    
    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  // ============================================
  // Drift History
  // ============================================
  
  /**
   * Get drift history
   */
  getDriftHistory(featureName?: string): DriftMetrics[] {
    let history = [...this.driftHistory];
    if (featureName) {
      history = history.filter(d => d.featureName === featureName);
    }
    return history.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }
  
  /**
   * Get drift summary
   */
  getDriftSummary(): {
    totalFeatures: number;
    featuresWithDrift: number;
    highSeverityCount: number;
    lastCheckTime: Date | null;
  } {
    const latestByFeature = new Map<string, DriftMetrics>();
    
    for (const drift of this.driftHistory) {
      const existing = latestByFeature.get(drift.featureName);
      if (!existing || drift.detectedAt > existing.detectedAt) {
        latestByFeature.set(drift.featureName, drift);
      }
    }
    
    const latestDrifts = Array.from(latestByFeature.values());
    
    return {
      totalFeatures: latestDrifts.length,
      featuresWithDrift: latestDrifts.filter(d => d.severity !== 'none').length,
      highSeverityCount: latestDrifts.filter(d => d.severity === 'high').length,
      lastCheckTime: latestDrifts.length > 0 
        ? new Date(Math.max(...latestDrifts.map(d => d.detectedAt.getTime())))
        : null,
    };
  }
  
  // ============================================
  // Health Check
  // ============================================
  
  /**
   * Run full health check
   */
  async runHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: {
      name: string;
      status: 'pass' | 'warn' | 'fail';
      message: string;
    }[];
  }> {
    const checks: { name: string; status: 'pass' | 'warn' | 'fail'; message: string }[] = [];
    
    // Check drift status
    const driftSummary = this.getDriftSummary();
    if (driftSummary.highSeverityCount > 0) {
      checks.push({
        name: 'Data Drift',
        status: 'fail',
        message: `${driftSummary.highSeverityCount} features with high drift`,
      });
    } else if (driftSummary.featuresWithDrift > 0) {
      checks.push({
        name: 'Data Drift',
        status: 'warn',
        message: `${driftSummary.featuresWithDrift} features with drift`,
      });
    } else {
      checks.push({
        name: 'Data Drift',
        status: 'pass',
        message: 'No significant drift detected',
      });
    }
    
    // Check active alerts
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical' || a.severity === 'error');
    if (criticalAlerts.length > 0) {
      checks.push({
        name: 'Alerts',
        status: 'fail',
        message: `${criticalAlerts.length} critical alerts`,
      });
    } else if (activeAlerts.length > 0) {
      checks.push({
        name: 'Alerts',
        status: 'warn',
        message: `${activeAlerts.length} active alerts`,
      });
    } else {
      checks.push({
        name: 'Alerts',
        status: 'pass',
        message: 'No active alerts',
      });
    }
    
    // Determine overall status
    const hasFailure = checks.some(c => c.status === 'fail');
    const hasWarning = checks.some(c => c.status === 'warn');
    
    return {
      status: hasFailure ? 'critical' : hasWarning ? 'warning' : 'healthy',
      checks,
    };
  }
  
  // ============================================
  // Helper Methods
  // ============================================
  
  private calculateDistribution(name: string, values: number[]): FeatureDistribution {
    if (values.length === 0) {
      return {
        featureName: name,
        mean: 0,
        std: 0,
        min: 0,
        max: 0,
        percentiles: { p25: 0, p50: 0, p75: 0 },
        sampleSize: 0,
        timestamp: new Date(),
      };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );
    
    return {
      featureName: name,
      mean,
      std,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      percentiles: {
        p25: sorted[Math.floor(sorted.length * 0.25)],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p75: sorted[Math.floor(sorted.length * 0.75)],
      },
      sampleSize: values.length,
      timestamp: new Date(),
    };
  }
  
  private getDriftSeverity(score: number): 'none' | 'low' | 'medium' | 'high' {
    if (score >= this.DRIFT_THRESHOLDS.high) return 'high';
    if (score >= this.DRIFT_THRESHOLDS.medium) return 'medium';
    if (score >= this.DRIFT_THRESHOLDS.low) return 'low';
    return 'none';
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();
