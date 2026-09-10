import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-quality-'));
process.env.WORKSPACE_DIR=path.join(root,'workspace');
process.env.MOCK_MODE='1';process.env.TEXT_PROVIDER='mock';process.env.IMAGE_PROVIDER='mock';process.env.VOICE_PROVIDER='mock';process.env.VIDEO_RENDERER='simple';
process.env.VIDEO_WIDTH='320';process.env.VIDEO_HEIGHT='180';process.env.VIDEO_FPS='10';process.env.SCENE_MIN_SEC='1';process.env.SCENE_TARGET_SEC='1';process.env.SCENE_MAX_SEC='1';

const {config}=await import('../packages/core/src/env.mjs');
const {createProject}=await import('../packages/core/src/project.mjs');
const {runPipeline}=await import('../apps/worker/src/pipeline.mjs');
const {runQualityChecks}=await import('../apps/worker/src/quality.mjs');

test('offline QA records deterministic visual and audio checks',async()=>{
  const cfg=config(),project=createProject({title:'QA test',sourceText:'A tiny quality scene.',workflowMode:'auto'},cfg);
  await runPipeline(project.id,{sceneId:project.scenes[0].id,stage:'clip'});
  const events=[],result=await runQualityChecks(project.id,{onProgress:(event)=>events.push(event)}),scene=result.project.scenes[0];
  assert.equal(scene.quality.visual.status,'unchecked');
  assert.equal(scene.quality.audio.checks.silence.status,'fail');
  assert.ok(['fail','warn'].includes(result.project.quality.status));
  assert.equal(events.at(-1).percent,100);
});
