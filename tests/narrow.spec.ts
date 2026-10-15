import { test, expect } from './fixtures';

test.use({ viewport: { width: 320, height: 720 }, video: { mode: 'on', size: { width: 320, height: 720 } } });

test('small-screen help and studio remain accessible with no page overflow or external assets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith(new URL(test.info().project.use.baseURL || 'http://127.0.0.1:5173').origin)) external.push(request.url()); });
  await page.goto('./'); await expect(page.getByRole('heading', { name: 'A change of scenery' })).toBeVisible(); await page.evaluate(() => document.fonts.ready.then(() => {}));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Let’s make something click', exact: true }).click();
  await page.getByRole('button', { name: /Creative studio/ }).click();
  await page.getByRole('button', { name: 'Node root: Sky color', exact: true }).click();
  await page.getByRole('button', { name: 'Split region', exact: true }).click();
  await expect(page.locator('.tree-node')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(external).toEqual([]);
});

