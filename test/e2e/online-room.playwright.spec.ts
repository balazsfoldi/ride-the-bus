import { expect, test } from '@playwright/test';

test('can join the online room and see the player identity', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /online/i }).click();
  await page.getByLabel('Your name').fill('Solo');
  await page.getByRole('button', { name: /join/i }).click();

  await expect(page.getByText('Connected as')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solo' })).toBeVisible();
  await expect(page.getByRole('button', { name: /start game/i })).toBeVisible();
});
