// Provider-neutral, JSON-only content contracts. No credentials or runtime config.
export const textValue = (value, max = 6000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const stringList = (value, max = 50) => Array.isArray(value) ? value.map((item) => textValue(item, 1000)).filter(Boolean).slice(0, max) : [];
export const objectValue = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export const contentError = (message, status = 400) => Object.assign(new Error(message), { status });
export const PUBLISH_STATUSES = Object.freeze(['draft', 'ready', 'scheduled', 'published', 'failed']);

export function normalizeMemory(value = {}) {
  const memory = objectValue(value);
  return {
    characters: stringList(memory.characters, 30), palette: stringList(memory.palette, 12),
    artDirection: textValue(memory.artDirection), pronunciations: stringList(memory.pronunciations),
    terms: stringList(memory.terms), conventions: stringList(memory.conventions),
  };
}

export function normalizeBrief(value) {
  if (value == null) return null;
  const brief = objectValue(value);
  const result = Object.fromEntries(['topic', 'pillar', 'targetViewer', 'viewerQuestion', 'angle', 'corePromise', 'hook', 'desiredTakeaway', 'narrativeDirection'].map((key) => [key, textValue(brief[key])]));
  result.targetDurationSec = brief.targetDurationSec == null || brief.targetDurationSec === '' ? null : Number(brief.targetDurationSec);
  if (result.targetDurationSec !== null && (!Number.isFinite(result.targetDurationSec) || result.targetDurationSec <= 0 || result.targetDurationSec > 14400)) throw contentError('Brief duration must be between 0 and 14400 seconds.');
  result.format = brief.format || null;
  if (result.format && !['landscape', 'short'].includes(result.format)) throw contentError('Unsupported brief format.');
  return result;
}

export function normalizeContentProject(project) {
  // Additive normalization: old files need no disk rewrite and renders never load a channel.
  project.channelId ||= null;
  project.channelRevision ??= null;
  project.channelSnapshotAt ??= null;
  project.channelSnapshot ??= null;
  project.channelApplications = Array.isArray(project.channelApplications) ? project.channelApplications : [];
  project.ideaId ??= null;
  project.brief ??= null;
  project.publish ||= { status: 'draft', youtubeVideoId: null, publishedAt: null, scheduledAt: null };
  return project;
}
