# ADR-0002: Channel strategy with independent video snapshots

Status: Accepted

## Context and insertion points

`project.json` already owns a video's source, scenes, memory, settings, reviews,
takes, history and output paths. `createProject` is the boundary before scene
planning. `normalizeWorkflow` provides additive legacy normalization. The worker
hashes actual narration, visual prompts and adapter configuration, not project
metadata. The web app opens the existing Director workspace after creation.

Extend these boundaries without changing project directories, scene identities,
renderer adapters or the artifact lifecycle. A Channel is reusable creative and
strategic context, not a container required by rendering.

## Storage and ownership

```text
workspace/
  .channels/<channel-id>/
    channel.json
    ideas/<idea-id>.json
  <project-id>/
    project.json
    scenes/...
    assets/...
    output/...
```

Channel profiles contain identity, strategy, editorial direction, visual identity,
production defaults, memory, packaging defaults and YouTube identity. Stable IDs
are separate from editable names/slugs. `channel.json` and idea files use atomic
replacement. A meaningful normalized profile change increments `revision`; an
identical save does not. Updates support optimistic revision checks. Ideas have
their own revisions; editing an idea does not revise channel DNA.

The channel model whitelists public profile fields. `youtube.connected` is false
for new profiles; entering a YouTube ID/handle never establishes a connection.
OAuth tokens, API keys, endpoints and provider request fields do not belong here.

## Snapshot inheritance

Video creation captures one channel revision before asynchronous script generation:

- `channelId`: current destination channel, or `null` for Unassigned.
- `channelRevision`: originally inherited revision, or `null` for assignment only.
- `channelSnapshotAt`: original inheritance timestamp.
- `channelSnapshot`: versioned original profile plus resolved settings, memory,
  creative context and packaging defaults. Never mutated by later channel edits.
- `channelApplications`: explicit partial applications, each with a source
  revision, timestamp and exact path/value pairs.

The snapshot's `resolved` object records what the channel supplied. The top-level
video settings/memory record the owner's effective choices, including overrides.
`channelRevision` deliberately continues to mean the original revision after a
partial apply; it does not falsely claim that every field is now up to date.

Review compares current channel values with the original resolved values plus
explicit applications. A three-way diff includes inherited, current-video and
proposed values, with local overrides flagged. Selected paths can be applied,
all pending paths can be applied, or the video can be left alone. Apply is guarded
by the reviewed channel revision and recorded in normal project undo/redo.

Assigning or reassigning a video only changes its channel reference and resets
inheritance provenance. Production settings, memory, creative context, artifacts
and source idea provenance stay intact. Undo restores the previous association
and snapshot. An assigned video can subsequently review and explicitly inherit
selected channel values.

Changing a channel never loads or writes its videos. Neither `loadProject` nor
the worker resolves a channel file. Missing/moved channels and copied projects
remain renderable using project-local assets and configured provider credentials.

## Memory and production boundaries

`project.memory` remains the production continuity contract. At creation it is
copied from channel memory, with visual identity as fallback for palette/art
direction and recurring characters merged. Per-video memory overrides are
supported by `createProject`; the memory is independent after creation. Terms
and conventions extend the existing characters/palette/artDirection/pronunciations
fields. Updating memory from the existing Director UI preserves new fields.

Visual scene planning receives resolved project memory before compiling prompts.
Generic `settings.voice = {provider, voiceId}` is translated to runtime options
inside the voice adapter. Provider model/endpoint/secrets remain environment
configuration. A voice default is resolved at creation, then stored in the video;
legacy projects without `settings.voice` retain the previous environment behavior.
Mock mode still overrides all provider choices.

Explicit application uses scoped invalidation:

| Applied change | Invalidation |
| --- | --- |
| Strategy, editorial, identity, packaging, terms, conventions | None |
| Desired language/duration, pronunciation QA guidance | None; does not rewrite existing narration |
| Captions / caption language | Final assembly only |
| FPS / format | Render, clip, final; source voice and image remain reusable |
| Renderer | Render, clip, final for scenes using the project renderer |
| Voice selection | Voice and dependent render/clip/final; script approval and visual remain |
| Visual memory | Recompile generated-image prompts; invalidate changed visuals and dependents |

Scene renderer overrides remain authoritative. Visual memory does not regenerate
project-local Draw Reveal artwork or Cinematic B-roll footage. Existing takes
remain available. Format changes reuse source artwork; later prompt edits compile
against the current frame. Cache signatures do not include channel IDs, revisions,
briefs, ideas or the full channel profile. Music defaults are creative direction
only in this phase; actual tracks remain video-local assets.

## Ideas and briefs

An Idea belongs to one channel and stores topic/title, pillar, angle, viewer
question, hook, promise, notes and optional brief. Statuses are `idea`,
`shortlisted`, `developing`, `converted-to-video`, and `archived`. Optional manual
scores are 0–5 for curiosity, evergreen value, channel fit, visualizability and
originality. No automatic scoring is fabricated.

`createVideo` is the shared web/CLI orchestration boundary. Idea creation resolves
an optional brief; a brief can also be supplied directly without an idea or
channel. Brief/strategy/editorial/continuity context is passed to both text
providers when generating narration and visual beats. Script and SRT imports
retain their supplied narration; Topic → script continues to work. The offline
mock text provider keeps its deterministic narration template.

The video stores `ideaId`, `ideaSource` (channel ID, idea ID, revision), and its
own normalized `brief`. The source idea keeps `videoIds` and becomes converted
only after project creation succeeds. If saving that backlink fails, the saved
project remains authoritative and its `ideaSource` allows later reconciliation.
Ideas may produce multiple videos; their backlink is historical and survives
video deletion or reassignment. Editing an idea never changes created videos.

## Compatibility and future integration

This is an additive extension of project version 7, with independent version 1
contracts for Channel, Idea and the inheritance snapshot. Legacy loads normalize
missing references to Unassigned and add a draft publish envelope in memory.
Normalization is idempotent and does not write legacy files merely by reading.
No destructive migration or output-path change is needed.

`publish` reserves `status`, `youtubeVideoId`, `publishedAt`, and `scheduledAt`.
Statuses are `draft`, `ready`, `scheduled`, `published`, and `failed`. Production
status stays separate: rendering completion does not imply publication. This
phase neither sends publication requests nor exposes an authenticated connection.

Future performance observations can attach to video ID + publish.youtubeVideoId,
with source, observedAt and measured views, CTR, average view duration, average
percentage viewed, retention observations and subscriber gain. Channel learning
can store dated conclusions with supporting video/observation IDs. Neither
observations nor learning should enter render cache keys; adopted lessons should
create a new channel profile revision for future videos. No placeholder metrics,
OAuth, uploads, analytics API calls or automatic learning are implemented here.

## API and CLI

- `GET/POST /api/channels`; `GET/PATCH /api/channels/:id`.
- `GET/POST /api/channels/:id/ideas`; `GET/PATCH .../ideas/:ideaId`.
- `GET /api/projects?channelId=<id>`; an empty channelId selects Unassigned.
- `POST /api/projects` accepts optional channelId, ideaId and brief.
- `GET /api/projects/:id/channel` returns availability and pending changes.
- `PATCH /api/projects/:id/channel` assigns `{channelId}` without inheritance.
- `POST /api/projects/:id/channel` applies `{paths, expectedRevision}`.
- `PATCH /api/projects/:id` accepts optional brief; editing it never regenerates.
- CLI `create` accepts `--channel <id>`, `--idea <id>`, `--brief <json-file>` in
  addition to all existing Topic/Script/SRT flags. Existing run/status are unchanged.

The web navigation adds channel overview, videos, idea bank and profile above the
Director. New Video uses the selected channel automatically. Video context is a
small wrapper/dialog, not a rewrite of the production workspace.
