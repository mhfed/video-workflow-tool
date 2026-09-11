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
const {createProject,loadProject,projectDir,saveProject,sceneDir}=await import('../packages/core/src/project.mjs');
const {run}=await import('../packages/core/src/process.mjs');
const {sha256}=await import('../packages/core/src/utils.mjs');
const {runPipeline}=await import('../apps/worker/src/pipeline.mjs');

async function seedVisual(project,cfg,scene=project.scenes[0]) {
  const file=path.join(sceneDir(cfg,project.id,scene.id),'visual.png');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  await run(cfg.ffmpegBin,['-loglevel','error','-y','-f','lavfi','-i','color=c=white:s=320x180','-frames:v','1',file],{capture:true});
  scene.cache.image=sha256({prompt:scene.visualPrompt,provider:'openai',model:cfg.openaiImageModel,size:cfg.openaiImageSize,quality:cfg.openaiImageQuality});
  scene.artifacts.visual=path.relative(projectDir(cfg,project.id),file);
  saveProject(project,cfg);
}

function installFakeWhiteboardEngine() {
  const scripts=path.join(engine,'scripts');
  fs.mkdirSync(scripts,{recursive:true});
  fs.writeFileSync(path.join(scripts,'render_stream_whiteboard.py'),`import json,subprocess,sys\nann=json.load(open(sys.argv[2]))\nassert ann['elements'][0]['region']['width']==320\nsubprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','color=c=white:s=320x180:r=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p',sys.argv[3]],check=True)\n`);
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
  assert.ok(result.project.scenes[0].takes.voice.length>=1);
  assert.ok(result.project.scenes[0].takes.clip.length>=1);
  const before=result.project.scenes[0].takes.voice.length;
  await runPipeline(project.id,{sceneId:'scene-001',stage:'voice',force:true});
  assert.equal(loadProject(project.id,cfg).scenes[0].takes.voice.length,before+1);
});

test('legacy whiteboard project runs annotation, render, voice mux, and final assembly',async()=>{
  installFakeWhiteboardEngine();
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

test('mixed simple and whiteboard scenes assemble through the existing pipeline',async()=>{
  installFakeWhiteboardEngine();
  process.env.MOCK_MODE='0';
  const cfg=config();
  const project=legacyProject('simple',cfg);
  const first=project.scenes[0];
  first.renderer='simple';
  const second=structuredClone(first);
  second.id='scene-002'; second.index=1; second.renderer='whiteboard';
  second.startMs=first.endMs; second.endMs=second.startMs+second.durationMs;
  second.cache={}; second.artifacts={};
  project.scenes.push(second);
  await seedVisual(project,cfg,first);
  await seedVisual(project,cfg,second);
  const result=await runPipeline(project.id);
  assert.equal(result.project.scenes[0].renderer,'simple');
  assert.equal(result.project.scenes[1].renderer,'whiteboard');
  for(const scene of result.project.scenes) {
    assert.ok(fs.existsSync(path.join(projectDir(cfg,project.id),scene.artifacts.video)));
    assert.ok(fs.existsSync(path.join(projectDir(cfg,project.id),scene.artifacts.clip)));
  }
  assert.ok(fs.existsSync(path.join(sceneDir(cfg,project.id,'scene-002'),'scene-002.annotation.json')));
  assert.ok(fs.existsSync(result.final));
});

test('cinematic B-roll uses local visual media and the existing voice, clip, and final lifecycle',async()=>{
  process.env.MOCK_MODE='0';
  const cfg=config();
  const project=legacyProject('cinematic-broll',cfg);
  project.settings.format='short';project.settings.aspectRatio='9:16';project.settings.width=180;project.settings.height=320;
  project.settings.backgroundMusic='assets/music.wav';
  project.settings.cinematicBroll={musicVolumeDb:-20,subtitleMaxWords:12};
  const scene=project.scenes[0];
  scene.broll='assets/broll.mp4';scene.brollStartMs=100;
  const assets=path.join(projectDir(cfg,project.id),'assets');
  fs.mkdirSync(assets,{recursive:true});
  await run(cfg.ffmpegBin,['-loglevel','error','-y','-f','lavfi','-i','testsrc2=s=320x180:r=10:d=0.3','-c:v','libx264','-pix_fmt','yuv420p',path.join(assets,'broll.mp4')],{capture:true});
  await run(cfg.ffmpegBin,['-loglevel','error','-y','-f','lavfi','-i','sine=frequency=180:duration=0.25','-c:a','pcm_s16le',path.join(assets,'music.wav')],{capture:true});
  saveProject(project,cfg);
  const result=await runPipeline(project.id);
  const rendered=result.project.scenes[0];
  assert.equal(rendered.renderer,undefined);
  assert.ok(rendered.cache.image);
  assert.equal(rendered.artifacts.visual,undefined);
  assert.ok(fs.existsSync(path.join(projectDir(cfg,project.id),rendered.artifacts.voice)));
  assert.ok(fs.existsSync(path.join(projectDir(cfg,project.id),rendered.artifacts.video)));
  const clip=path.join(projectDir(cfg,project.id),rendered.artifacts.clip);
  assert.ok(fs.existsSync(clip));
  assert.deepEqual(await (await import('../packages/core/src/media.mjs')).probeVideoSize(clip,cfg),{width:180,height:320});
  assert.ok(fs.existsSync(result.final));
  const takeCounts=Object.fromEntries(Object.entries(rendered.takes).map(([kind,takes])=>[kind,takes.length]));
  await runPipeline(project.id);
  const cached=loadProject(project.id,cfg).scenes[0];
  for(const [kind,count] of Object.entries(takeCounts))assert.equal(cached.takes[kind].length,count,`${kind} should be cached`);
  const editedProject=loadProject(project.id,cfg);editedProject.scenes[0].brollStartMs=150;saveProject(editedProject,cfg);
  await runPipeline(project.id,{sceneId:scene.id,stage:'clip'});
  const rerendered=loadProject(project.id,cfg).scenes[0];
  assert.equal(rerendered.takes.voice.length,takeCounts.voice);
  assert.equal(rerendered.takes.visual.length,takeCounts.visual);
  assert.equal(rerendered.takes.video.length,takeCounts.video+1);
  assert.equal(rerendered.takes.clip.length,takeCounts.clip+1);
});
