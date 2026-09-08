# MVP v0.1

## Objective

Prove that a personal scene-based workflow is materially faster than manually wiring scripts together.

## User flow

### A. Create project

Input:

- project name
- script text or SRT upload
- optional existing voice file

Output:

- workspace directory
- initial `VideoProject`

### B. Scene planning

If SRT exists, derive scene boundaries from timestamps.

If only script exists, allow manual scene splitting first. Automatic script-to-scene planning can be added after the core workflow works.

Each scene exposes:

- text
- start/end time
- duration
- visual prompt
- visual asset
- renderer
- renderer config
- render status

### C. Whiteboard rendering

For selected scenes:

1. ensure visual exists;
2. prepare whiteboard annotation;
3. render preview;
4. render final scene MP4;
5. save artifact metadata.

### D. Final render

- Concatenate scene MP4s in order.
- Add/replace voice track.
- Optional simple background music control.
- Export `output/final.mp4`.

## UI scope

### Projects

- New project
- Recent projects
- Open project
- Duplicate project (nice-to-have)

### Script

- Plain text editor
- Import `.md`, `.txt`, `.srt`
- Scene split markers
- Save

### Scene Editor

Three-column layout is preferred:

```text
Scene list | Preview / timeline | Scene properties
```

Properties:

- scene text
- start/end
- prompt
- renderer selector
- visual actions
- render actions

Primary actions:

- Regenerate visual
- Rebuild annotation
- Render preview
- Render scene
- Render all stale

### Render Queue

- running task
- queued tasks
- progress
- logs
- retry failed task

### Final Preview

- video player
- export path
- re-render stale scenes
- build final

## Acceptance tests

1. A 5-scene SRT project can be imported.
2. Scene 3 can be rendered while scenes 1, 2, 4, 5 remain untouched.
3. Editing scene 3 prompt marks only its downstream artifacts stale.
4. Restarting the app restores all project state.
5. Final MP4 contains all scenes in the correct order.
6. A failed scene render surfaces logs and can be retried.
