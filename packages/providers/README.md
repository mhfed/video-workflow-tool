# Providers

Replaceable text, image, and voice provider adapters.

Voice orchestration goes through `src/voice.mjs`, which owns provider lookup and cache inputs. Provider-specific request fields stay in environment-backed runtime configuration and never enter `project.json`.

Supported voice adapters:

- `openai`: synchronous MP3 speech generation;
- `vivibe`: LucyAI JSON-RPC job creation, status polling, download, and MP3 normalization;
- `mock`: offline silent audio for smoke tests.

To add another voice source, implement its adapter and register its cache identity plus synthesizer in `src/voice.mjs`. The worker pipeline does not need provider-specific branches.

## B-roll search

`src/broll.mjs` normalizes Pexels and Pixabay video search into one UI-facing result shape and chooses a rendition suited to the target aspect ratio. Credentials come only from `PEXELS_API_KEY` and `PIXABAY_API_KEY`.

The web download boundary accepts only HTTPS media URLs on the provider's known CDN host, streams with a size limit into a temporary file, then atomically moves the completed clip under the project's `assets/broll/` directory. Project state stores only the local relative path and generic source/creator attribution; API-specific response fields never enter the renderer.
