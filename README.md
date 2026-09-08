# Video Workflow Tool

Local-first internal tool for turning a topic/script into an editable video project and final MP4.

The first renderer target is whiteboard animation, using `geeklee/srt-whiteboard-animation` as an external renderer dependency rather than coupling its implementation into the core workflow.

## Product goal

Build a personal "video IDE" where each production step is visible, editable, cached, and re-runnable independently.

```text
Topic / Script
  -> Script
  -> Voice
  -> SRT
  -> Scene Plan
  -> Visuals
  -> Animation Renderer
  -> Final Render
```

The system must avoid the "one giant generate button" trap. A bad scene should be regeneratable without rebuilding the whole video.

## MVP screens

1. Projects
2. Script
3. Scene Editor
4. Render Queue
5. Final Preview / Export

## Proposed stack

- Web app: TanStack Start + React + TypeScript
- Runtime/API: Node.js
- Local database: SQLite
- Media pipeline: FFmpeg
- Renderer workers: Python subprocesses
- First renderer: `srt-whiteboard-animation`
- Storage: local project workspace on disk

## Repository layout

```text
apps/
  web/                 # TanStack Start UI + API routes
  worker/              # background/local render worker
packages/
  core/                # project schema, pipeline state, cache keys
  renderers/           # renderer interfaces + adapters
vendor/                 # optional git submodules / vendored engines
docs/
  architecture.md
  mvp-v0.1.md
  data-model.md
  renderer-contract.md
  roadmap.md
  github-bootstrap.md
  decisions/
```

## Core rule

The LLM does **not** directly produce a video. It produces or edits a structured `VideoProject` representation. Renderers consume that representation and generate deterministic artifacts where possible.

## First milestone

Given an existing `script.md` or `.srt` file:

1. create a project;
2. split it into scenes;
3. inspect/edit scene timing and prompts;
4. render whiteboard scenes;
5. re-render one scene independently;
6. merge scenes and voice into `final.mp4`.

See [`docs/mvp-v0.1.md`](docs/mvp-v0.1.md).
