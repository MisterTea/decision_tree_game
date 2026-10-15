import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'A change of scenery' })).toBeVisible();
}
async function tapOrClick(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  if (test.info().project.name === 'mobile') await button.tap(); else await button.click();
}
test('first puzzle supports input, undo, reset, score, and persistent progress', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await page.screenshot({ path: `tmp/initial-${test.info().project.name}.png`, fullPage: true });
  await tapOrClick(page, 'Node b: Peach color');
  await expect(page.getByRole('button', { name: 'Node b: Peach color', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await tapOrClick(page, 'Node c: Sky color');
  await expect(page.getByText('Everything clicked.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Your picture, 100 percent matching', exact: true })).toBeVisible();
  await expect(page.locator('.success-card .stars')).toHaveAttribute('aria-label', '3 of 3 stars');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('Everything clicked.')).not.toBeVisible();
  await tapOrClick(page, 'Node b: Peach color');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.stats-row strong').nth(1)).toHaveText('00');
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('branch-bloom-progress-v1') || '{}')['1'])).toBe(1);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the full campaign is solvable through the interface, including subtree moves', async ({ page }) => {
  await open(page);
  for (let level = 0; level < 12; level++) {
    for (let move = 0; move < 8 && !(await page.locator('.success-card').count()); move++) {
      await page.getByRole('button', { name: 'A little hint', exact: true }).click();
      const names = await page.locator('.tree-node.hinted').evaluateAll(elements => elements.map(el => el.getAttribute('aria-label')!));
      expect(names).toHaveLength(2);
      await tapOrClick(page, names[0]); await tapOrClick(page, names[1]);
    }
    await expect(page.locator('.success-card')).toBeVisible();
    if (level === 9) await page.screenshot({ path: `tmp/subtree-${test.info().project.name}.png`, fullPage: true });
    if (level < 11) await page.locator('.game-actions').getByRole('button', { name: 'Next puzzle', exact: true }).click();
  }
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('branch-bloom-progress-v1') || '{}')).length)).toBe(12);
  await page.getByRole('button', { name: 'See your journey' }).click();
  await expect(page.getByRole('heading', { name: 'Your growing collection.' })).toBeVisible();
  await expect(page.getByText('12 of 12 pictures restored.', { exact: false })).toBeVisible();
});

test('studio can split, paint, update, collapse, undo, and export', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Creative studio', exact: false }).click();
  await tapOrClick(page, 'Node root: Sky color');
  await page.getByRole('button', { name: 'Split region', exact: true }).click();
  await expect(page.locator('.tree-node')).toHaveCount(3);
  await expect(page.getByRole('img', { name: 'Your pixel art canvas' })).toBeVisible();
  await page.getByRole('button', { name: 'Update rule', exact: true }).click();
  const leafName = await page.locator('.tree-node.leaf').first().getAttribute('aria-label');
  await tapOrClick(page, leafName!);
  await page.getByRole('button', { name: 'Paint Rose', exact: true }).click();
  await expect(page.locator('.tree-node.leaf').first()).toContainText('Rose');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save picture', exact: true }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe('branch-and-bloom.png');
  await tapOrClick(page, 'Node root: x less than 4');
  await page.getByRole('button', { name: 'Collapse branch to selected color' }).click();
  await expect(page.locator('.tree-node')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.tree-node')).toHaveCount(3);
});

test('mouse drag swaps nodes without leaving a stale selection', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'Mouse drag is tested on desktop; tap is tested on mobile.');
  await open(page);
  const source = await page.getByRole('button', { name: 'Node b: Peach color', exact: true }).boundingBox();
  const target = await page.getByRole('button', { name: 'Node c: Sky color', exact: true }).boundingBox();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2); await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 12 }); await page.mouse.up();
  await expect(page.getByText('Everything clicked.')).toBeVisible();
  await expect(page.locator('.tree-node.selected')).toHaveCount(0);
});

test('keyboard selection and dialog focus work', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Node b: Peach color', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.getByText('Everything clicked.')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.success-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'The puzzles', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
