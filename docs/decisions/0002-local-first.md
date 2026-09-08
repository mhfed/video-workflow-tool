# ADR-0002: Local-first MVP

Status: Accepted

## Decision

Run the UI, database, files, FFmpeg, and renderer workers on one machine for v0.1.

## Why

This is a personal tool. Distributed infrastructure would increase failure modes and development time without improving the immediate workflow.

## Revisit when

- rendering must happen on another machine/GPU;
- multiple users need shared projects;
- jobs must survive host shutdown independently.
