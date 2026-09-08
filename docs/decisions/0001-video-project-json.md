# ADR-0001: Use VideoProject as the canonical intermediate representation

Status: Accepted

## Context

A video workflow can easily become coupled to individual providers or scripts. If the whiteboard engine defines the entire application's data model, adding another renderer later becomes expensive.

## Decision

Use a provider-neutral `VideoProject`/`Scene` representation as the source of truth. Provider-specific formats such as whiteboard `annotation.json` are generated artifacts, not canonical state.

## Consequences

Positive:

- renderer swapping is possible;
- project edits are provider-independent;
- cache invalidation can be generic;
- multiple output formats can share the same source project.

Cost:

- adapters must translate between the core schema and provider-specific formats;
- some renderer-specific options remain opaque JSON.
