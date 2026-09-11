import fs from 'node:fs';
import path from 'node:path';

export function loadEnv(file = path.resolve('.env')) {
  if (!fs.existsSync(file)) return process.env;
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
  return process.env;
}

export function config() {
  const env = loadEnv();
  return {
    workspaceDir: path.resolve(env.WORKSPACE_DIR || './workspace'),
    uiLanguage: env.UI_LANGUAGE || 'vi',
    contentLanguage: env.CONTENT_LANGUAGE || 'vi',
    mockMode: /^(1|true|yes)$/i.test(env.MOCK_MODE || ''),
    renderer: env.VIDEO_RENDERER || 'simple',
    imageProvider: env.IMAGE_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'mock'),
    voiceProvider: env.VOICE_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'mock'),
    textProvider: env.TEXT_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'mock'),
    codexBin: env.CODEX_BIN || 'codex',
    codexModel: env.CODEX_MODEL || '',
    codexTimeoutMs: Number(env.CODEX_TIMEOUT_MS || 300000),
    openaiApiKey: env.OPENAI_API_KEY || '',
    openaiBaseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    openaiTextModel: env.OPENAI_TEXT_MODEL || 'gpt-5.6-luna',
    openaiImageModel: env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
    openaiImageSize: env.OPENAI_IMAGE_SIZE || '1536x1024',
    openaiImageQuality: env.OPENAI_IMAGE_QUALITY || 'medium',
    openaiTtsModel: env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    openaiTtsVoice: env.OPENAI_TTS_VOICE || 'marin',
    openaiTtsInstructions: env.OPENAI_TTS_INSTRUCTIONS || 'Speak clearly, naturally, and conversationally for a YouTube explainer.',
    openaiTranscribeModel: env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
    vivibeApiKey: env.VIVIBE_API_KEY || '',
    vivibeBaseUrl: (env.VIVIBE_BASE_URL || 'https://api.lucylab.io/json-rpc').replace(/\/$/, ''),
    vivibeVoiceId: env.VIVIBE_VOICE_ID || '',
    vivibeSpeed: Number(env.VIVIBE_SPEED || 1),
    vivibePollIntervalMs: Number(env.VIVIBE_POLL_INTERVAL_MS || 2000),
    vivibeTimeoutMs: Number(env.VIVIBE_TIMEOUT_MS || 120000),
    pexelsApiKey: env.PEXELS_API_KEY || '',
    pixabayApiKey: env.PIXABAY_API_KEY || '',
    scriptMinutes: Number(env.SCRIPT_TARGET_MINUTES || 6),
    ffmpegBin: env.FFMPEG_BIN || 'ffmpeg',
    ffprobeBin: env.FFPROBE_BIN || 'ffprobe',
    pythonBin: env.PYTHON_BIN || 'python3',
    whiteboardPython: env.WHITEBOARD_PYTHON || '',
    whiteboardEngineDir: path.resolve(env.WHITEBOARD_ENGINE_DIR || './vendor/srt-whiteboard-animation'),
    whiteboardAutoInstall: !/^(0|false|no)$/i.test(env.WHITEBOARD_AUTO_INSTALL || '1'),
    sceneTargetSec: Number(env.SCENE_TARGET_SEC || 12),
    sceneMinSec: Number(env.SCENE_MIN_SEC || 6),
    sceneMaxSec: Number(env.SCENE_MAX_SEC || 18),
    wordsPerMinute: Number(env.WORDS_PER_MINUTE || 150),
    width: Number(env.VIDEO_WIDTH || 1920),
    height: Number(env.VIDEO_HEIGHT || 1080),
    fps: Number(env.VIDEO_FPS || 30),
    webHost: env.WEB_HOST || '127.0.0.1',
    webPort: Number(env.WEB_PORT || 4173)
  };
}
