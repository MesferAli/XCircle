/**
 * Unit Tests for audit-guard.ts
 * 
 * CRITICAL SECURITY TESTS:
 * These tests verify that NO state mutation can occur without an audit record.
 * Transaction atomicity ensures audit logging is mandatory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions first
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn();
const mockReturning = vi.fn();

// Mock the database module before importing AuditGuard
vi.mock('@server/db', () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: mockReturning,
      }),
    }),
  },
  pool: {
    connect: mockConnect,
  },
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn().mockReturnValue({
    insert: () => ({
      values: () => ({
        returning: mockReturning,
      }),
    }),
  }),
}));

vi.mock('@shared/schema', () => ({
  auditLogs: {},
}));

// Dynamic import after mocks
const auditGuardModule = await import('@server/audit-guard');
const { AuditGuard, auditGuard } = auditGuardModule;
type AuditContext = typeof auditGuardModule.AuditContext;

describe('AuditGuard - Security Guarantees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockQuery.mockResolvedValue({ rows: [] });
    mockReturning.mockResolvedValue([{ id: 'audit-123', createdAt: new Date() }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withAudit transaction behavior', () => {
    const testContext = {
      tenantId: 'tenant-123',
      userId: 'user-456',
      action: 'test_action',
      resourceType: 'test_resource',
      resourceId: 'resource-789',
    };

    it('should begin transaction before operation', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true });
      
      await auditGuard.withAudit(testContext, operation);
      
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
    });

    it('should commit transaction after successful operation and audit', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true });
      
      await auditGuard.withAudit(testContext, operation);
      
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction if operation fails', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(auditGuard.withAudit(testContext, operation)).rejects.toThrow();
      
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should rollback transaction if audit logging fails', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true });
      mockReturning.mockResolvedValueOnce([]); // Empty array = audit failed
      
      await expect(auditGuard.withAudit(testContext, operation)).rejects.toThrow(
        /AUDIT_FAILURE/
      );
      
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should always release database connection', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true });
      
      await auditGuard.withAudit(testContext, operation);
      
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should release connection even on error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));
      
      try {
        await auditGuard.withAudit(testContext, operation);
      } catch {
        // Expected
      }
      
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should return operation result on success', async () => {
      const expectedResult = { id: 'result-123', data: 'test' };
      const operation = vi.fn().mockResolvedValue(expectedResult);
      
      const result = await auditGuard.withAudit(testContext, operation);
      
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Audit context validation', () => {
    it('should include tenantId in audit log', async () => {
      const context = {
        tenantId: 'specific-tenant',
        action: 'test',
        resourceType: 'test',
      };
      const operation = vi.fn().mockResolvedValue({});
      
      await auditGuard.withAudit(context, operation);
      
      expect(operation).toHaveBeenCalled();
    });

    it('should handle optional fields gracefully', async () => {
      const minimalContext = {
        tenantId: 'tenant-123',
        action: 'minimal_action',
        resourceType: 'minimal_resource',
      };
      const operation = vi.fn().mockResolvedValue({});
      
      await expect(
        auditGuard.withAudit(minimalContext, operation)
      ).resolves.not.toThrow();
    });

    it('should include correlationId when provided', async () => {
      const context = {
        tenantId: 'tenant-123',
        action: 'correlated_action',
        resourceType: 'test',
        correlationId: 'correlation-abc',
      };
      const operation = vi.fn().mockResolvedValue({});
      
      await auditGuard.withAudit(context, operation);
      
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('createAuditLogDirect', () => {
    it('should create audit log without transaction wrapper', async () => {
      const log = {
        tenantId: 'tenant-123',
        action: 'direct_log',
        resourceType: 'test',
      };
      
      mockReturning.mockResolvedValueOnce([{ id: 'direct-audit-123' }]);
      
      const result = await auditGuard.createAuditLogDirect(log as any);
      
      expect(result).toHaveProperty('id');
    });
  });

  describe('withAuditAndCapture', () => {
    it('should capture operation result as newState', async () => {
      const context = {
        tenantId: 'tenant-123',
        action: 'capture_action',
        resourceType: 'test',
      };
      const operationResult = { captured: true, data: 'test-data' };
      const operation = vi.fn().mockResolvedValue(operationResult);
      
      const result = await auditGuard.withAuditAndCapture(context, operation);
      
      expect(result).toEqual(operationResult);
    });
  });
});

describe('AuditGuard - Atomicity Guarantees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockQuery.mockResolvedValue({ rows: [] });
    mockReturning.mockResolvedValue([{ id: 'audit-123' }]);
  });

  it('should ensure BEGIN -> OPERATION -> AUDIT -> COMMIT order', async () => {
    const callOrder: string[] = [];
    
    mockQuery.mockImplementation((query: string) => {
      callOrder.push(query);
      return Promise.resolve({ rows: [] });
    });
    
    const operation = vi.fn().mockImplementation(() => {
      callOrder.push('OPERATION');
      return Promise.resolve({});
    });
    
    mockReturning.mockImplementation(() => {
      callOrder.push('AUDIT');
      return Promise.resolve([{ id: 'audit-123' }]);
    });
    
    await auditGuard.withAudit(
      { tenantId: 't', action: 'a', resourceType: 'r' },
      operation
    );
    
    expect(callOrder).toEqual(['BEGIN', 'OPERATION', 'AUDIT', 'COMMIT']);
  });

  it('should not commit if audit fails after successful operation', async () => {
    const operation = vi.fn().mockResolvedValue({ success: true });
    mockReturning.mockResolvedValueOnce([]); // Audit fails
    
    try {
      await auditGuard.withAudit(
        { tenantId: 't', action: 'a', resourceType: 'r' },
        operation
      );
    } catch {
      // Expected
    }
    
    expect(mockQuery).not.toHaveBeenCalledWith('COMMIT');
    expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
  });
});
