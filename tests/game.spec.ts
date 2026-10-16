import { test, expect, finishAudio } from './fixtures';
import type { Page } from '@playwright/test';
import { revealNode, clickNode, treeIds } from './navigation';

async function open(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'A change of scenery' })).toBeVisible();
}
async function tapOrClick(page: Page, name: string) {
  const id = /^Node ([^:]+):/.exec(name)?.[1];
  if (id) await revealNode(page, id);
  const button = page.getByRole('button', { name, exact: true });
  if (test.info().project.name === 'mobile') await button.tap(); else await button.click();
}
test('first puzzle supports input, undo, reset, score, and persistent progress', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  const pictures = page.locator('.picture-panel .picture-section');
  await expect(pictures.nth(0)).toContainText('YOUR PICTURE');
  await expect(pictures.nth(1)).toContainText('THE TARGET');
  const source = (await pictures.nth(0).boundingBox())!, target = (await pictures.nth(1).boundingBox())!;
  if (test.info().project.name === 'desktop') expect(source.y + source.height).toBeLessThan(target.y);
  else expect(source.x + source.width).toBeLessThan(target.x);
  for (const axis of await page.locator('.picture-panel .axis-y').all()) {
    await expect(axis.locator('svg.lucide-arrow-up')).toHaveCount(1);
    expect(await axis.evaluate(el => getComputedStyle(el).writingMode)).toBe('horizontal-tb');
  }
  await page.screenshot({ path: `tmp/initial-${test.info().project.name}.png` });
  await tapOrClick(page, 'Node b: Peach color');
  await expect(page.getByRole('button', { name: 'Node b: Peach color', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await tapOrClick(page, 'Node c: Sky color');
  await expect(page.getByText('Everything clicked.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Your picture, 100 percent matching', exact: true })).toBeVisible();
  await expect(page.locator('.success-card .stars')).toHaveAttribute('aria-label', '3 of 3 stars');
  await expect(page.locator('.tree-area')).toBeHidden();
  await page.getByRole('button', { name: 'Show puzzle again', exact: true }).click();
  await expect(page.locator('.tree-area')).toBeVisible();
  await expect(page.locator('.feedback-burst')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('reviewed-tree.png') });
  await expect(page.getByRole('img', { name: 'Your picture, 100 percent matching', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hide puzzle', exact: true }).click();
  await expect(page.locator('.tree-area')).toBeHidden();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('Everything clicked.')).not.toBeVisible();
  await tapOrClick(page, 'Node b: Peach color');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.stats-row strong').nth(1)).toHaveText('00');
  await finishAudio(page); await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('branch-bloom-progress-v1') || '{}')['1'])).toBe(1);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the full campaign is solvable through the interface, including subtree moves', async ({ page }) => {
  test.setTimeout(90000);
  await open(page);
  for (let level = 0; level < 12; level++) {
    for (let move = 0; move < 8 && !(await page.locator('.success-card').count()); move++) {
      await page.getByRole('button', { name: 'A little hint', exact: true }).click();
      const names = await page.locator('.tree-node.hinted').evaluateAll(elements => elements.map(el => el.getAttribute('aria-label')!));
      expect(names).toHaveLength(2); await tapOrClick(page, names[0]); await tapOrClick(page, names[1]);
    }
    await expect(page.locator('.success-card')).toBeVisible();
    if (level === 9) await page.screenshot({ path: `tmp/subtree-${test.info().project.name}.png` });
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

test('drag swaps nodes without leaving a stale selection', async ({ page, context }) => {
  await open(page);
  await page.getByRole('button', { name: 'Node b: Peach color', exact: true }).scrollIntoViewIfNeeded();
  const source = await page.getByRole('button', { name: 'Node b: Peach color', exact: true }).boundingBox();
  const target = await page.getByRole('button', { name: 'Node c: Sky color', exact: true }).boundingBox();
  async function inspectPhantom() {
    const phantom = page.locator('.drag-ghost');
    await expect(phantom).toBeVisible(); await expect(phantom).toHaveText('Peach');
    await expect(phantom).toHaveCSS('pointer-events', 'none');
    const box = (await phantom.boundingBox())!;
    expect(box.x).toBeCloseTo((source!.x + target!.x) / 2, 0);
    expect(box.width).toBeCloseTo(source!.width, 0); expect(box.height).toBeCloseTo(source!.height, 0);
    const original = (await page.getByRole('button', { name: 'Node b: Peach color', exact: true }).boundingBox())!;
    expect(original.x).toBeCloseTo(source!.x, 0); expect(original.y).toBeCloseTo(source!.y, 0);
    await page.screenshot({ path: test.info().outputPath('drag-phantom.png') });
    await page.waitForTimeout(400);
  }
  if (test.info().project.name === 'mobile') {
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: source!.x + source!.width / 2, y: source!.y + source!.height / 2 }] });
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    for (let step = 1; step <= 12; step++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: source!.x + source!.width / 2 + (target!.x - source!.x) * step / 12, y: target!.y + target!.height / 2 }] });
      if (step === 6) {
        await inspectPhantom();
      }
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2); await page.mouse.down();
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    await page.mouse.move((source!.x + target!.x) / 2 + source!.width / 2, source!.y + source!.height / 2, { steps: 6 });
    await inspectPhantom();
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 12 }); await page.mouse.up();
  }
  await expect(page.getByText('Everything clicked.')).toBeVisible();
  await expect(page.locator('.tree-node.selected')).toHaveCount(0);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
});

test('plays the entire campaign without hints and keeps target previews available', async ({ page }) => {
  test.setTimeout(90000);
  const { levels } = await import('../src/engine');
  await open(page);
  for (const level of levels) {
    await expect(page.getByRole('heading', { name: level.title, exact: true })).toBeVisible();
    for (const [a, b] of [...level.scramble].reverse()) {
      for (const id of [a, b]) {
        await clickNode(page, id);
      }
    }
    await expect(page.getByRole('img', { name: 'Your picture, 100 percent matching', exact: true })).toBeVisible();
    await expect(page.locator('.success-card .stars')).toHaveAttribute('aria-label', '3 of 3 stars');
    await page.locator('.success-card').scrollIntoViewIfNeeded();
    if (test.info().project.name === 'mobile') {
      const target = await page.getByRole('img', { name: 'Target pixel art to recreate', exact: true }).boundingBox();
      expect(target!.y).toBeGreaterThanOrEqual(0);
      expect(target!.y + target!.height).toBeLessThan(844);
    }
    await page.waitForTimeout(650); // Let the win animation play in the review recording.
    if (level.id < 12) await page.locator('.game-actions').getByRole('button', { name: 'Next puzzle', exact: true }).click();
  }
  await page.getByRole('button', { name: 'See your journey', exact: true }).click();
  await expect(page.getByText('12 of 12 pictures restored.', { exact: false })).toBeVisible();
});

test('sound, reduced motion, mistakes, recovery, and fit controls stay usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await tapOrClick(page, 'Node b: Peach color');
  expect(await page.evaluate(() => (window as unknown as { __qaAudio: { notes: number } }).__qaAudio.notes)).toBe(0);
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { __qaAudio: { notes: number } }).__qaAudio.notes)).toBe(1);
  await tapOrClick(page, 'Node c: Sky color');
  await expect(page.getByText('Everything clicked.')).toBeVisible();
  await expect(page.locator('.feedback-burst')).toHaveCSS('display', 'none');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Fit whole tree', exact: true }).click();
  await page.getByRole('button', { name: 'Show tree at actual size', exact: true }).click();
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await finishAudio(page); await page.reload();
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'The puzzles', exact: true }).click();
  await page.getByRole('button', { name: /Preview: Wild growth/ }).click();
  await clickNode(page, 'a');
  await clickNode(page, 'b');
  await expect(page.getByRole('status')).toContainText('Choose separate branches');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'A little hint', exact: true }).click();
  await expect(page.locator('.hinted')).toHaveCount(2);
});

test('studio builds a full 31-node mosaic and handles its limit without losing work', async ({ page }) => {
  test.setTimeout(90000);
  await open(page); await page.getByRole('button', { name: /Creative studio/ }).click();
  const queue = [{ id: 'root', x0: 0, x1: 8, y0: 0, y1: 8, depth: 0 }];
  const colors = ['Rose', 'Honey', 'Forest', 'Blue', 'Lilac', 'Peach', 'Sky', 'Cream'];
  let painted = 0;
  while (queue.length) {
    const region = queue.shift()!;
    const selector = await revealNode(page, region.id);
    await selector.click();
    if (region.depth === 4) { await page.getByRole('button', { name: `Paint ${colors[painted++ % colors.length]}`, exact: true }).click(); continue; }
    const axis = region.depth % 2 === 0 ? 'x' : 'y';
    const value = axis === 'x' ? (region.x0 + region.x1) / 2 : (region.y0 + region.y1) / 2;
    await page.getByLabel('Split axis', { exact: true }).selectOption(axis);
    await page.getByLabel('Split coordinate', { exact: true }).selectOption(String(value));
    const previous = new Set(await treeIds(page));
    await page.getByRole('button', { name: 'Split region', exact: true }).click();
    const added = (await treeIds(page)).filter(id => !previous.has(id));
    const yes = added.find(id => id.endsWith('-yes'))!, no = added.find(id => id.endsWith('-no'))!;
    queue.push({ ...region, id: yes, depth: region.depth + 1, ...(axis === 'x' ? { x1: value } : { y1: value }) });
    queue.push({ ...region, id: no, depth: region.depth + 1, ...(axis === 'x' ? { x0: value } : { y0: value }) });
  }
  expect(await treeIds(page)).toHaveLength(31);
  await expect(page.getByRole('button', { name: 'Split region', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Fit whole tree', exact: true }).click();
  await page.locator('.tree-scroll').scrollIntoViewIfNeeded(); await page.waitForTimeout(700);
  expect(await page.locator('.tree-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'The puzzles', exact: true }).click();
  await page.getByRole('button', { name: /Creative studio/ }).click();
  expect(await treeIds(page)).toHaveLength(31);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save picture', exact: true }).click();
  const download = await downloadPromise; await download.saveAs(test.info().outputPath('mosaic.png'));
  await (await revealNode(page, 'root')).click();
  await expect(page.getByLabel('Split axis', { exact: true })).toHaveValue('x');
  await page.getByRole('button', { name: 'Collapse branch to selected color' }).click();
  await expect(page.locator('.tree-node')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await treeIds(page)).toHaveLength(31);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.tree-node')).toHaveCount(1);
  const rootBounds = await page.getByRole('button', { name: /^Node root:/ }).boundingBox();
  const canvasBounds = await page.locator('.tree-scroll').boundingBox();
  expect(Math.abs(rootBounds!.x + rootBounds!.width / 2 - (canvasBounds!.x + canvasBounds!.width / 2))).toBeLessThan(3);
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
