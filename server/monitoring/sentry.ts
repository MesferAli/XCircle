/**
 * Sentry Monitoring Configuration
 * 
 * Enterprise AI Layer - Error Tracking & Performance Monitoring
 * 
 * This module initializes Sentry for:
 * - Error tracking and alerting
 * - Performance monitoring (transactions, spans)
 * - User context tracking (tenant, user)
 * - Custom tags for filtering
 */

import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';

// ============================================
// Configuration
// ============================================

interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
}

const getConfig = (): SentryConfig => ({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.APP_VERSION || 'unknown',
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
});

// ============================================
// Initialization
// ============================================

export function initSentry(): void {
  const config = getConfig();
  
  if (!config.dsn) {
    console.log('[Sentry] DSN not configured, monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    
    // Performance Monitoring
    tracesSampleRate: config.tracesSampleRate,
    profilesSampleRate: config.profilesSampleRate,
    
    // Integrations
    integrations: [
      // HTTP integration for tracking outgoing requests
      Sentry.httpIntegration(),
      // Express integration
      Sentry.expressIntegration(),
      // PostgreSQL integration
      Sentry.postgresIntegration(),
    ],
    
    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      
      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data?.password) {
            breadcrumb.data.password = '[REDACTED]';
          }
          return breadcrumb;
        });
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Network request failed',
      'AbortError',
    ],
  });

  console.log(`[Sentry] Initialized for ${config.environment} environment`);
}

// ============================================
// Express Middleware
// ============================================

/**
 * Request handler middleware - adds Sentry to each request
 */
export function sentryRequestHandler() {
  return Sentry.expressIntegration().setupOnce;
}

/**
 * Error handler middleware - captures errors to Sentry
 */
export function sentryErrorHandler() {
  return Sentry.expressErrorHandler();
}

// ============================================
// Context & User Tracking
// ============================================

/**
 * Set user context for Sentry
 */
export function setUserContext(user: {
  id: string;
  tenantId: string;
  email?: string;
  role?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
  
  Sentry.setTag('tenant_id', user.tenantId);
  Sentry.setTag('user_role', user.role || 'unknown');
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Middleware to set user context from request
 */
export function userContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const user = (req as any).user;
  
  if (user) {
    setUserContext({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });
  }
  
  next();
}

// ============================================
// Custom Error Tracking
// ============================================

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  }
): string {
  return Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    level: context?.level,
  });
}

/**
 * Capture message with context
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

// ============================================
// Performance Monitoring
// ============================================

/**
 * Start a new transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, any>
): ReturnType<typeof Sentry.startSpan> {
  return Sentry.startSpan(
    {
      name,
      op,
      attributes: data,
    },
    () => {}
  );
}

/**
 * Wrap async function with performance tracking
 */
export async function withPerformanceTracking<T>(
  name: string,
  op: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op,
    },
    async () => {
      return await fn();
    }
  );
}

// ============================================
// Business-Specific Tracking
// ============================================

/**
 * Track AI Engine execution
 */
export function trackAIExecution(
  tenantId: string,
  operation: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    category: 'ai-engine',
    message: `AI ${operation} ${success ? 'completed' : 'failed'}`,
    level: success ? 'info' : 'error',
    data: {
      tenantId,
      operation,
      duration,
      ...metadata,
    },
  });

  if (!success) {
    captureMessage(`AI Engine ${operation} failed`, 'warning', {
      tenantId,
      duration,
      ...metadata,
    });
  }
}

/**
 * Track recommendation generation
 */
export function trackRecommendation(
  tenantId: string,
  recommendationId: string,
  type: string,
  priority: string
): void {
  Sentry.addBreadcrumb({
    category: 'recommendation',
    message: `Recommendation generated: ${type}`,
    level: 'info',
    data: {
      tenantId,
      recommendationId,
      type,
      priority,
    },
  });
}

/**
 * Track execution block (security event)
 */
export function trackExecutionBlocked(
  tenantId: string,
  userId: string,
  action: string,
  reason: string
): void {
  Sentry.addBreadcrumb({
    category: 'security',
    message: `Execution blocked: ${action}`,
    level: 'warning',
    data: {
      tenantId,
      userId,
      action,
      reason,
    },
  });

  captureMessage('Execution attempt blocked', 'warning', {
    tenantId,
    userId,
    action,
    reason,
  });
}

/**
 * Track policy violation
 */
export function trackPolicyViolation(
  tenantId: string,
  policyId: string,
  policyName: string,
  violation: string
): void {
  Sentry.addBreadcrumb({
    category: 'policy',
    message: `Policy violation: ${policyName}`,
    level: 'warning',
    data: {
      tenantId,
      policyId,
      policyName,
      violation,
    },
  });
}

// ============================================
// Health Check
// ============================================

/**
 * Check if Sentry is properly configured
 */
export function isSentryEnabled(): boolean {
  return !!process.env.SENTRY_DSN;
}

/**
 * Get Sentry status for health check
 */
export function getSentryStatus(): {
  enabled: boolean;
  environment: string;
  release: string;
} {
  const config = getConfig();
  return {
    enabled: !!config.dsn,
    environment: config.environment,
    release: config.release || 'unknown',
  };
}

// ============================================
// Export Sentry for direct access
// ============================================

export { Sentry };
