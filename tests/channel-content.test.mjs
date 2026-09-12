import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { channelFile, createChannel, listChannels, loadChannel, updateChannel } from '../packages/core/src/channel.mjs';
import { createProject, listProjects, loadProject, projectFile, saveProject } from '../packages/core/src/project.mjs';
import { applyProjectChannelChanges, assignProjectChannel, diffProjectChannel } from '../packages/core/src/channel-inheritance.mjs';
import { normalizeWorkflow } from '../packages/core/src/workflow.mjs';
import { redoProject, undoProject } from '../packages/core/src/history.mjs';
import { createIdea, loadIdea, updateIdea } from '../packages/core/src/idea.mjs';
import { createVideo } from '../apps/worker/src/create-video.mjs';
import { routeContentApi } from '../apps/web/src/content-api.mjs';
import { projectVoiceConfig, voiceCacheConfig } from '../packages/providers/src/voice.mjs';
import { scriptContext } from '../packages/providers/src/content-context.mjs';
import { generateScriptOpenAI } from '../packages/providers/src/openai.mjs';

function fixture(t) {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vwt-channel-'));
  t.after(() => fs.rmSync(workspaceDir, { recursive: true, force: true }));
  return { workspaceDir, renderer: 'simple', width: 320, height: 180, fps: 10, sceneTargetSec: 1, sceneMinSec: 1, sceneMaxSec: 1, wordsPerMinute: 150, contentLanguage: 'vi', scriptMinutes: 6, mockMode: true, textProvider: 'mock', voiceProvider: 'mock', voiceDefaults: { mock: '', openai: 'marin', vivibe: 'voice-default' } };
}
const profile = () => ({
  identity: { name: 'Everyday Science', description: 'An editorial science channel.' },
  strategy: { niche: 'Everyday science', targetAudience: 'Curious students', channelPromise: 'Understand one useful mechanism', contentPillars: ['Habits', 'Learning'] },
  editorial: { narrationTone: 'Warm', evidencePolicy: 'No invented statistics', thingsToAvoid: ['Clickbait'] },
  visualIdentity: { characters: ['Mai wears a red scarf'], palette: ['navy'], artDirection: 'Editorial ink' },
  productionDefaults: { language: 'en', format: 'short', renderer: 'simple', fps: 24, captions: false, targetDurationSec: 45, voice: { provider: 'openai', voiceId: 'coral' } },
  memory: { pronunciations: ['Mai = my'], terms: ['spaced repetition'], conventions: ['Metric units'] },
  packagingDefaults: { titleStyle: 'A concrete question', titleConstraints: ['No unsupported claims'] },
});
const video = (channel, cfg, extra = {}) => createProject({ title: 'Test video', sourceText: 'Why does this work? One useful explanation.', channelId: channel?.id, ...extra }, cfg);
function rendered(project) {
  project.status = 'complete'; project.artifacts = { final: 'output/final.mp4', captions: 'output/captions.vtt' };
  for (const scene of project.scenes) {
    scene.cache = { voice: 'voice-key', image: 'image-key', video: 'video-key', clip: 'clip-key' };
    scene.artifacts = { voice: 'voice.mp3', visual: 'visual.png', video: 'render.mp4', clip: 'clip.mp4' };
    scene.review = { script: 'approved', voice: 'approved', visual: 'approved', clip: 'approved' };
    scene.selectedTakes = { voice: 'v1', visual: 'i1', video: 'r1', clip: 'c1' };
    scene.takes = Object.fromEntries(['voice', 'visual', 'video', 'clip'].map((kind) => [kind, [{ id: scene.selectedTakes[kind], path: scene.artifacts[kind], cacheKey: scene.cache[kind === 'visual' ? 'image' : kind] }]]));
  }
  return project;
}

test('legacy files normalize idempotently as Unassigned without rewriting files or losing production state', (t) => {
  const cfg = fixture(t), project = rendered(video(null, cfg)), file = projectFile(cfg, project.id);
  for (const key of ['channelId', 'channelRevision', 'channelSnapshotAt', 'channelSnapshot', 'channelApplications', 'publish', 'brief']) delete project[key];
  project.version = 3;
  fs.writeFileSync(file, JSON.stringify(project)); const before = fs.readFileSync(file, 'utf8');
  const loaded = loadProject(project.id, cfg), once = structuredClone(loaded);
  assert.equal(loaded.channelId, null); assert.equal(loaded.publish.status, 'draft');
  assert.deepEqual(loaded.scenes, project.scenes); assert.equal(loaded.artifacts.final, 'output/final.mp4');
  assert.deepEqual(normalizeWorkflow(loaded), once); assert.equal(fs.readFileSync(file, 'utf8'), before);
  createChannel(profile(), cfg);
  assert.deepEqual(listProjects(cfg, { channelId: null }).map((item) => item.id), [project.id]);
  assert.equal(listProjects(cfg).length, 1);
});

test('new video receives resolved defaults, independent memory and complete channel provenance', (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg), project = video(channel, cfg);
  assert.equal(project.channelId, channel.id); assert.equal(project.channelRevision, 1);
  assert.equal(project.channelSnapshotAt, project.channelSnapshot.inheritedAt);
  assert.equal(project.channelSnapshot.profile.strategy.channelPromise, channel.strategy.channelPromise);
  assert.equal(project.settings.language, 'en'); assert.equal(project.settings.format, 'short');
  assert.equal(project.settings.width, 1080); assert.equal(project.settings.fps, 24); assert.equal(project.settings.captions, false);
  assert.deepEqual(project.settings.voice, { provider: 'openai', voiceId: 'coral' });
  assert.match(project.scenes[0].visualPrompt, /Editorial ink/); assert.match(project.scenes[0].visualPrompt, /Mai wears a red scarf/);
  assert.deepEqual(project.memory.terms, ['spaced repetition']); assert.deepEqual(project.memory.conventions, ['Metric units']);
  project.memory.characters.push('A new character'); project.settings.voice.voiceId = 'edited';
  assert.equal(project.channelSnapshot.resolved.memory.characters.length, 1);
  assert.equal(project.channelSnapshot.resolved.settings.voice.voiceId, 'coral');
  assert.deepEqual(loadChannel(channel.id, cfg), channel);
});

test('channel changes revise only channel state; cached existing videos and history remain byte-for-byte intact', (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg), project = rendered(video(channel, cfg)); saveProject(project, cfg);
  const before = fs.readFileSync(projectFile(cfg, project.id), 'utf8');
  const next = updateChannel(channel.id, { strategy: { channelPromise: 'New promise' }, memory: { palette: ['coral'] }, productionDefaults: { renderer: 'whiteboard', fps: 30 } }, cfg, { expectedRevision: 1 });
  assert.equal(next.revision, 2); assert.equal(fs.readFileSync(projectFile(cfg, project.id), 'utf8'), before);
  assert.deepEqual(loadProject(project.id, cfg).scenes, project.scenes);
  const fresh = video(next, cfg); assert.equal(fresh.channelRevision, 2); assert.equal(fresh.settings.renderer, 'whiteboard'); assert.deepEqual(fresh.memory.palette, ['coral']);
  assert.equal(loadProject(project.id, cfg).settings.renderer, 'simple');
});

test('no-op profile edits do not increment revision; stale writers, invalid defaults and secret fields are handled safely', (t) => {
  const cfg = fixture(t), channel = createChannel({ ...profile(), token: 'secret', youtube: { handle: '@test', accessToken: 'secret', connected: true }, productionDefaults: { ...profile().productionDefaults, apiKey: 'secret' } }, cfg);
  assert.equal(channel.youtube.connected, false); assert.doesNotMatch(fs.readFileSync(channelFile(channel.id, cfg), 'utf8'), /secret|accessToken|apiKey/);
  assert.equal(updateChannel(channel.id, { identity: { name: channel.identity.name } }, cfg).revision, 1);
  updateChannel(channel.id, { identity: { name: 'Renamed' } }, cfg);
  assert.throws(() => updateChannel(channel.id, { identity: { name: 'Stale' } }, cfg, { expectedRevision: 1 }), (error) => error.status === 409);
  for (const productionDefaults of [{ renderer: 'bad' }, { fps: 1.5 }, { targetDurationSec: -10 }, { language: 'xx' }]) assert.throws(() => updateChannel(channel.id, { productionDefaults }, cfg));
  assert.throws(() => loadChannel('../outside', cfg), /Invalid content id/);
});

test('video remains self-contained after its channel store is unavailable, including when copied', (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg), project = video(channel, cfg);
  fs.renameSync(path.dirname(channelFile(channel.id, cfg)), path.join(cfg.workspaceDir, '.channel-backup'));
  const copiedCfg = { ...cfg, workspaceDir: path.join(cfg.workspaceDir, 'copied') };
  fs.cpSync(path.join(cfg.workspaceDir, project.id), path.join(copiedCfg.workspaceDir, project.id), { recursive: true });
  const loaded = loadProject(project.id, copiedCfg);
  assert.deepEqual(loaded.settings, project.settings); assert.deepEqual(loaded.memory, project.memory);
  assert.equal(loaded.channelSnapshot.revision, 1); assert.deepEqual(listChannels(copiedCfg), []);
});

test('assign and unassign keep settings, memory, artifacts and approvals; undo restores provenance', (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg), project = rendered(video(null, cfg));
  const before = structuredClone(project);
  assignProjectChannel(project, channel);
  assert.equal(project.channelRevision, null); assert.equal(project.channelSnapshot, null);
  for (const key of ['settings', 'memory', 'scenes', 'artifacts', 'status']) assert.deepEqual(project[key], before[key]);
  assert.equal(undoProject(project), true); assert.equal(project.channelId, null);
  assert.equal(redoProject(project), true); assert.equal(project.channelId, channel.id);
  assignProjectChannel(project, null); assert.equal(project.channelId, null); assert.deepEqual(project.settings, before.settings);
});

test('partial apply keeps unselected changes pending, records provenance, and strategy edits have zero media impact', (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg), project = rendered(video(channel, cfg));
  const before = structuredClone(project), updated = updateChannel(channel.id, { strategy: { targetAudience: 'Adults' }, productionDefaults: { fps: 30 } }, cfg);
  const diff = diffProjectChannel(project, updated, cfg); assert.equal(diff.changes.length, 2);
  assert.deepEqual(diff.changes.find((change) => change.path === 'creativeContext.strategy').impact, []);
  applyProjectChannelChanges(project, updated, cfg, { paths: ['creativeContext.strategy'], expectedRevision: 2 });
  assert.deepEqual(project.scenes, before.scenes); assert.deepEqual(project.artifacts, before.artifacts); assert.equal(project.status, 'complete');
  assert.equal(project.channelRevision, 1); assert.equal(project.channelSnapshot.profile.strategy.targetAudience, 'Curious students');
  assert.equal(project.channelApplications[0].revision, 2); assert.equal(project.creativeContext.strategy.targetAudience, 'Adults');
  assert.deepEqual(diffProjectChannel(project, updated, cfg).changes.map((change) => change.path), ['settings.fps']);
  const after = structuredClone(project);
  assert.equal(applyProjectChannelChanges(project, updated, cfg, { paths: [] }), false); assert.deepEqual(project, after);
  assert.throws(() => applyProjectChannelChanges(project, updated, cfg, { paths: ['settings.fps'], expectedRevision: 1 }), /Channel changed/);
  assert.throws(() => applyProjectChannelChanges(project, updated, cfg, { paths: ['scenes'] }), /valid channel change/);
});

test('local overrides are visible in the diff and explicit apply can be undone and redone', (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg), project = rendered(video(channel, cfg));
  project.settings.fps = 25;
  const next = updateChannel(channel.id, { productionDefaults: { fps: 30 } }, cfg), before = structuredClone(project);
  assert.equal(diffProjectChannel(project, next, cfg).changes[0].locallyModified, true);
  applyProjectChannelChanges(project, next, cfg, { paths: ['settings.fps'] });
  const scene = project.scenes[0]; assert.equal(scene.cache.voice, 'voice-key'); assert.equal(scene.cache.image, 'image-key'); assert.equal(scene.cache.clip, undefined);
  assert.deepEqual(scene.takes, before.scenes[0].takes); assert.equal(project.artifacts.final, undefined);
  undoProject(project); assert.equal(project.settings.fps, 25); assert.deepEqual(project.scenes, before.scenes); assert.equal(project.channelApplications.length, 0);
  redoProject(project); assert.equal(project.settings.fps, 30); assert.equal(project.channelApplications.length, 1);
});

test('explicitly adopting the already effective runtime voice does not regenerate existing media', (t) => {
  const cfg = fixture(t), channel = createChannel({ identity: { name: 'Same defaults' } }, cfg), project = rendered(video(null, cfg));
  assignProjectChannel(project, channel); const before = structuredClone(project.scenes);
  const diff = diffProjectChannel(project, channel, cfg);
  assert.deepEqual(diff.changes.find((change) => change.path === 'settings.voice').impact, []);
  applyProjectChannelChanges(project, channel, cfg, { paths: ['settings.voice'] });
  assert.deepEqual(project.scenes, before); assert.equal(project.artifacts.final, 'output/final.mp4');
});

test('voice apply preserves script approval and visuals; visual memory apply preserves voice and local artwork scenes', (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg), project = rendered(video(channel, cfg));
  let next = updateChannel(channel.id, { productionDefaults: { voice: { voiceId: 'nova' } } }, cfg);
  applyProjectChannelChanges(project, next, cfg, { paths: ['settings.voice'] });
  assert.equal(project.scenes[0].review.script, 'approved'); assert.equal(project.scenes[0].cache.image, 'image-key'); assert.equal(project.scenes[0].cache.voice, undefined);
  rendered(project); project.scenes[1].renderer = 'draw-reveal'; const second = structuredClone(project.scenes[1]);
  next = updateChannel(channel.id, { memory: { palette: ['orange'] } }, cfg);
  applyProjectChannelChanges(project, next, cfg, { paths: ['memory.palette'] });
  assert.equal(project.scenes[0].cache.voice, 'voice-key'); assert.equal(project.scenes[0].cache.image, undefined); assert.match(project.scenes[0].visualPrompt, /orange/);
  assert.deepEqual(project.scenes[1], second);
});

test('renderer apply respects scene overrides; caption apply invalidates only final assembly', (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg), project = rendered(video(channel, cfg));
  project.scenes[1].renderer = 'cinematic-broll'; const second = structuredClone(project.scenes[1]);
  let next = updateChannel(channel.id, { productionDefaults: { renderer: 'whiteboard' } }, cfg);
  applyProjectChannelChanges(project, next, cfg, { paths: ['settings.renderer'] });
  assert.deepEqual(project.scenes[1], second); assert.equal(project.scenes[0].cache.voice, 'voice-key'); assert.equal(project.scenes[0].cache.image, 'image-key'); assert.equal(project.scenes[0].cache.video, undefined);
  rendered(project); const scenes = structuredClone(project.scenes);
  next = updateChannel(channel.id, { productionDefaults: { captions: true } }, cfg);
  applyProjectChannelChanges(project, next, cfg, { paths: ['settings.captions'] });
  assert.deepEqual(project.scenes, scenes); assert.equal(project.artifacts.final, undefined);
});

test('pronunciations, conventions, duration, language and packaging are planning context, not media invalidation keys', (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg), project = rendered(video(channel, cfg)), before = structuredClone(project);
  const next = updateChannel(channel.id, { memory: { pronunciations: ['Another term'], conventions: ['New convention'] }, productionDefaults: { targetDurationSec: 60, language: 'vi', captionLanguage: 'en' }, packagingDefaults: { titleStyle: 'A mystery' } }, cfg);
  const diff = diffProjectChannel(project, next, cfg); assert.ok(diff.changes.every((change) => !change.impact.length));
  applyProjectChannelChanges(project, next, cfg, { paths: diff.changes.map((change) => change.path) });
  assert.deepEqual(project.scenes, before.scenes); assert.deepEqual(project.artifacts, before.artifacts);
});

test('Idea → Brief → Video passes captured strategy to generation and records both sides of conversion', async (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg);
  const idea = createIdea(channel.id, { title: 'Learning without cramming', angle: 'Spacing beats repetition', viewerQuestion: 'How do I remember?', hook: 'Close your notes.', scores: { channelFit: 4 }, brief: { desiredTakeaway: 'Space practice over time' } }, cfg);
  let options;
  const project = await createVideo({ channelId: channel.id, ideaId: idea.id }, cfg, { generateScript: async (topic, runtime, value) => { options = value; assert.equal(topic, idea.title); updateChannel(channel.id, { editorial: { narrationTone: 'Dramatic' }, productionDefaults: { fps: 30 } }, cfg); return 'Why does this work? One useful explanation.'; } });
  assert.equal(project.channelRevision, 1); assert.equal(project.settings.fps, 24); assert.equal(project.channelSnapshot.profile.editorial.narrationTone, 'Warm');
  assert.equal(options.brief.angle, idea.angle); assert.equal(options.context.strategy.targetAudience, 'Curious students'); assert.equal(options.minutes, .75);
  assert.equal(project.ideaId, idea.id); assert.equal(project.ideaSource.revision, 1); assert.equal(project.brief.desiredTakeaway, 'Space practice over time');
  const saved = loadIdea(channel.id, idea.id, cfg); assert.equal(saved.status, 'converted-to-video'); assert.deepEqual(saved.videoIds, [project.id]);
  assert.match(scriptContext(options), /Curious students/); assert.match(scriptContext(options), /Space practice over time/);
  assert.throws(() => updateIdea(channel.id, idea.id, { title: 'Stale' }, cfg, { expectedRevision: 1 }), (error) => error.status === 409);
});

test('legacy script and SRT creation skip script generation, while Topic and optional Brief still work', async (t) => {
  const cfg = fixture(t); let generated = 0;
  const dependencies = { generateScript: async () => { generated++; return 'One narration sentence.'; } };
  const script = await createVideo({ title: 'Script', sourceType: 'script', sourceText: 'My exact narration.' }, cfg, dependencies);
  const srt = await createVideo({ title: 'SRT', sourceType: 'srt', sourceText: '1\n00:00:00,000 --> 00:00:02,000\nMy exact subtitle.' }, cfg, dependencies);
  assert.equal(generated, 0); assert.equal(script.scenes[0].text, 'My exact narration.'); assert.equal(srt.scenes[0].durationMs, 2000); assert.equal(srt.channelId, null);
  assert.equal((await createVideo({ sourceType: 'topic', topic: 'A topic' }, cfg, dependencies)).source.topic, 'A topic');
  const brief = await createVideo({ brief: { topic: 'A richer topic', angle: 'A distinct angle', format: 'short', targetDurationSec: 50 } }, cfg, dependencies);
  assert.equal(brief.brief.angle, 'A distinct angle'); assert.equal(brief.settings.format, 'short'); assert.equal(generated, 2);
  await assert.rejects(createVideo({ channelId: 'missing', title: 'Bad', sourceText: 'Bad.' }, cfg), (error) => error.status === 404);
});

test('video choices override channel defaults without rewriting inherited provenance', async (t) => {
  const cfg = fixture(t), channel = createChannel(profile(), cfg);
  const project = await createVideo({ channelId: channel.id, title: 'Override', sourceType: 'script', sourceText: 'My narration.', language: 'vi', format: 'landscape', renderer: 'draw-reveal', minutes: 2 }, cfg);
  assert.equal(project.settings.language, 'vi'); assert.equal(project.settings.captionLanguage, 'vi'); assert.equal(project.settings.format, 'landscape'); assert.equal(project.settings.renderer, 'draw-reveal'); assert.equal(project.settings.targetDurationSec, 120);
  assert.equal(project.channelSnapshot.resolved.settings.language, 'en'); assert.equal(project.channelSnapshot.resolved.settings.renderer, 'simple');
});

test('voice selection stays inside adapters and legacy runtime configuration is unchanged', (t) => {
  const cfg = { ...fixture(t), openaiTtsVoice: 'global', openaiTtsModel: 'speech-model', openaiTtsInstructions: 'Read', vivibeVoiceId: 'global-vivibe' };
  assert.equal(projectVoiceConfig({ settings: {} }, cfg), cfg);
  const channel = createChannel(profile(), cfg), project = video(channel, cfg), runtime = projectVoiceConfig(project, cfg);
  assert.equal(runtime.openaiTtsVoice, 'coral'); assert.equal(runtime.voiceProvider, 'openai'); assert.equal(cfg.openaiTtsVoice, 'global');
  assert.equal(voiceCacheConfig('openai', runtime).voice, 'coral');
  const defaults = createChannel({ identity: { name: 'Default voice' }, productionDefaults: { voice: { provider: 'vivibe' } } }, cfg);
  const saved = video(defaults, cfg); assert.equal(saved.settings.voice.voiceId, 'voice-default');
  assert.equal(projectVoiceConfig(saved, { ...cfg, vivibeVoiceId: 'changed' }).vivibeVoiceId, 'voice-default');
});

test('OpenAI script adapter includes brief and channel policy without changing its provider contract', async () => {
  const previous = globalThis.fetch; let request;
  globalThis.fetch = async (_url, init) => { request = JSON.parse(init.body); return new Response(JSON.stringify({ output_text: 'Narration.' })); };
  try {
    const value = await generateScriptOpenAI('Topic', { openaiApiKey: 'test', openaiBaseUrl: 'https://example.test', openaiTextModel: 'model', contentLanguage: 'en', scriptMinutes: 1 }, { brief: { angle: 'Make it concrete' }, context: { editorial: { evidencePolicy: 'Verified facts only' } } });
    assert.equal(value, 'Narration.'); assert.match(request.input, /Make it concrete/); assert.match(request.input, /Verified facts only/);
  } finally { globalThis.fetch = previous; }
});

test('content API supports channels, ideas, missing profiles, assignment, revision guards and busy-job guards', async (t) => {
  const cfg = fixture(t);
  const call = (method, url, body = {}, projectBusy) => routeContentApi({ method, parts: url.split('/').filter(Boolean), cfg, readBody: async () => body, projectBusy });
  const created = await call('POST', '/api/channels', profile()); assert.equal(created.status, 201); const channel = created.body;
  assert.equal((await call('GET', '/api/channels')).body.length, 1);
  const idea = await call('POST', `/api/channels/${channel.id}/ideas`, { title: 'An idea' }); assert.equal(idea.status, 201);
  assert.equal((await call('GET', `/api/channels/${channel.id}/ideas`)).body.length, 1);
  const project = rendered(video(null, cfg)); saveProject(project, cfg);
  await assert.rejects(call('PATCH', `/api/projects/${project.id}/channel`, { channelId: channel.id }, () => true), (error) => error.status === 409);
  const assigned = await call('PATCH', `/api/projects/${project.id}/channel`, { channelId: channel.id }); assert.deepEqual(assigned.body.settings, project.settings);
  const diff = (await call('GET', `/api/projects/${project.id}/channel`)).body; assert.equal(diff.available, true);
  await assert.rejects(call('POST', `/api/projects/${project.id}/channel`, { paths: ['settings.fps'] }), /Review the channel revision/);
  const applied = await call('POST', `/api/projects/${project.id}/channel`, { paths: ['settings.fps'], expectedRevision: 1 }); assert.equal(applied.body.settings.fps, 24);
  fs.renameSync(path.dirname(channelFile(channel.id, cfg)), path.join(cfg.workspaceDir, '.missing-profile'));
  assert.equal((await call('GET', `/api/projects/${project.id}/channel`)).body.available, false);
});
