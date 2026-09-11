# Architecture

This document describes the implemented v0.1 architecture. For the reasoning behind the final choices, also see [`architecture-v0.1.md`](architecture-v0.1.md).

## 1. Overview

```text
Local browser UI / CLI
        |
Node.js pipeline orchestrator
        |
project.json + filesystem artifacts
        |
Provider adapters + renderer adapters
        |
OpenAI / FFmpeg / Python whiteboard engine
```

The original scaffold proposed TanStack Start + SQLite. v0.1 deliberately uses Node's built-in HTTP server and `project.json` instead, eliminating npm runtime dependencies while preserving replaceable provider/renderer boundaries.

## 2. Local-first process model

```text
Node.js
  |- local HTTP review UI
  |- CLI
  |- project.json state
  |- workspace files
  |- OpenAI HTTP adapters
  |- FFmpeg subprocesses
  `- Python whiteboard subprocess
```

There is no auth, database server, queue, container requirement, or cloud worker in v0.1.

## 3. Project workspace

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

`project.json` is the canonical state. Large media stays on disk and is referenced by relative paths.

## 4. Pipeline dependency graph

```text
script / SRT
   -> scene plan
      -> per-scene voice -----------+
      -> per-scene image            |
            -> scene renderer       |
                  -> normalized mux-+
                         -> concat -> final.mp4
```

Narration is generated per scene. The measured voice duration updates that scene's timeline before video rendering, which keeps audio and visuals synchronized.

### Workflow modes

The application exposes two operating modes over this same dependency graph:

- `auto` runs every stale stage through the final cut and is intended for fast first drafts and automation;
- `studio` exposes script, voice, visual, and clip checkpoints. Creative downstream work is gated by explicit owner approval.

These are orchestration policies, not separate pipelines. Both modes call the same provider/renderer adapters, use the same cache keys, and persist to the same `project.json`. A project can switch modes without copying artifacts or losing completed work.

In Studio mode, script approval unlocks voice and visual generation. Approved voice and visual artifacts unlock clip rendering. Every scene clip must be approved before final assembly.

Stage-first and bulk operations pass an explicit scene ID set into the same pipeline runner. The runner validates that set and processes only those scenes, preserving the per-scene cache and the invariant that unrelated scenes are never rerun.

## 5. Cache / stale behavior

Every scene stores independent SHA-256 keys for voice, image, video, and clip outputs. Each key includes only the inputs relevant to that step.

Changing one scene narration or visual prompt invalidates that scene's downstream artifacts without forcing other scenes to rerender. A full run reuses valid files and creates only stale outputs.

Technical readiness and creative approval are separate state. Regenerating an artifact returns its checkpoint to `pending`; editing an upstream input marks affected downstream reviews `stale`.

## 6. Provider boundary

`packages/providers` owns external AI request shapes. The current providers are:

- OpenAI image generation;
- OpenAI text-to-speech;
- mock speech/image behavior for zero-cost tests.

Provider-specific fields come from ENV/config and do not become the canonical project model.

## 7. Renderer boundary

`packages/renderers` owns media engines:

- `simple`: FFmpeg-only scene renderer used for smoke tests and fallback;
- `whiteboard`: adapter around `geeklee/srt-whiteboard-animation`;
- `cinematic-broll`: local B-roll composition with captions and optional music;
- `draw-reveal`: local full-color artwork reveal mask with a path-following hand.

The whiteboard adapter:

1. installs/prepares the upstream engine when configured;
2. builds a valid annotation from the generic scene;
3. invokes the upstream Python renderer;
4. returns a scene video to the common pipeline.

v0.1 uses one semantic full-canvas region per scene so the process is fully automatic. Multi-region semantic drawing can be added later without changing the project model.

## 8. Output normalization

Renderer outputs may differ in dimensions or FPS. Before concatenation, every scene is encoded to the configured output size/FPS with H.264 video and AAC audio. This guarantees compatible clips for final FFmpeg concat.

## 9. Failure model

Pipeline operations fail with actionable process/API errors and keep previously successful artifacts on disk. The UI/CLI can rerun a single scene or force a regeneration when needed.
