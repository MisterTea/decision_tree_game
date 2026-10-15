import { test, expect } from './fixtures';

test.use({ viewport: { width: 800, height: 1000 }, video: { mode: 'on', size: { width: 800, height: 1000 } } });

test('dragging at the pane edge reveals a distant card and drops on its new position', async ({ page, context }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'The puzzles', exact: true }).click();
  await page.getByRole('button', { name: /Preview: A place in the sun/ }).click();
  const pane = page.locator('.tree-scroll');
  await pane.scrollIntoViewIfNeeded();
  await pane.evaluate(element => { element.scrollLeft = 0; element.scrollTop = 0; });
  const bounds = (await pane.boundingBox())!;
  const source = page.getByRole('button', { name: 'Node d: Peach color', exact: true });
  const destination = page.getByRole('button', { name: 'Node i: Forest color', exact: true });
  const start = (await source.boundingBox())!;
  expect((await destination.boundingBox())!.x + (await destination.boundingBox())!.width).toBeGreaterThan(bounds.x + bounds.width);
  const scrollBefore = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  const touch = test.info().project.name === 'mobile' ? await context.newCDPSession(page) : null;
  async function move(x: number, y: number) {
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    else await page.mouse.move(x, y, { steps: 8 });
  }
  const x = start.x + start.width / 2, y = start.y + start.height / 2;
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  else { await page.mouse.move(x, y); await page.mouse.down(); }
  await move(bounds.x + bounds.width - 8, bounds.y + bounds.height - 8);
  // No pointer moves here: holding at the edge must keep the pane moving.
  await expect.poll(() => pane.evaluate(element => element.scrollLeft)).toBeGreaterThan(100);
  await expect.poll(() => pane.evaluate(element => element.scrollTop)).toBeGreaterThan(10);
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('edge-scroll.png') });
  const target = (await destination.boundingBox())!;
  expect(target.x).toBeGreaterThanOrEqual(bounds.x); expect(target.x + target.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  await move(target.x + target.width / 2, target.y + target.height / 2);
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Node i: Peach color', exact: true })).toBeVisible();
  await expect(page.locator('.stats-row strong').nth(1)).toHaveText('01');
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(page.locator('.tree-node.selected')).toHaveCount(0);
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(scrollBefore);
  const stopped = await pane.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }));
  await page.waitForTimeout(150);
  expect(await pane.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }))).toEqual(stopped);
  await page.screenshot({ path: test.info().outputPath('distant-drop.png') });
  await page.getByRole('button', { name: 'Fit whole tree', exact: true }).click();
  await expect.poll(() => pane.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1)).toBe(true);
});
