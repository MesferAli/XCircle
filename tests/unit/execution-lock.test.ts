/**
 * Unit Tests for execution-lock.ts
 * 
 * CRITICAL SECURITY TESTS:
 * These tests verify that the platform CANNOT execute actions by design.
 * All execution attempts MUST be blocked and logged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage for audit logging - must be before imports
vi.mock('@server/storage', () => ({
  storage: {
    createAuditLog: vi.fn().mockResolvedValue({ id: 'test-audit-id' }),
  },
}));

// Dynamic import to handle ESM
const executionLockModule = await import('@server/execution-lock');
const {
  EXECUTION_MODE,
  ExecutionForbiddenError,
  assertExecutionAllowed,
  blockAllExecution,
  isDraftOnlyMode,
  getExecutionMode,
} = executionLockModule;

describe('Execution Lock - Security Guarantees', () => {
  describe('EXECUTION_MODE constant', () => {
    it('should always be DRAFT_ONLY', () => {
      expect(EXECUTION_MODE).toBe('DRAFT_ONLY');
    });

    it('should be a compile-time constant (readonly)', () => {
      expect(typeof EXECUTION_MODE).toBe('string');
      expect(EXECUTION_MODE).not.toBe('EXECUTE');
      expect(EXECUTION_MODE).not.toBe('AUTO');
    });
  });

  describe('ExecutionForbiddenError', () => {
    it('should have correct error code', () => {
      const error = new ExecutionForbiddenError();
      expect(error.code).toBe('EXECUTION_FORBIDDEN_BY_DESIGN');
    });

    it('should have 403 HTTP status', () => {
      const error = new ExecutionForbiddenError();
      expect(error.httpStatus).toBe(403);
    });

    it('should include attempted action in message when provided', () => {
      const error = new ExecutionForbiddenError('reorder_stock');
      expect(error.message).toContain('reorder_stock');
      expect(error.message).toContain('EXECUTION_FORBIDDEN_BY_DESIGN');
    });

    it('should have generic message when no action provided', () => {
      const error = new ExecutionForbiddenError();
      expect(error.message).toContain('DRAFT_ONLY mode');
    });
  });

  describe('assertExecutionAllowed', () => {
    it('should ALWAYS throw ExecutionForbiddenError', () => {
      expect(() => assertExecutionAllowed()).toThrow(ExecutionForbiddenError);
    });

    it('should throw with action name when provided', () => {
      expect(() => assertExecutionAllowed('auto_reorder')).toThrow(
        /auto_reorder/
      );
    });

    it('should never return (return type is never)', () => {
      let completed = false;
      try {
        assertExecutionAllowed();
        completed = true;
      } catch {
        // Expected
      }
      expect(completed).toBe(false);
    });
  });

  describe('isDraftOnlyMode', () => {
    it('should always return true', () => {
      expect(isDraftOnlyMode()).toBe(true);
    });

    it('should return boolean true (not truthy)', () => {
      expect(isDraftOnlyMode()).toStrictEqual(true);
    });
  });

  describe('getExecutionMode', () => {
    it('should always return DRAFT_ONLY', () => {
      expect(getExecutionMode()).toBe('DRAFT_ONLY');
    });
  });

  describe('blockAllExecution middleware', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
      mockReq = {
        user: { id: 'user-123', tenantId: 'tenant-456' },
        params: { id: 'rec-789' },
        originalUrl: '/api/recommendations/rec-789/execute',
        method: 'POST',
        get: vi.fn().mockReturnValue('test-user-agent'),
        ip: '127.0.0.1',
      };

      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      mockNext = vi.fn();
    });

    it('should return 403 status', async () => {
      await blockAllExecution(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return EXECUTION_FORBIDDEN_BY_DESIGN error code', async () => {
      await blockAllExecution(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'EXECUTION_FORBIDDEN_BY_DESIGN',
          code: 'EXECUTION_FORBIDDEN_BY_DESIGN',
        })
      );
    });

    it('should include blocked: true in response', async () => {
      await blockAllExecution(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          blocked: true,
        })
      );
    });

    it('should include executionMode in response', async () => {
      await blockAllExecution(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          executionMode: 'DRAFT_ONLY',
        })
      );
    });

    it('should NEVER call next() - execution is always blocked', async () => {
      await blockAllExecution(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing user gracefully', async () => {
      mockReq.user = undefined;
      await blockAllExecution(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle missing params gracefully', async () => {
      mockReq.params = {};
      await blockAllExecution(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});

describe('Execution Lock - Attack Vectors', () => {
  it('should block direct API execution attempts', () => {
    expect(() => assertExecutionAllowed('direct_api_call')).toThrow(
      ExecutionForbiddenError
    );
  });

  it('should block automated script execution attempts', () => {
    expect(() => assertExecutionAllowed('automated_script')).toThrow(
      ExecutionForbiddenError
    );
  });

  it('should block admin override attempts', () => {
    expect(() => assertExecutionAllowed('admin_override')).toThrow(
      ExecutionForbiddenError
    );
  });

  it('should block batch execution attempts', () => {
    expect(() => assertExecutionAllowed('batch_execute')).toThrow(
      ExecutionForbiddenError
    );
  });
});
