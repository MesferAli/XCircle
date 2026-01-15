/**
 * Monitoring Module
 * 
 * Exports all monitoring utilities for the Enterprise AI Layer platform.
 */

export {
  // Initialization
  initSentry,
  
  // Middleware
  sentryRequestHandler,
  sentryErrorHandler,
  userContextMiddleware,
  
  // User Context
  setUserContext,
  clearUserContext,
  
  // Error Tracking
  captureException,
  captureMessage,
  
  // Performance
  startTransaction,
  withPerformanceTracking,
  
  // Business Tracking
  trackAIExecution,
  trackRecommendation,
  trackExecutionBlocked,
  trackPolicyViolation,
  
  // Health Check
  isSentryEnabled,
  getSentryStatus,
  
  // Direct Sentry access
  Sentry,
} from './sentry';
