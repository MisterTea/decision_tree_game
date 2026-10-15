# Branch & Bloom

A React + TypeScript puzzle game about drawing pixel art with decision trees.

**[Play the game](https://mistertea.github.io/decision_tree_game/)**

## Play

Recreate the target 8×8 picture by repairing a scrambled decision tree. Every pixel follows coordinate questions from the root until it reaches a color leaf. Coordinates are zero-based: x goes right, y goes down. All questions use full-canvas coordinates.

The 12-puzzle campaign introduces three mechanics:

- **Color stories:** swap two color leaves.
- **A twist of logic:** swap decision rules while their children stay put.
- **Room to grow:** swap whole subtrees, including their descendants. Separate branches can have different sizes, so the topology can change. Ancestor/descendant swaps are forbidden.

Click or tap two compatible cards, or drag one onto another. Keyboard players can use Tab and Enter. Undo, reset, hints, live pixel previews, and optional mismatch markers help you explore without a timer or hard move limit. Match the picture within the swap target for three stars. Your best completed scores are stored locally in this browser; storage is optional and no account is required.

The **Creative studio** lets you split regions, edit rules, paint leaves, collapse branches, and download your art as a PNG. Your draft survives switching between the campaign and studio during a session. Reloading or resetting clears the draft, so export art you want to keep. Trees are limited to 31 nodes to keep the editor manageable.

Quiet synthesized sound cues accompany selections, swaps, edits, hints, undo, exports, and wins. Use the speaker button to mute; the preference is saved in this browser. Sound starts only after interaction. Brief particles and star pops celebrate progress and respect reduced-motion preferences. On phones, picture previews stay visible as you explore the tree. Use **Fit** for a whole-tree overview, or **100%** for full-size editing.

Hints prefer an immediate winning move. Otherwise they retrace a known legal route to the target; they can suggest undoing an earlier move and do not promise an optimal solution. Swap targets are designed solutions, not proven global minima.

## Develop

Requires Node.js 22.22.2+, 24.15+, or 26+ and npm (matching the test toolchain).

```sh
npm ci
npm run dev
```

Open the printed local address at `/decision_tree_game/`.

```sh
npm test          # unit/component tests for engine, UI, storage, and sound
npm run test:coverage # HTML + lcov reports; >80% required in every source file
npm run build    # strict TypeScript checking and production bundle
npm run preview  # serve the production build
```

Browser checks use Playwright and run the campaign on desktop and mobile, plus drag, keyboard, score persistence, and studio export:

```sh
npx playwright install chromium ffmpeg
npm run test:e2e
python scripts/review-recordings.py qa/final
```

Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Chrome instead. Set `BASE_URL` to test an already-running deployment. Every test records a WebM; the Python helper converts it to H.264 MP4, includes captured Web Audio, extracts review frames at 2 fps, and writes timestamped contact sheets and a recording manifest. It requires FFmpeg/FFprobe on PATH and Python with Pillow. Set `QA_DIR` to retain separate QA iterations. Recordings and coverage reports are ignored by Git.

The browser suite includes full campaign play with and without hints, mouse/touch drag, keyboard controls, score persistence, audio/mute, reduced motion, invalid moves, and sandbox painting/editing/export up to the 31-node limit on both desktop and mobile.

## Publish

GitHub Pages is configured to use GitHub Actions. Every push to `main` checks unit coverage, builds the game, runs desktop/mobile browser tests, and deploys only after checks pass. Coverage and MP4 recordings are retained as the `coverage-and-playthroughs` workflow artifact for 14 days. Pull requests run checks without deploying. Vite's base path is `/decision_tree_game/`; update `vite.config.ts` if you rename the repository. The game is static and needs no server or secrets. The two fonts are bundled locally, with system fallbacks; gameplay makes no third-party network requests.

## Project

- `src/engine.ts`: immutable tree operations, rendering, authored levels, and hints.
- `src/App.tsx`: React game, accessible controls, progress, and studio.
- `src/style.css`: responsive visual design and reduced-motion support.
- `src/engine.test.ts`: core behavior and campaign validation.
- `tests/game.spec.ts`: desktop, mobile, input, and studio browser tests.

Inspired by the supplied Decision Tree Drawing Puzzle Game conversation. No conversation text or private documents are bundled in the public game.
