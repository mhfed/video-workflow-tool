# Environment configuration

For the default real end-to-end workflow, the **only secret you must supply** is:

```bash
OPENAI_API_KEY=...
```

Start from `.env.example`. Defaults are already wired for Topic → Script → Voice → Illustration → Whiteboard → Final MP4.

## Recommended defaults

Unless you intentionally want another provider/style, keep:

```bash
MOCK_MODE=0
VIDEO_RENDERER=whiteboard
TEXT_PROVIDER=openai
IMAGE_PROVIDER=openai
VOICE_PROVIDER=openai
SCRIPT_TARGET_MINUTES=6
OPENAI_TEXT_MODEL=gpt-5.6-luna
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=2048x1152
OPENAI_IMAGE_QUALITY=medium
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=marin
WHITEBOARD_AUTO_INSTALL=1
WHITEBOARD_PYTHON=
```

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
- scene timing values: how frequently visuals change.
- `WHITEBOARD_PYTHON`: normally leave blank. Setup reads the exact `ENV_PY` reported by upstream `prepare_env.py`; use this only if you deliberately maintain the environment yourself.

## Useful switches

- `MOCK_MODE=1`: no paid AI calls; useful for CI/smoke tests.
- `VIDEO_RENDERER=simple|whiteboard`: `simple` is FFmpeg-only; `whiteboard` wraps `geeklee/srt-whiteboard-animation`.
- `TEXT_PROVIDER`, `IMAGE_PROVIDER`, `VOICE_PROVIDER`: `openai` or `mock` in v0.1.
- `WHITEBOARD_AUTO_INSTALL=1`: clones the upstream whiteboard engine when absent and prepares its isolated Python environment when needed.
- `VIDEO_WIDTH`, `VIDEO_HEIGHT`, `VIDEO_FPS`: final clip normalization.

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
