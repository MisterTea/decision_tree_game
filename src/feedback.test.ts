import { beforeEach, expect, test, vi } from 'vitest';
import { createSoundPlayer, readSoundEnabled, saveSoundEnabled } from './feedback';

function fakeAudio(state: AudioContextState = 'running') {
  const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const oscillators: { type: string; frequency: ReturnType<typeof param>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended?: () => void }[] = [];
  const gains: { gain: ReturnType<typeof param>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = { state, currentTime: 2, destination: {}, resume: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => { const oscillator = { type: '', frequency: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; oscillators.push(oscillator); return oscillator; }),
    createGain: vi.fn(() => { const gain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() }; gains.push(gain); return gain; }),
  };
  const Audio = vi.fn(function () { return context; });
  vi.stubGlobal('AudioContext', Audio);
  return { context, Audio, oscillators, gains };
}
beforeEach(() => { vi.unstubAllGlobals(); });
test('audio is lazy and mute creates no audio resources', () => {
  const { Audio } = fakeAudio(); const player = createSoundPlayer();
  player.close(); expect(Audio).not.toHaveBeenCalled(); player.play('swap', false); expect(Audio).not.toHaveBeenCalled();
});
test.each(['select', 'swap', 'win', 'edit', 'undo', 'hint', 'error', 'navigate', 'export'] as const)('%s has a short bounded envelope and disconnects finished nodes', sound => {
  const { context, oscillators, gains, Audio } = fakeAudio(); const player = createSoundPlayer();
  player.play(sound); expect(Audio).toHaveBeenCalledOnce();
  expect(oscillators.length).toBeGreaterThan(0);
  for (const [i, oscillator] of oscillators.entries()) {
    expect(oscillator.start).toHaveBeenCalledWith(2 + i * 0.075);
    expect(oscillator.stop.mock.calls[0][0] - oscillator.start.mock.calls[0][0]).toBeLessThan(0.32);
    expect(gains[i].gain.linearRampToValueAtTime.mock.calls[0][0]).toBeLessThanOrEqual(0.055);
    expect(gains[i].connect).toHaveBeenCalledWith(context.destination);
    oscillator.onended!(); expect(oscillator.disconnect).toHaveBeenCalledOnce(); expect(gains[i].disconnect).toHaveBeenCalledOnce();
  }
  player.play('select'); expect(Audio).toHaveBeenCalledOnce(); player.close(); expect(context.close).toHaveBeenCalledOnce();
});
test('resumes a suspended context and tolerates rejected browser audio promises', async () => {
  const { context } = fakeAudio('suspended'); context.resume.mockRejectedValue(new Error('Denied')); context.close.mockRejectedValue(new Error('Closed'));
  const player = createSoundPlayer(); player.play('win'); player.close(); await Promise.resolve(); expect(context.resume).toHaveBeenCalled();
});
test('closed contexts are recreated and repeated close is safe', () => {
  const { context, Audio } = fakeAudio(); const player = createSoundPlayer(); player.play('select'); context.state = 'closed';
  player.close(); expect(context.close).not.toHaveBeenCalled(); player.play('edit'); expect(Audio).toHaveBeenCalledTimes(2);
});
test('unsupported audio and audio creation failures leave gameplay working', () => {
  vi.stubGlobal('AudioContext', undefined); expect(() => createSoundPlayer().play('swap')).not.toThrow();
  vi.stubGlobal('AudioContext', function () { throw new Error('Not available'); }); expect(() => createSoundPlayer().play('select')).not.toThrow();
});
test('sound preference is persistent, defaults on, and tolerates storage restrictions', () => {
  expect(readSoundEnabled()).toBe(true); saveSoundEnabled(false); expect(readSoundEnabled()).toBe(false); saveSoundEnabled(true); expect(readSoundEnabled()).toBe(true);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); }); expect(readSoundEnabled()).toBe(true);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); }); expect(() => saveSoundEnabled(false)).not.toThrow();
});
