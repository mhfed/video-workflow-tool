# Video Workflow Tool

A local-first personal video production workflow. Give it a **topic, script, or SRT**, review scenes, and render a synchronized MP4 without rebuilding unchanged work.

## End-to-end workflow

```text
Topic / Script / SRT
  -> narration script (automatic for Topic)
  -> scene plan
  -> per-scene voice
  -> per-scene illustration
  -> simple, whiteboard, or cinematic-broll renderer
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

Open `http://127.0.0.1:4173`. The default **Topic → auto script** input lets you enter an idea and choose target minutes. New projects default to **Studio**, where script, voice, visual, and clip checkpoints are reviewed independently. Switch a project to **Auto run** when you want a complete first draft in one pass.

Projects open in one **AI Directing Room**: a visual storyboard on the left, the best available scene preview in the center, an intent-aware Director on the right, and the cut timeline along the bottom. The Director always explains the smallest useful next action and previews which cached stages an instruction will affect before it is applied.

Long work now runs through a persistent async queue with per-step progress, ETA, and cooperative cancellation. Every regeneration creates a versioned take, so older voice, visual, and clip options stay selectable. Editorial changes have undo/redo, and the rough-cut player can play cached scene clips in sequence without creating a new final export.

The QA panel performs offline frame/audio checks and can add OpenAI vision plus transcription review when configured. It checks crop, safe area, unwanted text, visual continuity, silence, clipping, pacing, and pronunciation, then prepares a scoped repair proposal with request counts. Project Memory keeps recurring characters, palette, art direction, and pronunciation guidance consistent across new generations.

Normal visual edits use a short, human-facing creative intent; CUTROOM compiles the technical generation prompt behind an Advanced section. Scenes can be inserted, split, duplicated, merged, moved, or removed without rerunning unrelated work. Existing completed projects infer readiness from their artifacts, so upgrading does not force old approvals to be repeated. See [`docs/CUTROOM_V2_PLAN.md`](docs/CUTROOM_V2_PLAN.md) for the product and engine roadmap.

The interface and new video projects default to Vietnamese. In **Provider settings → Language**, you can switch the interface and independently choose Vietnamese or English as the default content language. Each project records its own language in `project.json`, and generated narration plus embedded subtitles follow that setting.

The default real configuration uses:

- OpenAI Responses API with `gpt-5.6-luna` for topic → narration.
- OpenAI Image API with `gpt-image-2` at supported landscape size `1536x1024` for illustrations.
- OpenAI Speech API with `gpt-4o-mini-tts` for narration audio.
- Optional Vivibe/LucyAI narration through a separate voice-provider adapter.
- `geeklee/srt-whiteboard-animation` for whiteboard rendering. The engine is cloned/prepared automatically when `WHITEBOARD_AUTO_INSTALL=1`.
- Local B-roll for cinematic vertical scenes; no media search or download service is required.
- FFmpeg for per-scene composition/muxing, frame normalization, and final concatenation.

For handoff, review [`docs/REVIEW_CHECKLIST.md`](docs/REVIEW_CHECKLIST.md). The default real workflow requires one secret: `OPENAI_API_KEY`. See [`docs/ENV.md`](docs/ENV.md) for all optional settings.

## Review control panel

For each scene the UI can show the generated visual, narration audio, rendered clip, and prior takes. Media endpoints support HTTP Range requests, so video/audio seek normally in the browser. A project-level queue serializes expensive work, and failed/cancelled jobs persist their events for review.

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
npm run cli -- create --title "Vì sao ta trì hoãn" --topic "Vì sao con người hay trì hoãn?" --minutes 6 --language vi

# Vertical 9:16 output for Shorts, Reels, or TikTok
npm run cli -- create --title "Trì hoãn trong 60 giây" --topic "Vì sao ta trì hoãn?" --minutes 1 --language vi --format short
npm run cli -- run --project <project-id> --stage voice --scene scene-001
npm run cli -- run --project <project-id> --stage visual --scene scene-001
npm run cli -- run --project <project-id> --stage clip --scene scene-001
npm run cli -- run --project <project-id> --stage final
npm run cli -- run --project <auto-project-id>
```

Or start from material you already have:

```bash
npm run cli -- create --title "My explainer" --script ./script.md
npm run cli -- create --title "Existing narration" --srt ./subtitles.srt
```

Use `--language vi` or `--language en` to override `CONTENT_LANGUAGE` for one project.

## Cinematic B-roll renderer

Set the project or scene renderer to `cinematic-broll`, use the existing `short` format, and place each source clip inside that project's workspace directory. A scene requires a project-relative `broll` path; `brollStartMs` is optional. The clip is looped when it is shorter than the narration, trimmed to the scene duration, and center-cropped with cover behavior to the configured frame.

```json
{
  "settings": {
    "renderer": "cinematic-broll",
    "format": "short",
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "backgroundMusic": "assets/quiet-bed.mp3",
    "cinematicBroll": { "musicVolumeDb": -20 }
  },
  "scenes": [{
    "id": "scene-001",
    "renderer": "cinematic-broll",
    "text": "The narration also becomes the burned-in scene subtitle.",
    "broll": "assets/city-at-dawn.mp4",
    "brollStartMs": 1250
  }]
}
```

Subtitles are derived from `scene.text`, limited to roughly two balanced lines, and placed in the lower-middle phone-safe area. They are on by default; optional settings live under `settings.cinematicBroll` (or a scene-level `cinematicBroll` override): `subtitles`, `subtitleMaxWords`, `subtitleFontSize`, `subtitlePosition`, and `musicVolumeDb`. A scene-level `backgroundMusic` overrides the project setting. Asset paths must remain inside the project directory. See [`examples/cinematic-broll-project.json`](examples/cinematic-broll-project.json).

The scene editor includes server-side Pexels and Pixabay video search. Add either API key in Provider Settings, open a Cinematic B-roll scene, search from its visual intent, review the creator/source credit, choose an optional start offset, and select a clip. The server downloads it once to `assets/broll/`, records generic attribution metadata, and the renderer continues entirely from that local file.

Automatic copyright detection, TikTok/YouTube downloading, AI video generation, karaoke highlighting, and a transition engine remain deliberately out of scope. Search-provider responses stay behind adapters; the renderer does not know whether a local clip came from Pexels, Pixabay, or a future source.

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
├── assets/               # optional local B-roll and music inputs
├── topic.txt             # topic projects
├── script.md | source.srt
├── scenes/
│   └── scene-001/
│       ├── takes/
│       │   ├── voice/<take-id>.mp3
│       │   ├── visual/<take-id>.png
│       │   ├── video/<take-id>.mp4
│       │   └── clip/<take-id>.mp4
│       ├── scene-001.annotation.json
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
