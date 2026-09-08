# MVP v0.1

## Objective

Provide a usable personal/local workflow that turns an existing script or SRT into an editable, synchronized final MP4 while avoiding unnecessary rerenders.

## Implemented user flow

### A. Create project

From the browser UI, paste:

- project title;
- script text or SRT text.

From CLI, use `--script <file>` or `--srt <file>`.

The tool creates a workspace and canonical `project.json`.

### B. Scene planning

- Script input is split automatically using sentence boundaries plus configured target/min/max scene duration.
- SRT input preserves source cue timing and groups cues into scenes.
- Every scene gets editable narration and an editable whiteboard-style visual prompt.

### C. Per-scene generation

For each stale scene:

1. create narration with the configured speech provider;
2. measure the actual narration duration;
3. update the scene timeline;
4. create the scene illustration;
5. render with `simple` or `whiteboard`;
6. normalize video size/FPS and mux narration;
7. cache hashes and artifact paths.

A single scene can be rerun independently.

### D. Final render

All normalized scene clips are concatenated in scene order into:

```text
workspace/<project-id>/output/final.mp4
```

The browser UI streams this file into a final preview player.

## Implemented UI scope

### Projects

- Create project.
- List/reopen local projects.
- Show project status and scene count.

### Scene editor

For each scene:

- narration text;
- measured/planned duration;
- visual prompt;
- current status;
- save edits;
- render only that scene.

### Project action

- Run the complete pipeline while reusing valid cached scene artifacts.

### Final preview

- Play final MP4 in browser.
- Show final artifact path.

## CLI scope

```bash
npm run cli -- create --title "..." --script ./script.md
npm run cli -- create --title "..." --srt ./subtitles.srt
npm run cli -- status
npm run cli -- run --project <id>
npm run cli -- run --project <id> --scene scene-003
npm run cli -- run --project <id> --force
```

## Acceptance status

- [x] Script project can be created and automatically split into scenes.
- [x] SRT project can be imported and cue timing parsed.
- [x] One scene can be rendered independently.
- [x] Scene inputs are hashed so unchanged artifacts are reused.
- [x] Project state survives process restart because it is persisted to disk.
- [x] Narration duration drives scene timing.
- [x] Renderer output is normalized before concat.
- [x] Final MP4 contains scenes in order with narration audio.
- [x] Final MP4 is reviewable in the local browser UI.
- [x] Whiteboard adapter contract has a regression test.
- [x] OpenAI image/speech request contracts have offline tests.
- [x] GitHub CI runs prerequisite check, tests and a full mock smoke render.

## Deferred from v0.1

- Existing voice-file import.
- Background music/SFX mixing.
- Dedicated render queue/progress log UI.
- Drag/drop file upload (paste text and CLI file input are sufficient for v0.1).
- Automatic topic research/script writing.
- Multi-region semantic whiteboard annotation.
