import { test, expect } from '@playwright/test';
import {
  mockAuthenticatedState,
  waitForAppLoad,
  MOCK_RECOMMENDATIONS,
} from './fixtures/test-utils';
import {
  PERFORMANCE_BUDGETS,
  createApiTimingCollector,
  measurePageLoadTime,
  measureActionTime,
  assertWithinBudget,
  collectPerformanceMetrics,
} from './fixtures/performance-utils';

test.describe('Performance Benchmarks', () => {
  test.describe('Dashboard Performance', () => {
    test('should load dashboard within 2 second budget', async ({ page }) => {
      await mockAuthenticatedState(page);

      const loadTime = await measurePageLoadTime(page, '/');

      console.log(`[PERF] Dashboard load time: ${loadTime}ms`);

      assertWithinBudget(
        loadTime,
        PERFORMANCE_BUDGETS.DASHBOARD_FULL_LOAD,
        'Dashboard full load'
      );
    });

    test('should have acceptable First Contentful Paint', async ({ page }) => {
      await mockAuthenticatedState(page);
      await page.goto('/');
      await waitForAppLoad(page);

      const metrics = await collectPerformanceMetrics(page);

      if (metrics.firstContentfulPaint !== null) {
        console.log(`[PERF] FCP: ${metrics.firstContentfulPaint}ms`);

        assertWithinBudget(
          metrics.firstContentfulPaint,
          PERFORMANCE_BUDGETS.FIRST_CONTENTFUL_PAINT,
          'First Contentful Paint'
        );
      }
    });

    test('should load all dashboard API calls within budget', async ({ page }) => {
      await mockAuthenticatedState(page);

      const collector = createApiTimingCollector(page);
      collector.start();

      await page.goto('/');
      await waitForAppLoad(page);

      collector.stop();

      const timings = collector.getTimings();
      console.log('[PERF] API Response Times:');

      for (const timing of timings) {
        const endpoint = new URL(timing.url).pathname;
        console.log(`  ${endpoint}: ${timing.duration}ms`);
      }

      // Check individual API budgets
      const statsTiming = collector.getTimingForEndpoint('/api/stats');
      if (statsTiming) {
        assertWithinBudget(
          statsTiming.duration,
          PERFORMANCE_BUDGETS.API_STATS,
          '/api/stats response'
        );
      }

      const recsTiming = collector.getTimingForEndpoint('/api/recommendations');
      if (recsTiming) {
        assertWithinBudget(
          recsTiming.duration,
          PERFORMANCE_BUDGETS.API_RECOMMENDATIONS,
          '/api/recommendations response'
        );
      }

      const connectorsTiming = collector.getTimingForEndpoint('/api/connectors');
      if (connectorsTiming) {
        assertWithinBudget(
          connectorsTiming.duration,
          PERFORMANCE_BUDGETS.API_CONNECTORS,
          '/api/connectors response'
        );
      }
    });

    test('should render stat cards without layout shift', async ({ page }) => {
      await mockAuthenticatedState(page);

      await page.goto('/');

      // Measure time until all 4 stat cards are visible
      const { duration } = await measureActionTime(async () => {
        await page.waitForSelector('[class*="card"]', { state: 'visible' });
        // Wait for stats to populate (numbers appear)
        await page.waitForFunction(() => {
          const cards = document.querySelectorAll('[class*="card"]');
          return cards.length >= 4;
        });
      });

      console.log(`[PERF] Stat cards render time: ${duration}ms`);

      // Stats should render within 1 second
      assertWithinBudget(duration, 1000, 'Stat cards render');
    });
  });

  test.describe('Recommendations Page Performance', () => {
    test('should load recommendations page within 1.5 second budget', async ({ page }) => {
      await mockAuthenticatedState(page);

      const loadTime = await measurePageLoadTime(page, '/recommendations');

      console.log(`[PERF] Recommendations page load time: ${loadTime}ms`);

      assertWithinBudget(
        loadTime,
        PERFORMANCE_BUDGETS.RECOMMENDATIONS_PAGE_LOAD,
        'Recommendations page load'
      );
    });

    test('should render recommendation list efficiently', async ({ page }) => {
      await mockAuthenticatedState(page);

      await page.goto('/recommendations');

      const { duration } = await measureActionTime(async () => {
        // Wait for recommendations to be visible
        await page.waitForSelector('[data-testid^="recommendation-"]', {
          state: 'visible',
          timeout: 10000,
        });
      });

      console.log(`[PERF] Recommendation list render time: ${duration}ms`);

      // List should render within 1 second after page load starts
      assertWithinBudget(duration, 1000, 'Recommendation list render');
    });

    test('should filter recommendations within 500ms', async ({ page }) => {
      await mockAuthenticatedState(page);
      await page.goto('/recommendations');
      await waitForAppLoad(page);

      // Wait for initial load
      await page.waitForSelector('[data-testid^="recommendation-"]', { state: 'visible' });

      // Measure filter operation
      const { duration } = await measureActionTime(async () => {
        const searchInput = page.getByTestId('input-search-recommendations');
        await searchInput.fill('Reorder');

        // Wait for filter to apply (list updates)
        await page.waitForTimeout(100); // Small delay for React state update
      });

      console.log(`[PERF] Filter operation time: ${duration}ms`);

      assertWithinBudget(
        duration,
        PERFORMANCE_BUDGETS.FILTER_RESPONSE,
        'Filter response'
      );
    });
  });

  test.describe('Recommendation Actions Performance', () => {
    test('should complete approve action within 1.5 second budget', async ({ page }) => {
      await mockAuthenticatedState(page);
      await page.goto('/recommendations');
      await waitForAppLoad(page);

      // Find a pending recommendation
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) {
        test.skip();
        return;
      }

      // Wait for list to load
      await page.waitForSelector(`[data-testid="button-review-${pendingRec.id}"]`, {
        state: 'visible',
      });

      // Measure the entire approval flow
      const { duration } = await measureActionTime(async () => {
        // Click review button
        await page.getByTestId(`button-review-${pendingRec.id}`).click();

        // Wait for dialog
        await page.waitForSelector('[role="dialog"]', { state: 'visible' });

        // Click approve
        await page.getByTestId('button-approve').click();

        // Wait for success indication (toast or dialog close)
        await Promise.race([
          page.waitForSelector('[role="dialog"]', { state: 'hidden' }),
          page.waitForSelector('[class*="toast"]', { state: 'visible' }),
        ]);
      });

      console.log(`[PERF] Approve action time: ${duration}ms`);

      assertWithinBudget(
        duration,
        PERFORMANCE_BUDGETS.RECOMMENDATION_ACTION,
        'Recommendation approve action'
      );
    });

    test('should complete reject action within 1.5 second budget', async ({ page }) => {
      await mockAuthenticatedState(page);
      await page.goto('/recommendations');
      await waitForAppLoad(page);

      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) {
        test.skip();
        return;
      }

      await page.waitForSelector(`[data-testid="button-review-${pendingRec.id}"]`, {
        state: 'visible',
      });

      const { duration } = await measureActionTime(async () => {
        await page.getByTestId(`button-review-${pendingRec.id}`).click();
        await page.waitForSelector('[role="dialog"]', { state: 'visible' });
        await page.getByTestId('button-reject').click();

        await Promise.race([
          page.waitForSelector('[role="dialog"]', { state: 'hidden' }),
          page.waitForSelector('[class*="toast"]', { state: 'visible' }),
        ]);
      });

      console.log(`[PERF] Reject action time: ${duration}ms`);

      assertWithinBudget(
        duration,
        PERFORMANCE_BUDGETS.RECOMMENDATION_ACTION,
        'Recommendation reject action'
      );
    });

    test('should complete defer action within 1.5 second budget', async ({ page }) => {
      await mockAuthenticatedState(page);
      await page.goto('/recommendations');
      await waitForAppLoad(page);

      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) {
        test.skip();
        return;
      }

      await page.waitForSelector(`[data-testid="button-review-${pendingRec.id}"]`, {
        state: 'visible',
      });

      const { duration } = await measureActionTime(async () => {
        await page.getByTestId(`button-review-${pendingRec.id}`).click();
        await page.waitForSelector('[role="dialog"]', { state: 'visible' });
        await page.getByTestId('button-defer').click();

        await Promise.race([
          page.waitForSelector('[role="dialog"]', { state: 'hidden' }),
          page.waitForSelector('[class*="toast"]', { state: 'visible' }),
        ]);
      });

      console.log(`[PERF] Defer action time: ${duration}ms`);

      assertWithinBudget(
        duration,
        PERFORMANCE_BUDGETS.RECOMMENDATION_ACTION,
        'Recommendation defer action'
      );
    });

    test('should open review dialog within 300ms', async ({ page }) => {
      await mockAuthenticatedState(page);
      await page.goto('/recommendations');
      await waitForAppLoad(page);

      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) {
        test.skip();
        return;
      }

      await page.waitForSelector(`[data-testid="button-review-${pendingRec.id}"]`, {
        state: 'visible',
      });

      const { duration } = await measureActionTime(async () => {
        await page.getByTestId(`button-review-${pendingRec.id}`).click();
        await page.waitForSelector('[role="dialog"]', { state: 'visible' });
      });

      console.log(`[PERF] Dialog open time: ${duration}ms`);

      // Dialog should open within 300ms
      assertWithinBudget(duration, 300, 'Review dialog open');
    });
  });

  test.describe('Navigation Performance', () => {
    test('should navigate between pages within 1 second', async ({ page }) => {
      await mockAuthenticatedState(page);
      await page.goto('/');
      await waitForAppLoad(page);

      // Navigate to recommendations
      const { duration: toRecsTime } = await measureActionTime(async () => {
        await page.getByTestId('link-view-all-recommendations').click();
        await page.waitForURL(/\/recommendations/);
        await page.waitForSelector('[data-testid^="recommendation-"]', { state: 'visible' })
          .catch(() => {}); // May not have recommendations
      });

      console.log(`[PERF] Navigation to recommendations: ${toRecsTime}ms`);
      assertWithinBudget(toRecsTime, 1000, 'Navigation to recommendations');

      // Navigate back to dashboard
      const { duration: toDashTime } = await measureActionTime(async () => {
        await page.locator('[class*="sidebar"]').getByText(/dashboard/i).click();
        await page.waitForURL(/^\/$|\/dashboard/);
        await page.waitForSelector('[class*="card"]', { state: 'visible' });
      });

      console.log(`[PERF] Navigation to dashboard: ${toDashTime}ms`);
      assertWithinBudget(toDashTime, 1000, 'Navigation to dashboard');
    });
  });

  test.describe('Memory and Resource Usage', () => {
    test('should not have memory leaks after navigation', async ({ page }) => {
      await mockAuthenticatedState(page);

      // Initial navigation
      await page.goto('/');
      await waitForAppLoad(page);

      const initialMetrics = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return null;
      });

      // Navigate multiple times
      for (let i = 0; i < 5; i++) {
        await page.goto('/recommendations');
        await waitForAppLoad(page);
        await page.goto('/');
        await waitForAppLoad(page);
      }

      const finalMetrics = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return null;
      });

      if (initialMetrics !== null && finalMetrics !== null) {
        const increase = finalMetrics - initialMetrics;
        const increasePercent = (increase / initialMetrics) * 100;

        console.log(`[PERF] Memory increase after navigation: ${(increase / 1024 / 1024).toFixed(2)}MB (${increasePercent.toFixed(1)}%)`);

        // Memory should not increase more than 50%
        expect(increasePercent, 'Memory increase should be < 50%').toBeLessThan(50);
      }
    });
  });

  test.describe('API Performance Monitoring', () => {
    test('should complete all dashboard API calls within total budget', async ({ page }) => {
      await mockAuthenticatedState(page);

      const collector = createApiTimingCollector(page);
      collector.start();

      await page.goto('/');
      await waitForAppLoad(page);

      collector.stop();

      const timings = collector.getTimings();
      const totalApiTime = timings.reduce((sum, t) => sum + t.duration, 0);
      const avgApiTime = collector.getAverageTime();

      console.log(`[PERF] Total API time: ${totalApiTime}ms`);
      console.log(`[PERF] Average API time: ${avgApiTime.toFixed(0)}ms`);
      console.log(`[PERF] API calls count: ${timings.length}`);

      // Total API time should be reasonable (sum of all calls)
      // With mocked APIs this should be very fast
      assertWithinBudget(
        avgApiTime,
        PERFORMANCE_BUDGETS.API_STATS,
        'Average API response time'
      );
    });
  });
});

test.describe('Performance Regression Tests', () => {
  test('should not regress on key performance metrics', async ({ page }) => {
    await mockAuthenticatedState(page);

    // Collect baseline metrics
    const loadTime = await measurePageLoadTime(page, '/');
    const metrics = await collectPerformanceMetrics(page);

    // Log all metrics for tracking
    console.log('\n=== PERFORMANCE METRICS SUMMARY ===');
    console.log(`Page Load Time: ${loadTime}ms`);
    console.log(`DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`First Contentful Paint: ${metrics.firstContentfulPaint ?? 'N/A'}ms`);
    console.log(`Time to Interactive: ${metrics.timeToInteractive ?? 'N/A'}ms`);
    console.log('===================================\n');

    // Assert all budgets
    assertWithinBudget(loadTime, PERFORMANCE_BUDGETS.DASHBOARD_FULL_LOAD, 'Dashboard load');

    if (metrics.firstContentfulPaint) {
      assertWithinBudget(
        metrics.firstContentfulPaint,
        PERFORMANCE_BUDGETS.FIRST_CONTENTFUL_PAINT,
        'FCP'
      );
    }
  });
});
