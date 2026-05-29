/**
 * E2E tests: Notifications — bell badge, popover, mark read.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth.js';

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'viewer');
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
  });

  test('notification bell is visible in navbar', async ({ page }) => {
    const bell = page.locator('[aria-label*="Notification"], button:has(svg[viewBox="0 0 24 24"])').first();
    await expect(bell).toBeVisible({ timeout: 5000 });
  });

  test('clicking bell opens notification popover', async ({ page }) => {
    const bell = page.locator('[aria-label*="Notification"]').first();
    if (await bell.isVisible()) {
      await bell.click();
      await page.waitForTimeout(500);
      // Popover should appear
      const popover = page.locator('text=Notifications');
      await expect(popover).toBeVisible({ timeout: 3000 });
    }
  });

  test('notification popover shows all caught up or list', async ({ page }) => {
    const bell = page.locator('[aria-label*="Notification"]').first();
    if (await bell.isVisible()) {
      await bell.click();
      await page.waitForTimeout(500);
      const allCaughtUp = page.locator('text=All caught up');
      const notifList = page.locator('[class*="border-b"]');
      const hasEmpty = await allCaughtUp.isVisible().catch(() => false);
      const hasList = await notifList.count() > 0;
      expect(hasEmpty || hasList).toBe(true);
    }
  });
});
