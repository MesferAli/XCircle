# Atlas MLOps v1 - Governed Decision Intelligence

## نظرة عامة

Atlas MLOps هو نظام ذكاء قرارات محكوم (Governed Decision Intelligence) مصمم للمؤسسات. يوفر قرارات ذكية مع الحفاظ على:

- **Human-in-the-loop**: الإنسان دائماً في حلقة القرار
- **Auditability**: قابلية التدقيق الكامل
- **Policy Enforcement**: تطبيق السياسات
- **Explainability**: قابلية التفسير

---

## البنية المعمارية

```
┌───────────────────────────────┐
│        CONTROL PLANE          │
│  ┌─────────────────────────┐  │
│  │ Model Registry          │  │
│  │ - versions, metrics     │  │
│  │ - approval status       │  │
│  └─────────────▲───────────┘  │
│                │              │
│  ┌─────────────┴───────────┐  │
│  │ Training Orchestrator   │  │
│  │ - scheduled retraining  │  │
│  │ - backtesting           │  │
│  └─────────────▲───────────┘  │
│                │              │
│  ┌─────────────┴───────────┐  │
│  │ Policy & Approval Gate  │  │
│  │ - human approval        │  │
│  │ - canary rollout        │  │
│  └─────────────▲───────────┘  │
│                │              │
│  ┌─────────────┴───────────┐  │
│  │ Decision API            │  │
│  │ (governed output only)  │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
                │
                ▼
┌───────────────────────────────┐
│         DATA PLANE            │
│  ┌─────────────────────────┐  │
│  │ Feature Computation     │  │
│  │ - canonical features    │  │
│  └─────────────▲───────────┘  │
│                │              │
│  ┌─────────────┴───────────┐  │
│  │ Inference Runtime       │  │
│  └─────────────▲───────────┘  │
│                │              │
│  ┌─────────────┴───────────┐  │
│  │ Decision Assembly       │  │
│  │ - explanation           │  │
│  │ - confidence            │  │
│  │ - policy result         │  │
│  │ - audit id              │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

---

## المكونات الرئيسية

### 1. Feature Store

مخزن موحد للـ Features يضمن:
- نفس التعريفات في كل مكان
- لا حسابات عشوائية في النماذج
- تتبع كامل للمصادر

```typescript
import { featureStore } from './mlops';

// الحصول على feature vector
const features = await featureStore.getFeatureVector(
  ['sales_last_30d', 'avg_daily_sales', 'sales_trend'],
  'product_123',
  'product',
  { salesHistory: [...] }
);
```

### 2. Model Registry

سجل مركزي للنماذج مع:
- إصدارات متعددة
- مقاييس الأداء
- حالة الموافقة

```typescript
import { modelRegistry } from './mlops';

// تسجيل نموذج جديد
const model = modelRegistry.registerModel({
  modelName: 'demand_forecasting',
  version: '1.0.0',
  metrics: { mae: 10, baselineComparison: 15 },
  // ...
});

// النموذج يبدأ بحالة 'draft'
// يجب الموافقة عليه قبل النشر
```

### 3. Governance Gate

بوابة الحوكمة تضمن:
- اجتياز الاختبار الرجعي (Backtesting)
- موافقة بشرية
- تطبيق السياسات
- سجل تدقيق كامل

```typescript
import { governanceGate } from './mlops';

// تقديم نموذج للموافقة
const request = await governanceGate.submitForApproval(
  modelVersionId,
  'user@example.com',
  backtestResults
);

// الموافقة (بواسطة إنسان فقط)
governanceGate.approveModel(request.id, 'approver@example.com');
```

---

## النماذج المتاحة

### 1. Demand Forecasting (توقع الطلب)

```typescript
import { demandForecastingModel } from './mlops';

const forecast = await demandForecastingModel.predict({
  productId: 'product_123',
  horizon: 14, // أيام
  salesHistory: [10, 12, 8, 15, ...],
  currentStock: 50,
  leadTimeDays: 7,
  isPromotional: false,
  seasonalityIndex: 1.2,
});

// النتيجة تشمل:
// - forecast: التوقعات اليومية
// - predictionInterval: نطاق الثقة
// - trend: اتجاه المبيعات
// - featureImportance: أهمية العوامل
```

### 2. Stockout Risk (مخاطر نفاد المخزون)

```typescript
import { stockoutRiskModel } from './mlops';

const risk = await stockoutRiskModel.predict({
  productId: 'product_123',
  currentStock: 20,
  avgDailySales: 5,
  salesVariability: 0.2,
  leadTimeDays: 7,
  pendingOrders: 0,
  reorderPoint: 35,
  isSeasonalPeak: false,
  supplierReliability: 0.9,
});

// النتيجة تشمل:
// - risk7Days: احتمالية النفاد خلال 7 أيام
// - risk14Days: احتمالية النفاد خلال 14 يوم
// - risk30Days: احتمالية النفاد خلال 30 يوم
// - overallRisk: المخاطر الإجمالية
```

### 3. Anomaly Detection (كشف الشذوذ)

```typescript
import { anomalyDetectionModel } from './mlops';

const anomaly = await anomalyDetectionModel.detect({
  entityId: 'product_123',
  entityType: 'product',
  metrics: [{
    name: 'daily_sales',
    currentValue: 150,
    historicalValues: [100, 102, 98, ...],
  }],
});

// النتيجة تشمل:
// - isAnomaly: هل يوجد شذوذ
// - anomalyScore: درجة الشذوذ
// - severity: شدة الشذوذ
// - anomalies: تفاصيل الحالات الشاذة
```

---

## Decision API

الـ API الرئيسي للحصول على قرارات محكومة:

```typescript
import { decisionAPI } from './mlops';

const decision = await decisionAPI.getDecision({
  useCase: 'demand_forecast', // أو 'stockout_risk' أو 'anomaly_detection'
  entityId: 'product_123',
  entityType: 'product',
  requestedBy: 'user@example.com',
  context: {
    horizon: 14,
    salesHistory: [...],
    currentStock: 50,
  },
});
```

### الاستجابة تشمل دائماً:

| الحقل | الوصف |
|-------|-------|
| `auditId` | معرف فريد للتدقيق |
| `recommendation` | التوصية (نص + أولوية) |
| `confidence` | مستوى الثقة (0-100) |
| `explanation` | التفسير (ملخص + العوامل الرئيسية) |
| `policyResult` | نتيجة السياسات المطبقة |
| `timestamp` | وقت القرار |

### ما لا يُعرض أبداً:

- اسم النموذج
- نوع الخوارزمية
- التوقعات الخام
- أوامر التنفيذ

---

## Monitoring & Drift Detection

مراقبة مستمرة للنظام:

```typescript
import { monitoringService } from './mlops';

// تعيين خط الأساس
monitoringService.setBaseline('sales_feature', historicalValues);

// تحديث البيانات الحالية
monitoringService.updateCurrent('sales_feature', currentValues);

// فحص الانحراف
const drift = monitoringService.checkDataDrift('sales_feature');

// فحص صحة النظام
const health = await monitoringService.runHealthCheck();
```

---

## السياسات الافتراضية

| السياسة | الوصف |
|---------|-------|
| `policy_baseline_improvement` | النموذج يجب أن يكون أفضل من الأساس |
| `policy_stability` | التفسيرات يجب أن تكون مستقرة |
| `policy_backtesting` | النموذج يجب أن يجتاز الاختبار الرجعي |

---

## Fail-Safe Mechanism

في حالة فشل النموذج أو انحراف البيانات:

1. يتم الرجوع للمنطق القاعدي (Rule-based)
2. يتم إبلاغ المستخدم بشفافية
3. يتم تسجيل الحدث في سجل التدقيق

---

## خارج النطاق (لا يتم تنفيذه)

- LLMs (نماذج اللغة الكبيرة)
- Reinforcement Learning
- Online Learning
- التنفيذ التلقائي
- APIs حرة للذكاء الاصطناعي

---

## معايير القبول

يُقبل Atlas MLOps فقط إذا:

1. القرارات تتفوق على الأساس القاعدي
2. التفسيرات مفهومة للمستخدمين غير التقنيين
3. النماذج مُصدّرة ومُوافق عليها وقابلة للتدقيق
4. التنفيذ التلقائي مستحيل
5. التكامل بسيط

---

## الملفات والهيكلية

```
server/mlops/
├── types.ts                    # الأنواع الأساسية
├── index.ts                    # نقطة الدخول
├── feature-store/
│   └── index.ts               # Feature Store
├── model-registry/
│   └── index.ts               # Model Registry
├── governance/
│   └── index.ts               # Governance Gate
├── models/
│   ├── demand-forecasting/
│   │   └── index.ts           # نموذج توقع الطلب
│   ├── stockout-risk/
│   │   └── index.ts           # نموذج مخاطر النفاد
│   └── anomaly-detection/
│       └── index.ts           # نموذج كشف الشذوذ
├── decision-api/
│   └── index.ts               # Decision API
├── monitoring/
│   └── index.ts               # Monitoring & Drift
└── __tests__/
    └── mlops.test.ts          # الاختبارات
```

---

## الخطوات التالية

1. **تكامل مع قاعدة البيانات**: حفظ Feature Store و Model Registry في قاعدة بيانات
2. **تكامل مع Sentry**: ربط التنبيهات مع نظام المراقبة
3. **واجهة المستخدم**: بناء لوحة تحكم للموافقات والمراقبة
4. **نماذج متقدمة**: استبدال النماذج الإحصائية بـ LightGBM/XGBoost
