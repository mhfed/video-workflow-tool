# Providers

Replaceable text, image, and voice provider adapters.

Voice orchestration goes through `src/voice.mjs`, which owns provider lookup and cache inputs. Provider-specific request fields stay in environment-backed runtime configuration and never enter `project.json`.

Supported voice adapters:

- `openai`: synchronous MP3 speech generation;
- `vivibe`: LucyAI JSON-RPC job creation, status polling, download, and MP3 normalization;
- `mock`: offline silent audio for smoke tests.

To add another voice source, implement its adapter and register its cache identity plus synthesizer in `src/voice.mjs`. The worker pipeline does not need provider-specific branches.
