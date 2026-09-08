# Architecture

## 1. Overview

The architecture is split into four layers:

```text
UI / Project Editor
       |
Pipeline Orchestrator
       |
Artifact + State Store
       |
Renderer / Provider Adapters
```

### UI / Project Editor

TanStack Start app for project navigation, script editing, scene editing, render status, previews, and export.

### Pipeline Orchestrator

Owns task dependencies, stale-state detection, cache keys, execution, retries, and progress reporting.

### Artifact + State Store

- SQLite stores metadata/state.
- Filesystem stores large artifacts: audio, images, SRT, JSON, MP4.
- Database paths are relative to the project workspace where possible.

### Provider / Renderer Adapters

Stable interfaces around replaceable engines:

- TTS provider
- transcription/SRT provider
- image provider
- whiteboard renderer
- future slideshow / motion / stock renderers

## 2. Local-first process model

```text
TanStack Start
  |- SQLite
  |- Project files
  |- FFmpeg
  |- Node worker
  `- Python renderer subprocess
```

For v0.1, all processes may run on the same machine. Do not introduce Redis, queues, containers, or distributed workers until needed.

## 3. Project workspace

```text
workspace/<project-id>/
  project.json
  source/
    script.md
    input.srt
  audio/
    voice.mp3
  scenes/
    001/
      scene.json
      visual.png
      annotation.json
      render.mp4
      preview.mp4
    002/
      ...
  output/
    concat.mp4
    final.mp4
  logs/
```

## 4. Pipeline dependency graph

```text
script/srt
   -> scene plan
      -> scene visual
         -> renderer metadata/annotation
            -> scene render

voice -------------------------------> final mux
scene renders -> concat --------------> final mux
```

Each node records an input hash and output artifact. If inputs have not changed and the artifact exists, the node is skipped.

## 5. Stale state

Example: change only `scene[4].visual.prompt`.

Invalidate:

```text
scene 4 visual
scene 4 annotation (if derived from visual)
scene 4 render
concat
final mux
```

Do not invalidate voice, other scenes, or the source script.

## 6. Renderer boundary

The core must never know implementation details such as OpenCV masks, hand paths, or contour wipes.

Core calls:

```ts
renderer.prepare(scene, context)
renderer.render(scene, context)
renderer.validate(scene, context)
```

The whiteboard adapter translates the generic scene into the external renderer's SRT/image/annotation files and invokes Python scripts.

## 7. Whiteboard renderer integration

Recommended initial integration:

```text
vendor/srt-whiteboard-animation
```

Use it as a git submodule or separately cloned dependency. Do not modify upstream code until a real limitation appears.

Adapter responsibilities:

1. Build the scene-specific input files.
2. Run its environment preparation/check.
3. Generate/validate annotation.
4. Invoke its stream renderer.
5. Capture stdout/stderr and exit code.
6. Copy/link outputs into the project scene directory.

## 8. Error model

Every pipeline task has:

- `pending`
- `running`
- `succeeded`
- `failed`
- `stale`
- `cancelled`

Failures must keep previous successful outputs when safe. A failed re-render should not delete the last playable scene render.
