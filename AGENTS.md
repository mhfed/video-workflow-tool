# AGENTS.md

## Goal
Keep this repository a reliable local-first video workflow tool for one owner.

## Invariants

- `project.json` is the canonical workflow state.
- Never require a full rerun when only one scene changes.
- Keep providers and renderers replaceable.
- Do not commit generated media, `.env`, API keys, or the cloned whiteboard engine.
- The `simple` renderer + mock providers must remain an offline smoke-test path.
- Before committing a meaningful phase, run `npm test` and `npm run smoke` when FFmpeg is available.

## Architecture

- `packages/core`: project state, parsing, timing, process/media helpers.
- `packages/providers`: image and voice providers.
- `packages/renderers`: simple and whiteboard rendering adapters.
- `apps/worker`: orchestration and CLI.
- `apps/web`: local review/control UI.

## Provider rule

Use provider adapters rather than leaking API-specific fields into project state. OpenAI HTTP defaults belong in `.env.example`; secrets belong only in `.env`.

## Whiteboard rule

Treat `geeklee/srt-whiteboard-animation` as an external engine. Keep integration behind `packages/renderers/src/whiteboard.mjs`; do not copy upstream implementation into core.
