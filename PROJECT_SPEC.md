# Project Specification

## Working name

Video Workflow Tool

## User

Single user: the owner/developer. No auth, billing, team permissions, cloud sync, or multi-tenant concerns in v0.1.

## Problem

AI video generation pipelines are easy to automate but hard to control. If one scene is wrong, monolithic pipelines often force the creator to re-run expensive steps and lose previous good outputs.

## Product principle

Treat video production like software compilation:

```text
source material
  -> structured project
  -> scene artifacts
  -> renderer outputs
  -> final video
```

Every intermediate artifact is inspectable and cacheable.

## Success criteria for v0.1

- Import script or SRT.
- Create and persist a `VideoProject`.
- Edit scene text, time range, visual prompt, renderer settings.
- Run whiteboard render for one scene.
- Render only stale/changed scenes.
- Merge all rendered scenes.
- Attach voice and export a playable MP4.
- Resume a project after closing the app without losing state.

## Explicit non-goals

- SaaS billing.
- User accounts.
- Cloud render farm.
- YouTube auto-upload.
- Analytics.
- Automatic topic research.
- Full autonomous script generation.
- Multiple collaborators.

These may come later only if the personal workflow proves useful.
