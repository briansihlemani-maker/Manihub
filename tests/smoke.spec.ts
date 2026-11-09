import { test, expect } from '@playwright/test';

test('login screen loads and the Supabase backend responds', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.locator('.backend-status.connected')).toBeVisible({ timeout: 20000 });
});

test('registration screen opens and exposes the required fields', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.locator('input[name="display_name"]')).toBeVisible();
  await expect(page.locator('input[name="identifier"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.locator('select[name="account_type"]')).toBeVisible();
});

test('password recovery screen opens and returns to sign in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await expect(page.locator('input[name="identifier"][type="email"]')).toBeVisible();
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('layout stays usable at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await page.goto('/');
  await expect(page.locator('.auth-card')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
