import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function revealNode(page: Page, id: string) {
  const explorer = page.getByRole('combobox', { name: 'Explore tree', exact: true });
  const node = page.getByRole('button', { name: new RegExp(`^Node ${id}:`) });
  if (await explorer.isVisible() && !(await node.isVisible())) await explorer.selectOption(id);
  return node;
}
export async function clickNode(page: Page, id: string) {
  const node = await revealNode(page, id);
  if (await page.locator('.compact-play').count()) await node.tap(); else await node.click();
}
export async function treeIds(page: Page) {
  const explorer = page.getByRole('combobox', { name: 'Explore tree', exact: true });
  if (await explorer.isVisible()) return explorer.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  return page.locator('.tree-node').evaluateAll(elements => elements.map(el => el.getAttribute('aria-label')!.split(':')[0].slice(5)));
}
export async function expectNoPlayScroll(page: Page) {
  const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, x: scrollX, y: scrollY }));
  expect(geometry.scrollWidth, 'Page must fit horizontally').toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.scrollHeight, 'Page must fit vertically').toBeLessThanOrEqual(geometry.height + 1);
  expect(geometry.x).toBe(0); expect(geometry.y).toBe(0);
  const showingCompletion = await page.locator('.completion-panel').isVisible();
  for (const selector of ['.picture-panel', '.logic-toolbar', '.game-actions', showingCompletion ? '.completion-panel' : '.tree-scroll', '.puzzle-header', '.puzzle-navigation']) {
    if ((selector === '.puzzle-navigation' || selector === '.logic-toolbar' || selector === '.puzzle-header') && !(await page.locator(selector).isVisible())) continue;
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} must remain visible`).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1); expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(geometry.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(geometry.height + 1);
    if (selector === '.game-actions' || selector === '.picture-panel') {
      const board = await page.locator('.game-board').boundingBox();
      expect(box!.y + box!.height, `${selector} must fit inside the board`).toBeLessThanOrEqual(board!.y + board!.height + 1);
    }
  }
  const clipping = showingCompletion ? [] : await page.locator('.tree-scroll').evaluate(container => {
    const bounds = container.getBoundingClientRect();
    return [...container.querySelectorAll('.tree-node')].filter(node => {
      const box = node.getBoundingClientRect();
      return box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1;
    }).map(node => node.getAttribute('aria-label'));
  });
  expect(clipping, 'Visible node cards must not be cut off').toEqual([]);
  const clippedControls = await page.locator('.game-board').evaluate(board => {
    const bounds = board.getBoundingClientRect();
    return [...board.querySelectorAll('button, select, input, .pixel-frame')].filter(control => {
      const box = control.getBoundingClientRect();
      return box.width && box.height && (box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1);
    }).map(control => control.getAttribute('aria-label') || control.textContent);
  });
  expect(clippedControls, 'All play controls and previews must fit inside the board').toEqual([]);
  if (!showingCompletion && await page.locator('.branch-view').count()) {
    for (const card of await page.locator('.tree-node').all()) {
      const box = await card.boundingBox();
      expect(box!.height, 'Branch cards must remain readable and tappable').toBeGreaterThanOrEqual(36);
    }
  }
}
