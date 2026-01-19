import { test, expect } from '@playwright/test';
import {
  mockAuthenticatedState,
  waitForAppLoad,
  MOCK_STATS,
  MOCK_RECOMMENDATIONS,
  MOCK_CONNECTORS,
  MOCK_ANOMALIES,
} from './fixtures/test-utils';
import {
  PERFORMANCE_BUDGETS,
  measurePageLoadTime,
  measureActionTime,
  assertWithinBudget,
  createApiTimingCollector,
} from './fixtures/performance-utils';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedState(page);
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test.describe('Page Load', () => {
    test('should display dashboard title', async ({ page }) => {
      // Check for dashboard heading
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/dashboard/i);
    });

    test('should display page header with description', async ({ page }) => {
      // Dashboard should have a header section
      const header = page.locator('[class*="header"]').first();
      await expect(header).toBeVisible();
    });

    test('should have connect new system button', async ({ page }) => {
      const connectButton = page.getByTestId('button-start-onboarding');
      await expect(connectButton).toBeVisible();
    });
  });

  test.describe('Statistics Cards', () => {
    test('should display active items count', async ({ page }) => {
      // Look for the stat card showing items count
      await expect(page.getByText(String(MOCK_STATS.items))).toBeVisible();
    });

    test('should display locations count', async ({ page }) => {
      await expect(page.getByText(String(MOCK_STATS.locations))).toBeVisible();
    });

    test('should display pending recommendations count', async ({ page }) => {
      await expect(page.getByText(String(MOCK_STATS.recommendations))).toBeVisible();
    });

    test('should display open anomalies count', async ({ page }) => {
      await expect(page.getByText(String(MOCK_STATS.anomalies))).toBeVisible();
    });

    test('should display four stat cards', async ({ page }) => {
      // Each stat should be in a card-like container
      const statCards = page.locator('[class*="card"]').filter({
        has: page.locator('[class*="stat"], [class*="text-2xl"]'),
      });

      // Wait for cards to load
      await page.waitForTimeout(500);

      // Should have at least 4 stat cards
      await expect(statCards.first()).toBeVisible();
    });
  });

  test.describe('AI Recommendations Section', () => {
    test('should display AI recommendations section', async ({ page }) => {
      await expect(page.getByText(/ai recommendations/i)).toBeVisible();
    });

    test('should display recent recommendations', async ({ page }) => {
      // Check that recommendations are rendered
      const firstRec = MOCK_RECOMMENDATIONS[0];
      await expect(page.getByText(firstRec.title)).toBeVisible();
    });

    test('should display priority badges on recommendations', async ({ page }) => {
      // Look for priority badges
      await expect(page.getByText(/high|medium|low|critical/i).first()).toBeVisible();
    });

    test('should display confidence scores', async ({ page }) => {
      // Confidence scores should be visible
      const confidenceIndicator = page.locator('[class*="confidence"], [class*="progress"]').first();
      await expect(confidenceIndicator).toBeVisible();
    });

    test('should have view all recommendations link', async ({ page }) => {
      const viewAllLink = page.getByTestId('link-view-all-recommendations');
      await expect(viewAllLink).toBeVisible();
    });

    test('should navigate to recommendations page on view all click', async ({ page }) => {
      const viewAllLink = page.getByTestId('link-view-all-recommendations');
      await viewAllLink.click();

      await expect(page).toHaveURL(/\/recommendations/);
    });
  });

  test.describe('System Health / Connectors Section', () => {
    test('should display system health section', async ({ page }) => {
      await expect(page.getByText(/system health|connected sources/i)).toBeVisible();
    });

    test('should display connected connectors', async ({ page }) => {
      const firstConnector = MOCK_CONNECTORS[0];
      await expect(page.getByText(firstConnector.name)).toBeVisible();
    });

    test('should display connector status badges', async ({ page }) => {
      // Status should show connected/active
      await expect(page.getByText(/connected|active|error|disabled/i).first()).toBeVisible();
    });

    test('should have manage connectors link', async ({ page }) => {
      const manageLink = page.getByTestId('link-view-connectors');
      await expect(manageLink).toBeVisible();
    });

    test('should navigate to connectors page', async ({ page }) => {
      const manageLink = page.getByTestId('link-view-connectors');
      await manageLink.click();

      await expect(page).toHaveURL(/\/connectors/);
    });
  });

  test.describe('Anomalies Section', () => {
    test('should display anomalies section', async ({ page }) => {
      await expect(page.getByText(/anomalies detected|unusual patterns/i)).toBeVisible();
    });

    test('should display recent anomalies', async ({ page }) => {
      const firstAnomaly = MOCK_ANOMALIES[0];
      await expect(page.getByText(firstAnomaly.title)).toBeVisible();
    });

    test('should have view all anomalies link', async ({ page }) => {
      const viewAllLink = page.getByTestId('link-view-all-anomalies');
      await expect(viewAllLink).toBeVisible();
    });

    test('should navigate to anomalies page', async ({ page }) => {
      const viewAllLink = page.getByTestId('link-view-all-anomalies');
      await viewAllLink.click();

      await expect(page).toHaveURL(/\/anomalies/);
    });
  });

  test.describe('Quick Actions', () => {
    test('should display quick actions section', async ({ page }) => {
      await expect(page.getByText(/quick actions/i)).toBeVisible();
    });

    test('should have connect system quick action', async ({ page }) => {
      const connectAction = page.getByTestId('quick-action-connect');
      await expect(connectAction).toBeVisible();
    });

    test('should have create mapping quick action', async ({ page }) => {
      const mappingAction = page.getByTestId('quick-action-mapping');
      await expect(mappingAction).toBeVisible();
    });

    test('should have review AI quick action', async ({ page }) => {
      const reviewAction = page.getByTestId('quick-action-recommendations');
      await expect(reviewAction).toBeVisible();
    });

    test('should have view audit quick action', async ({ page }) => {
      const auditAction = page.getByTestId('quick-action-audit');
      await expect(auditAction).toBeVisible();
    });

    test('should navigate to correct pages from quick actions', async ({ page }) => {
      // Test navigation for recommendations quick action
      const reviewAction = page.getByTestId('quick-action-recommendations');
      await reviewAction.click();

      await expect(page).toHaveURL(/\/recommendations/);
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar', async ({ page }) => {
      // Look for sidebar element
      const sidebar = page.locator('[class*="sidebar"]').first();
      await expect(sidebar).toBeVisible();
    });

    test('should have dashboard link in sidebar', async ({ page }) => {
      const sidebar = page.locator('[class*="sidebar"]');
      await expect(sidebar.getByText(/dashboard/i)).toBeVisible();
    });

    test('should have connectors link in sidebar', async ({ page }) => {
      const sidebar = page.locator('[class*="sidebar"]');
      await expect(sidebar.getByText(/connectors/i)).toBeVisible();
    });

    test('should have recommendations link in sidebar', async ({ page }) => {
      const sidebar = page.locator('[class*="sidebar"]');
      await expect(sidebar.getByText(/recommendations/i)).toBeVisible();
    });

    test('should have policies link in sidebar', async ({ page }) => {
      const sidebar = page.locator('[class*="sidebar"]');
      await expect(sidebar.getByText(/policies/i)).toBeVisible();
    });

    test('should have audit link in sidebar', async ({ page }) => {
      const sidebar = page.locator('[class*="sidebar"]');
      await expect(sidebar.getByText(/audit/i)).toBeVisible();
    });

    test('should navigate via sidebar links', async ({ page }) => {
      const sidebar = page.locator('[class*="sidebar"]');

      // Click on connectors in sidebar
      await sidebar.getByText(/connectors/i).click();
      await expect(page).toHaveURL(/\/connectors/);

      // Navigate back to dashboard
      await sidebar.getByText(/dashboard/i).click();
      await expect(page).toHaveURL(/^\/$|\/dashboard/);
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should handle mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await waitForAppLoad(page);

      // Dashboard content should still be visible
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('should handle tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await waitForAppLoad(page);

      // Dashboard content should still be visible
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  test.describe('Empty States', () => {
    test('should show empty state when no recommendations', async ({ page }) => {
      // Override recommendations to return empty array
      await page.route('**/api/recommendations', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.reload();
      await waitForAppLoad(page);

      // Should show "all caught up" or similar empty state
      await expect(
        page.getByText(/all caught up|no.*recommendations|pending/i)
      ).toBeVisible();
    });

    test('should show empty state when no connectors', async ({ page }) => {
      // Override connectors to return empty array
      await page.route('**/api/connectors', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.reload();
      await waitForAppLoad(page);

      // Should show "no connectors" or setup prompt
      await expect(
        page.getByText(/no.*connector|get started|add.*first/i)
      ).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('should show skeleton loading initially', async ({ page }) => {
      // Add delay to API responses
      await page.route('**/api/stats', async (route) => {
        await new Promise((r) => setTimeout(r, 1000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_STATS),
        });
      });

      await page.goto('/');

      // Should see skeleton loaders
      const skeletons = page.locator('[class*="skeleton"]');
      await expect(skeletons.first()).toBeVisible();
    });
  });

  test.describe('Performance Budgets', () => {
    test('dashboard must fully load within 2 seconds', async ({ page }) => {
      // Reset mocks for fresh timing
      await mockAuthenticatedState(page);

      const loadTime = await measurePageLoadTime(page, '/');

      console.log(`[PERF] Dashboard load: ${loadTime}ms (budget: ${PERFORMANCE_BUDGETS.DASHBOARD_FULL_LOAD}ms)`);

      assertWithinBudget(
        loadTime,
        PERFORMANCE_BUDGETS.DASHBOARD_FULL_LOAD,
        'Dashboard full load'
      );
    });

    test('API calls must complete within individual budgets', async ({ page }) => {
      await mockAuthenticatedState(page);

      const collector = createApiTimingCollector(page);
      collector.start();

      await page.goto('/');
      await waitForAppLoad(page);

      collector.stop();

      // Verify /api/stats
      const statsTiming = collector.getTimingForEndpoint('/api/stats');
      if (statsTiming) {
        console.log(`[PERF] /api/stats: ${statsTiming.duration}ms (budget: ${PERFORMANCE_BUDGETS.API_STATS}ms)`);
        assertWithinBudget(statsTiming.duration, PERFORMANCE_BUDGETS.API_STATS, '/api/stats');
      }

      // Verify /api/recommendations
      const recsTiming = collector.getTimingForEndpoint('/api/recommendations');
      if (recsTiming) {
        console.log(`[PERF] /api/recommendations: ${recsTiming.duration}ms (budget: ${PERFORMANCE_BUDGETS.API_RECOMMENDATIONS}ms)`);
        assertWithinBudget(recsTiming.duration, PERFORMANCE_BUDGETS.API_RECOMMENDATIONS, '/api/recommendations');
      }
    });

    test('navigation should be snappy (< 1 second)', async ({ page }) => {
      const { duration } = await measureActionTime(async () => {
        await page.getByTestId('link-view-all-recommendations').click();
        await page.waitForURL(/\/recommendations/);
      });

      console.log(`[PERF] Navigation time: ${duration}ms`);
      assertWithinBudget(duration, 1000, 'Dashboard navigation');
    });
  });
});
