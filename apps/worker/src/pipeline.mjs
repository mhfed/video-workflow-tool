import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../../packages/core/src/env.mjs';
import { loadProject, saveProject, sceneDir, projectDir, updateTimeline } from '../../../packages/core/src/project.mjs';
import { invalidateFinal } from '../../../packages/core/src/invalidation.mjs';
import { sha256, fileExists, ensureDir } from '../../../packages/core/src/utils.mjs';
import { probeDuration } from '../../../packages/core/src/media.mjs';
import { run } from '../../../packages/core/src/process.mjs';
import { generateImageOpenAI } from '../../../packages/providers/src/openai.mjs';
import { synthesizeVoice, voiceCacheConfig } from '../../../packages/providers/src/voice.mjs';
import { renderSimpleScene } from '../../../packages/renderers/src/simple.mjs';
import { renderWhiteboardScene } from '../../../packages/renderers/src/whiteboard.mjs';

function log(event, detail={}) { console.log(JSON.stringify({time:new Date().toISOString(),event,...detail})); }
const effectiveProvider = (configured, cfg) => cfg.mockMode ? 'mock' : configured;

async function ensureVoice(scene, project, cfg, force=false) {
  const dir=ensureDir(sceneDir(cfg,project.id,scene.id));
  const file=path.join(dir,'voice.mp3');
  const provider=effectiveProvider(cfg.voiceProvider,cfg);
  const key=sha256({text:scene.text,provider,...voiceCacheConfig(provider,cfg)});
  if (!force && scene.cache.voice===key && fileExists(file)) return file;
  log('voice:start',{scene:scene.id,provider});
  await synthesizeVoice({provider,text:scene.text,outputFile:file,cfg,durationSec:scene.durationMs/1000});
  scene.durationMs=Math.round((await probeDuration(file,cfg))*1000);
  scene.cache.voice=key; scene.artifacts.voice=path.relative(projectDir(cfg,project.id),file); scene.status='voice-ready';
  saveProject(updateTimeline(project),cfg); log('voice:done',{scene:scene.id,durationMs:scene.durationMs}); return file;
}

async function ensureImage(scene, project, cfg, force=false) {
  const dir=ensureDir(sceneDir(cfg,project.id,scene.id));
  const file=path.join(dir,'visual.png');
  const provider=effectiveProvider(cfg.imageProvider,cfg);
  const key=sha256({prompt:scene.visualPrompt,provider,model:provider==='openai'?cfg.openaiImageModel:null,size:provider==='openai'?cfg.openaiImageSize:null,quality:provider==='openai'?cfg.openaiImageQuality:null});
  if (!force && scene.cache.image===key && (provider==='mock' || fileExists(file))) return provider==='mock' ? null : file;
  if (provider==='mock') { scene.cache.image=key; scene.artifacts.visual=null; saveProject(project,cfg); return null; }
  if (provider!=='openai') throw new Error(`Unsupported IMAGE_PROVIDER=${provider}`);
  log('image:start',{scene:scene.id,provider}); await generateImageOpenAI(scene.visualPrompt,file,cfg);
  scene.cache.image=key; scene.artifacts.visual=path.relative(projectDir(cfg,project.id),file); scene.status='visual-ready'; saveProject(project,cfg); log('image:done',{scene:scene.id}); return file;
}

async function ensureVideo(scene, project, cfg, imageFile, force=false) {
  const dir=ensureDir(sceneDir(cfg,project.id,scene.id));
  const file=path.join(dir,'video.mp4');
  const renderer = project.settings.renderer || cfg.renderer;
  const key=sha256({renderer,durationMs:scene.durationMs,image:scene.cache.image,text:scene.text,width:cfg.width,height:cfg.height,fps:cfg.fps});
  if (!force && scene.cache.video===key && fileExists(file)) return file;
  log('render:start',{scene:scene.id,renderer});
  const args={scene,imageFile,outputFile:file,durationSec:scene.durationMs/1000,cfg};
  if (renderer==='whiteboard') await renderWhiteboardScene(args); else if (renderer==='simple') await renderSimpleScene(args); else throw new Error(`Unsupported VIDEO_RENDERER=${renderer}`);
  scene.cache.video=key; scene.artifacts.video=path.relative(projectDir(cfg,project.id),file); scene.status='rendered'; saveProject(project,cfg); log('render:done',{scene:scene.id}); return file;
}

async function ensureClip(scene, project, cfg, videoFile, voiceFile, force=false) {
  const dir=ensureDir(sceneDir(cfg,project.id,scene.id));
  const file=path.join(dir,'clip.mp4');
  const key=sha256({video:scene.cache.video,voice:scene.cache.voice,width:cfg.width,height:cfg.height,fps:cfg.fps});
  if (!force && scene.cache.clip===key && fileExists(file)) return file;
  const vf=`scale=${cfg.width}:${cfg.height}:force_original_aspect_ratio=increase,crop=${cfg.width}:${cfg.height},format=yuv420p`;
  await run(cfg.ffmpegBin,['-y','-i',videoFile,'-i',voiceFile,'-map','0:v:0','-map','1:a:0','-vf',vf,'-r',String(cfg.fps),'-c:v','libx264','-preset','medium','-crf','18','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',file],{capture:true});
  scene.cache.clip=key; scene.artifacts.clip=path.relative(projectDir(cfg,project.id),file); scene.status='ready'; saveProject(project,cfg); return file;
}

async function concatClips(project,cfg,clips) {
  const outDir=ensureDir(path.join(projectDir(cfg,project.id),'output'));
  const list=path.join(outDir,'concat.txt');
  const final=path.join(outDir,'final.mp4');
  fs.writeFileSync(list,clips.map((f)=>`file '${f.replaceAll("'","'\\''")}'`).join('\n')+'\n');
  await run(cfg.ffmpegBin,['-y','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',final],{capture:true});
  project.artifacts.final=path.relative(projectDir(cfg,project.id),final); project.status='complete'; saveProject(project,cfg); return final;
}

export async function runPipeline(projectId,{force=false,sceneId=null}={}) {
  const cfg=config(); const project=loadProject(projectId,cfg); const clips=[];
  if (sceneId) { invalidateFinal(project); saveProject(project,cfg); }
  for (const scene of project.scenes) {
    if (sceneId && scene.id!==sceneId) { if (scene.artifacts.clip) clips.push(path.join(projectDir(cfg,project.id),scene.artifacts.clip)); continue; }
    const voice=await ensureVoice(scene,project,cfg,force);
    const image=await ensureImage(scene,project,cfg,force);
    const video=await ensureVideo(scene,project,cfg,image,force);
    const clip=await ensureClip(scene,project,cfg,video,voice,force); clips.push(clip);
  }
  if (sceneId) return {project:loadProject(projectId,cfg),final:null};
  const allClips=project.scenes.map((s)=>s.artifacts.clip ? path.join(projectDir(cfg,project.id),s.artifacts.clip) : null);
  if (allClips.some((x)=>!x || !fileExists(x))) throw new Error('Not all scenes have final clips');
  const final=await concatClips(project,cfg,allClips); log('pipeline:complete',{project:project.id,final}); return {project:loadProject(project.id,cfg),final};
}
