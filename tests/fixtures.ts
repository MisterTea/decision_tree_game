import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

/** Flush before a reload so a navigation cannot discard the recorded audio. */
export async function finishAudio(page: Page) {
  await page.evaluate(async () => {
    const scope = window as unknown as { __qaAudio?: { notes: number; started: number; recorder: MediaRecorder | null; chunks: Blob[] }; __qaSaveAudio: (audio: { notes: number; started: number; bytes: number[] }) => Promise<void> };
    const state = scope.__qaAudio;
    if (!state?.recorder || state.recorder.state === 'inactive') return;
    await new Promise<void>(resolve => { state.recorder!.onstop = () => resolve(); state.recorder!.stop(); });
    await scope.__qaSaveAudio({ notes: state.notes, started: state.started, bytes: Array.from(new Uint8Array(await new Blob(state.chunks).arrayBuffer())) });
  }).catch(() => {});
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const epoch = Date.now();
    await page.exposeFunction('__qaSaveAudio', async (audio: { notes: number; started: number; bytes: number[] }) => {
      await writeFile(testInfo.outputPath('audio.webm'), Buffer.from(audio.bytes));
      await writeFile(testInfo.outputPath('audio.json'), JSON.stringify({ notes: audio.notes, offset: Math.max(0, (audio.started - epoch) / 1000) }));
    });
    // Capture the real Web Audio output in addition to Playwright's video-only recording.
    await page.addInitScript(() => {
      const state = { notes: 0, started: 0, recorder: null as MediaRecorder | null, chunks: [] as Blob[] };
      Object.assign(window, { __qaAudio: state });
      const Original = window.AudioContext;
      const streams = new WeakMap<BaseAudioContext, MediaStreamAudioDestinationNode>();
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (this: AudioNode, ...args: [AudioNode | AudioParam, number?, number?]) {
        const result = (connect as Function).apply(this, args);
        if (args[0] === this.context.destination && streams.has(this.context)) (connect as Function).call(this, streams.get(this.context));
        return result;
      } as AudioNode['connect'];
      window.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options);
          const stream = this.createMediaStreamDestination(); streams.set(this, stream);
          const recorder = new MediaRecorder(stream.stream, { mimeType: 'audio/webm;codecs=opus' });
          state.recorder = recorder; state.started = Date.now();
          recorder.ondataavailable = event => { if (event.data.size) state.chunks.push(event.data); };
          recorder.start();
        }
        createOscillator() { state.notes++; return super.createOscillator(); }
      };
    });
    await use(page);
    if (!page.isClosed()) {
      await finishAudio(page);
      await writeFile(testInfo.outputPath('scenario.json'), JSON.stringify({ title: testInfo.title, project: testInfo.project.name, status: testInfo.status, errors }, null, 2));
    }
    expect(errors, 'The game must not throw browser errors').toEqual([]);
  },
});
export { expect };
