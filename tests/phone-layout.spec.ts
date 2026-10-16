import { test, expect } from './fixtures';
import { clickNode, expectNoPlayScroll } from './navigation';
import { levels, nodes } from '../src/engine';

test('entire campaign and studio use one scrollable tree pane with visible controls', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('./'); await expect(page.locator('.compact-play')).toBeVisible();
  for (const level of levels) {
    await expect(page.locator('.tree-node')).toHaveCount(nodes(level.initial).length);
    await expect(page.getByRole('combobox', { name: 'Explore tree' })).toHaveCount(0);
    await expectNoPlayScroll(page);
    if (level.id === 2) {
      await page.getByRole('button', { name: 'A little hint', exact: true }).tap();
      await expectNoPlayScroll(page);
    }
    for (const [a, b] of [...level.scramble].reverse()) {
      await clickNode(page, a); await expectNoPlayScroll(page);
      await clickNode(page, b); await expectNoPlayScroll(page);
    }
    await expect(page.locator('.success-card')).toBeVisible();
    await expect(page.locator('.tree-area')).toBeHidden();
    if (level.id === 1 || level.id === 12) {
      await page.getByRole('button', { name: 'Show puzzle again', exact: true }).tap();
      await expect(page.locator('.feedback-burst')).toHaveCount(0);
      await expect(page.locator('.tree-area')).toBeVisible(); await expectNoPlayScroll(page);
      await page.getByRole('button', { name: 'Hide puzzle', exact: true }).tap();
      await expect(page.locator('.tree-area')).toBeHidden(); await expectNoPlayScroll(page);
    }
    if (level.id === 1 || level.id === 12) await page.screenshot({ path: test.info().outputPath(`level-${level.id}.png`) });
    if (level.id < 12) await page.locator('.game-actions').getByRole('button', { name: 'Next puzzle', exact: true }).tap();
  }
  await page.getByRole('button', { name: /Creative studio/ }).tap();
  await expectNoPlayScroll(page);
  await clickNode(page, 'root');
  await page.getByRole('button', { name: 'Split region', exact: true }).tap();
  await expectNoPlayScroll(page);
  await page.getByLabel('Split axis', { exact: true }).selectOption('y');
  await page.getByLabel('Split coordinate', { exact: true }).selectOption('3');
  await page.getByRole('button', { name: 'Update rule', exact: true }).tap();
  const firstLeaf = await page.locator('.tree-node.leaf').first().getAttribute('aria-label');
  await page.getByRole('button', { name: firstLeaf!, exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: firstLeaf!, exact: true }).tap();
  await page.getByRole('button', { name: 'Paint Rose', exact: true }).tap();
  await expectNoPlayScroll(page);
  await page.getByRole('button', { name: 'Split region', exact: true }).tap();
  await expectNoPlayScroll(page);
  await page.locator('.tree-node.leaf').first().scrollIntoViewIfNeeded();
  await page.locator('.tree-node.leaf').first().tap();
  await page.getByRole('button', { name: 'Paint Honey', exact: true }).tap();
  await expectNoPlayScroll(page);
  await page.screenshot({ path: test.info().outputPath('studio.png') });
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save picture', exact: true }).tap(); await downloadPromise;
  await page.getByRole('button', { name: 'Undo', exact: true }).tap();
  await expectNoPlayScroll(page);
});
