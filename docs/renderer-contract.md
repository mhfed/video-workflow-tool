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
pipeline. Its renderer entries delegate directly to isolated adapter functions;
the registry does not own orchestration, approvals, or media
generation.

Scene renderer selection uses the optional top-level `scene.renderer` field. The
registry resolves it before the legacy project and environment defaults:
`scene.renderer`, then `project.settings.renderer`, then `cfg.renderer`.

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

## `draw-reveal` renderer

Implementation: `packages/renderers/src/draw-reveal.mjs`.

- Consumes project-local full-color raster artwork rather than converting it to line art.
- Generates a normalized serpentine path or accepts an explicit normalized path.
- Encodes nearest-path reveal order into a temporary grayscale schedule mask.
- Thresholds that mask over narration duration and moves the existing hand asset along the same path.
- Supports renderer-local burned captions and optional quiet background music through the existing adapter hooks.
- Requires FFmpeg only and never invokes the external whiteboard engine.

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
- keep any additive renderer-specific options minimal and namespaced;
- let the common pipeline own voice mux, output normalization, caching, and final concat.
