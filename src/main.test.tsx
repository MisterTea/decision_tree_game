import { expect, test, vi } from 'vitest';
const render = vi.hoisted(() => vi.fn());
vi.mock('react-dom/client', () => ({ default: { createRoot: () => ({ render }) } }));
test('mounts the game in the application root', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await import('./main');
  expect(render).toHaveBeenCalledOnce();
});
