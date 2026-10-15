# Gameplay and recording review

## Coverage

The unit/component suite has 78 passing tests, including all 12 puzzles, legal and illegal swaps, hint recovery, scoring, React interactions, progress/storage failures, studio edits, exports, and sound scheduling/resource cleanup.

Coverage includes **every production TypeScript/TSX source file**, including the React app, engine, audio, and bootstrap. Only tests and test setup are excluded. The baseline was 26.86% statements across the whole app, despite high engine coverage.

| Metric | Final coverage |
| --- | ---: |
| Statements | 98.28% |
| Branches | 97.06% |
| Functions | 98.55% |
| Lines | 100% |

Each source file must individually meet an 81% floor in all four metrics. CI runs `npm run test:coverage`, and a coverage regression fails the deployment.

## Recorded browser tests

There are 29 end-to-end scenarios: ten cases each in desktop and mobile Chromium, including touch input emulation. The normal viewports are 1440×1000 and 390×844; narrow-layout cases use 320×720, and mouse/touch edge-scrolling cases use 800×1000 to exercise an overflowing tree pane. Nine more viewport-specific scenarios play the entire campaign and use the studio: 320×480, 320×568, 360×640, 375×667, 390×844, 412×915, 568×320, 667×375, and 844×390. These use touch input and branch buttons without page or tree scrolling. Every move checks document dimensions, card bounds and minimum size, and every visible control/preview against the board edges. Each video uses its viewport dimensions. The 320×480 case also covers a reduced visible area caused by browser controls.

1. First-puzzle play, selection/cancel, win, completion hides the tree, review/hide controls, undo/reset, scoring, and saved progress. Phone-size runs also reveal/hide the solved tree on the first and final puzzles and check both views for overflow. Keyboard focus moves to the next puzzle on completion and to the hide control during review.
2. Every campaign puzzle solved with hints through the interface.
3. Every campaign puzzle solved without hints, checking three-star solutions and visible mobile previews.
4. Mouse drag and actual Chromium touch-drag input, with a pointer-following phantom, matching displayed card size, an unmoved source, and cleanup after the drop. Unit tests also cover missed drops, Escape, pointer cancellation, lost capture, and window blur.
5. Keyboard selection, undo, and dialog focus/cancel.
6. Sound/mute persistence, actual oscillator generation, reduced motion, invalid moves, recovery, and fit controls.
7. Studio splitting, painting, editing, collapsing, undo, and PNG export.
8. A full 31-node studio mosaic, split limit, fit bounds, draft restoration, export, collapse/undo, and immediate reset centering. Both downloaded PNGs are 512×512 with the eight expected colors.
9. Narrow-screen help and studio, horizontal-overflow checks, and absence of third-party asset requests.

10. Edge-assisted mouse and touch drags: hold a stationary pointer at the bottom/right pane edge, reveal an initially clipped target, drop on its new position, keep page scroll unchanged, and stop pane scrolling after release.

The tests run against the production build. Every test records video, and test instrumentation captures the browser's real Web Audio output. The review helper encodes H.264/AAC MP4s, measures audio peaks, extracts timestamped frames at 2 fps from those MP4s, and builds contact sheets plus a playable HTML index. Audio alignment is approximate to the recording start.

Open `qa/final/index.html` after a local run. Each scenario has its own `video.mp4`, contact sheets, frames, and result metadata. These generated artifacts are ignored by Git. CI retains MP4s, contact sheets, metadata, and coverage as `coverage-and-playthroughs` for 14 days.

## Findings and fixes from review

| Observed issue | Change and verification |
| --- | --- |
| A dragged card cannot reach a target outside the visible pane. | Frame-based scrolling near pane edges, with speed based on proximity. Mouse/touch playthroughs verify horizontal and vertical movement, a successful distant drop, no page scrolling, and cleanup after release. Unit checks cover stationary holds, reversal, limits, viewport clipping, and cancellation. |
| The solved tree still looks playable after a win. | Replace it with an explicit Puzzle complete panel and stars. Show puzzle again reveals the solved tree without changing the score; Hide puzzle returns to the result. Undo, Reset, and the next puzzle clear the review state. Opening review also clears the celebration so it cannot cover the tree. |
| Dragging has no moving visual feedback. | A translucent copy preserves the grab offset and follows the pointer outside the tree frame. It ignores hit testing, stays out of the accessibility tree, and clears on drop or cancellation. A viewport overlay prevents edge drags from adding scrollbars. |
| Mobile players lose sight of target art while editing deep trees. | A viewport-sized play surface retains previews and actions throughout the campaign. |
| A large tree is difficult to use without scrolling on a phone. | Readable branch explorer with Open/Up/Root controls, a path selector, and an optional whole-tree overview. Selection survives branch navigation. |
| Landscape cards become too small when vertically stacked with studio controls. | Horizontal campaign branches and a studio editor beside the tree; card size is asserted during full campaign play. |
| A short landscape picture panel forces actions below the board. | Explicit grid row limits and smaller previews; every control is checked against the board bounds. |
| An icon-only help button loses its accessible name on phones. | Explicit accessible label and narrow-screen dialog tests. |
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
