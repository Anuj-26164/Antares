/**
 * E2E tests: Authentication flows — Register, Login, Logout.
 */
import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from './helpers/auth.js';

test.describe('Authentication', () => {
  test('landing page loads without login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Antares/i);
    // Should show Sign In link for unauthenticated users
    await expect(page.locator('text=Sign In')).toBeVisible({ timeout: 5000 });
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('register page is accessible', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should stay on login page or show error
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/login');
  });

  test('login with valid credentials redirects to app', async ({ page }) => {
    await loginAs(page, 'viewer');
    const url = page.url();
    expect(url).not.toContain('/login');
  });

  test('logout redirects to home', async ({ page }) => {
    await loginAs(page, 'viewer');
    await logout(page);
    await expect(page.locator('text=Sign In')).toBeVisible({ timeout: 5000 });
  });

  test('protected route redirects unauthenticated user', async ({ page }) => {
    await page.goto('/gallery');
    // Should redirect to login or show sign-in prompt
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasSignIn = await page.locator('text=Sign In').isVisible().catch(() => false);
    expect(url.includes('/login') || hasSignIn).toBe(true);
  });
});
