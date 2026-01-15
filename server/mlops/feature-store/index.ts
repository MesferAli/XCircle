/**
 * Atlas MLOps - Feature Store
 * 
 * Centralized feature management ensuring:
 * - Same features, same meaning, everywhere
 * - No ad-hoc feature computation in models
 * - Full traceability and versioning
 */

import { FeatureDefinition, FeatureValue } from '../types';

// ============================================
// Feature Definitions (Canonical)
// ============================================

export const FEATURE_DEFINITIONS: Record<string, FeatureDefinition> = {
  // Demand Features
  'sales_last_7d': {
    name: 'sales_last_7d',
    description: 'إجمالي المبيعات في آخر 7 أيام',
    source: 'computed',
    dataType: 'numeric',
    refreshFrequency: 'daily',
    owner: 'analytics',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'sales_last_30d': {
    name: 'sales_last_30d',
    description: 'إجمالي المبيعات في آخر 30 يوم',
    source: 'computed',
    dataType: 'numeric',
    refreshFrequency: 'daily',
    owner: 'analytics',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'avg_daily_sales': {
    name: 'avg_daily_sales',
    description: 'متوسط المبيعات اليومية',
    source: 'computed',
    dataType: 'numeric',
    refreshFrequency: 'daily',
    owner: 'analytics',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'sales_trend': {
    name: 'sales_trend',
    description: 'اتجاه المبيعات (موجب = تصاعدي، سالب = تنازلي)',
    source: 'computed',
    dataType: 'numeric',
    refreshFrequency: 'daily',
    owner: 'analytics',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'seasonality_index': {
    name: 'seasonality_index',
    description: 'مؤشر الموسمية (1 = عادي، >1 = موسم مرتفع)',
    source: 'computed',
    dataType: 'numeric',
    refreshFrequency: 'weekly',
    owner: 'analytics',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  
  // Inventory Features
  'current_stock': {
    name: 'current_stock',
    description: 'الكمية الحالية في المخزون',
    source: 'salla',
    dataType: 'numeric',
    refreshFrequency: 'realtime',
    owner: 'inventory',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'days_of_stock': {
    name: 'days_of_stock',
    description: 'عدد أيام المخزون المتبقية بناءً على معدل البيع',
    source: 'computed',
    dataType: 'numeric',
    refreshFrequency: 'daily',
    owner: 'inventory',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'reorder_point': {
    name: 'reorder_point',
    description: 'نقطة إعادة الطلب المحسوبة',
    source: 'computed',
    dataType: 'numeric',
    refreshFrequency: 'weekly',
    owner: 'inventory',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'lead_time_days': {
    name: 'lead_time_days',
    description: 'وقت التوريد بالأيام',
    source: 'erp',
    dataType: 'numeric',
    refreshFrequency: 'weekly',
    owner: 'procurement',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  
  // Product Features
  'product_category': {
    name: 'product_category',
    description: 'تصنيف المنتج',
    source: 'salla',
    dataType: 'categorical',
    refreshFrequency: 'daily',
    owner: 'catalog',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'product_price': {
    name: 'product_price',
    description: 'سعر المنتج الحالي',
    source: 'salla',
    dataType: 'numeric',
    refreshFrequency: 'realtime',
    owner: 'pricing',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'is_promotional': {
    name: 'is_promotional',
    description: 'هل المنتج في عرض ترويجي',
    source: 'salla',
    dataType: 'boolean',
    refreshFrequency: 'realtime',
    owner: 'marketing',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  
  // Time Features
  'day_of_week': {
    name: 'day_of_week',
    description: 'يوم الأسبوع (0-6)',
    source: 'computed',
    dataType: 'numeric',
    refreshFrequency: 'realtime',
    owner: 'system',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'is_weekend': {
    name: 'is_weekend',
    description: 'هل اليوم عطلة نهاية الأسبوع',
    source: 'computed',
    dataType: 'boolean',
    refreshFrequency: 'realtime',
    owner: 'system',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  'month': {
    name: 'month',
    description: 'الشهر (1-12)',
    source: 'computed',
    dataType: 'numeric',
    refreshFrequency: 'realtime',
    owner: 'system',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};

// ============================================
// Feature Store Class
// ============================================

export class FeatureStore {
  private cache: Map<string, FeatureValue> = new Map();
  
  /**
   * Get feature definition
   */
  getDefinition(featureName: string): FeatureDefinition | undefined {
    return FEATURE_DEFINITIONS[featureName];
  }
  
  /**
   * Get all feature definitions
   */
  getAllDefinitions(): FeatureDefinition[] {
    return Object.values(FEATURE_DEFINITIONS);
  }
  
  /**
   * Compute feature value for an entity
   */
  async computeFeature(
    featureName: string,
    entityId: string,
    entityType: 'product' | 'order' | 'customer' | 'store',
    context: Record<string, any>
  ): Promise<FeatureValue> {
    const definition = this.getDefinition(featureName);
    if (!definition) {
      throw new Error(`Feature not defined: ${featureName}`);
    }
    
    // Check cache
    const cacheKey = `${featureName}:${entityType}:${entityId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && this.isFresh(cached, definition)) {
      return cached;
    }
    
    // Compute based on source
    let value: number | string | boolean;
    
    switch (featureName) {
      case 'sales_last_7d':
        value = context.salesHistory?.slice(-7).reduce((a: number, b: number) => a + b, 0) || 0;
        break;
      case 'sales_last_30d':
        value = context.salesHistory?.slice(-30).reduce((a: number, b: number) => a + b, 0) || 0;
        break;
      case 'avg_daily_sales':
        const sales30d = context.salesHistory?.slice(-30) || [];
        value = sales30d.length > 0 ? sales30d.reduce((a: number, b: number) => a + b, 0) / sales30d.length : 0;
        break;
      case 'sales_trend':
        value = this.computeTrend(context.salesHistory || []);
        break;
      case 'days_of_stock':
        const avgSales = context.avgDailySales || 1;
        value = avgSales > 0 ? (context.currentStock || 0) / avgSales : 999;
        break;
      case 'day_of_week':
        value = new Date().getDay();
        break;
      case 'is_weekend':
        const day = new Date().getDay();
        value = day === 5 || day === 6; // Friday & Saturday in Saudi
        break;
      case 'month':
        value = new Date().getMonth() + 1;
        break;
      default:
        value = context[featureName] ?? 0;
    }
    
    const featureValue: FeatureValue = {
      featureName,
      entityId,
      entityType,
      value,
      computedAt: new Date(),
      version: 1,
    };
    
    // Cache
    this.cache.set(cacheKey, featureValue);
    
    return featureValue;
  }
  
  /**
   * Get feature vector for ML model
   */
  async getFeatureVector(
    featureNames: string[],
    entityId: string,
    entityType: 'product' | 'order' | 'customer' | 'store',
    context: Record<string, any>
  ): Promise<Record<string, number | string | boolean>> {
    const vector: Record<string, number | string | boolean> = {};
    
    for (const name of featureNames) {
      const feature = await this.computeFeature(name, entityId, entityType, context);
      vector[name] = feature.value;
    }
    
    return vector;
  }
  
  /**
   * Check if cached value is still fresh
   */
  private isFresh(cached: FeatureValue, definition: FeatureDefinition): boolean {
    const now = new Date();
    const age = now.getTime() - cached.computedAt.getTime();
    
    switch (definition.refreshFrequency) {
      case 'realtime':
        return age < 60 * 1000; // 1 minute
      case 'hourly':
        return age < 60 * 60 * 1000; // 1 hour
      case 'daily':
        return age < 24 * 60 * 60 * 1000; // 1 day
      case 'weekly':
        return age < 7 * 24 * 60 * 60 * 1000; // 1 week
      default:
        return false;
    }
  }
  
  /**
   * Compute trend from time series
   */
  private computeTrend(series: number[]): number {
    if (series.length < 2) return 0;
    
    const n = series.length;
    const recent = series.slice(-7);
    const older = series.slice(-14, -7);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    if (olderAvg === 0) return 0;
    
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const featureStore = new FeatureStore();
