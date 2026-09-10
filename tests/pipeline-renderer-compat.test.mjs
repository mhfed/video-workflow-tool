import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-renderer-compat-'));
const engine=path.join(root,'whiteboard-engine');
process.env.WORKSPACE_DIR=path.join(root,'workspace');
process.env.MOCK_MODE='1';
process.env.TEXT_PROVIDER='mock';
process.env.VOICE_PROVIDER='mock';
process.env.IMAGE_PROVIDER='openai';
process.env.OPENAI_API_KEY='test-key-not-used';
process.env.VIDEO_RENDERER='simple';
process.env.VIDEO_WIDTH='320';
process.env.VIDEO_HEIGHT='180';
process.env.VIDEO_FPS='10';
process.env.SCENE_MIN_SEC='1';
process.env.SCENE_TARGET_SEC='1';
process.env.SCENE_MAX_SEC='1';
process.env.WHITEBOARD_ENGINE_DIR=engine;
process.env.WHITEBOARD_AUTO_INSTALL='0';

const {config}=await import('../packages/core/src/env.mjs');
const {createProject,projectDir,saveProject,sceneDir}=await import('../packages/core/src/project.mjs');
const {run}=await import('../packages/core/src/process.mjs');
const {sha256}=await import('../packages/core/src/utils.mjs');
const {runPipeline}=await import('../apps/worker/src/pipeline.mjs');

async function seedVisual(project,cfg) {
  const scene=project.scenes[0];
  const file=path.join(sceneDir(cfg,project.id,scene.id),'visual.png');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  await run(cfg.ffmpegBin,['-loglevel','error','-y','-f','lavfi','-i','color=c=white:s=320x180','-frames:v','1',file],{capture:true});
  scene.cache.image=sha256({prompt:scene.visualPrompt,provider:'openai',model:cfg.openaiImageModel,size:cfg.openaiImageSize,quality:cfg.openaiImageQuality});
  scene.artifacts.visual=path.relative(projectDir(cfg,project.id),file);
  saveProject(project,cfg);
}

function legacyProject(renderer,cfg) {
  const project=createProject({title:`Legacy ${renderer}`,sourceText:'One compatibility scene.',workflowMode:'auto'},cfg);
  project.settings.renderer=renderer;
  for(const scene of project.scenes) {
    delete scene.renderer;
    if(scene.visual)delete scene.visual.renderer;
  }
  return project;
}

test('legacy simple project runs voice, render, clip, and final assembly',async()=>{
  const cfg=config();
  const project=legacyProject('simple',cfg);
  await seedVisual(project,cfg);
  const result=await runPipeline(project.id);
  assert.ok(fs.existsSync(result.final));
  assert.ok(fs.existsSync(path.join(projectDir(cfg,project.id),result.project.scenes[0].artifacts.voice)));
  assert.ok(fs.existsSync(path.join(projectDir(cfg,project.id),result.project.scenes[0].artifacts.video)));
  assert.ok(fs.existsSync(path.join(projectDir(cfg,project.id),result.project.scenes[0].artifacts.clip)));
});

test('legacy whiteboard project runs annotation, render, voice mux, and final assembly',async()=>{
  const scripts=path.join(engine,'scripts');
  fs.mkdirSync(scripts,{recursive:true});
  fs.writeFileSync(path.join(scripts,'render_stream_whiteboard.py'),`import json,subprocess,sys\nann=json.load(open(sys.argv[2]))\nassert ann['elements'][0]['region']['width']==320\nsubprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','color=c=white:s=320x180:r=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p',sys.argv[3]],check=True)\n`);
  process.env.MOCK_MODE='0';
  const cfg=config();
  const project=legacyProject('whiteboard',cfg);
  await seedVisual(project,cfg);
  const result=await runPipeline(project.id);
  const scene=result.project.scenes[0];
  assert.ok(fs.existsSync(path.join(sceneDir(cfg,project.id,scene.id),`${scene.id}.annotation.json`)));
  assert.ok(fs.existsSync(path.join(projectDir(cfg,project.id),scene.artifacts.voice)));
  assert.ok(fs.existsSync(path.join(projectDir(cfg,project.id),scene.artifacts.clip)));
  assert.ok(fs.existsSync(result.final));
});
