# Video Workflow Tool

A local-first personal video production workflow. Paste a script or SRT, review scenes, and render a synchronized MP4 without redoing unchanged work.

## End-to-end workflow

```text
Script / SRT
  -> scene plan
  -> per-scene voice
  -> per-scene illustration
  -> simple or whiteboard renderer
  -> synchronized scene clips
  -> final.mp4
```

Every scene caches its voice, image, render, and mux steps. Editing one scene invalidates only that scene.

## Quick start

```bash
git clone git@github.com:mhfed/video-workflow-tool.git
cd video-workflow-tool
cp .env.example .env
# add OPENAI_API_KEY to .env
npm run setup
npm run web
```

Open `http://127.0.0.1:4173`, create a project, paste a script, review the generated scenes and prompts, then click **Run full pipeline**.

The default real configuration uses:

- OpenAI Image API with `gpt-image-2` for illustrations.
- OpenAI Speech API with `gpt-4o-mini-tts` for narration.
- `geeklee/srt-whiteboard-animation` for whiteboard rendering. The engine is cloned automatically when `WHITEBOARD_AUTO_INSTALL=1`.
- FFmpeg for per-scene muxing and final concatenation.

See [`docs/ENV.md`](docs/ENV.md) for all environment variables.

## Zero-cost smoke test

No API key is required to test orchestration:

```bash
npm test
npm run smoke
```

`npm run smoke` forces mock providers + the simple renderer and must produce a playable `final.mp4` in a temporary workspace.

## CLI

```bash
npm run cli -- create --title "Why we procrastinate" --script ./script.md
npm run cli -- status
npm run cli -- run --project <project-id>
npm run cli -- run --project <project-id> --scene scene-003
npm run cli -- run --project <project-id> --force
```

For SRT input:

```bash
npm run cli -- create --title "Existing narration" --srt ./subtitles.srt
```

## Workspace layout

```text
workspace/<project-id>/
├── project.json
├── script.md | source.srt
├── scenes/
│   └── scene-001/
│       ├── voice.mp3
│       ├── visual.png
│       ├── scene-001.annotation.json
│       ├── video.mp4
│       └── clip.mp4
└── output/
    ├── concat.txt
    └── final.mp4
```

## Requirements

- Node.js 20+
- FFmpeg + ffprobe
- Git
- Python 3 (whiteboard mode)

There are intentionally no npm runtime dependencies in v0.1. The web control panel uses Node's built-in HTTP server so the core workflow remains easy to run and debug locally.
