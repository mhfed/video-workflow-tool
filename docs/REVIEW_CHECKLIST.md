# Final handoff checklist

This is the shortest path from a fresh clone to the real end-to-end workflow.

## 1. Review `.env`

```bash
cp .env.example .env
```

### Required secret

Set exactly this for the default real workflow:

```bash
OPENAI_API_KEY=<your OpenAI API key>
```

Do not commit `.env`.

### Recommended defaults — no change required

```bash
MOCK_MODE=0
VIDEO_RENDERER=whiteboard
TEXT_PROVIDER=openai
IMAGE_PROVIDER=openai
VOICE_PROVIDER=openai
OPENAI_TEXT_MODEL=gpt-5.6-luna
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=1536x1024
OPENAI_IMAGE_QUALITY=medium
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=marin
WHITEBOARD_AUTO_INSTALL=1
WHITEBOARD_PYTHON=
```

### Optional personalization

Only change these if you want a different output style/length:

```bash
SCRIPT_TARGET_MINUTES=6
OPENAI_TTS_VOICE=marin
OPENAI_TTS_INSTRUCTIONS=Speak clearly, naturally, and conversationally for a YouTube explainer.
SCENE_TARGET_SEC=12
SCENE_MIN_SEC=6
SCENE_MAX_SEC=18
VIDEO_WIDTH=1920
VIDEO_HEIGHT=1080
VIDEO_FPS=30
```

Normally leave `WHITEBOARD_PYTHON` empty. Set it only if you want to pin an already-prepared interpreter from the upstream whiteboard environment.

## 2. Install/check local prerequisites

Required locally:

- Node.js 20+
- FFmpeg + ffprobe
- Git
- Python 3

Then run:

```bash
npm run setup
npm run doctor
```

`setup` prepares the workspace and whiteboard engine. `doctor` is read-only and prints only non-secret configuration state; it never prints the API key value.

All rows should report `OK`. A landscape-image crop warning is expected because GPT Image landscape output is 3:2 while the final YouTube video is 16:9; prompts use a centered safe area before cropping.

## 3. Verify orchestration without paid generation

Optional but recommended after a fresh machine setup:

```bash
npm test
npm run smoke
```

The smoke workflow uses mock AI providers and creates a real MP4 through FFmpeg.

## 4. Run the real workflow

```bash
npm run web
```

Open:

```text
http://127.0.0.1:4173
```

Workflow:

1. Create project with **Topic → auto script**, Script, or SRT.
2. Review/edit narration and visual prompts per scene.
3. Render individual scenes and review image, voice, and clip previews.
4. Repeat only the scenes that need changes.
5. Click **Run full pipeline** when all scenes are approved.
6. Review the seekable final video in the control panel.
7. Final file is stored at `workspace/<project-id>/output/final.mp4`.

## Done criteria

The environment is ready when:

- `npm run doctor` has no `FAIL` rows;
- `npm test` passes;
- `npm run smoke` produces `final.mp4`;
- the web UI health header shows `REAL · whiteboard` and the OpenAI key is marked configured;
- a real project can render at least one scene before the full pipeline is launched.
