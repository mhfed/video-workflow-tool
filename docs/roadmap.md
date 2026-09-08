# Roadmap

## v0.1 — complete

The first usable workflow intentionally favors a zero-npm-dependency Node.js control plane over the original TanStack/SQLite proposal. `project.json` is the local source of truth; FFmpeg and Python remain external media workers. This reduced setup surface while preserving the planned renderer/provider boundaries.

### Foundations

- [x] Local workspace service and persistent `project.json` state.
- [x] SHA-256 artifact/cache keys per scene step.
- [x] Script and SRT parsing / scene planning.
- [x] FFmpeg / ffprobe prerequisite checks.
- [x] Python + Git validation for whiteboard mode.
- [x] First-run `.env` bootstrap.
- [x] CI with unit, contract, whiteboard-adapter and smoke-render tests.

### Production pipeline

- [x] OpenAI image provider.
- [x] OpenAI speech provider.
- [x] Mock providers for zero-cost testing.
- [x] FFmpeg simple renderer.
- [x] `srt-whiteboard-animation` adapter with automatic engine setup.
- [x] Generate whiteboard annotation automatically.
- [x] Use measured narration duration as scene timing source of truth.
- [x] Normalize scene clips to a common resolution/FPS/audio format.
- [x] Render only stale/changed scene artifacts.
- [x] Re-render one scene independently.
- [x] Concatenate synchronized scene clips into `final.mp4`.

### Review UI / CLI

- [x] Create project from script or SRT.
- [x] List projects and scene status.
- [x] Edit narration and visual prompt per scene.
- [x] Render one scene or the complete project.
- [x] Preview final MP4 in the browser.
- [x] CLI create / run / status commands.

## Deliberately deferred

These are not required for the v0.1 script/SRT-to-video workflow:

- Topic research and autonomous long-form script generation.
- Background music / SFX mixing.
- Whisper transcription.
- Vision-based multi-region whiteboard annotations (v0.1 uses a full-canvas semantic region per scene).
- Multiple aspect-ratio exports and Shorts-specific layouts.
- Presets, bulk editing and keyboard shortcuts.
- YouTube metadata, upload and analytics.
- TanStack/React rewrite or SQLite indexing; add these only when the local workflow needs more UI/state complexity.
