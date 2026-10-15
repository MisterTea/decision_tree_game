import { beforeEach, expect, test, vi } from 'vitest';
import { startDragScroll } from './drag-scroll';

let callbacks: FrameRequestCallback[];
let time: number;
beforeEach(() => {
  callbacks = []; time = 0;
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('innerWidth', 1000); vi.stubGlobal('innerHeight', 800);
});
function pane(width = 1200, height = 900) {
  const element = document.createElement('div');
  Object.defineProperties(element, { scrollWidth: { value: width }, clientWidth: { value: 400 }, scrollHeight: { value: height }, clientHeight: { value: 300 } });
  element.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 400 } as DOMRect);
  return element;
}
function frame(ms = 16) { time += ms; callbacks.shift()!(time); }

test('does not schedule scrolling for an absent pane or a fitted tree', () => {
  startDragScroll(null, () => null)(); startDragScroll(pane(400, 300), () => null)(); startDragScroll(pane(401, 301), () => null)();
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
test('keeps scrolling toward the edge with a stationary pointer and stops immediately on cancellation', () => {
  const element = pane(); const stop = startDragScroll(element, () => ({ x: 495, y: 250 }));
  frame(); const first = element.scrollLeft; expect(first).toBeGreaterThan(0); expect(element.scrollTop).toBe(0);
  frame(); expect(element.scrollLeft).toBeGreaterThan(first);
  stop(); expect(cancelAnimationFrame).toHaveBeenCalled(); const last = element.scrollLeft;
  frame(); expect(element.scrollLeft).toBe(last); expect(callbacks).toHaveLength(0);
});
test('scrolls both axes, reverses direction, and clamps at the pane limits', () => {
  const element = pane(); element.scrollLeft = 799; element.scrollTop = 599;
  let pointer = { x: 510, y: 410 }; startDragScroll(element, () => pointer);
  frame(); expect(element.scrollLeft).toBe(800); expect(element.scrollTop).toBe(600);
  pointer = { x: 90, y: 90 }; frame(); expect(element.scrollLeft).toBeLessThan(800); expect(element.scrollTop).toBeLessThan(600);
  element.scrollLeft = 1; element.scrollTop = 1; frame(); expect(element.scrollLeft).toBe(0); expect(element.scrollTop).toBe(0);
});
test('does not pan in the center or when dragged well outside the pane', () => {
  const element = pane(); element.scrollLeft = 200; element.scrollTop = 200;
  let pointer = { x: 300, y: 250 }; startDragScroll(element, () => pointer);
  frame(); expect(element.scrollLeft).toBe(200); expect(element.scrollTop).toBe(200);
  for (pointer of [{ x: 50, y: 250 }, { x: 550, y: 250 }, { x: 300, y: 50 }, { x: 300, y: 450 }]) frame();
  expect(element.scrollLeft).toBe(200); expect(element.scrollTop).toBe(200);
});
test('uses the visible viewport edges and bounds the speed after a suspended frame', () => {
  const element = pane(); element.getBoundingClientRect = () => ({ left: -100, right: 1100, top: -100, bottom: 900 } as DOMRect);
  startDragScroll(element, () => ({ x: 999, y: 799 })); frame(1000);
  expect(element.scrollLeft).toBeGreaterThan(0); expect(element.scrollLeft).toBeLessThanOrEqual(720 * .032);
  expect(element.scrollTop).toBeGreaterThan(0);
});
test('stops scheduling when the drag ends and ignores a pane outside the visible screen', () => {
  const element = pane(); let pointer: { x: number; y: number } | null = { x: 495, y: 395 };
  element.getBoundingClientRect = () => ({ left: 1100, right: 1500, top: 900, bottom: 1200 } as DOMRect);
  startDragScroll(element, () => pointer); frame(); expect(element.scrollLeft).toBe(0);
  pointer = null; frame(); expect(callbacks).toHaveLength(0);
});
