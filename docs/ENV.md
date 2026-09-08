# Environment configuration

For the default real workflow, the only secret you need to supply is:

```bash
OPENAI_API_KEY=...
```

Start from `.env.example`. Its production defaults use OpenAI for scene illustrations and narration, plus the whiteboard renderer for video.

## Recommended review checklist

Keep these unless you intentionally want different behavior:

```bash
MOCK_MODE=0
VIDEO_RENDERER=whiteboard
IMAGE_PROVIDER=openai
VOICE_PROVIDER=openai
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=2048x1152
OPENAI_IMAGE_QUALITY=medium
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=marin
WHITEBOARD_AUTO_INSTALL=1
```

Then set:

```bash
OPENAI_API_KEY=<your-key>
```

## Useful switches

- `MOCK_MODE=1`: makes no paid AI calls; uses silent mock narration and the smoke-test path.
- `VIDEO_RENDERER=simple|whiteboard`: `simple` is FFmpeg-only; `whiteboard` wraps `geeklee/srt-whiteboard-animation`.
- `WHITEBOARD_AUTO_INSTALL=1`: clones the upstream whiteboard engine and prepares its isolated Python environment on setup.
- `SCENE_TARGET_SEC`, `SCENE_MIN_SEC`, `SCENE_MAX_SEC`: control scene splitting for scripts/SRT.
- `VIDEO_WIDTH`, `VIDEO_HEIGHT`, `VIDEO_FPS`: final clip normalization settings.
- `OPENAI_TTS_INSTRUCTIONS`: narration delivery instructions.

## Non-secret prerequisites

- Node.js 20+
- FFmpeg / ffprobe
- Git
- Python 3 for whiteboard mode

## Setup behavior

```bash
npm run setup
```

If `.env` does not exist, setup creates it from `.env.example` first and then validates that configuration. A real OpenAI run fails early with a clear message when `OPENAI_API_KEY` is empty. Whiteboard mode also validates Git/Python and prepares the upstream engine automatically.

For a zero-cost end-to-end check before adding a key:

```bash
npm test
npm run smoke
```
