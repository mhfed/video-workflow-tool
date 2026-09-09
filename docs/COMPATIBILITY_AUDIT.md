# External compatibility audit

Verified on 2026-09-09 before handoff.

This audit exists because the repository's CI intentionally uses mock AI providers for deterministic, zero-cost testing. The real workflow also depends on external contracts that must match the integration code.

## OpenAI text generation

The workflow uses the Responses API at `POST /v1/responses` with the configured `OPENAI_TEXT_MODEL` and plain text `input`.

Default model: `gpt-5.6-luna`.

## OpenAI image generation

The workflow uses `POST /v1/images/generations`.

Current integration fields were checked against the OpenAI API reference:

- model: `gpt-image-2`
- size: `1536x1024`
- quality: `medium`
- output_format: `png`
- response handling: `data[0].b64_json` with URL fallback

The final video is 16:9 while the generated landscape image is 3:2. Scene prompts explicitly reserve a centered 16:9 safe area and FFmpeg performs the final crop.

## OpenAI speech generation

The workflow uses `POST /v1/audio/speech`.

Current integration fields were checked against the OpenAI API reference:

- model: `gpt-4o-mini-tts`
- built-in voice: `marin`
- instructions: supported for `gpt-4o-mini-tts`
- response_format: `mp3`

Scene-sized narration keeps requests well below the API's per-request text limit under normal operation.

## Whiteboard renderer

Upstream: `geeklee/srt-whiteboard-animation`.

The current upstream `scripts/render_stream_whiteboard.py` accepts all flags used by this repository:

- `--total-ms`
- `--ink-path grid|skeleton`
- `--color-fill contour-wipe|brush`
- `--pause heavy|auto|light|off`

The current upstream `scripts/prepare_env.py` also preserves the expected contract:

1. creates/reuses `.venv`;
2. installs `opencv-python`, `numpy`, `av`, and `Pillow` when needed;
3. supports `--check`;
4. prints `ENV_PY=<interpreter>` for the caller.

The tool therefore keeps the upstream repository as an external renderer dependency rather than copying renderer internals into the core workflow.

## Local media requirements

The real workflow still requires these machine-level executables:

- Node.js 20+
- FFmpeg
- ffprobe
- Git
- Python 3

Run `npm run setup` followed by `npm run doctor` after filling `.env`.

## Handoff status

The deterministic CI path covers unit tests, provider request contracts, cache invalidation, media serving, whiteboard adapter behavior, and an end-to-end MP4 smoke render. The external request shapes and whiteboard CLI contract were additionally checked against their live documentation/upstream source before handoff.
