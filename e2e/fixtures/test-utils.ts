import { test as base, expect, Page } from '@playwright/test';

/**
 * XCircle E2E Test Utilities
 *
 * Provides common helpers for authentication, navigation, and assertions.
 */

// Test user credentials for E2E testing
export const TEST_USER = {
  email: 'e2e-test@xcircle.dev',
  password: 'TestPassword123!',
};

// API endpoints used in tests
export const API_ENDPOINTS = {
  AUTH_USER: '/api/auth/user',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/logout',
  RECOMMENDATIONS: '/api/recommendations',
  CONNECTORS: '/api/connectors',
  STATS: '/api/stats',
  ONBOARDING_STATUS: '/api/onboarding/status',
  TENANT: '/api/tenant',
  ANOMALIES: '/api/anomalies',
};

// Mock data for API responses
export const MOCK_USER = {
  id: 'test-user-123',
  email: 'e2e-test@xcircle.dev',
  firstName: 'Test',
  lastName: 'User',
  profileImageUrl: null,
  tenantId: 'test-tenant-123',
  role: 'admin',
  platformRole: 'user',
};

export const MOCK_ONBOARDING_STATUS = {
  onboardingCompleted: true,
  companySize: 'smb',
  selectedUseCase: 'inventory',
  trialExpired: false,
};

export const MOCK_TENANT = {
  id: 'test-tenant-123',
  name: 'Test Company',
  status: 'active',
  companySize: 'smb',
  trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  onboardingCompleted: true,
};

export const MOCK_STATS = {
  items: 150,
  locations: 5,
  recommendations: 12,
  anomalies: 3,
  connectors: 2,
  activeConnectors: 2,
};

export const MOCK_RECOMMENDATIONS = [
  {
    id: 'rec-001',
    tenantId: 'test-tenant-123',
    title: 'Reorder Inventory for SKU-12345',
    description: 'Stock levels are approaching minimum threshold. Consider placing a reorder.',
    type: 'reorder',
    priority: 'high',
    status: 'pending',
    confidenceScore: 0.92,
    explanation: 'Based on historical sales velocity and current stock levels, this item will reach stockout in approximately 5 days.',
    suggestedAction: { action: 'reorder', quantity: 100, sku: 'SKU-12345' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-002',
    tenantId: 'test-tenant-123',
    title: 'Transfer Stock Between Warehouses',
    description: 'Warehouse A has excess inventory while Warehouse B is running low.',
    type: 'transfer',
    priority: 'medium',
    status: 'pending',
    confidenceScore: 0.85,
    explanation: 'Distribution analysis shows imbalanced inventory across locations.',
    suggestedAction: { action: 'transfer', from: 'Warehouse A', to: 'Warehouse B', quantity: 50 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-003',
    tenantId: 'test-tenant-123',
    title: 'Review Pricing for Slow-Moving Items',
    description: 'Several items have not moved in 30+ days.',
    type: 'adjustment',
    priority: 'low',
    status: 'approved',
    confidenceScore: 0.78,
    explanation: 'Inventory aging analysis indicates potential overstock situation.',
    suggestedAction: { action: 'review', items: ['SKU-111', 'SKU-222'] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_CONNECTORS = [
  {
    id: 'conn-001',
    tenantId: 'test-tenant-123',
    name: 'Salla Store',
    type: 'salla',
    baseUrl: 'https://api.salla.dev',
    status: 'connected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'conn-002',
    tenantId: 'test-tenant-123',
    name: 'Zid Store',
    type: 'zid',
    baseUrl: 'https://api.zid.sa',
    status: 'connected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_ANOMALIES = [
  {
    id: 'anom-001',
    tenantId: 'test-tenant-123',
    title: 'Unusual Sales Spike Detected',
    description: 'Sales for SKU-999 increased 300% compared to historical average.',
    severity: 'high',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
  mockAPIs: (page: Page) => Promise<void>;
}>({
  /**
   * Provides a page that is already authenticated via mocked API
   */
  authenticatedPage: async ({ page }, use) => {
    await mockAuthenticatedState(page);
    await use(page);
  },

  /**
   * Helper to mock all APIs with default data
   */
  mockAPIs: async ({}, use) => {
    const mockFn = async (page: Page) => {
      await mockAuthenticatedState(page);
    };
    await use(mockFn);
  },
});

/**
 * Mock authenticated state by intercepting API calls
 */
export async function mockAuthenticatedState(page: Page): Promise<void> {
  // Mock the auth user endpoint
  await page.route(`**/api/auth/user`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USER),
    });
  });

  // Mock onboarding status
  await page.route(`**/api/onboarding/status`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ONBOARDING_STATUS),
    });
  });

  // Mock tenant info
  await page.route(`**/api/tenant`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TENANT),
    });
  });

  // Mock stats
  await page.route(`**/api/stats`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STATS),
    });
  });

  // Mock recommendations
  await page.route(`**/api/recommendations`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RECOMMENDATIONS),
      });
    } else {
      route.continue();
    }
  });

  // Mock recommendation update (PATCH)
  await page.route(`**/api/recommendations/*`, (route) => {
    if (route.request().method() === 'PATCH') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      route.continue();
    }
  });

  // Mock connectors
  await page.route(`**/api/connectors`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CONNECTORS),
    });
  });

  // Mock anomalies
  await page.route(`**/api/anomalies`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ANOMALIES),
    });
  });
}

/**
 * Mock unauthenticated state
 */
export async function mockUnauthenticatedState(page: Page): Promise<void> {
  await page.route(`**/api/auth/user`, (route) => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });
}

/**
 * Mock login API endpoint
 */
export async function mockLoginAPI(page: Page, options?: { shouldSucceed?: boolean }): Promise<void> {
  const { shouldSucceed = true } = options || {};

  await page.route(`**/api/auth/login`, (route) => {
    if (shouldSucceed) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, user: MOCK_USER }),
      });
    } else {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email or password' }),
      });
    }
  });
}

/**
 * Wait for the app to finish loading
 */
export async function waitForAppLoad(page: Page): Promise<void> {
  // Wait for loading spinner to disappear
  await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10000 }).catch(() => {
    // Loading spinner may not appear if page loads quickly
  });

  // Wait for main content to be visible
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a page and wait for it to load
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForAppLoad(page);
}

/**
 * Fill login form and submit
 */
export async function performLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('button-login').click();
}

export { expect };
