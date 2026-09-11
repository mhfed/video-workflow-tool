# Renderers

Replaceable scene-rendering adapters selected through `src/registry.mjs`:

- `simple`: the offline image/placeholder renderer.
- `whiteboard`: the external `srt-whiteboard-animation` integration.
- `cinematic-broll`: local video cover-crop, loop/trim, burned scene subtitles, and optional quiet local music.
- `draw-reveal`: deterministic FFmpeg mask animation that reveals a local full-color illustration while a hand follows the same path.

The worker still owns voice generation, reviews, cache lifecycle, takes, and final assembly. Cinematic B-roll only consumes a resolved project-local clip (`scene.broll`) plus the narration file already produced by the voice stage. It can prepare its own local visual input and mix renderer-specific audio through optional adapter hooks; existing adapters continue through the original image generation and FFmpeg voice-mux path.

Common Cinematic video extensions are `.mp4`, `.mov`, `.mkv`, and `.webm`. Background music may be `.aac`, `.flac`, `.m4a`, `.mp3`, `.ogg`, or `.wav`. FFmpeg `drawtext` is used for captions when available; macOS has a CoreText PNG fallback for minimal FFmpeg builds without text filters. Other platforms should install FFmpeg with libfreetype/drawtext support.

Draw Reveal accepts project-local `.png`, `.jpg`, or `.jpeg` artwork through `scene.artwork`. Its default `contour-v1` mode runs FFmpeg edge detection at analysis resolution, visits populated edge cells in deterministic drawing order, and falls back to a contain-fitted serpentine path when the artwork has too few edges. `drawReveal.path` can replace this with 2–64 explicit `[x, y]` points from 0 to 1; `null` restores automatic generation. The registry exposes the renderer's optional `resolvePath` hook to the local path editor, while the worker continues using the ordinary render adapter. The existing hand PNG is reused by default, while `drawReveal.handAsset` may point to another project-local image. It uses the same narration lifecycle and supports the existing `backgroundMusic` field plus renderer-local subtitle/music settings.
