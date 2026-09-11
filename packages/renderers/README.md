# Renderers

Replaceable scene-rendering adapters selected through `src/registry.mjs`:

- `simple`: the offline image/placeholder renderer.
- `whiteboard`: the external `srt-whiteboard-animation` integration.
- `cinematic-broll`: local video cover-crop, loop/trim, burned scene subtitles, and optional quiet local music.

The worker still owns voice generation, reviews, cache lifecycle, takes, and final assembly. Cinematic B-roll only consumes a resolved project-local clip (`scene.broll`) plus the narration file already produced by the voice stage. It can prepare its own local visual input and mix renderer-specific audio through optional adapter hooks; existing adapters continue through the original image generation and FFmpeg voice-mux path.

Common Cinematic video extensions are `.mp4`, `.mov`, `.mkv`, and `.webm`. Background music may be `.aac`, `.flac`, `.m4a`, `.mp3`, `.ogg`, or `.wav`. FFmpeg `drawtext` is used for captions when available; macOS has a CoreText PNG fallback for minimal FFmpeg builds without text filters. Other platforms should install FFmpeg with libfreetype/drawtext support.
