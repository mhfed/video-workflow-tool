import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { channelDirectory, loadChannel } from './channel.mjs';
import { contentError, normalizeBrief, objectValue, textValue } from './content-contract.mjs';
import { readContent, safeContentId, writeContent } from './content-store.mjs';
import { nowIso } from './utils.mjs';

export const IDEA_STATUSES = ['idea', 'shortlisted', 'developing', 'converted-to-video', 'archived'];
const scoreKeys = ['curiosity', 'evergreen', 'channelFit', 'visualizability', 'originality'];
const ideaDirectory = (channelId, cfg) => path.join(channelDirectory(channelId, cfg), 'ideas');
const ideaFile = (channelId, id, cfg) => path.join(ideaDirectory(channelId, cfg), `${safeContentId(id)}.json`);

function normalizeIdea(value) {
  const idea = objectValue(value), title = textValue(idea.title, 300), status = idea.status || 'idea';
  if (!title) throw contentError('Idea title is required.');
  if (!IDEA_STATUSES.includes(status)) throw contentError('Unsupported idea status.');
  const scores = {};
  for (const key of scoreKeys) {
    const value = idea.scores?.[key];
    if (value == null || value === '') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 5) throw contentError('Idea scores must be between 0 and 5.');
    scores[key] = value;
  }
  return { title, ...Object.fromEntries(['topic', 'pillar', 'angle', 'viewerQuestion', 'hook', 'corePromise', 'notes'].map((key) => [key, textValue(idea[key])])), status, scores, brief: normalizeBrief(idea.brief) };
}

export function createIdea(channelId, value, cfg) {
  loadChannel(channelId, cfg);
  const normalized = normalizeIdea(value);
  if (normalized.status === 'converted-to-video') throw contentError('Create a video to convert this idea.');
  const at = nowIso(), idea = { version: 1, id: `idea-${crypto.randomBytes(6).toString('hex')}`, channelId, revision: 1, createdAt: at, updatedAt: at, ...normalized, videoIds: [] };
  return writeContent(ideaFile(channelId, idea.id, cfg), idea);
}

export function loadIdea(channelId, id, cfg) {
  const value = readContent(ideaFile(channelId, id, cfg));
  if (value.id !== id || value.channelId !== channelId) throw contentError('Idea does not belong to this channel.');
  return { ...value, ...normalizeIdea(value), videoIds: Array.isArray(value.videoIds) ? value.videoIds : [] };
}

export function listIdeas(channelId, cfg) {
  loadChannel(channelId, cfg);
  const dir = ideaDirectory(channelId, cfg);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => loadIdea(channelId, name.slice(0, -5), cfg)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function updateIdea(channelId, id, patch, cfg, { expectedRevision } = {}) {
  loadChannel(channelId, cfg);
  const current = loadIdea(channelId, id, cfg);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw contentError('Idea changed. Reload before saving.', 409);
  const normalized = normalizeIdea({ ...current, ...patch, scores: { ...current.scores, ...objectValue(patch.scores) } });
  if (normalized.status === 'converted-to-video' && !current.videoIds.length) throw contentError('Create a video to convert this idea.');
  return writeContent(ideaFile(channelId, id, cfg), { ...current, ...normalized, revision: current.revision + 1, updatedAt: nowIso() });
}

export function linkIdeaVideo(channelId, id, videoId, cfg) {
  // The project has already committed its ideaId. The backlink is recoverable from projects.
  const current = loadIdea(channelId, id, cfg);
  if (current.videoIds.includes(videoId)) return current;
  return writeContent(ideaFile(channelId, id, cfg), { ...current, status: 'converted-to-video', videoIds: [...current.videoIds, videoId], revision: current.revision + 1, updatedAt: nowIso() });
}

export function briefFromIdea(idea, channel) {
  return normalizeBrief({
    topic: idea.topic || idea.title, pillar: idea.pillar, targetViewer: channel.strategy.targetAudience,
    viewerQuestion: idea.viewerQuestion, angle: idea.angle, corePromise: idea.corePromise, hook: idea.hook,
    targetDurationSec: channel.productionDefaults.targetDurationSec, format: channel.productionDefaults.format,
    ...Object.fromEntries(Object.entries(idea.brief || {}).filter(([, value]) => value !== null && value !== '')),
  });
}
