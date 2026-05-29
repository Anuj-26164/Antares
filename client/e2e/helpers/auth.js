/**
 * Reusable auth helpers for Playwright E2E tests.
 */

export const TEST_USERS = {
  admin:        { email: 'admin@antares.test',  password: 'Admin1234!',  name: 'Seed Admin' },
  photographer: { email: 'photo@antares.test',  password: 'Photo1234!',  name: 'Seed Photographer' },
  viewer:       { email: 'viewer@antares.test', password: 'Viewer1234!', name: 'Seed Viewer' },
};

/**
 * Log in via the UI and wait for redirect.
 */
export async function loginAs(page, role = 'viewer') {
  const user = TEST_USERS[role];
  await page.goto('/login');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
}

/**
 * Log out via the UI.
 */
export async function logout(page) {
  // Click avatar/profile button to open dropdown
  await page.click('[aria-label*="Profile"], button:has-text("Log Out"), [data-testid="avatar-btn"]');
  await page.click('button:has-text("Log Out")');
  await page.waitForURL('/', { timeout: 5_000 });
}

/**
 * Register a new user via the UI.
 */
export async function registerUser(page, { name, email, password }) {
  await page.goto('/register');
  await page.fill('input[name="name"], input[placeholder*="name" i]', name);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}
