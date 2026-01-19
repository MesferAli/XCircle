import { Page, expect } from '@playwright/test';

/**
 * XCircle Performance Testing Utilities
 *
 * Provides helpers for measuring and asserting performance metrics.
 */

// Performance budgets in milliseconds
export const PERFORMANCE_BUDGETS = {
  // Page load budgets
  DASHBOARD_FULL_LOAD: 2000,
  RECOMMENDATIONS_PAGE_LOAD: 1500,

  // Action budgets
  RECOMMENDATION_ACTION: 1500,
  FILTER_RESPONSE: 500,

  // API response budgets
  API_STATS: 500,
  API_RECOMMENDATIONS: 800,
  API_CONNECTORS: 500,
  API_ANOMALIES: 500,

  // Core Web Vitals targets
  FIRST_CONTENTFUL_PAINT: 1800,
  LARGEST_CONTENTFUL_PAINT: 2500,
  TIME_TO_INTERACTIVE: 3000,
} as const;

export interface PerformanceMetrics {
  pageLoadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  timeToInteractive: number | null;
  apiResponseTimes: Record<string, number>;
}

export interface ApiTiming {
  url: string;
  method: string;
  duration: number;
  status: number;
}

/**
 * Collect performance metrics from the page
 */
export async function collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
  const metrics = await page.evaluate(() => {
    const perf = window.performance;
    const timing = perf.timing;

    // Get paint entries
    const paintEntries = perf.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');

    // Get LCP if available
    let lcpValue: number | null = null;
    try {
      const lcpEntries = perf.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        lcpValue = lcpEntries[lcpEntries.length - 1].startTime;
      }
    } catch {
      // LCP not available
    }

    return {
      pageLoadTime: timing.loadEventEnd - timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      firstContentfulPaint: fcpEntry ? fcpEntry.startTime : null,
      largestContentfulPaint: lcpValue,
      timeToInteractive: timing.domInteractive - timing.navigationStart,
    };
  });

  return {
    ...metrics,
    apiResponseTimes: {},
  };
}

/**
 * Create an API timing collector that tracks response times
 */
export function createApiTimingCollector(page: Page): {
  timings: ApiTiming[];
  start: () => void;
  stop: () => void;
  getTimings: () => ApiTiming[];
  getTimingForEndpoint: (endpoint: string) => ApiTiming | undefined;
  getAverageTime: () => number;
} {
  const timings: ApiTiming[] = [];
  const requestStartTimes = new Map<string, number>();

  const requestHandler = (request: any) => {
    if (request.url().includes('/api/')) {
      requestStartTimes.set(request.url() + request.method(), Date.now());
    }
  };

  const responseHandler = (response: any) => {
    const key = response.url() + response.request().method();
    const startTime = requestStartTimes.get(key);

    if (startTime && response.url().includes('/api/')) {
      const duration = Date.now() - startTime;
      timings.push({
        url: response.url(),
        method: response.request().method(),
        duration,
        status: response.status(),
      });
      requestStartTimes.delete(key);
    }
  };

  return {
    timings,
    start: () => {
      page.on('request', requestHandler);
      page.on('response', responseHandler);
    },
    stop: () => {
      page.removeListener('request', requestHandler);
      page.removeListener('response', responseHandler);
    },
    getTimings: () => [...timings],
    getTimingForEndpoint: (endpoint: string) =>
      timings.find(t => t.url.includes(endpoint)),
    getAverageTime: () => {
      if (timings.length === 0) return 0;
      return timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
    },
  };
}

/**
 * Measure time for an async action
 */
export async function measureActionTime<T>(
  action: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await action();
  const duration = Date.now() - startTime;
  return { result, duration };
}

/**
 * Assert that a duration is within budget
 */
export function assertWithinBudget(
  actualMs: number,
  budgetMs: number,
  metricName: string
): void {
  expect(
    actualMs,
    `${metricName} exceeded budget: ${actualMs}ms > ${budgetMs}ms`
  ).toBeLessThanOrEqual(budgetMs);
}

/**
 * Wait for network to be idle and measure total time
 */
export async function measurePageLoadTime(
  page: Page,
  url: string
): Promise<number> {
  const startTime = Date.now();

  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for any loading spinners to disappear
  await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10000 })
    .catch(() => {});

  // Wait for main content to be visible
  await page.waitForSelector('[class*="card"]', { state: 'visible', timeout: 10000 })
    .catch(() => {});

  return Date.now() - startTime;
}

/**
 * Measure time from action to UI update
 */
export async function measureActionToUIUpdate(
  page: Page,
  action: () => Promise<void>,
  successIndicator: string | (() => Promise<boolean>)
): Promise<number> {
  const startTime = Date.now();

  await action();

  if (typeof successIndicator === 'string') {
    await page.waitForSelector(successIndicator, { state: 'visible', timeout: 10000 });
  } else {
    await page.waitForFunction(successIndicator, { timeout: 10000 });
  }

  return Date.now() - startTime;
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(
  metrics: PerformanceMetrics,
  apiTimings: ApiTiming[],
  budgets: typeof PERFORMANCE_BUDGETS
): string {
  const lines: string[] = [
    '## Performance Report',
    '',
    '### Page Metrics',
    `- Page Load Time: ${metrics.pageLoadTime}ms`,
    `- DOM Content Loaded: ${metrics.domContentLoaded}ms`,
    `- First Contentful Paint: ${metrics.firstContentfulPaint ?? 'N/A'}ms`,
    `- Largest Contentful Paint: ${metrics.largestContentfulPaint ?? 'N/A'}ms`,
    `- Time to Interactive: ${metrics.timeToInteractive ?? 'N/A'}ms`,
    '',
    '### API Response Times',
  ];

  for (const timing of apiTimings) {
    const endpoint = new URL(timing.url).pathname;
    lines.push(`- ${timing.method} ${endpoint}: ${timing.duration}ms`);
  }

  lines.push('', '### Budget Compliance');

  if (metrics.pageLoadTime <= budgets.DASHBOARD_FULL_LOAD) {
    lines.push(`✅ Dashboard load: ${metrics.pageLoadTime}ms (budget: ${budgets.DASHBOARD_FULL_LOAD}ms)`);
  } else {
    lines.push(`❌ Dashboard load: ${metrics.pageLoadTime}ms (budget: ${budgets.DASHBOARD_FULL_LOAD}ms)`);
  }

  return lines.join('\n');
}

/**
 * Performance test decorator - wraps a test with timing
 */
export function withPerformanceTiming(
  testName: string,
  budgetMs: number
) {
  return async (
    page: Page,
    testFn: (page: Page) => Promise<void>
  ): Promise<{ passed: boolean; duration: number }> => {
    const { duration } = await measureActionTime(() => testFn(page));
    const passed = duration <= budgetMs;

    console.log(
      `[PERF] ${testName}: ${duration}ms ${passed ? '✅' : '❌'} (budget: ${budgetMs}ms)`
    );

    return { passed, duration };
  };
}
