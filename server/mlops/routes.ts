/**
 * Atlas MLOps - API Routes
 * 
 * REST API endpoints for MLOps dashboard
 */

import { Router } from 'express';
import { z } from 'zod';
import { decisionAPI } from './decision-api';
import { modelRegistry } from './model-registry';
import { governanceGate } from './governance';
import { featureStore } from './feature-store';
import { monitoringService } from './monitoring';
import {
  modelRegistryStorage,
  governanceStorage,
  decisionLogStorage,
  monitoringStorage,
} from './storage/db-storage';
import { sentryMLOps } from './integrations/sentry-integration';

const router = Router();

// ============================================
// Decision API
// ============================================

/**
 * POST /api/mlops/decisions
 * Get a governed decision
 */
router.post('/decisions', async (req, res) => {
  try {
    const { useCase, entityId, entityType, context } = req.body;
    const user = (req as any).user;

    if (!useCase || !entityId || !entityType) {
      return res.status(400).json({ error: 'Missing required fields: useCase, entityId, entityType' });
    }

    const decision = await decisionAPI.getDecision({
      useCase,
      entityId,
      entityType,
      requestedBy: user?.email || 'anonymous',
      context: context || {},
    });

    // Track decision in Sentry
    sentryMLOps.trackDecision(
      user?.tenantId || 'unknown',
      decision.auditId,
      useCase,
      entityId,
      decision.confidence.score,
      decision.isFallback || false
    );

    res.json(decision);
  } catch (error: any) {
    console.error('[MLOps] Decision error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mlops/decisions/:auditId
 * Get decision by audit ID
 */
router.get('/decisions/:auditId', async (req, res) => {
  try {
    const { auditId } = req.params;
    const decision = await decisionLogStorage.getDecision(auditId);

    if (!decision) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    res.json(decision);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mlops/decisions/stats
 * Get decision statistics
 */
router.get('/decisions/stats', async (req, res) => {
  try {
    const user = (req as any).user;
    const days = parseInt(req.query.days as string) || 30;

    const stats = await decisionLogStorage.getStats(user?.tenantId || 'default', days);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Model Registry
// ============================================

/**
 * GET /api/mlops/models
 * List all model versions
 */
router.get('/models', async (req, res) => {
  try {
    const { modelName, status } = req.query;

    let models;
    if (modelName) {
      models = await modelRegistryStorage.getModelVersions(modelName as string);
    } else {
      // Get all models - need to implement this
      models = modelRegistry.getAllModels();
    }

    if (status) {
      models = models.filter((m: any) => m.approvalStatus === status);
    }

    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mlops/models/:id
 * Get model version by ID
 */
router.get('/models/:id', async (req, res) => {
  try {
    const model = await modelRegistryStorage.getModelVersion(req.params.id);

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    res.json(model);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mlops/models
 * Register new model version
 */
router.post('/models', async (req, res) => {
  try {
    const model = modelRegistry.registerModel(req.body);
    res.status(201).json(model);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/mlops/models/stats
 * Get registry statistics
 */
router.get('/models/stats', async (req, res) => {
  try {
    const stats = await modelRegistryStorage.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Approvals (Governance)
// ============================================

/**
 * GET /api/mlops/approvals
 * List approval requests
 */
router.get('/approvals', async (req, res) => {
  try {
    const { status } = req.query;

    let requests;
    if (status === 'pending') {
      requests = await governanceStorage.getPendingRequests();
    } else {
      requests = governanceGate.getAllRequests();
    }

    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mlops/approvals
 * Submit model for approval
 */
router.post('/approvals', async (req, res) => {
  try {
    const { modelVersionId, backtestResults } = req.body;
    const user = (req as any).user;

    const request = await governanceGate.submitForApproval(
      modelVersionId,
      user?.email || 'anonymous',
      backtestResults
    );

    // Track in Sentry
    const model = modelRegistry.getModel(modelVersionId);
    if (model) {
      sentryMLOps.trackApprovalEvent(
        user?.tenantId || 'unknown',
        model.modelName,
        model.version,
        'requested',
        user?.email || 'anonymous'
      );
    }

    res.status(201).json(request);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/mlops/approvals/:id/approve
 * Approve a model
 */
router.post('/approvals/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const user = (req as any).user;

    const request = governanceGate.getRequest(id);
    if (!request) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    governanceGate.approveModel(id, user?.email || 'anonymous');

    // Update in storage
    await governanceStorage.updateApprovalRequest(id, 'approved', user?.email || 'anonymous', comments);

    // Track in Sentry
    const model = modelRegistry.getModel(request.modelVersionId);
    if (model) {
      sentryMLOps.trackApprovalEvent(
        user?.tenantId || 'unknown',
        model.modelName,
        model.version,
        'approved',
        user?.email || 'anonymous',
        comments
      );
    }

    res.json({ success: true, message: 'Model approved' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/mlops/approvals/:id/reject
 * Reject a model
 */
router.post('/approvals/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const user = (req as any).user;

    const request = governanceGate.getRequest(id);
    if (!request) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    governanceGate.rejectModel(id, user?.email || 'anonymous', comments);

    // Update in storage
    await governanceStorage.updateApprovalRequest(id, 'rejected', user?.email || 'anonymous', comments);

    // Track in Sentry
    const model = modelRegistry.getModel(request.modelVersionId);
    if (model) {
      sentryMLOps.trackApprovalEvent(
        user?.tenantId || 'unknown',
        model.modelName,
        model.version,
        'rejected',
        user?.email || 'anonymous',
        comments
      );
    }

    res.json({ success: true, message: 'Model rejected' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Policies
// ============================================

/**
 * GET /api/mlops/policies
 * List all policies
 */
router.get('/policies', async (req, res) => {
  try {
    const policies = await governanceStorage.getPolicies();
    res.json(policies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mlops/policies
 * Create or update policy
 */
router.post('/policies', async (req, res) => {
  try {
    const policy = await governanceStorage.upsertPolicy(req.body);
    res.status(201).json(policy);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Monitoring
// ============================================

/**
 * GET /api/mlops/drift
 * Get drift metrics
 */
router.get('/drift', async (req, res) => {
  try {
    const user = (req as any).user;
    const { featureName, limit } = req.query;

    const metrics = await monitoringStorage.getDriftHistory(
      user?.tenantId || 'default',
      featureName as string,
      parseInt(limit as string) || 100
    );

    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mlops/drift/check
 * Check drift for a feature
 */
router.post('/drift/check', async (req, res) => {
  try {
    const { featureName, currentValues } = req.body;
    const user = (req as any).user;

    // Update current values
    monitoringService.updateCurrent(featureName, currentValues);

    // Check drift
    const result = monitoringService.checkDataDrift(featureName);

    // Track if drift detected
    if (result.hasDrift && result.severity !== 'none') {
      sentryMLOps.trackDriftDetected(
        user?.tenantId || 'unknown',
        featureName,
        result.driftScore,
        result.severity as 'low' | 'medium' | 'high'
      );
    }

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/mlops/alerts
 * Get monitoring alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const user = (req as any).user;
    const alerts = await monitoringStorage.getActiveAlerts(user?.tenantId || 'default');
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mlops/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    await monitoringStorage.acknowledgeAlert(id, user?.email || 'anonymous');
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/mlops/health
 * Health check
 */
router.get('/health', async (req, res) => {
  try {
    const health = await monitoringService.runHealthCheck();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Features
// ============================================

/**
 * GET /api/mlops/features
 * List feature definitions
 */
router.get('/features', async (req, res) => {
  try {
    const definitions = featureStore.getAllDefinitions();
    res.json(definitions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mlops/features/compute
 * Compute feature for entity
 */
router.post('/features/compute', async (req, res) => {
  try {
    const { featureName, entityId, entityType, context } = req.body;

    const feature = await featureStore.computeFeature(
      featureName,
      entityId,
      entityType,
      context || {}
    );

    res.json(feature);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/mlops/features/vector
 * Get feature vector for entity
 */
router.post('/features/vector', async (req, res) => {
  try {
    const { featureNames, entityId, entityType, context } = req.body;

    const vector = await featureStore.getFeatureVector(
      featureNames,
      entityId,
      entityType,
      context || {}
    );

    res.json(vector);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
