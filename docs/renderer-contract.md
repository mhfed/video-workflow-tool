# Renderer Contract

## Goal

Make renderers replaceable without changing project orchestration.

```ts
export interface VideoRenderer {
  type: string

  validate(input: RenderInput): Promise<ValidationResult>
  prepare(input: RenderInput): Promise<PreparedRender>
  render(input: PreparedRender, ctx: RenderContext): Promise<RenderResult>
}
```

## Generic input

```ts
type RenderInput = {
  projectId: string
  scene: Scene
  workspace: string
  visualPath?: string
  subtitlePath?: string
}
```

## Whiteboard adapter

Adapter name: `whiteboard-srt`.

Responsibilities:

- translate generic scene fields into renderer-specific files;
- use the upstream annotation format as an implementation detail;
- run Python through a configured interpreter;
- surface progress and logs;
- return preview/final artifact paths.

Suggested configuration:

```json
{
  "type": "whiteboard-srt",
  "paperColor": "#F5EBD7",
  "inkPath": "grid",
  "colorFill": "contour-wipe",
  "holdEndMs": 500
}
```

## Future renderers

- `image-ken-burns`
- `stock-broll`
- `caption-first-short`
- `motion-graphics`

A renderer may have its own editor panel, but it must still obey the common task/artifact lifecycle.
