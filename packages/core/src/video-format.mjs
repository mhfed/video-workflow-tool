export const VIDEO_FORMATS = Object.freeze({
  landscape: Object.freeze({ width: 1920, height: 1080, aspectRatio: '16:9' }),
  short: Object.freeze({ width: 1080, height: 1920, aspectRatio: '9:16' })
});

export const SUPPORTED_VIDEO_FORMATS = new Set(Object.keys(VIDEO_FORMATS));

export function videoFormatSettings(format = 'landscape', fallback = {}) {
  if (!SUPPORTED_VIDEO_FORMATS.has(format)) throw new Error(`Unsupported video format: ${format}`);
  const preset = VIDEO_FORMATS[format];
  return { format, aspectRatio: preset.aspectRatio, width: format === 'landscape' ? Number(fallback.width) || preset.width : preset.width, height: format === 'landscape' ? Number(fallback.height) || preset.height : preset.height };
}

export function normalizeVideoFormat(settings = {}, fallback = {}) {
  const inferred = settings.format || (Number(settings.height) > Number(settings.width) ? 'short' : 'landscape');
  const format = SUPPORTED_VIDEO_FORMATS.has(inferred) ? inferred : 'landscape';
  const preset = videoFormatSettings(format, { width: settings.width || fallback.width, height: settings.height || fallback.height });
  settings.format = format; settings.aspectRatio = preset.aspectRatio;
  settings.width = Number(settings.width) > 0 ? Number(settings.width) : preset.width;
  settings.height = Number(settings.height) > 0 ? Number(settings.height) : preset.height;
  return settings;
}
