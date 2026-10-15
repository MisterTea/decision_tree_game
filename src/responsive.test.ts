import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { COMPACT_QUERY, useCompactScreen } from './responsive';

test('falls back to desktop when media queries are unavailable', () => {
  vi.stubGlobal('matchMedia', undefined);
  const { result } = renderHook(useCompactScreen);
  expect(result.current).toBe(false);
});
test('tracks phone and orientation changes, then removes its listener', () => {
  let listener = () => {};
  const remove = vi.fn();
  const media = { matches: true, addEventListener: vi.fn((_event, callback) => { listener = callback; }), removeEventListener: remove };
  const match = vi.fn(() => media); vi.stubGlobal('matchMedia', match);
  const { result, unmount } = renderHook(useCompactScreen);
  expect(match).toHaveBeenCalledWith(COMPACT_QUERY); expect(result.current).toBe(true);
  act(() => { media.matches = false; listener(); }); expect(result.current).toBe(false);
  act(() => { media.matches = true; listener(); }); expect(result.current).toBe(true);
  unmount(); expect(remove).toHaveBeenCalledWith('change', listener);
});
