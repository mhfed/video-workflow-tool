import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vwt-channel-pipeline-'));
Object.assign(process.env, { WORKSPACE_DIR: root, MOCK_MODE: '1', TEXT_PROVIDER: 'mock', IMAGE_PROVIDER: 'mock', VOICE_PROVIDER: 'mock', VIDEO_RENDERER: 'simple', VIDEO_WIDTH: '320', VIDEO_HEIGHT: '180', VIDEO_FPS: '10', SCENE_MIN_SEC: '1', SCENE_TARGET_SEC: '1', SCENE_MAX_SEC: '1' });
const { config } = await import('../packages/core/src/env.mjs');
const { createChannel, updateChannel, channelFile } = await import('../packages/core/src/channel.mjs');
const { createIdea } = await import('../packages/core/src/idea.mjs');
const { createVideo } = await import('../apps/worker/src/create-video.mjs');
const { loadProject, projectFile, saveProject } = await import('../packages/core/src/project.mjs');
const { invalidateScene } = await import('../packages/core/src/invalidation.mjs');
const { runPipeline } = await import('../apps/worker/src/pipeline.mjs');

test.after(() => fs.rmSync(root, { recursive: true, force: true }));

test('real offline pipeline reuses every scene cache after channel edit/removal and reruns only an edited scene', async () => {
  const cfg = config();
  const channel = createChannel({ identity: { name: 'Offline channel' }, memory: { palette: ['navy'] } }, cfg);
  const project = await createVideo({ channelId: channel.id, title: 'Channel cache compatibility', sourceType: 'script', sourceText: 'Why does this work? A second short scene.', workflowMode: 'auto' }, cfg);
  const first = await runPipeline(project.id); assert.ok(fs.existsSync(first.final));
  const baseline = loadProject(project.id, cfg), disk = fs.readFileSync(projectFile(cfg, project.id), 'utf8');
  updateChannel(channel.id, { strategy: { channelPromise: 'A revised promise' }, memory: { palette: ['red'] }, productionDefaults: { fps: 20 } }, cfg);
  assert.equal(fs.readFileSync(projectFile(cfg, project.id), 'utf8'), disk);
  await runPipeline(project.id);
  let cached = loadProject(project.id, cfg);
  for (let i = 0; i < cached.scenes.length; i++) {
    assert.deepEqual(cached.scenes[i].cache, baseline.scenes[i].cache);
    assert.deepEqual(cached.scenes[i].takes, baseline.scenes[i].takes);
  }
  fs.renameSync(path.dirname(channelFile(channel.id, cfg)), path.join(root, '.channel-unavailable'));
  await runPipeline(project.id); cached = loadProject(project.id, cfg);
  assert.deepEqual(cached.scenes, baseline.scenes);
  const edited = cached.scenes[0]; edited.text = 'A changed narration for this scene.'; invalidateScene(cached, edited, { textChanged: true }); saveProject(cached, cfg);
  await runPipeline(project.id, { sceneId: edited.id, stage: 'clip' });
  const after = loadProject(project.id, cfg);
  assert.deepEqual(after.scenes[1], baseline.scenes[1]);
  assert.equal(after.scenes[0].takes.voice.length, baseline.scenes[0].takes.voice.length + 1);
  assert.equal(after.scenes[0].takes.visual.length, baseline.scenes[0].takes.visual.length);
  assert.equal(after.channelRevision, 1); assert.equal(after.artifacts.final, undefined);
});

test('CLI continues to create from Script, SRT and Topic, and accepts optional Channel / Idea / Brief', () => {
  const cfg = config(), channel = createChannel({ identity: { name: 'CLI channel' }, productionDefaults: { language: 'en', format: 'short', targetDurationSec: 40 } }, cfg);
  const idea = createIdea(channel.id, { title: 'CLI idea', angle: 'A specific angle' }, cfg);
  const script = path.join(root, 'input.md'), srt = path.join(root, 'input.srt'), brief = path.join(root, 'brief.json');
  fs.writeFileSync(script, 'The supplied narration.'); fs.writeFileSync(srt, '1\n00:00:00,000 --> 00:00:02,000\nThe supplied subtitle.');
  fs.writeFileSync(brief, JSON.stringify({ topic: 'CLI brief', hook: 'A concrete hook', targetDurationSec: 50 }));
  const create = (args) => JSON.parse(execFileSync(process.execPath, ['apps/worker/src/cli.mjs', 'create', ...args], { encoding: 'utf8', env: process.env }));
  const imported = create(['--script', script, '--title', 'Legacy CLI']); assert.equal(imported.sourceType, 'script'); assert.equal(loadProject(imported.id, cfg).channelId, null);
  const subtitle = create(['--srt', srt, '--title', 'SRT CLI']); assert.equal(loadProject(subtitle.id, cfg).scenes[0].durationMs, 2000);
  const topic = create(['--topic', 'Legacy topic']); assert.equal(topic.sourceType, 'topic');
  const inherited = create(['--channel', channel.id, '--idea', idea.id]); const video = loadProject(inherited.id, cfg);
  assert.equal(video.channelRevision, 1); assert.equal(video.settings.language, 'en'); assert.equal(video.brief.angle, 'A specific angle');
  const fromBrief = create(['--channel', channel.id, '--brief', brief]); assert.equal(loadProject(fromBrief.id, cfg).brief.hook, 'A concrete hook');
});
