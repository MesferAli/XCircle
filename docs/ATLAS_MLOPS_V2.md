# Atlas MLOps v2 - Complete Documentation

## نظرة عامة

Atlas MLOps v2 هو نظام ذكاء قرارات محكوم (Governed Decision Intelligence) متكامل يوفر:

- **Human-in-the-loop**: الإنسان دائماً في حلقة القرار
- **Database Integration**: تخزين دائم في PostgreSQL
- **Sentry Integration**: مراقبة وتنبيهات متقدمة
- **Advanced ML Models**: LightGBM, XGBoost, Isolation Forest
- **Dashboard UI**: لوحة تحكم للموافقات والمراقبة

---

## البنية المعمارية

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           MLOps Dashboard (React)                       │ │
│  │  - Model Registry View                                  │ │
│  │  - Approval Workflow                                    │ │
│  │  - Drift Monitoring                                     │ │
│  │  - Alert Management                                     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           MLOps Routes (Express)                        │ │
│  │  POST /api/mlops/decisions                              │ │
│  │  GET  /api/mlops/models                                 │ │
│  │  POST /api/mlops/approvals                              │ │
│  │  GET  /api/mlops/drift                                  │ │
│  │  GET  /api/mlops/alerts                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Decision API │  │ Governance   │  │ Monitoring       │   │
│  │              │  │ Gate         │  │ Service          │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Feature      │  │ Model        │  │ Sentry           │   │
│  │ Store        │  │ Registry     │  │ Integration      │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      ML LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ LightGBM     │  │ XGBoost      │  │ Isolation        │   │
│  │ Demand       │  │ Stockout     │  │ Forest           │   │
│  │ Forecasting  │  │ Risk         │  │ Anomaly          │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Python Bridge (child_process)              │ │
│  │  - demand_lightgbm.py                                   │ │
│  │  - stockout_xgboost.py                                  │ │
│  │  - anomaly_iforest.py                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL (Drizzle ORM)                   │ │
│  │  - feature_definitions                                  │ │
│  │  - feature_values                                       │ │
│  │  - model_versions                                       │ │
│  │  - approval_requests                                    │ │
│  │  - decision_logs                                        │ │
│  │  - drift_metrics                                        │ │
│  │  - monitoring_alerts                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## الملفات والهيكلية

```
server/mlops/
├── types.ts                          # الأنواع الأساسية
├── index.ts                          # نقطة الدخول الرئيسية
├── routes.ts                         # API Routes
│
├── feature-store/
│   └── index.ts                      # Feature Store
│
├── model-registry/
│   └── index.ts                      # Model Registry
│
├── governance/
│   └── index.ts                      # Governance Gate
│
├── decision-api/
│   └── index.ts                      # Decision API
│
├── monitoring/
│   └── index.ts                      # Monitoring & Drift
│
├── storage/
│   └── db-storage.ts                 # Database Storage Layer
│
├── integrations/
│   └── sentry-integration.ts         # Sentry Integration
│
├── models/
│   ├── demand-forecasting/           # Statistical Model
│   ├── stockout-risk/                # Statistical Model
│   ├── anomaly-detection/            # Statistical Model
│   └── advanced/
│       ├── ml-models.ts              # LightGBM/XGBoost/IForest
│       ├── python/
│       │   ├── demand_lightgbm.py
│       │   ├── stockout_xgboost.py
│       │   ├── anomaly_iforest.py
│       │   └── requirements.txt
│       └── artifacts/                # Model artifacts
│
└── __tests__/
    └── mlops.test.ts                 # Unit Tests

shared/
└── mlops-schema.ts                   # Database Schema

client/src/pages/
└── mlops-dashboard.tsx               # Dashboard UI
```

---

## قاعدة البيانات

### الجداول

| الجدول | الوصف |
|--------|-------|
| `feature_definitions` | تعريفات الـ Features |
| `feature_values` | قيم الـ Features المحسوبة |
| `model_versions` | إصدارات النماذج |
| `approval_requests` | طلبات الموافقة |
| `ml_policies` | سياسات الحوكمة |
| `decision_logs` | سجل القرارات |
| `drift_metrics` | مقاييس الانحراف |
| `monitoring_alerts` | تنبيهات المراقبة |
| `training_jobs` | مهام التدريب |
| `feature_baselines` | خطوط الأساس |

### Migration

```bash
# Generate migration
npx drizzle-kit generate:pg

# Apply migration
npx drizzle-kit push:pg
```

---

## API Endpoints

### Decision API

```http
POST /api/mlops/decisions
Content-Type: application/json

{
  "useCase": "demand_forecast",
  "entityId": "product_123",
  "entityType": "product",
  "context": {
    "horizon": 14,
    "salesHistory": [10, 12, 8, 15, ...],
    "currentStock": 50
  }
}
```

**Response:**
```json
{
  "auditId": "uuid",
  "recommendation": {
    "action": "reorder",
    "priority": "high",
    "message": "يُنصح بإعادة الطلب"
  },
  "confidence": {
    "score": 85,
    "level": "high"
  },
  "explanation": {
    "summary": "...",
    "topDrivers": [...]
  },
  "policyResult": {
    "allowed": true,
    "appliedPolicies": [...]
  }
}
```

### Model Registry

```http
GET /api/mlops/models
GET /api/mlops/models/:id
POST /api/mlops/models
GET /api/mlops/models/stats
```

### Approvals

```http
GET /api/mlops/approvals
POST /api/mlops/approvals
POST /api/mlops/approvals/:id/approve
POST /api/mlops/approvals/:id/reject
```

### Monitoring

```http
GET /api/mlops/drift
POST /api/mlops/drift/check
GET /api/mlops/alerts
POST /api/mlops/alerts/:id/acknowledge
GET /api/mlops/health
```

---

## Sentry Integration

### التنبيهات المدعومة

| النوع | الوصف |
|-------|-------|
| `drift_detected` | اكتشاف انحراف في البيانات |
| `model_performance_degradation` | تدهور أداء النموذج |
| `approval_required` | طلب موافقة جديد |
| `approval_granted` | تمت الموافقة |
| `approval_rejected` | تم الرفض |
| `fallback_triggered` | تفعيل الآلية البديلة |
| `policy_violation` | انتهاك سياسة |
| `training_failed` | فشل التدريب |

### الاستخدام

```typescript
import { sentryMLOps } from './integrations/sentry-integration';

// Track drift
sentryMLOps.trackDriftDetected(tenantId, 'sales_feature', 25.5, 'medium');

// Track approval
sentryMLOps.trackApprovalEvent(tenantId, 'demand_model', '1.2.0', 'approved', userId);

// Track fallback
sentryMLOps.trackFallbackTriggered(tenantId, 'demand_forecast', 'Model timeout', entityId);
```

---

## النماذج المتقدمة

### LightGBM Demand Forecasting

```typescript
import { lightGBMDemandModel } from './models/advanced/ml-models';

const forecast = await lightGBMDemandModel.predict({
  productId: 'product_123',
  horizon: 14,
  salesHistory: [...],
  currentStock: 50,
  leadTimeDays: 7,
  isPromotional: false,
  seasonalityIndex: 1.2,
});
```

### XGBoost Stockout Risk

```typescript
import { xgboostStockoutModel } from './models/advanced/ml-models';

const risk = await xgboostStockoutModel.predict({
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
```

### Isolation Forest Anomaly Detection

```typescript
import { isolationForestModel } from './models/advanced/ml-models';

const anomaly = await isolationForestModel.detect({
  entityId: 'product_123',
  entityType: 'product',
  metrics: [{
    name: 'daily_sales',
    currentValue: 150,
    historicalValues: [100, 102, 98, ...],
  }],
});
```

---

## Python Dependencies

```bash
# Install Python dependencies
cd server/mlops/models/advanced/python
pip install -r requirements.txt
```

**requirements.txt:**
- numpy>=1.24.0
- pandas>=2.0.0
- scikit-learn>=1.3.0
- lightgbm>=4.0.0
- xgboost>=2.0.0

---

## لوحة التحكم (Dashboard)

### الميزات

1. **نظرة عامة**: إحصائيات النماذج والقرارات
2. **الموافقات**: مراجعة وموافقة/رفض النماذج
3. **سجل النماذج**: جميع إصدارات النماذج
4. **مراقبة الانحراف**: تتبع drift في البيانات
5. **التنبيهات**: إدارة التنبيهات

### الوصول

```
/mlops-dashboard
```

---

## الاختبارات

```bash
# Run all MLOps tests
npx vitest run server/mlops/

# Run specific tests
npx vitest run server/mlops/__tests__/mlops.test.ts
npx vitest run server/mlops/models/advanced/__tests__/
```

**النتائج:**
- 32 اختبار
- 100% نجاح

---

## التكامل مع التطبيق

### إضافة Routes

```typescript
// server/routes.ts
import mlopsRoutes from './mlops/routes';

app.use('/api/mlops', mlopsRoutes);
```

### إضافة الصفحة للـ Router

```typescript
// client/src/App.tsx
import MLOpsDashboard from './pages/mlops-dashboard';

<Route path="/mlops-dashboard" component={MLOpsDashboard} />
```

---

## الخطوات التالية

1. **تشغيل Migrations**: تطبيق schema على قاعدة البيانات
2. **تثبيت Python Dependencies**: لتفعيل النماذج المتقدمة
3. **تكوين Sentry DSN**: في ملف `.env`
4. **اختبار End-to-End**: مع بيانات حقيقية
5. **تدريب النماذج**: على بيانات العملاء
