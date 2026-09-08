# Environment configuration

For a normal real run, the only secret you must add is:

```bash
OPENAI_API_KEY=...
```

The defaults in `.env.example` use OpenAI for images and speech and the whiteboard renderer for video.

## Important switches

- `MOCK_MODE=1`: no paid API calls; generates silent audio and placeholder visuals. Useful for smoke testing.
- `VIDEO_RENDERER=simple|whiteboard`: `simple` uses FFmpeg only; `whiteboard` wraps `geeklee/srt-whiteboard-animation`.
- `WHITEBOARD_AUTO_INSTALL=1`: clones and prepares the whiteboard engine automatically when first needed.
- `OPENAI_IMAGE_MODEL=gpt-image-2`: image model used by the Image API.
- `OPENAI_TTS_MODEL=gpt-4o-mini-tts`: speech model.
- `OPENAI_TTS_VOICE=marin`: narration voice; change to another supported voice if desired.

## Non-secret prerequisites

- Node.js 20+
- FFmpeg / ffprobe
- Git
- Python 3 for whiteboard mode

Run `npm run setup` to validate prerequisites and install the whiteboard engine when configured.
