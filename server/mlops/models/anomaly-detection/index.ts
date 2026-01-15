/**
 * Atlas MLOps - Anomaly Detection Model
 * 
 * Detects unusual behavior with focus on explainability:
 * - Sales anomalies
 * - Inventory anomalies
 * - Order pattern anomalies
 * 
 * Models allowed: Isolation Forest, Robust statistical methods
 */

import { ExplanationDriver } from '../../types';

// ============================================
// Types
// ============================================

interface AnomalyDetectionInput {
  entityId: string;
  entityType: 'product' | 'order' | 'customer' | 'store';
  metrics: {
    name: string;
    currentValue: number;
    historicalValues: number[];
  }[];
  context?: Record<string, any>;
}

interface AnomalyDetectionOutput {
  isAnomaly: boolean;
  anomalyScore: number; // 0-100
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  anomalies: DetectedAnomaly[];
  overallConfidence: number;
}

interface DetectedAnomaly {
  metric: string;
  currentValue: number;
  expectedRange: {
    lower: number;
    upper: number;
  };
  deviation: number; // standard deviations from mean
  direction: 'above' | 'below';
  score: number;
}

// ============================================
// Anomaly Detection Model
// ============================================

export class AnomalyDetectionModel {
  private modelName = 'anomaly_detection';
  private version = '1.0.0';
  
  // Thresholds for anomaly detection (in standard deviations)
  private readonly THRESHOLDS = {
    low: 2,
    medium: 2.5,
    high: 3,
    critical: 4,
  };
  
  /**
   * Detect anomalies using robust statistical methods
   * (Production would use Isolation Forest)
   */
  async detect(input: AnomalyDetectionInput): Promise<AnomalyDetectionOutput> {
    const anomalies: DetectedAnomaly[] = [];
    let maxScore = 0;
    
    for (const metric of input.metrics) {
      const anomaly = this.detectMetricAnomaly(metric);
      if (anomaly) {
        anomalies.push(anomaly);
        maxScore = Math.max(maxScore, anomaly.score);
      }
    }
    
    const isAnomaly = anomalies.length > 0;
    const anomalyScore = maxScore;
    const severity = this.getSeverity(anomalyScore);
    
    // Confidence based on data quality
    const avgDataPoints = input.metrics.reduce((sum, m) => sum + m.historicalValues.length, 0) / input.metrics.length;
    const overallConfidence = Math.min(95, 50 + avgDataPoints * 2);
    
    return {
      isAnomaly,
      anomalyScore,
      severity,
      anomalies,
      overallConfidence: Math.round(overallConfidence),
    };
  }
  
  /**
   * Detect anomaly in a single metric using Modified Z-Score
   * (More robust than standard Z-score for outliers)
   */
  private detectMetricAnomaly(metric: {
    name: string;
    currentValue: number;
    historicalValues: number[];
  }): DetectedAnomaly | null {
    const { name, currentValue, historicalValues } = metric;
    
    if (historicalValues.length < 10) {
      return null; // Not enough data
    }
    
    // Calculate robust statistics (using median and MAD)
    const sorted = [...historicalValues].sort((a, b) => a - b);
    const median = this.getMedian(sorted);
    const mad = this.getMAD(sorted, median);
    
    // Modified Z-score
    const modifiedZScore = mad > 0 ? 0.6745 * (currentValue - median) / mad : 0;
    const absZScore = Math.abs(modifiedZScore);
    
    // Check if anomaly
    if (absZScore < this.THRESHOLDS.low) {
      return null;
    }
    
    // Calculate expected range (using IQR method)
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    
    // Calculate anomaly score (0-100)
    const score = Math.min(100, (absZScore / this.THRESHOLDS.critical) * 100);
    
    return {
      metric: name,
      currentValue,
      expectedRange: { lower, upper },
      deviation: modifiedZScore,
      direction: currentValue > median ? 'above' : 'below',
      score: Math.round(score),
    };
  }
  
  /**
   * Get severity level from anomaly score
   */
  private getSeverity(score: number): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    if (score >= 30) return 'low';
    return 'none';
  }
  
  /**
   * Calculate median
   */
  private getMedian(sorted: number[]): number {
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  /**
   * Calculate Median Absolute Deviation (MAD)
   */
  private getMAD(sorted: number[], median: number): number {
    const deviations = sorted.map(v => Math.abs(v - median)).sort((a, b) => a - b);
    return this.getMedian(deviations);
  }
  
  /**
   * Generate explanation for anomaly detection
   */
  generateExplanation(
    input: AnomalyDetectionInput,
    output: AnomalyDetectionOutput
  ): {
    summary: string;
    topDrivers: ExplanationDriver[];
    scenario: string;
  } {
    const drivers: ExplanationDriver[] = [];
    
    for (const anomaly of output.anomalies.slice(0, 3)) {
      const direction = anomaly.direction === 'above' ? 'أعلى' : 'أقل';
      const deviation = Math.abs(anomaly.deviation).toFixed(1);
      
      drivers.push({
        factor: this.getArabicMetricName(anomaly.metric),
        contribution: anomaly.direction === 'above' ? anomaly.score : -anomaly.score,
        direction: anomaly.direction === 'above' ? 'positive' : 'negative',
        description: `القيمة الحالية (${anomaly.currentValue.toFixed(0)}) ${direction} من المتوقع بـ ${deviation} انحراف معياري`,
      });
    }
    
    const summary = this.generateSummary(input, output);
    const scenario = this.generateScenario(input, output);
    
    return { summary, topDrivers: drivers, scenario };
  }
  
  /**
   * Generate summary in Arabic
   */
  private generateSummary(input: AnomalyDetectionInput, output: AnomalyDetectionOutput): string {
    if (!output.isAnomaly) {
      return `لم يتم اكتشاف أي سلوك غير طبيعي. جميع المؤشرات ضمن النطاق المتوقع.`;
    }
    
    const severityArabic = {
      none: 'لا يوجد',
      low: 'منخفضة',
      medium: 'متوسطة',
      high: 'مرتفعة',
      critical: 'حرجة',
    };
    
    return `تم اكتشاف ${output.anomalies.length} حالة شاذة بدرجة خطورة ${severityArabic[output.severity]}. ` +
      `درجة الشذوذ: ${output.anomalyScore}%.`;
  }
  
  /**
   * Generate scenario in Arabic
   */
  private generateScenario(input: AnomalyDetectionInput, output: AnomalyDetectionOutput): string {
    if (!output.isAnomaly) {
      return `✅ الوضع طبيعي. لا حاجة لاتخاذ إجراء.`;
    }
    
    const topAnomaly = output.anomalies[0];
    
    if (output.severity === 'critical') {
      return `🔴 تحذير حرج: ${this.getArabicMetricName(topAnomaly.metric)} ` +
        `${topAnomaly.direction === 'above' ? 'أعلى' : 'أقل'} بشكل غير طبيعي. ` +
        `يتطلب مراجعة فورية.`;
    } else if (output.severity === 'high') {
      return `🟠 تنبيه مهم: سلوك غير معتاد في ${this.getArabicMetricName(topAnomaly.metric)}. ` +
        `يُنصح بالتحقق من السبب.`;
    } else if (output.severity === 'medium') {
      return `🟡 ملاحظة: تغير ملحوظ في ${this.getArabicMetricName(topAnomaly.metric)}. ` +
        `قد يكون طبيعياً أو يستحق المتابعة.`;
    } else {
      return `🔵 معلومة: تغير طفيف في ${this.getArabicMetricName(topAnomaly.metric)}. ` +
        `للعلم فقط.`;
    }
  }
  
  /**
   * Get Arabic metric name
   */
  private getArabicMetricName(metric: string): string {
    const names: Record<string, string> = {
      'daily_sales': 'المبيعات اليومية',
      'order_count': 'عدد الطلبات',
      'average_order_value': 'متوسط قيمة الطلب',
      'return_rate': 'معدل الإرجاع',
      'inventory_turnover': 'دوران المخزون',
      'stock_level': 'مستوى المخزون',
      'customer_count': 'عدد العملاء',
      'conversion_rate': 'معدل التحويل',
    };
    return names[metric] || metric;
  }
  
  /**
   * Run backtest for anomaly detection
   */
  async backtest(
    historicalData: {
      date: Date;
      metrics: Record<string, number>;
      actualAnomaly: boolean;
    }[]
  ): Promise<{
    passed: boolean;
    precision: number;
    recall: number;
    f1Score: number;
    falsePositiveRate: number;
    baselineComparison: number;
  }> {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    let baselineCorrect = 0;
    
    const windowSize = 30;
    
    for (let i = windowSize; i < historicalData.length; i++) {
      const current = historicalData[i];
      const history = historicalData.slice(i - windowSize, i);
      
      // Prepare input
      const metricsInput = Object.keys(current.metrics).map(name => ({
        name,
        currentValue: current.metrics[name],
        historicalValues: history.map(h => h.metrics[name]),
      }));
      
      const prediction = await this.detect({
        entityId: 'backtest',
        entityType: 'product',
        metrics: metricsInput,
      });
      
      const predictedAnomaly = prediction.isAnomaly;
      const actualAnomaly = current.actualAnomaly;
      
      // Simple baseline: 3-sigma rule
      const baselinePrediction = metricsInput.some(m => {
        const mean = m.historicalValues.reduce((a, b) => a + b, 0) / m.historicalValues.length;
        const std = Math.sqrt(m.historicalValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / m.historicalValues.length);
        return Math.abs(m.currentValue - mean) > 3 * std;
      });
      if (baselinePrediction === actualAnomaly) baselineCorrect++;
      
      // Confusion matrix
      if (predictedAnomaly && actualAnomaly) truePositives++;
      else if (predictedAnomaly && !actualAnomaly) falsePositives++;
      else if (!predictedAnomaly && !actualAnomaly) trueNegatives++;
      else falseNegatives++;
    }
    
    const total = truePositives + falsePositives + trueNegatives + falseNegatives;
    const precision = truePositives / (truePositives + falsePositives) * 100 || 0;
    const recall = truePositives / (truePositives + falseNegatives) * 100 || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    const falsePositiveRate = falsePositives / (falsePositives + trueNegatives) * 100 || 0;
    
    const modelAccuracy = (truePositives + trueNegatives) / total * 100;
    const baselineAccuracy = baselineCorrect / total * 100;
    const baselineComparison = ((modelAccuracy - baselineAccuracy) / baselineAccuracy) * 100;
    
    return {
      passed: baselineComparison > 0 && falsePositiveRate < 20,
      precision,
      recall,
      f1Score,
      falsePositiveRate,
      baselineComparison,
    };
  }
}

// Singleton instance
export const anomalyDetectionModel = new AnomalyDetectionModel();
