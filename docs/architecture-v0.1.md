# Architecture v0.1

## Control plane

Node.js owns project state, provider calls, process orchestration and a small local HTTP UI. The runtime intentionally has no npm dependencies in v0.1 so the personal tool is easy to install and debug.

## Data plane

Heavy media work is delegated to FFmpeg and renderer subprocesses. The whiteboard adapter shells out to `srt-whiteboard-animation` and creates a valid full-canvas annotation automatically for each generated scene image.

## Sync strategy

Speech is generated per scene. Its measured duration becomes the source of truth for that scene. The video renderer receives that exact duration, and FFmpeg muxes the scene video with its narration before all clips are concatenated. This prevents estimated script timing from drifting away from narration.

## Cache strategy

Each scene stores SHA-256 cache keys for voice, image, video and mux outputs. A key contains only inputs relevant to that step. Editing narration or a prompt invalidates downstream work for that scene without touching other scenes.

## Whiteboard trade-off

v0.1 uses one full-canvas semantic element per scene to make the upstream renderer fully automatable. A later phase can add vision-based multi-region annotation for more narrative drawing order without changing the renderer contract.
