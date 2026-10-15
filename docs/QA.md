# Gameplay and recording review

## Coverage

The unit/component suite has 58 passing tests, including all 12 puzzles, legal and illegal swaps, hint recovery, scoring, React interactions, progress/storage failures, studio edits, exports, and sound scheduling/resource cleanup.

Coverage includes **every production TypeScript/TSX source file**, including the React app, engine, audio, and bootstrap. Only tests and test setup are excluded. The baseline was 26.86% statements across the whole app, despite high engine coverage.

| Metric | Final coverage |
| --- | ---: |
| Statements | 93.19% |
| Branches | 93.11% |
| Functions | 94.49% |
| Lines | 96.29% |

Each source file must individually meet an 81% floor in all four metrics. CI runs `npm run test:coverage`, and a coverage regression fails the deployment.

## Recorded browser tests

There are 18 passing end-to-end scenarios: nine cases each in desktop and mobile Chromium, including touch input emulation. The normal viewports are 1440×1000 and 390×844; narrow-layout cases use 320×720.

1. First-puzzle play, selection/cancel, win, undo/reset, scoring, and saved progress.
2. Every campaign puzzle solved with hints through the interface.
3. Every campaign puzzle solved without hints, checking three-star solutions and visible mobile previews.
4. Mouse drag and actual Chromium touch-drag input.
5. Keyboard selection, undo, and dialog focus/cancel.
6. Sound/mute persistence, actual oscillator generation, reduced motion, invalid moves, recovery, and fit controls.
7. Studio splitting, painting, editing, collapsing, undo, and PNG export.
8. A full 31-node studio mosaic, split limit, fit bounds, draft restoration, export, collapse/undo, and immediate reset centering. Both downloaded PNGs are 512×512 with the eight expected colors.
9. Narrow-screen help and studio, horizontal-overflow checks, and absence of third-party asset requests.

The tests run against the production build. Every test records video, and test instrumentation captures the browser's real Web Audio output. The review helper encodes H.264/AAC MP4s, measures audio peaks, extracts timestamped frames at 2 fps from those MP4s, and builds contact sheets plus a playable HTML index. Audio alignment is approximate to the recording start.

Open `qa/final/index.html` after a local run. Each scenario has its own `video.mp4`, contact sheets, frames, and result metadata. These generated artifacts are ignored by Git. CI retains MP4s, contact sheets, metadata, and coverage as `coverage-and-playthroughs` for 14 days.

## Findings and fixes from review

| Observed issue | Change and verification |
| --- | --- |
| Mobile players lose sight of target art while editing deep trees. | Compact sticky picture previews; campaign tests check their bounds during play. |
| A large tree is difficult to survey on a phone. | Working Fit/100% controls, centered initial tree view, and an explicit horizontal-scroll cue. Full-size cards remain available for editing. |
| Fitted graph layout can retain oversized scroll bounds. | A wrapper clips the unscaled layout bounds; the 31-node test verifies the fitted width. |
| Shrinking a 31-node tree animates the remaining node outside its new frame. | Removed position interpolation that disconnected cards from their edges. Reset centering is checked immediately, without waiting for animation. |
| Selecting a studio question leaves stale axis/threshold controls. | Populate controls from the selected rule; update and selection are tested. |
| No-op edits consume undo history. | Skip unchanged edits. |
| Switching modes discards studio art, and a restored draft cannot be reset. | Keep the session draft and enable reset for nonempty drafts. |
| Selecting a studio leaf washes out the rest of the drawing. | Keep the studio canvas at full color while tree selection remains visible. |
| External font loading produces several seconds of blank video. | Bundle the fonts locally; narrow-screen tests verify that no third-party assets are requested. |
| The header keyboard outline extends beyond the viewport. | Draw its focus ring inside the navigation button. |
| Full-page screenshots briefly resize the recorded browser viewport. | Use viewport screenshots during recordings, then re-record affected tests. This was a capture artifact, not gameplay overflow. |

## Engagement feedback

Short, quiet synthesized cues accompany selection, swaps, edits, undo, hints, invalid moves, navigation, exports, and wins. Sound is unlocked by user interaction; the persistent speaker control mutes it. Audio failures do not interrupt play. Envelopes taper to avoid clicks, and finished nodes disconnect.

Brief particles, selection feedback, success-card pulses, and staggered star pops provide visual rewards. They do not intercept input, and reduced-motion settings disable motion. Playback review checks these alongside ordinary gameplay, rather than treating passing assertions as sufficient visual verification.
