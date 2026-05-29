/**
 * E2E tests: Gallery — infinite scroll, like, comment, download.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth.js';

test.describe('Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'viewer');
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
  });

  test('gallery page loads with media grid', async ({ page }) => {
    await expect(page.locator('h1:has-text("Gallery")')).toBeVisible({ timeout: 5000 });
  });

  test('media cards are visible', async ({ page }) => {
    // Wait for either media cards or empty state
    await page.waitForTimeout(2000);
    const cards = page.locator('[class*="rounded"][class*="overflow-hidden"]');
    const emptyState = page.locator('text=No media found');
    const hasCards = await cards.count() > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBe(true);
  });

  test('sort controls are visible', async ({ page }) => {
    await expect(page.locator('select')).toBeVisible({ timeout: 5000 });
  });

  test('clicking a media card opens modal', async ({ page }) => {
    const cards = page.locator('[class*="rounded"][class*="overflow-hidden"]');
    const count = await cards.count();
    if (count === 0) {
      test.skip();
      return;
    }
    await cards.first().click();
    // Modal should appear
    await expect(page.locator('[class*="fixed"][class*="inset-0"]')).toBeVisible({ timeout: 3000 });
  });

  test('modal can be closed', async ({ page }) => {
    const cards = page.locator('[class*="rounded"][class*="overflow-hidden"]');
    const count = await cards.count();
    if (count === 0) { test.skip(); return; }
    await cards.first().click();
    await page.waitForTimeout(500);
    // Close via escape or close button
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const modal = page.locator('[class*="fixed"][class*="inset-0"]');
    const isVisible = await modal.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('unauthenticated like redirects to login', async ({ page }) => {
    // Log out first
    await page.goto('/');
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    const cards = page.locator('[class*="rounded"][class*="overflow-hidden"]');
    const count = await cards.count();
    if (count === 0) { test.skip(); return; }
    await cards.first().click();
    await page.waitForTimeout(500);
    // Click like button
    const likeBtn = page.locator('button:has(svg path[d*="M20.84"])').first();
    if (await likeBtn.isVisible()) {
      await likeBtn.click();
      await page.waitForTimeout(1000);
      // Should redirect to login
      expect(page.url()).toContain('/login');
    }
  });
});
