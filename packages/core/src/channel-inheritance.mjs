import { channelProfile } from './channel.mjs';
import { contentError, normalizeMemory, sameValue } from './content-contract.mjs';
import { normalizeLanguage } from './languages.mjs';
import { videoFormatSettings } from './video-format.mjs';
import { visualPromptFor } from './scene-plan.mjs';
import { invalidateFinal, invalidateScene } from './invalidation.mjs';
import { recordHistory } from './history.mjs';
import { nowIso } from './utils.mjs';

export function resolveChannelValues(channel, cfg, fallback = {}) {
  const profile = channelProfile(channel), defaults = profile.productionDefaults;
  const language = defaults.language || fallback.language || normalizeLanguage(cfg.contentLanguage);
  const voice = defaults.voice.provider ? defaults.voice : fallback.voice || { provider: cfg.voiceProvider || 'mock', voiceId: '' };
  const voiceId = voice.voiceId || (fallback.voice?.provider === voice.provider ? fallback.voice.voiceId : '') || cfg.voiceDefaults?.[voice.provider] || '';
  const memory = normalizeMemory({
    ...profile.memory,
    characters: [...new Set([...profile.visualIdentity.characters, ...profile.memory.characters])],
    palette: profile.memory.palette.length ? profile.memory.palette : profile.visualIdentity.palette,
    artDirection: profile.memory.artDirection || profile.visualIdentity.artDirection,
  });
  return {
    settings: {
      renderer: defaults.renderer || profile.visualIdentity.preferredRenderer || fallback.renderer || cfg.renderer,
      format: defaults.format || fallback.format || 'landscape', language,
      fps: defaults.fps || fallback.fps || cfg.fps, captions: defaults.captions ?? fallback.captions ?? true,
      captionLanguage: defaults.captionLanguage || language,
      targetDurationSec: defaults.targetDurationSec || fallback.targetDurationSec || (cfg.scriptMinutes || 6) * 60,
      voice: { provider: voice.provider, voiceId },
    },
    memory,
    creativeContext: { identity: profile.identity, strategy: profile.strategy, editorial: profile.editorial, visualIdentity: profile.visualIdentity, music: defaults.music },
    packagingDefaults: profile.packagingDefaults,
  };
}

export function snapshotChannel(channel, cfg) {
  return { version: 1, channelId: channel.id, revision: channel.revision, inheritedAt: nowIso(), profile: channelProfile(channel), resolved: resolveChannelValues(channel, cfg) };
}

export function projectChannelFields(snapshot) {
  if (!snapshot) return {};
  return { channelId: snapshot.channelId, channelRevision: snapshot.revision, channelSnapshotAt: snapshot.inheritedAt, channelSnapshot: structuredClone(snapshot), creativeContext: structuredClone(snapshot.resolved.creativeContext), packagingDefaults: structuredClone(snapshot.resolved.packagingDefaults) };
}

export function assignProjectChannel(project, channel) {
  const id = channel?.id || null;
  if (project.channelId === id) return false;
  recordHistory(project, id ? 'Assign video to channel (keep settings)' : 'Move video to Unassigned');
  project.channelId = id;
  project.channelRevision = null;
  project.channelSnapshotAt = null;
  project.channelSnapshot = null;
  project.channelApplications = [];
  // An idea remains source provenance even when the video changes its destination channel.
  return true;
}

const valueAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function setValue(object, path, value) {
  const keys = path.split('.'), key = keys.pop();
  let target = object;
  for (const part of keys) target = target[part] ||= {};
  target[key] = structuredClone(value);
}
const resolvedPaths = (resolved) => Object.entries(resolved).flatMap(([group, values]) => Object.keys(values).map((key) => `${group}.${key}`));
const baselineFor = (project) => {
  const baseline = structuredClone(project.channelSnapshot?.resolved || {});
  for (const application of project.channelApplications || []) for (const [path, value] of Object.entries(application.values || {})) setValue(baseline, path, value);
  return baseline;
};

export function channelChangeImpact(path) {
  if (['memory.artDirection', 'memory.palette', 'memory.characters'].includes(path)) return ['visual', 'render', 'clip', 'final'];
  if (path === 'settings.voice') return ['voice', 'render', 'clip', 'final'];
  if (['settings.renderer', 'settings.format', 'settings.fps'].includes(path)) return ['render', 'clip', 'final'];
  if (['settings.captions', 'settings.captionLanguage'].includes(path)) return ['final'];
  return [];
}

function effectiveVoice(settings, cfg) {
  const provider = settings.voice?.provider || cfg.voiceProvider || 'mock';
  return { provider, voiceId: provider === 'mock' ? '' : settings.voice?.voiceId || cfg.voiceDefaults?.[provider] || '' };
}

export function diffProjectChannel(project, channel, cfg) {
  if (project.channelId !== channel.id) throw contentError('Assign the video to this channel before reviewing changes.');
  const baseline = baselineFor(project), proposed = resolveChannelValues(channel, cfg, baseline.settings || project.settings);
  const changes = resolvedPaths(proposed).filter((path) => !sameValue(valueAt(baseline, path), valueAt(proposed, path))).map((path) => ({
    path, inherited: valueAt(baseline, path) ?? null, current: valueAt(project, path) ?? null, proposed: valueAt(proposed, path),
    locallyModified: valueAt(baseline, path) !== undefined && !sameValue(valueAt(baseline, path), valueAt(project, path)),
    impact: sameValue(valueAt(project, path), valueAt(proposed, path)) || path === 'settings.voice' && sameValue(effectiveVoice(project.settings, cfg), effectiveVoice(proposed.settings, cfg)) ? [] : channelChangeImpact(path),
  }));
  return { channelId: channel.id, inheritedRevision: project.channelRevision, currentRevision: channel.revision, lastAppliedRevision: project.channelApplications?.at(-1)?.revision || null, changes };
}

export function applyProjectChannelChanges(project, channel, cfg, { paths = [], expectedRevision } = {}) {
  if (expectedRevision !== undefined && expectedRevision !== channel.revision) throw contentError('Channel changed. Review the latest changes before applying.', 409);
  const diff = diffProjectChannel(project, channel, cfg);
  if (!Array.isArray(paths) || paths.some((path) => !diff.changes.some((change) => change.path === path))) throw contentError('Choose valid channel change paths.');
  const selected = diff.changes.filter((change) => paths.includes(change.path));
  if (!selected.length) return false;
  recordHistory(project, `Apply ${selected.length} channel changes from revision ${channel.revision}`);
  const before = structuredClone({ settings: project.settings, memory: project.memory });
  for (const change of selected) setValue(project, change.path, change.proposed);
  if (before.settings.format !== project.settings.format) Object.assign(project.settings, videoFormatSettings(project.settings.format, cfg));
  const visualMemoryChanged = ['artDirection', 'palette', 'characters'].some((key) => !sameValue(before.memory?.[key], project.memory?.[key]));
  const voiceChanged = !sameValue(effectiveVoice(before.settings, cfg), effectiveVoice(project.settings, cfg));
  const frameChanged = ['format', 'fps'].some((key) => before.settings[key] !== project.settings[key]);
  for (const scene of project.scenes || []) {
    const generatedVisual = !['draw-reveal', 'cinematic-broll'].includes(scene.renderer || project.settings.renderer);
    let promptChanged = false;
    if (visualMemoryChanged && generatedVisual) {
      const prompt = visualPromptFor(scene.text, { ...cfg, format: project.settings.format, memory: project.memory }, scene.visualIntent);
      promptChanged = prompt !== scene.visualPrompt;
      scene.visualPrompt = prompt;
    }
    const rendererChanged = frameChanged || !scene.renderer && before.settings.renderer !== project.settings.renderer;
    invalidateScene(project, scene, { promptChanged, rendererChanged, voiceChanged });
  }
  if (['captions', 'captionLanguage'].some((key) => before.settings[key] !== project.settings[key])) invalidateFinal(project);
  // Preserve the original snapshot. Partial updates carry their own exact provenance.
  project.channelApplications ||= [];
  project.channelApplications.push({ revision: channel.revision, appliedAt: nowIso(), values: Object.fromEntries(selected.map((change) => [change.path, structuredClone(change.proposed)])) });
  return true;
}
