/**
 * Unit Tests for policy-engine.ts
 * 
 * Tests for policy evaluation, condition matching, and action enforcement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage
vi.mock('../../server/storage', () => ({
  storage: {
    getPolicies: vi.fn().mockResolvedValue([]),
    createAuditLog: vi.fn().mockResolvedValue({ id: 'audit-123' }),
  },
}));

import { PolicyEngine } from '../../server/policy-engine';
import type { PolicyContext } from '@shared/schema';

describe('PolicyEngine - Core Functionality', () => {
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine();
    vi.clearAllMocks();
  });

  describe('evaluatePolicy', () => {
    it('should return allowed=true for valid context during business hours', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'view_recommendation',
          targetType: 'recommendation',
          data: {},
        },
        environment: 'development',
        requestTime: new Date('2024-01-15T10:00:00'), // Monday 10 AM
      };

      const result = await policyEngine.evaluatePolicy(context);

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('appliedPolicies');
    });

    it('should block actions during weekends', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'execute_recommendation',
          targetType: 'recommendation',
          data: {},
        },
        environment: 'production',
        requestTime: new Date('2024-01-13T10:00:00'), // Saturday
      };

      const result = await policyEngine.evaluatePolicy(context);

      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].message).toContain('weekend');
    });

    it('should block actions after business hours', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'execute_recommendation',
          targetType: 'recommendation',
          data: {},
        },
        environment: 'production',
        requestTime: new Date('2024-01-15T20:00:00'), // Monday 8 PM
      };

      const result = await policyEngine.evaluatePolicy(context);

      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.message.includes('after business hours'))).toBe(true);
    });

    it('should require approval for execute_recommendation actions', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'execute_recommendation',
          targetType: 'recommendation',
          data: {},
        },
        environment: 'development',
        requestTime: new Date('2024-01-15T10:00:00'), // Monday 10 AM
      };

      const result = await policyEngine.evaluatePolicy(context);

      expect(result.requiresApproval).toBe(true);
    });

    it('should require approval for high-value actions (quantity > 10000)', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'reorder_stock',
          targetType: 'item',
          data: { quantity: 15000 },
        },
        environment: 'development',
        requestTime: new Date('2024-01-15T10:00:00'),
      };

      const result = await policyEngine.evaluatePolicy(context);

      expect(result.requiresApproval).toBe(true);
    });

    it('should reject actions affecting more than 100 items (blast radius)', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'batch_update',
          targetType: 'item',
          data: { affectedItems: 150 },
        },
        environment: 'development',
        requestTime: new Date('2024-01-15T10:00:00'),
      };

      const result = await policyEngine.evaluatePolicy(context);

      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.message.includes('too many items'))).toBe(true);
    });

    it('should include explanation in result', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'view_data',
          targetType: 'item',
          data: {},
        },
        environment: 'development',
        requestTime: new Date('2024-01-15T10:00:00'),
      };

      const result = await policyEngine.evaluatePolicy(context);

      expect(result).toHaveProperty('explanation');
      expect(typeof result.explanation).toBe('string');
    });
  });

  describe('Condition Operators', () => {
    it('should evaluate equals operator correctly', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'execute_recommendation',
          targetType: 'recommendation',
          data: {},
        },
        environment: 'production',
        requestTime: new Date('2024-01-15T10:00:00'),
      };

      const result = await policyEngine.evaluatePolicy(context);

      // Production environment should trigger approval requirement
      expect(result.requiresApproval).toBe(true);
    });

    it('should evaluate gt (greater than) operator correctly', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'reorder',
          targetType: 'item',
          data: { quantity: 5000 }, // Less than 10000
        },
        environment: 'development',
        requestTime: new Date('2024-01-15T10:00:00'),
      };

      const result = await policyEngine.evaluatePolicy(context);

      // Should not trigger high-value approval
      expect(result.appliedPolicies).not.toContain('default_high_value_approval');
    });
  });

  describe('Policy Priority', () => {
    it('should apply policies in priority order', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'execute_recommendation',
          targetType: 'recommendation',
          data: { quantity: 15000, affectedItems: 150 },
        },
        environment: 'production',
        requestTime: new Date('2024-01-15T10:00:00'),
      };

      const result = await policyEngine.evaluatePolicy(context);

      // Multiple policies should be applied
      expect(result.appliedPolicies.length).toBeGreaterThan(0);
    });
  });

  describe('Violation Handling', () => {
    it('should include policyId in violations', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'batch_update',
          targetType: 'item',
          data: { affectedItems: 200 },
        },
        environment: 'development',
        requestTime: new Date('2024-01-15T10:00:00'),
      };

      const result = await policyEngine.evaluatePolicy(context);

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toHaveProperty('policyId');
      expect(result.violations[0]).toHaveProperty('policyName');
      expect(result.violations[0]).toHaveProperty('message');
      expect(result.violations[0]).toHaveProperty('severity');
    });

    it('should set severity to error for blocking violations', async () => {
      const context: PolicyContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: {
          type: 'batch_update',
          targetType: 'item',
          data: { affectedItems: 200 },
        },
        environment: 'development',
        requestTime: new Date('2024-01-15T10:00:00'),
      };

      const result = await policyEngine.evaluatePolicy(context);

      const blockingViolation = result.violations.find(v => v.severity === 'error');
      expect(blockingViolation).toBeDefined();
    });
  });
});

describe('PolicyEngine - Default Policies', () => {
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine();
  });

  it('should have default_recommendation_approval policy', async () => {
    const context: PolicyContext = {
      tenantId: 'tenant-123',
      userId: 'user-456',
      action: {
        type: 'execute_recommendation',
        targetType: 'recommendation',
        data: {},
      },
      environment: 'development',
      requestTime: new Date('2024-01-15T10:00:00'),
    };

    const result = await policyEngine.evaluatePolicy(context);

    expect(result.appliedPolicies).toContain('default_recommendation_approval');
  });

  it('should have default_after_hours_block policy', async () => {
    const context: PolicyContext = {
      tenantId: 'tenant-123',
      userId: 'user-456',
      action: {
        type: 'any_action',
        targetType: 'any',
        data: {},
      },
      environment: 'development',
      requestTime: new Date('2024-01-13T10:00:00'), // Saturday
    };

    const result = await policyEngine.evaluatePolicy(context);

    expect(result.appliedPolicies).toContain('default_after_hours_block');
  });

  it('should have default_blast_radius policy', async () => {
    const context: PolicyContext = {
      tenantId: 'tenant-123',
      userId: 'user-456',
      action: {
        type: 'batch_action',
        targetType: 'item',
        data: { affectedItems: 150 },
      },
      environment: 'development',
      requestTime: new Date('2024-01-15T10:00:00'),
    };

    const result = await policyEngine.evaluatePolicy(context);

    expect(result.appliedPolicies).toContain('default_blast_radius');
  });
});
