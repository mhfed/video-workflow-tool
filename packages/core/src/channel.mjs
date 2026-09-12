import path from 'node:path';
import crypto from 'node:crypto';
import { nowIso, slugify } from './utils.mjs';
import { SUPPORTED_RENDERERS } from './validate-config.mjs';
import { SUPPORTED_LANGUAGES } from './languages.mjs';
import { contentDirectories, readContent, safeContentId, writeContent } from './content-store.mjs';
import { contentError, normalizeMemory, objectValue, sameValue, stringList, textValue } from './content-contract.mjs';

export const CHANNEL_GROUPS = ['identity', 'strategy', 'editorial', 'visualIdentity', 'productionDefaults', 'memory', 'packagingDefaults', 'youtube'];
const strings = (value, keys) => Object.fromEntries(keys.map((key) => [key, textValue(value?.[key])]));
const lists = (value, keys) => Object.fromEntries(keys.map((key) => [key, stringList(value?.[key])]));
const choice = (value, choices, label) => {
  if (value == null || value === '') return null;
  if (!choices.has(value)) throw contentError(`Unsupported ${label}.`);
  return value;
};
const positive = (value, max, label) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > max) throw contentError(`Invalid ${label}.`);
  return number;
};

export function normalizeChannelProfile(value = {}) {
  const data = objectValue(value), production = objectValue(data.productionDefaults), voice = objectValue(production.voice);
  const name = textValue(data.identity?.name, 160);
  if (!name) throw contentError('Channel name is required.');
  const fps = positive(production.fps, 120, 'channel fps');
  if (fps !== null && !Number.isInteger(fps)) throw contentError('Channel fps must be an integer.');
  if (production.captions != null && typeof production.captions !== 'boolean') throw contentError('Captions must be a boolean.');
  const provider = choice(voice.provider, new Set(['mock', 'openai', 'vivibe']), 'voice provider');
  const voiceId = textValue(voice.voiceId, 160);
  if (voiceId && !provider) throw contentError('Choose a voice provider for the voice id.');
  return {
    identity: { name, slug: slugify(data.identity?.slug || name), description: textValue(data.identity?.description) },
    strategy: { ...strings(data.strategy, ['niche', 'targetAudience', 'channelPromise', 'positioning']), ...lists(data.strategy, ['targetMarkets', 'contentPillars', 'preferredVideoTypes']) },
    editorial: { ...strings(data.editorial, ['narrationTone', 'narratorPersona', 'hookStyle', 'pacing', 'complexityLevel', 'evidencePolicy', 'ctaStyle']), ...lists(data.editorial, ['thingsToAvoid']) },
    visualIdentity: { ...strings(data.visualIdentity, ['artDirection', 'thumbnailDirection']), ...lists(data.visualIdentity, ['palette', 'motifs', 'characters']), preferredRenderer: choice(data.visualIdentity?.preferredRenderer, SUPPORTED_RENDERERS, 'preferred renderer') },
    productionDefaults: {
      language: choice(production.language, SUPPORTED_LANGUAGES, 'channel language'),
      format: choice(production.format, new Set(['landscape', 'short']), 'channel format'),
      targetDurationSec: positive(production.targetDurationSec, 14400, 'target duration'),
      renderer: choice(production.renderer, SUPPORTED_RENDERERS, 'channel renderer'), fps,
      captions: production.captions ?? null,
      captionLanguage: choice(production.captionLanguage, SUPPORTED_LANGUAGES, 'caption language'),
      voice: { provider, voiceId },
      // Creative direction only; actual music must be a project-local asset.
      music: { direction: textValue(production.music?.direction) },
    },
    memory: normalizeMemory(data.memory),
    packagingDefaults: { ...strings(data.packagingDefaults, ['titleStyle', 'thumbnailStyle', 'descriptionTemplate']), titleConstraints: stringList(data.packagingDefaults?.titleConstraints) },
    youtube: { channelId: textValue(data.youtube?.channelId, 160), handle: textValue(data.youtube?.handle, 160), connected: data.youtube?.connected === true },
  };
}

export const channelRoot = (cfg) => path.join(cfg.workspaceDir, '.channels');
export const channelDirectory = (id, cfg) => path.join(channelRoot(cfg), safeContentId(id));
export const channelFile = (id, cfg) => path.join(channelDirectory(id, cfg), 'channel.json');
export const channelProfile = (channel) => normalizeChannelProfile(channel);

export function createChannel(value, cfg) {
  const profile = normalizeChannelProfile(value), at = nowIso();
  const channel = { version: 1, id: `channel-${profile.identity.slug}-${crypto.randomBytes(4).toString('hex')}`, revision: 1, createdAt: at, updatedAt: at, ...profile };
  // A local profile is not an authenticated YouTube connection.
  channel.youtube.connected = false;
  return writeContent(channelFile(channel.id, cfg), channel);
}

export function loadChannel(id, cfg) {
  const value = readContent(channelFile(id, cfg));
  if (value.id !== id || !Number.isSafeInteger(value.revision) || value.revision < 1) throw contentError('Invalid channel state.');
  return { ...value, ...normalizeChannelProfile(value) };
}

export const listChannels = (cfg) => contentDirectories(channelRoot(cfg)).map((id) => loadChannel(id, cfg)).sort((a, b) => a.identity.name.localeCompare(b.identity.name));

export function updateChannel(id, patch, cfg, { expectedRevision } = {}) {
  const current = loadChannel(id, cfg);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw contentError('Channel changed. Reload the profile before saving.', 409);
  const merged = { ...current };
  for (const group of CHANNEL_GROUPS) {
    if (patch[group] === undefined) continue;
    if (!patch[group] || typeof patch[group] !== 'object' || Array.isArray(patch[group])) throw contentError(`Invalid channel ${group}.`);
    merged[group] = { ...current[group], ...patch[group] };
    if (group === 'productionDefaults') for (const key of ['voice', 'music']) if (patch[group][key] !== undefined) merged[group][key] = { ...current[group][key], ...objectValue(patch[group][key]) };
  }
  const profile = normalizeChannelProfile(merged);
  profile.youtube.connected = current.youtube.connected && profile.youtube.channelId === current.youtube.channelId && profile.youtube.handle === current.youtube.handle;
  if (sameValue(profile, channelProfile(current))) return current;
  return writeContent(channelFile(id, cfg), { ...current, ...profile, revision: current.revision + 1, updatedAt: nowIso() });
}
