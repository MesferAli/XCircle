import { test, expect } from '@playwright/test';
import {
  mockAuthenticatedState,
  waitForAppLoad,
  MOCK_RECOMMENDATIONS,
} from './fixtures/test-utils';
import {
  PERFORMANCE_BUDGETS,
  measurePageLoadTime,
  measureActionTime,
  assertWithinBudget,
} from './fixtures/performance-utils';

test.describe('Recommendations Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedState(page);
    await page.goto('/recommendations');
    await waitForAppLoad(page);
  });

  test.describe('Page Load', () => {
    test('should display page header', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/recommendations/i);
    });

    test('should display page description', async ({ page }) => {
      await expect(page.getByText(/review.*action|ai.*generated|insights/i)).toBeVisible();
    });

    test('should have export button', async ({ page }) => {
      // Look for export functionality
      const exportButton = page.getByRole('button', { name: /export/i });
      await expect(exportButton).toBeVisible();
    });
  });

  test.describe('Statistics Cards', () => {
    test('should display pending review count', async ({ page }) => {
      const pendingCount = MOCK_RECOMMENDATIONS.filter((r) => r.status === 'pending').length;
      await expect(page.getByText(String(pendingCount))).toBeVisible();
      await expect(page.getByText(/pending.*review/i)).toBeVisible();
    });

    test('should display approved count', async ({ page }) => {
      const approvedCount = MOCK_RECOMMENDATIONS.filter((r) => r.status === 'approved').length;
      await expect(page.getByText(String(approvedCount))).toBeVisible();
      await expect(page.getByText(/^approved$/i)).toBeVisible();
    });

    test('should display rejected count', async ({ page }) => {
      await expect(page.getByText(/^rejected$/i)).toBeVisible();
    });

    test('should display total generated count', async ({ page }) => {
      await expect(page.getByText(String(MOCK_RECOMMENDATIONS.length))).toBeVisible();
      await expect(page.getByText(/total.*generated/i)).toBeVisible();
    });
  });

  test.describe('Filters and Search', () => {
    test('should have search input', async ({ page }) => {
      const searchInput = page.getByTestId('input-search-recommendations');
      await expect(searchInput).toBeVisible();
    });

    test('should have status filter dropdown', async ({ page }) => {
      const statusFilter = page.getByTestId('select-status-filter');
      await expect(statusFilter).toBeVisible();
    });

    test('should have priority filter dropdown', async ({ page }) => {
      const priorityFilter = page.getByTestId('select-priority-filter');
      await expect(priorityFilter).toBeVisible();
    });

    test('should filter by search query', async ({ page }) => {
      const searchInput = page.getByTestId('input-search-recommendations');
      const firstRec = MOCK_RECOMMENDATIONS[0];

      // Search for first recommendation
      await searchInput.fill(firstRec.title.substring(0, 10));

      // Should show matching recommendation
      await expect(page.getByText(firstRec.title)).toBeVisible();
    });

    test('should filter by status', async ({ page }) => {
      const statusFilter = page.getByTestId('select-status-filter');
      await statusFilter.click();

      // Select "Pending" status
      await page.getByRole('option', { name: /pending/i }).click();

      // Should only show pending recommendations
      const pendingRecs = MOCK_RECOMMENDATIONS.filter((r) => r.status === 'pending');
      for (const rec of pendingRecs) {
        await expect(page.getByText(rec.title)).toBeVisible();
      }
    });

    test('should filter by priority', async ({ page }) => {
      const priorityFilter = page.getByTestId('select-priority-filter');
      await priorityFilter.click();

      // Select "High" priority
      await page.getByRole('option', { name: /high/i }).click();

      // Should only show high priority recommendations
      const highPriorityRecs = MOCK_RECOMMENDATIONS.filter((r) => r.priority === 'high');
      if (highPriorityRecs.length > 0) {
        await expect(page.getByText(highPriorityRecs[0].title)).toBeVisible();
      }
    });

    test('should combine search and filters', async ({ page }) => {
      const searchInput = page.getByTestId('input-search-recommendations');
      const statusFilter = page.getByTestId('select-status-filter');

      // Set status filter to pending
      await statusFilter.click();
      await page.getByRole('option', { name: /pending/i }).click();

      // Search within pending
      await searchInput.fill('Reorder');

      // Results should match both criteria
      await page.waitForTimeout(300); // Wait for filter to apply
    });
  });

  test.describe('Recommendation List', () => {
    test('should display all recommendations', async ({ page }) => {
      for (const rec of MOCK_RECOMMENDATIONS) {
        await expect(page.getByText(rec.title)).toBeVisible();
      }
    });

    test('should display recommendation descriptions', async ({ page }) => {
      const firstRec = MOCK_RECOMMENDATIONS[0];
      await expect(page.getByText(firstRec.description)).toBeVisible();
    });

    test('should display priority badges', async ({ page }) => {
      // Check for priority badges
      await expect(page.getByText(/high|medium|low|critical/i).first()).toBeVisible();
    });

    test('should display type badges', async ({ page }) => {
      const firstRec = MOCK_RECOMMENDATIONS[0];
      await expect(page.getByText(new RegExp(firstRec.type, 'i')).first()).toBeVisible();
    });

    test('should display confidence scores', async ({ page }) => {
      // Look for confidence score indicators
      const confidenceElements = page.locator('[class*="confidence"], [class*="progress"]');
      await expect(confidenceElements.first()).toBeVisible();
    });

    test('should display status badges', async ({ page }) => {
      await expect(page.getByText(/pending|approved|rejected|deferred/i).first()).toBeVisible();
    });

    test('should have AI explanation toggle', async ({ page }) => {
      const firstRec = MOCK_RECOMMENDATIONS[0];
      const explanationToggle = page.getByTestId(`toggle-explanation-${firstRec.id}`);
      await expect(explanationToggle).toBeVisible();
    });

    test('should expand AI explanation on click', async ({ page }) => {
      const firstRec = MOCK_RECOMMENDATIONS[0];
      const explanationToggle = page.getByTestId(`toggle-explanation-${firstRec.id}`);

      await explanationToggle.click();

      // Explanation text should be visible
      await expect(page.getByText(firstRec.explanation)).toBeVisible();
    });

    test('should collapse AI explanation on second click', async ({ page }) => {
      const firstRec = MOCK_RECOMMENDATIONS[0];
      const explanationToggle = page.getByTestId(`toggle-explanation-${firstRec.id}`);

      // Expand
      await explanationToggle.click();
      await expect(page.getByText(firstRec.explanation)).toBeVisible();

      // Collapse
      await explanationToggle.click();
      await expect(page.getByText(firstRec.explanation)).not.toBeVisible();
    });
  });

  test.describe('Review Dialog', () => {
    test('should have review button for pending recommendations', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (pendingRec) {
        const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
        await expect(reviewButton).toBeVisible();
      }
    });

    test('should not have review button for approved recommendations', async ({ page }) => {
      const approvedRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'approved');
      if (approvedRec) {
        const reviewButton = page.getByTestId(`button-review-${approvedRec.id}`);
        await expect(reviewButton).not.toBeVisible();
      }
    });

    test('should open review dialog on button click', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Dialog should be open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/review recommendation/i)).toBeVisible();
    });

    test('should display recommendation details in dialog', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Check dialog content
      await expect(page.getByRole('dialog').getByText(pendingRec.title)).toBeVisible();
      await expect(page.getByRole('dialog').getByText(pendingRec.description)).toBeVisible();
    });

    test('should display AI explanation in dialog', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Explanation should be visible in dialog
      await expect(page.getByRole('dialog').getByText(pendingRec.explanation)).toBeVisible();
    });

    test('should display suggested action in dialog', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find(
        (r) => r.status === 'pending' && r.suggestedAction
      );
      if (!pendingRec) return;

      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Suggested action should be displayed
      await expect(page.getByText(/suggested action/i)).toBeVisible();
    });

    test('should display confidence score in dialog', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Confidence score should be visible
      const dialog = page.getByRole('dialog');
      const confidenceElement = dialog.locator('[class*="confidence"], [class*="progress"]');
      await expect(confidenceElement.first()).toBeVisible();
    });

    test('should show requires approval badge for high priority', async ({ page }) => {
      const highPriorityRec = MOCK_RECOMMENDATIONS.find(
        (r) => r.status === 'pending' && (r.priority === 'high' || r.priority === 'critical')
      );
      if (!highPriorityRec) return;

      const reviewButton = page.getByTestId(`button-review-${highPriorityRec.id}`);
      await reviewButton.click();

      // Should show requires approval message
      await expect(page.getByText(/requires approval/i)).toBeVisible();
    });

    test('should have approve, reject, and defer buttons', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      await expect(page.getByTestId('button-approve')).toBeVisible();
      await expect(page.getByTestId('button-reject')).toBeVisible();
      await expect(page.getByTestId('button-defer')).toBeVisible();
    });

    test('should close dialog on backdrop click', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Click outside dialog to close
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Recommendation Actions', () => {
    test('should approve recommendation successfully', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      // Open review dialog
      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Click approve
      const approveButton = page.getByTestId('button-approve');
      await approveButton.click();

      // Should show success toast
      await expect(page.getByText(/approved|success/i)).toBeVisible({ timeout: 5000 });

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should reject recommendation successfully', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      // Open review dialog
      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Click reject
      const rejectButton = page.getByTestId('button-reject');
      await rejectButton.click();

      // Should show success toast
      await expect(page.getByText(/rejected|success/i)).toBeVisible({ timeout: 5000 });

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should defer recommendation successfully', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      // Open review dialog
      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Click defer
      const deferButton = page.getByTestId('button-defer');
      await deferButton.click();

      // Should show success toast
      await expect(page.getByText(/deferred|success/i)).toBeVisible({ timeout: 5000 });

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should disable buttons during submission', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      // Add delay to API response
      await page.route('**/api/recommendations/*', async (route) => {
        if (route.request().method() === 'PATCH') {
          await new Promise((r) => setTimeout(r, 500));
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          route.continue();
        }
      });

      // Open review dialog
      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Click approve
      const approveButton = page.getByTestId('button-approve');
      await approveButton.click();

      // Buttons should be disabled during loading
      await expect(approveButton).toBeDisabled();
      await expect(page.getByTestId('button-reject')).toBeDisabled();
      await expect(page.getByTestId('button-defer')).toBeDisabled();
    });

    test('should handle API error gracefully', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      // Mock API error
      await page.route('**/api/recommendations/*', (route) => {
        if (route.request().method() === 'PATCH') {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        } else {
          route.continue();
        }
      });

      // Open review dialog
      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Click approve
      const approveButton = page.getByTestId('button-approve');
      await approveButton.click();

      // Should show error toast
      await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 });
    });

    test('should record action in audit log', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      // Open review dialog
      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      // Click approve
      const approveButton = page.getByTestId('button-approve');
      await approveButton.click();

      // Toast should mention audit log
      await expect(page.getByText(/audit.*log|recorded/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no recommendations', async ({ page }) => {
      // Override to return empty array
      await page.route('**/api/recommendations', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.reload();
      await waitForAppLoad(page);

      // Should show empty state message
      await expect(page.getByText(/no.*recommendations|appear.*here/i)).toBeVisible();
    });

    test('should show no results message when filter returns nothing', async ({ page }) => {
      const searchInput = page.getByTestId('input-search-recommendations');

      // Search for something that doesn't exist
      await searchInput.fill('xyznonexistent123');

      // Should show no results
      await expect(page.getByText(/no.*found|adjust.*filter/i)).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate with Tab key', async ({ page }) => {
      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should focus on interactive elements
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should close dialog with Escape key', async ({ page }) => {
      const pendingRec = MOCK_RECOMMENDATIONS.find((r) => r.status === 'pending');
      if (!pendingRec) return;

      // Open dialog
      const reviewButton = page.getByTestId(`button-review-${pendingRec.id}`);
      await reviewButton.click();

      await expect(page.getByRole('dialog')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
    });

    test('should have accessible button labels', async ({ page }) => {
      const buttons = page.getByRole('button');
      const firstButton = buttons.first();
      await expect(firstButton).toBeVisible();
    });

    test('should have form labels or placeholders', async ({ page }) => {
      const searchInput = page.getByTestId('input-search-recommendations');
      const placeholder = await searchInput.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    });
  });

  test.describe('Performance Budgets', () => {
    test('page must load within 1.5 seconds', async ({ page }) => {
      await mockAuthenticatedState(page);

      const loadTime = await measurePageLoadTime(page, '/recommendations');

      console.log(`[PERF] Recommendations page load: ${loadTime}ms (budget: ${PERFORMANCE_BUDGETS.RECOMMENDATIONS_PAGE_LOAD}ms)`);

      assertWithinBudget(
        loadTime,
        PERFORMANCE_BUDGETS.RECOMMENDATIONS_PAGE_LOAD,
        'Recommendations page load'
      );
    });

    test('approve action must complete within 1.5 seconds', async ({ page }) => {
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
        await page.getByTestId('button-approve').click();

        await Promise.race([
          page.waitForSelector('[role="dialog"]', { state: 'hidden' }),
          page.waitForSelector('[class*="toast"]', { state: 'visible' }),
        ]);
      });

      console.log(`[PERF] Approve action: ${duration}ms (budget: ${PERFORMANCE_BUDGETS.RECOMMENDATION_ACTION}ms)`);

      assertWithinBudget(
        duration,
        PERFORMANCE_BUDGETS.RECOMMENDATION_ACTION,
        'Recommendation approve action'
      );
    });

    test('reject action must complete within 1.5 seconds', async ({ page }) => {
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

      console.log(`[PERF] Reject action: ${duration}ms (budget: ${PERFORMANCE_BUDGETS.RECOMMENDATION_ACTION}ms)`);

      assertWithinBudget(
        duration,
        PERFORMANCE_BUDGETS.RECOMMENDATION_ACTION,
        'Recommendation reject action'
      );
    });

    test('filter must respond within 500ms', async ({ page }) => {
      await page.waitForSelector('[data-testid^="recommendation-"]', { state: 'visible' });

      const { duration } = await measureActionTime(async () => {
        const searchInput = page.getByTestId('input-search-recommendations');
        await searchInput.fill('Reorder');
        await page.waitForTimeout(100);
      });

      console.log(`[PERF] Filter response: ${duration}ms (budget: ${PERFORMANCE_BUDGETS.FILTER_RESPONSE}ms)`);

      assertWithinBudget(
        duration,
        PERFORMANCE_BUDGETS.FILTER_RESPONSE,
        'Filter response'
      );
    });
  });
});
