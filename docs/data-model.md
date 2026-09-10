# Data Model

`workspace/<project-id>/project.json` is the canonical state in v0.1. The schema is intentionally plain JSON so it can later be indexed by SQLite without changing the workflow model.

## VideoProject

Representative shape:

```json
{
  "version": 4,
  "id": "why-habits-work-a1b2c3",
  "title": "Why habits work",
  "createdAt": "2026-09-09T00:00:00.000Z",
  "updatedAt": "2026-09-09T00:02:00.000Z",
  "source": {
    "type": "script",
    "text": "..."
  },
  "settings": {
    "renderer": "whiteboard",
    "format": "landscape",
    "aspectRatio": "16:9",
    "workflowMode": "studio",
    "width": 1920,
    "height": 1080,
    "fps": 30
  },
  "scenes": [],
  "artifacts": {
    "final": "output/final.mp4"
  },
  "status": "complete"
}
```

`source.type` is currently `script` or `srt`.

## Scene

```json
{
  "id": "scene-001",
  "index": 0,
  "text": "Narration text for this scene.",
  "visualIntent": "A learner freezes during a real conversation.",
  "startMs": 0,
  "endMs": 7421,
  "durationMs": 7421,
  "sourceStartMs": null,
  "sourceEndMs": null,
  "visualPrompt": "Create one clean 16:9 whiteboard-style illustration...",
  "renderer": "simple",
  "status": "ready",
  "review": {
    "script": "approved",
    "voice": "approved",
    "visual": "approved",
    "clip": "pending"
  },
  "cache": {
    "voice": "sha256...",
    "image": "sha256...",
    "video": "sha256...",
    "clip": "sha256..."
  },
  "artifacts": {
    "voice": "scenes/scene-001/voice.mp3",
    "visual": "scenes/scene-001/visual.png",
    "video": "scenes/scene-001/video.mp4",
    "clip": "scenes/scene-001/clip.mp4"
  }
}
```

`renderer` is optional at scene level. When absent, legacy projects continue to
use `settings.renderer`, followed by the runtime `VIDEO_RENDERER` default.

`visualIntent` is the owner-facing description of what the scene should show.
`visualPrompt` is compiled from narration, visual intent, format, and the shared
art direction. The normal UI edits `visualIntent` and keeps the compiled prompt
under Advanced production details. Legacy projects infer visual intent from
their narration until the owner changes it.

Scene IDs remain stable when a scene is moved. Structural operations update the
ordered `scenes` array, indexes, and timeline while invalidating only the final
assembly or the directly changed scene dependencies.

`settings.workflowMode` is `auto` or `studio`. Review decisions are independent from the technical `status` and can be `pending`, `approved`, `changes-requested`, or `stale`.

`settings.format` is `landscape` (16:9) or `short` (9:16). Short projects use 1080 × 1920. These dimensions are canonical project state and override environment defaults while rendering. Changing only the format invalidates rendered scene video, synchronized clips, and the final cut; voice and generated visuals remain reusable.

Studio dependency gates are:

```text
script approval -> voice / visual generation
voice + visual approval -> clip render
all clip approvals -> final assembly
```

For SRT imports, `sourceStartMs` and `sourceEndMs` retain the source cue timing. For generated speech, `durationMs` is updated from the measured audio duration and the project timeline is recalculated.

## Cache semantics

- `voice` hash: narration + speech provider/model/voice/instructions.
- `image` hash: visual prompt + image provider/model/size/quality.
- `video` hash: renderer + scene duration + visual hash + video settings.
- `clip` hash: rendered video + voice + normalized output dimensions/FPS.

If a matching hash exists and its file exists, that step is reused.

## Artifact files

v0.1 does not create a separate database artifact table. Artifact metadata lives next to each scene/project in `project.json`; media bytes remain in the filesystem. This is sufficient for the single-user local workflow and can be indexed later without migrating the media layout.
