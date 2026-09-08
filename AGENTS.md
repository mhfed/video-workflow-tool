# AGENTS.md

## Product intent

This repository is a personal/local-first video production workflow tool. Optimize for fast iteration, debuggability, resumability, and per-scene regeneration.

## Engineering rules

1. Keep the core independent from specific AI or renderer providers.
2. Never require rebuilding the entire video when one scene changes.
3. Persist intermediate artifacts and input hashes.
4. Preserve previous successful outputs when a re-render fails.
5. Prefer simple local infrastructure in v0.1.
6. Renderer-specific metadata must not become the canonical project model.
7. Keep external engines behind adapters.

## Preferred stack

- TypeScript
- TanStack Start
- Zod
- SQLite
- FFmpeg
- Python subprocess adapters where needed

## Before implementing a feature

Check whether it belongs to:

- core project model;
- pipeline orchestration;
- provider adapter;
- renderer adapter;
- UI only.

Avoid mixing these responsibilities.
