export type Sound = 'select' | 'swap' | 'win' | 'edit' | 'undo' | 'hint' | 'error' | 'navigate' | 'export';
const notes: Record<Sound, number[]> = {
  select: [392], swap: [392, 523.25], win: [523.25, 659.25, 783.99, 1046.5],
  edit: [440, 587.33], undo: [392, 293.66], hint: [659.25, 880],
  error: [220, 196], navigate: [349.23, 440], export: [783.99, 1046.5],
};
export function readSoundEnabled(): boolean {
  try { return localStorage.getItem('branch-bloom-sound') !== 'off'; } catch { return true; }
}
export function saveSoundEnabled(enabled: boolean) {
  try { localStorage.setItem('branch-bloom-sound', enabled ? 'on' : 'off'); } catch { /* Sound works without storage. */ }
}
/** Short, quiet synthesized notes. The context is created only in response to input. */
export function createSoundPlayer() {
  let context: AudioContext | undefined;
  return {
    play(sound: Sound, enabled = true) {
      if (!enabled || typeof window.AudioContext !== 'function') return;
      try {
        if (!context || context.state === 'closed') context = new AudioContext();
        if (context.state === 'suspended') void context.resume().catch(() => {});
        const start = context.currentTime;
        notes[sound].forEach((frequency, i) => {
          const oscillator = context!.createOscillator(), gain = context!.createGain();
          const at = start + i * 0.075, duration = sound === 'win' ? 0.3 : 0.14;
          oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, at);
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(sound === 'win' ? 0.055 : 0.035, at + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
          oscillator.connect(gain); gain.connect(context!.destination);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(at); oscillator.stop(at + duration + 0.01);
        });
      } catch { /* A browser audio restriction must never interrupt a game. */ }
    },
    close() { if (context && context.state !== 'closed') void context.close().catch(() => {}); },
  };
}
