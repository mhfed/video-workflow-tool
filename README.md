# Video Workflow Tool

A local-first personal video production workflow. Give it a **topic, script, or SRT**, review scenes, and render a synchronized MP4 without rebuilding unchanged work.

## End-to-end workflow

```text
Topic / Script / SRT
  -> narration script (automatic for Topic)
  -> scene plan
  -> per-scene voice
  -> per-scene illustration
  -> simple or whiteboard renderer
  -> synchronized scene clips
  -> final.mp4
```

Every scene caches its voice, image, render, and mux steps. Editing narration or a visual prompt invalidates only the dependent artifacts, and a stale final video is never kept marked current.

## Quick start

```bash
git clone git@github.com:mhfed/video-workflow-tool.git
cd video-workflow-tool
cp .env.example .env
# set OPENAI_API_KEY in .env
npm run setup
npm run doctor
npm run web
```

Open `http://127.0.0.1:4173`. The default **Topic → auto script** mode lets you enter an idea, choose target minutes, review the generated scenes/prompts, render/review scenes individually, then click **Run full pipeline**.

The default real configuration uses:

- OpenAI Responses API with `gpt-5.6-luna` for topic → narration.
- OpenAI Image API with `gpt-image-2` at supported landscape size `1536x1024` for illustrations.
- OpenAI Speech API with `gpt-4o-mini-tts` for narration audio.
- Optional Vivibe/LucyAI narration through a separate voice-provider adapter.
- `geeklee/srt-whiteboard-animation` for whiteboard rendering. The engine is cloned/prepared automatically when `WHITEBOARD_AUTO_INSTALL=1`.
- FFmpeg for per-scene muxing, 16:9 normalization, and final concatenation.

For handoff, review [`docs/REVIEW_CHECKLIST.md`](docs/REVIEW_CHECKLIST.md). The default real workflow requires one secret: `OPENAI_API_KEY`. See [`docs/ENV.md`](docs/ENV.md) for all optional settings.

## Review control panel

For each scene the UI can show the generated visual, narration audio, and rendered clip. Media endpoints support HTTP Range requests, so video/audio seek normally in the browser. A project-level lock prevents duplicate render runs, and failed runs persist their last error for review.

Provider settings let text/images stay on OpenAI while narration uses OpenAI Speech, Vivibe/LucyAI, or the offline mock provider. Vivibe keys remain server-side in `.env`; the UI can fetch active voices through `getUserVoices` and save the selected Voice ID.

## Zero-cost smoke test

No API key is required to test orchestration:

```bash
npm test
npm run smoke
```

`npm run smoke` exercises **topic → mock script → scenes → mock voice → simple render → final.mp4**.

## CLI

Topic all the way to final video:

```bash
npm run cli -- create --title "Why we procrastinate" --topic "Why do people procrastinate?" --minutes 6
npm run cli -- run --project <project-id>
```

Or start from material you already have:

```bash
npm run cli -- create --title "My explainer" --script ./script.md
npm run cli -- create --title "Existing narration" --srt ./subtitles.srt
```

Operate/review:

```bash
npm run cli -- status
npm run cli -- status --project <project-id>
npm run cli -- run --project <project-id> --scene scene-003
npm run cli -- run --project <project-id> --force
```

## Workspace layout

```text
workspace/<project-id>/
├── project.json
├── topic.txt             # topic projects
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
