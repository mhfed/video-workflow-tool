# Environment configuration

For the default real end-to-end workflow, the **only secret you must supply** is:

```bash
OPENAI_API_KEY=...
```

Start from `.env.example`. Defaults are wired for Topic → Script → Voice → Illustration → Whiteboard → Final MP4.

## Recommended defaults

Unless you intentionally want another provider/style, keep:

```bash
MOCK_MODE=0
UI_LANGUAGE=vi
CONTENT_LANGUAGE=vi
VIDEO_RENDERER=whiteboard
TEXT_PROVIDER=openai
IMAGE_PROVIDER=openai
VOICE_PROVIDER=openai
SCRIPT_TARGET_MINUTES=6
OPENAI_TEXT_MODEL=gpt-5.6-luna
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=1536x1024
OPENAI_IMAGE_QUALITY=medium
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=marin
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
WHITEBOARD_AUTO_INSTALL=1
WHITEBOARD_PYTHON=
```

`1536x1024` is the configured landscape image size. The final media step contains renderer output inside the configured 16:9 video frame, and generated visual prompts keep important subjects inside a centered safe area.

Then set only:

```bash
OPENAI_API_KEY=<your-key>
```

## What you may want to personalize

```bash
SCRIPT_TARGET_MINUTES=6
OPENAI_TTS_VOICE=marin
OPENAI_TTS_INSTRUCTIONS=Speak clearly, naturally, and conversationally for a YouTube explainer.
SCENE_TARGET_SEC=12
SCENE_MIN_SEC=6
SCENE_MAX_SEC=18
```

- `SCRIPT_TARGET_MINUTES`: default length when creating from a topic.
- `OPENAI_TTS_VOICE`: narration voice.
- `OPENAI_TTS_INSTRUCTIONS`: delivery/style of narration.
- `OPENAI_TRANSCRIBE_MODEL`: speech-to-text model used by pronunciation QA.
- scene timing values: how frequently visuals change.
- `WHITEBOARD_PYTHON`: normally leave blank. Setup reads the exact `ENV_PY` reported by upstream `prepare_env.py`; use this only if you deliberately maintain the environment yourself.

## Useful switches

- `MOCK_MODE=1`: no paid AI calls; useful for CI/smoke tests. Mock artifacts have distinct cache keys, so they cannot be silently reused in a later real run.
- `UI_LANGUAGE=vi|en`: web interface language; defaults to Vietnamese.
- `CONTENT_LANGUAGE=vi|en`: language for new projects and topic-to-script generation; each project keeps its own value in `project.json`.
- `VIDEO_RENDERER=simple|whiteboard|cinematic-broll`: Cinematic B-roll renders project-local video selected manually or downloaded through a provider.
- `TEXT_PROVIDER`, `IMAGE_PROVIDER`: `openai` or `mock`.
- `VOICE_PROVIDER`: `openai`, `vivibe`, or `mock`. Voice selection is independent from the text/image source.
- `WHITEBOARD_AUTO_INSTALL=1`: clones the upstream whiteboard engine when absent and prepares its isolated Python environment when needed.
- `VIDEO_WIDTH`, `VIDEO_HEIGHT`, `VIDEO_FPS`: final clip normalization.

## B-roll search providers

The Cinematic B-roll search panel can use either provider. Keys stay in `.env` and are never written to `project.json` or returned to the browser:

```bash
PEXELS_API_KEY=<your-pexels-key>
PIXABAY_API_KEY=<your-pixabay-key>
```

Search results keep source and creator links for attribution. Selecting a result downloads it once into `workspace/<project-id>/assets/broll/`; rendering remains local and deterministic afterward.

## Vivibe / LucyAI voice

The Settings dialog can load your active Vivibe voices and save the selected Voice ID. For manual configuration:

```bash
MOCK_MODE=0
VOICE_PROVIDER=vivibe
VIVIBE_API_KEY=<your-key>
VIVIBE_BASE_URL=https://api.lucylab.io/json-rpc
VIVIBE_VOICE_ID=<voice-id-from-getUserVoices>
VIVIBE_SPEED=1
```

The adapter calls `ttsLongText`, polls `getExportStatus` every two seconds, downloads the completed audio, and normalizes it to MP3 with FFmpeg. Optional timeout controls are `VIVIBE_POLL_INTERVAL_MS` and `VIVIBE_TIMEOUT_MS`.

## Non-secret prerequisites

- Node.js 20+
- FFmpeg / ffprobe
- Git
- Python 3 for whiteboard mode

## Setup

```bash
cp .env.example .env
# edit OPENAI_API_KEY
npm run setup
npm test
npm run smoke
npm run web
```

`npm run setup` validates required executables, validates whether a real provider needs `OPENAI_API_KEY`, and installs/prepares the whiteboard engine when enabled.

After the web server starts, open `http://127.0.0.1:4173`, choose **Topic → auto script**, enter a topic, review scenes, then run the pipeline.
