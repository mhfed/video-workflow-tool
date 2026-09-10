# Renderer Contract

## Goal

Keep renderer-specific logic outside the project model and pipeline orchestration.

In v0.1 the contract is intentionally small: the pipeline passes the scene, optional generated image, requested duration, output path, and runtime config to a renderer adapter.

Conceptually:

```ts
type RenderSceneInput = {
  scene: Scene
  imageFile: string | null
  outputFile: string
  durationSec: number
  cfg: RuntimeConfig
}

type RenderScene = (input: RenderSceneInput) => Promise<string>
```

The returned string is the rendered scene video path.

`packages/renderers/src/registry.mjs` is the compatibility registry used by the
pipeline. Its `simple` and `whiteboard` entries delegate directly to the existing
renderer functions; the registry does not own orchestration, approvals, or media
generation.

## `simple` renderer

Implementation: `packages/renderers/src/simple.mjs`.

- Uses FFmpeg only.
- With an image: scales/crops the visual and adds a subtle zoom.
- Without an image: creates a beige placeholder scene.
- Exists as a reliable fallback and zero-cost smoke-test renderer.

## `whiteboard` renderer

Implementation: `packages/renderers/src/whiteboard.mjs`.

Responsibilities:

1. ensure `geeklee/srt-whiteboard-animation` exists when auto-install is enabled;
2. prepare its isolated Python environment;
3. inspect the generated image dimensions;
4. create an upstream-compatible annotation JSON;
5. invoke `render_stream_whiteboard.py` with supported CLI flags;
6. return the rendered MP4 path.

Current upstream invocation uses:

```text
--ink-path grid
--color-fill contour-wipe
--pause off
--total-ms <measured narration duration>
```

The upstream annotation format, masks, hand-path behavior, and OpenCV implementation remain private to this adapter.

## v0.1 annotation policy

Each scene is represented as one semantic full-canvas region. This is fully automatic and robust enough to validate the end-to-end workflow.

A future semantic-annotation provider may break a scene into multiple narrative regions and sequences, but it must produce inputs for this adapter without changing `VideoProject` or the common pipeline.

## Pipeline normalization

A renderer is not required to emit the final target resolution/FPS. After rendering, the pipeline normalizes every scene during audio mux to the configured H.264/AAC clip format. Therefore new renderers can focus on visual generation while the pipeline guarantees concat compatibility.

## Adding another renderer

A new adapter should:

- accept the same generic scene inputs;
- write only inside the project/scene workspace or its own managed dependency directory;
- throw actionable errors when prerequisites are missing;
- never store renderer-specific structures in canonical project state;
- let the common pipeline own voice mux, output normalization, caching, and final concat.
