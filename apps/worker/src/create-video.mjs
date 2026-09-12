import { createProject } from '../../../packages/core/src/project.mjs';
import { loadChannel } from '../../../packages/core/src/channel.mjs';
import { snapshotChannel } from '../../../packages/core/src/channel-inheritance.mjs';
import { briefFromIdea, linkIdeaVideo, loadIdea } from '../../../packages/core/src/idea.mjs';
import { contentError, normalizeBrief } from '../../../packages/core/src/content-contract.mjs';
import { SUPPORTED_LANGUAGES } from '../../../packages/core/src/languages.mjs';
import { SUPPORTED_VIDEO_FORMATS } from '../../../packages/core/src/video-format.mjs';
import { SUPPORTED_RENDERERS } from '../../../packages/core/src/validate-config.mjs';
import { WORKFLOW_MODES } from '../../../packages/core/src/workflow.mjs';
import { generateScriptText, planNarrativeBeatsText, textProviderName } from '../../../packages/providers/src/text.mjs';

// One entry point for web and CLI. Capture the revision BEFORE any async provider work.
export async function createVideo(input, cfg, { generateScript = generateScriptText, planBeats = planNarrativeBeatsText, onWarning = console.warn } = {}) {
  const channel = input.channelId ? loadChannel(input.channelId, cfg) : null;
  if (input.ideaId && !channel) throw contentError('An idea requires its channel.');
  const idea = input.ideaId ? loadIdea(channel.id, input.ideaId, cfg) : null;
  const snapshot = channel ? snapshotChannel(channel, cfg) : null;
  const defaults = snapshot?.resolved.settings || {};
  const brief = input.brief || idea ? normalizeBrief({ ...(idea ? briefFromIdea(idea, channel) : {}), ...input.brief }) : null;
  const sourceType = input.sourceType || (brief || idea ? 'topic' : 'script');
  if (!['topic', 'script', 'srt'].includes(sourceType)) throw contentError('Unsupported video source type.');
  const renderer = input.renderer || defaults.renderer || cfg.renderer;
  const language = input.language || defaults.language || cfg.contentLanguage || 'vi';
  const format = input.format || brief?.format || defaults.format || 'landscape';
  const workflowMode = input.workflowMode || 'studio';
  if (!SUPPORTED_RENDERERS.has(renderer)) throw contentError('Unsupported video renderer.');
  if (!SUPPORTED_LANGUAGES.has(language)) throw contentError('Unsupported project language.');
  if (!SUPPORTED_VIDEO_FORMATS.has(format)) throw contentError('Unsupported video format.');
  if (!WORKFLOW_MODES.has(workflowMode)) throw contentError('Unsupported workflow mode.');
  const minutes = input.minutes == null || input.minutes === '' ? (brief?.targetDurationSec || defaults.targetDurationSec || (cfg.scriptMinutes || 6) * 60) / 60 : Number(input.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) throw contentError('Target duration must be between 0 and 240 minutes.');
  const topic = sourceType === 'topic' ? String(input.topic || input.sourceText || brief?.topic || idea?.topic || idea?.title || '').trim() : '';
  const title = String(input.title || topic || idea?.title || '').trim();
  if (!title) throw contentError('Video title is required.');
  if (sourceType === 'topic' && !topic) throw contentError('Topic is required.');
  let sourceText = typeof input.sourceText === 'string' ? input.sourceText : '', plannedScenes = null;
  const context = snapshot ? { ...snapshot.resolved.creativeContext, memory: snapshot.resolved.memory, packaging: snapshot.resolved.packagingDefaults } : null;
  const options = { minutes, language, format, brief, context };
  if (sourceType === 'topic') sourceText = await generateScript(topic, cfg, options);
  if (!sourceText.trim()) throw contentError('Source text is required.');
  if (sourceType !== 'srt' && textProviderName(cfg) !== 'mock') {
    try { plannedScenes = await planBeats(sourceText, { ...cfg, contentLanguage: language }, options); }
    catch (error) { onWarning(`Semantic planner fallback: ${error.message}`); }
  }
  const productionSettings = { renderer, language };
  if (input.language && input.language !== defaults.language) productionSettings.captionLanguage = language;
  if (snapshot || brief || input.minutes != null) productionSettings.targetDurationSec = minutes * 60;
  const project = createProject({ title, sourceText, sourceType, topic, workflowMode, format, plannedScenes, channelSnapshot: snapshot, brief, ideaId: idea?.id || null, ideaSource: idea ? { channelId: idea.channelId, ideaId: idea.id, revision: idea.revision } : null, productionSettings }, cfg);
  if (idea) {
    try { linkIdeaVideo(channel.id, idea.id, project.id, cfg); }
    catch (error) { onWarning(`Video ${project.id} created; idea backlink could not be saved: ${error.message}`); }
  }
  return project;
}
