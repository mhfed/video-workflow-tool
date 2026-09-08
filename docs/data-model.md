# Data Model

## VideoProject

Canonical project state should be serializable to JSON even if SQLite is used operationally.

```ts
type VideoProject = {
  version: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
  workspacePath: string
  source: SourceSpec
  audio: AudioSpec
  scenes: Scene[]
  output: OutputSpec
  preset?: string
}
```

## Scene

```ts
type Scene = {
  id: string
  index: number
  text: string
  startMs?: number
  endMs?: number
  durationMs?: number

  visual: {
    prompt?: string
    provider?: string
    assetPath?: string
    inputHash?: string
  }

  renderer: {
    type: 'whiteboard' | 'slideshow' | 'motion'
    config: Record<string, unknown>
    metadataPath?: string
    previewPath?: string
    outputPath?: string
    inputHash?: string
    status: TaskStatus
  }
}
```

## Artifact

```ts
type Artifact = {
  id: string
  projectId: string
  sceneId?: string
  kind:
    | 'script'
    | 'srt'
    | 'voice'
    | 'visual'
    | 'annotation'
    | 'scene-preview'
    | 'scene-render'
    | 'final-video'
  path: string
  hash: string
  createdAt: string
  metadata?: Record<string, unknown>
}
```

## TaskRun

```ts
type TaskStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'stale'
  | 'cancelled'

type TaskRun = {
  id: string
  projectId: string
  sceneId?: string
  taskType: string
  status: TaskStatus
  inputHash: string
  startedAt?: string
  finishedAt?: string
  exitCode?: number
  logPath?: string
  error?: string
}
```

## SQLite tables

Recommended minimal tables:

- `projects`
- `scenes`
- `artifacts`
- `task_runs`
- `presets`

Large JSON configs may remain JSON columns in v0.1. Avoid over-normalizing renderer-specific settings.
