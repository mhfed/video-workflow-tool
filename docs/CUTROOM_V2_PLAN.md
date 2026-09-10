# CUTROOM v2 — AI Directing Room

## Product thesis

CUTROOM is not a pipeline dashboard. It is a local-first directing room where one owner can move from an idea to a reviewable rough cut, fix the smallest possible unit, and always understand what the system will do next.

The primary interaction loop is:

```text
open project
  -> watch the best available cut
  -> see the next useful action
  -> direct one scene in plain language
  -> preview the impact
  -> regenerate only affected artifacts
```

The existing editorial, warm, analog visual identity remains. The interaction model changes from provider stages to creator intent.

## Non-negotiable constraints

- `project.json` remains the canonical workflow state.
- A scene edit never requires unrelated scenes to run again.
- Provider-specific request fields stay behind provider adapters.
- Renderers remain replaceable through the renderer registry.
- The `simple` renderer and mock providers remain a complete offline smoke path.
- Existing projects load without migration commands.
- Generated media, secrets, build output, and the external whiteboard engine are never committed.

## UX architecture

### One directing workspace

Replace the separate overview, workbench, manual room, and autopilot room with one workspace:

```text
project header + rough-cut action + export
storyboard | best available preview | Director
scene timeline / health rail
```

### Storyboard

Each scene card contains a thumbnail, narration summary, duration, and one human-readable health state. Scene structure actions live with the scene: add, split, duplicate, merge, move, and remove.

### Preview

The center canvas shows the best available artifact by default:

```text
clip -> visual -> narration card
```

Voice, visual, and clip remain inspectable through a compact view switch. The user does not need to understand the dependency graph to see useful output.

### Director

The right panel answers three questions:

1. What is happening now?
2. What is the smallest useful next action?
3. What will change if I apply this instruction?

The primary editing surface is creator intent. Raw provider prompts and renderer details are advanced controls.

### Review policy

Approval is still persisted for compatibility, but the UI emphasizes exceptions. Pending, stale, and failed work is translated into a single scene health model and an actionable explanation.

## State model evolution

### v4 additions

Scenes gain a human-facing `visualIntent` while keeping `visualPrompt` as a compiled generation input:

```json
{
  "id": "scene-001",
  "text": "Narration heard by the viewer",
  "visualIntent": "A learner freezes during a real conversation",
  "visualPrompt": "Compiled renderer/provider-neutral image instruction"
}
```

Existing scenes infer `visualIntent` from narration until the owner edits it. Updating narration or visual intent recompiles the prompt and uses the existing dependency-aware invalidation rules.

### Stable scene operations

Scene order is independent of scene identity. Insert, split, duplicate, merge, remove, and move operations update indexes/timing while preserving unaffected artifacts. Removing a scene from canonical state does not eagerly delete its media files.

### Director proposal protocol

Natural-language direction produces a proposal before mutation:

```json
{
  "summary": "Shorten the narration and regenerate voice + clip",
  "changes": { "text": "..." },
  "action": "save",
  "impact": ["voice", "clip", "final"]
}
```

The server validates the proposal. The UI shows impact and requires an explicit Apply action. Mock mode returns deterministic local proposals so the directing loop remains testable offline.

## Delivery phases

### Phase 1 — implemented in this change

- [x] One AI directing workspace.
- [x] Persistent, readable project navigation.
- [x] Storyboard cards with best-available thumbnails and scene health.
- [x] Best-available preview with focused artifact inspection.
- [x] Smart next action with dependency explanation.
- [x] Human-facing visual intent; raw prompt moved to Advanced.
- [x] Scene insert, split, duplicate, merge, move, and remove APIs.
- [x] Natural-language Director proposal and apply loop.
- [x] Impact preview before a Director edit is applied.
- [x] Responsive desktop/tablet/mobile layouts.

### Phase 2 — control engine (implemented)

- [x] Persistent async job queue.
- [x] Per-step progress events and estimated remaining work.
- [x] Cooperative cancel for provider calls and subprocess trees.
- [x] Versioned voice, visual, and clip takes with an active selection.
- [x] Project patch log with undo/redo.
- [x] Rough-cut manifest playback without requiring a new final export.

### Phase 3 — autonomous quality (implemented)

- [x] Vision checks for safe areas, crop, unwanted text, and style drift.
- [x] Audio checks for silence, clipping, pacing, and pronunciation flags.
- [x] Project memory for recurring characters, palette, and art direction.
- [x] Batch repair proposals with scope and cost preview.
- [x] Semantic scene planning based on narrative beats instead of punctuation alone.

## v6 control contract

- Jobs live in `project.json` and are resumed from `queued` state after a server restart. Render, QA, and repair use the same queue.
- Progress is stored as events with completed/total work, percentage, current scene/stage, and an elapsed-rate ETA.
- Cancellation propagates through OpenAI/Vivibe HTTP requests and process groups started for FFmpeg, ffprobe, Git, Python, and the external renderer.
- Generated scene media is immutable under `scenes/<scene-id>/takes/<kind>/`; `selectedTakes` controls which voice, visual, render, or clip is active.
- Human mutations create bounded snapshots in `history.undo`; generation jobs do not pollute editorial undo history.
- QA remains useful offline for dimensions, silence, level, clipping, and pacing. OpenAI vision/transcription add semantic safe-area, unwanted-text, style, and pronunciation review when configured.
- Repair plans are proposals. They show affected scenes and request counts before the owner starts a repair job.

## Acceptance criteria for CUTROOM v2

- The first screen inside a project shows a useful preview and the next recommended action.
- A user can restructure a project without editing JSON or rerunning unrelated scenes.
- A user never needs to edit the compiled image prompt for a normal visual change.
- Every disabled generation action has an adjacent explanation of its prerequisite.
- Director instructions show affected stages before applying state changes.
- Jobs survive a server restart, expose progress/ETA, and can be cancelled without leaving a renderer process behind.
- Every generated scene artifact remains available as a take; changing the active take invalidates only its dependents.
- Rough cut, QA, scoped repair, project memory, and undo/redo work from the directing room without editing JSON.
- Existing v3 projects continue to load and render.
- `npm test`, `npm run web:build`, and `npm run smoke` pass.
