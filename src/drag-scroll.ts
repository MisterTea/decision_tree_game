type Point = { x: number; y: number };

// Scroll only the tree viewport. A frame loop also works while the pointer is held still.
export function startDragScroll(pane: HTMLElement | null, point: () => Point | null) {
  if (!pane || (pane.scrollWidth <= pane.clientWidth + 1 && pane.scrollHeight <= pane.clientHeight + 1)) return () => {};
  let running = true;
  let previous = performance.now();
  let frame: number;
  function speed(position: number, start: number, end: number) {
    const band = Math.min(56, (end - start) / 3);
    if (position < start + band) return -720 * Math.min(1, (start + band - position) / band) ** 2;
    if (position > end - band) return 720 * Math.min(1, (position - end + band) / band) ** 2;
    return 0;
  }
  function tick(now: number) {
    if (!running) return;
    const pointer = point();
    if (!pointer) return;
    const elapsed = Math.min(32, Math.max(0, now - previous)) / 1000;
    previous = now;
    const bounds = pane!.getBoundingClientRect();
    const left = Math.max(0, bounds.left), right = Math.min(innerWidth, bounds.right);
    const top = Math.max(0, bounds.top), bottom = Math.min(innerHeight, bounds.bottom);
    if (right > left && bottom > top && pointer.x >= left - 24 && pointer.x <= right + 24 && pointer.y >= top - 24 && pointer.y <= bottom + 24) {
      const dx = speed(pointer.x, left, right) * elapsed, dy = speed(pointer.y, top, bottom) * elapsed;
      pane!.scrollLeft = Math.max(0, Math.min(pane!.scrollWidth - pane!.clientWidth, pane!.scrollLeft + dx));
      pane!.scrollTop = Math.max(0, Math.min(pane!.scrollHeight - pane!.clientHeight, pane!.scrollTop + dy));
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return () => { running = false; cancelAnimationFrame(frame); };
}
